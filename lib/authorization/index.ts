import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { UserPool, UserPoolIdentityProviderOidc, UserPoolClient, UserPoolClientIdentityProvider, ProviderAttribute } from 'aws-cdk-lib/aws-cognito';
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';

export class AuthorizationStack extends Construct {
  public readonly lambdaAuthorizer : lambda.Function;
  public readonly userPool : UserPool;
  public readonly userPoolClient : UserPoolClient;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id);

    // Create the Cognito User Pool
    const userPool = new UserPool(this, 'UserPool', {      
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      selfSignUpEnabled: false,
      mfa: cognito.Mfa.OPTIONAL,
      advancedSecurityMode: cognito.AdvancedSecurityMode.ENFORCED,
      autoVerify: { email: true, phone: true },
      signInAliases: {
        email: true,
      },
      customAttributes : {
        'role' : new cognito.StringAttribute({ minLen: 0, maxLen: 30, mutable: true })
      }
      // ... other user pool configurations
    });
    this.userPool = userPool;

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
    
    
    // Add the OIDC identity provider to the User Pool
    const oidcProvider = new cognito.UserPoolIdentityProviderOidc(this, 
      'bostonOIDCProvider', {
        name: process.env.COGNITO_OIDC_PROVIDER_NAME!,
      userPool: userPool,
        clientId: process.env.COGNITO_OIDC_PROVIDER_CLIENT_ID!,
        clientSecret: process.env.COGNITO_OIDC_PROVIDER_CLIENT_SECRET!,
        issuerUrl: process.env.COGNITO_OIDC_PROVIDER_ISSUER_URL!,
      attributeMapping: {
        custom: {
          username: ProviderAttribute.other('sub')
        }
      },
      endpoints: {
        authorization: process.env.COGNITO_OIDC_PROVIDER_AUTHORIZATION_ENDPOINT!,
        jwksUri: process.env.COGNITO_OIDC_PROVIDER_JWKS_URI!,
        token: process.env.COGNITO_OIDC_PROVIDER_TOKEN_ENDPOINT!,
        userInfo: process.env.COGNITO_OIDC_PROVIDER_USER_INFO_ENDPOINT!,
      }
    });

    const userPoolClient = new UserPoolClient(this, 'userPoolClient', {
      userPool,      
      supportedIdentityProviders: [UserPoolClientIdentityProvider.custom(oidcProvider.providerName)],
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true
        },
        callbackUrls: process.env.COGNITO_USER_POOL_CLIENT_CALLBACK_URL ? [process.env.COGNITO_USER_POOL_CLIENT_CALLBACK_URL] : [],
        logoutUrls: process.env.COGNITO_USER_POOL_CLIENT_LOGOUT_URL ? [process.env.COGNITO_USER_POOL_CLIENT_LOGOUT_URL] : [],
      },
    });

    this.userPoolClient = userPoolClient;

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

    this.lambdaAuthorizer = authorizerHandlerFunction;
    
    new cdk.CfnOutput(this, "UserPool ID", {
      value: userPool.userPoolId || "",
    });

    new cdk.CfnOutput(this, "UserPool Client ID", {
      value: userPoolClient.userPoolClientId || "",
    });    
  }
}
