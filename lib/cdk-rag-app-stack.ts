import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { AuthorizationStack } from "./authorization"
import { UserInterface } from "./user-interface"
import { ChatBotApi } from "./chatbot-api";

export class RagAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    const userInterface = new UserInterface(this, "UserInterface");

    const authorization = new AuthorizationStack(this, "Authorization", { 
      distributionDomainName: userInterface.cloudfrontDistribution.distributionDomainName
    });

    new ChatBotApi(this, "ChatbotAPI", { 
      httpAuthorizer: authorization.httpAuthorizer, 
      wsAuthorizer: authorization.wsAuthorizer, 
      cloudfrontDistribution: userInterface.cloudfrontDistribution,
      websiteBucket: userInterface.websiteBucket, 
      userPoolID: authorization.userPoolID, 
      userPoolClientID: authorization.userPoolClientID
    });
  }
}
