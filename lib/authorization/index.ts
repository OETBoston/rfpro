import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { UserPool, UserPoolIdentityProviderOidc, UserPoolClient, UserPoolClientIdentityProvider, ProviderAttribute } from 'aws-cdk-lib/aws-cognito';
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { WebSocketLambdaAuthorizer, HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as path from 'path';

export interface AuthorizationProps {
  readonly distributionDomainName: string;
}

export class AuthorizationStack extends Construct {
  public readonly httpAuthorizer: HttpJwtAuthorizer;
  public readonly wsAuthorizer: WebSocketLambdaAuthorizer;
  public readonly userPoolID: string;
  public readonly userPoolClientID: string;
  public readonly authenticatedRoleArn: string;
  public readonly identityPoolID: string;

  constructor(scope: Construct, id: string, props: AuthorizationProps) {
    super(scope, id);

    // Create the Cognito User Pool
    const userPool = new UserPool(this, 'UserPool', {      
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      selfSignUpEnabled: false,
      mfa: cognito.Mfa.OPTIONAL,
      // advancedSecurityMode: cognito.AdvancedSecurityMode.ENFORCED,
      autoVerify: { email: true, phone: true },
      signInAliases: {
        email: true,
      },
      customAttributes : {
        'role' : new cognito.StringAttribute({ minLen: 0, maxLen: 30, mutable: true })
      }
      // ... other user pool configurations
    });

    // Create 2 
    const userPoolBasicGroup = new cognito.CfnUserPoolGroup(this, 'BasicUserGroup', {
      groupName: 'BasicUsers',
      userPoolId: userPool.userPoolId
    });

    const userPoolAdminGroup = new cognito.CfnUserPoolGroup(this, 'AdminUserGroup', {
      groupName: 'AdminUsers',
      userPoolId: userPool.userPoolId
    });

    const userPoolOutsideGroup = new cognito.CfnUserPoolGroup(this, 'OutsideUserGroup', {
      groupName: 'OutsideUsers',
      userPoolId: userPool.userPoolId
    });

    const addUserToGroupLambda = new lambda.Function(this, 'AddUserToGroupLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, "user-group-handler")),
      environment: {
        BASIC_USER_GROUP_NAME: userPoolBasicGroup.groupName!,
        OUTSIDE_USER_GROUP_NAME: userPoolOutsideGroup.groupName!
      }
    });

    // Grant the Lambda function permission to add users to groups
    addUserToGroupLambda.role!.attachInlinePolicy(
      new iam.Policy(this, "UserGroupPolicy", {
        statements: [
          new iam.PolicyStatement({
            actions: ['cognito-idp:AdminAddUserToGroup'],
            resources: [userPool.userPoolArn],
          })
        ]
      }
    ));

    userPool.addTrigger(
      cognito.UserPoolOperation.POST_AUTHENTICATION,
      addUserToGroupLambda
    )

    userPool.addTrigger(
      cognito.UserPoolOperation.POST_CONFIRMATION,
      addUserToGroupLambda
    )

    // Create a provider attribute for mapping Azure claims
    // const providerAttribute = new ProviderAttribute({
    //   name: 'custom_attr',
    //   type: 'String',
    // });
    userPool.addDomain('CognitoDomain', {
      cognitoDomain: {
        domainPrefix: process.env.COGNITO_DOMAIN_PREFIX!,
      },
    });

    // When testing, add a conditional check for completeness for all 
    // the below credentials, use:
    // cognito.UserPoolClientIdentityProvider.COGNITO
    
    // Add the OIDC identity provider to the User Pool
    // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cognito.UserPoolIdentityProviderOidc.html
    const oidcProvider = new UserPoolIdentityProviderOidc(this, 
      'bostonOIDCProvider', {
        name: process.env.COGNITO_OIDC_PROVIDER_NAME!,
        userPool: userPool,
        clientId: process.env.COGNITO_OIDC_PROVIDER_CLIENT_ID!,
        clientSecret: process.env.COGNITO_OIDC_PROVIDER_CLIENT_SECRET!,
        issuerUrl: process.env.COGNITO_OIDC_PROVIDER_ISSUER_URL!,
        endpoints: {
          authorization: process.env.COGNITO_OIDC_PROVIDER_AUTHORIZATION_ENDPOINT!,
          jwksUri: process.env.COGNITO_OIDC_PROVIDER_JWKS_URI!,
          token: process.env.COGNITO_OIDC_PROVIDER_TOKEN_ENDPOINT!,
          userInfo: process.env.COGNITO_OIDC_PROVIDER_USER_INFO_ENDPOINT!,
        }
      }
    );

    const userPoolClient = new UserPoolClient(this, 'userPoolClient', {
      userPool,      
      supportedIdentityProviders: [
        // Use this to bypass SSO, you have to register users within the cognito user pool
        // cognito.UserPoolClientIdentityProvider.COGNITO
        // Also the callbarck URLs need to be tested, this seems to be blocking
        UserPoolClientIdentityProvider.custom(oidcProvider.providerName)
      ],
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true
        },
        callbackUrls: ["https://" + (process.env.CLOUDFRONT_CUSTOM_DOMAIN_URL ? process.env.CLOUDFRONT_CUSTOM_DOMAIN_URL : props.distributionDomainName)],
        logoutUrls: [process.env.COGNITO_USER_POOL_CLIENT_LOGOUT_URL!],
      },
    });

    this.userPoolID = userPool.userPoolId;
    this.userPoolClientID = userPoolClient.userPoolClientId;

    const authorizerHandlerFunction = new lambda.Function(this, 'AuthorizationFunction', {
      runtime: lambda.Runtime.PYTHON_3_12, // Choose any supported Node.js runtime
      code: lambda.Code.fromAsset(path.join(__dirname, 'websocket-api-authorizer')), // Points to the lambda directory
      handler: 'lambda_function.lambda_handler', // Points to the 'hello' file in the lambda directory
      environment: {
        "USER_POOL_ID" : userPool.userPoolId,
        "APP_CLIENT_ID" : userPoolClient.userPoolClientId
      },
      timeout: cdk.Duration.seconds(30)
    });

    this.httpAuthorizer = new HttpJwtAuthorizer('HTTPAuthorizer', userPool.userPoolProviderUrl, {
      jwtAudience: [userPoolClient.userPoolClientId],
    })

    this.wsAuthorizer = new WebSocketLambdaAuthorizer('WebSocketAuthorizer', authorizerHandlerFunction, { 
      identitySource: ['route.request.querystring.Authorization'] 
    });
    
    new cdk.CfnOutput(this, "UserPool ID", {
      value: userPool.userPoolId || "",
    });

    new cdk.CfnOutput(this, "UserPool Client ID", {
      value: userPoolClient.userPoolClientId || "",
    });
  }
}
