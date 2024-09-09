import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { cognitoDomainName } from '../constants' 
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

    // Replace these values with your Azure client ID, client secret, and issuer URL
    // const azureClientId = 'your-azure-client-id';
    // const azureClientSecret = 'your-azure-client-secret';
    // const azureIssuerUrl = 'https://your-azure-issuer.com';

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
        domainPrefix: cognitoDomainName,
      },
    });
    
    
    // Add the Azure OIDC identity provider to the User Pool
    const oidcProvider = new cognito.UserPoolIdentityProviderOidc(this, 
      'bostonOIDCProvider', {
      name: 'Boston',
      userPool: userPool,
      clientId: 'AI-Aided_Test',
      clientSecret: 'FOZyPWbVY4poV7itrnDc2LiSOR5TnRkyxM149B4thFkkTOGvEZ64jzl8DHWxggLU',
      issuerUrl: 'https://sso-test.boston.gov',
      attributeMapping: {
        custom: {
          username: ProviderAttribute.other('sub')
        }
      },
      endpoints: {
        authorization: 'https://sso-test.boston.gov/as/authorization.oauth2',
        jwksUri: 'https://sso-test.boston.gov/pf/JWKS',
        token: 'https://sso-test.boston.gov/as/token.oauth2',
        userInfo: 'https://sso-test.boston.gov/idp/userinfo.openid',
      }
    });

    const userPoolClient = new UserPoolClient(this, 'userPoolClient', {
      userPool,      
      supportedIdentityProviders: [UserPoolClientIdentityProvider.custom(oidcProvider.providerName)],
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
