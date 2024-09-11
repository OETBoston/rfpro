import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { AuthorizationStack } from "./authorization"
import { UserInterface } from "./user-interface"
import { ChatBotApi } from "./chatbot-api";

export class RagAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const authentication = new AuthorizationStack(this, "Authorization")
    const chatbotAPI = new ChatBotApi(this, "ChatbotAPI", {authentication});
    const userInterface = new UserInterface(this, "UserInterface",
     {userPoolId : authentication.userPool.userPoolId,
      userPoolClientId : authentication.userPoolClient.userPoolClientId,
      cognitoDomain: process.env.COGNITO_DOMAIN_PREFIX!,
      api : chatbotAPI
    })
    
  }
}
