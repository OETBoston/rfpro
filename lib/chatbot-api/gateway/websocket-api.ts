import * as cdk from "aws-cdk-lib";
import { aws_apigatewayv2 as apigwv2 } from "aws-cdk-lib";
import { Construct } from "constructs";

// import { NagSuppressions } from "cdk-nag";

interface WebsocketBackendAPIProps {  
  // readonly userPool: UserPool;
  // readonly api: appsync.GraphqlApi;
}

export class WebsocketBackendAPI extends Construct {
  public readonly wsAPI : apigwv2.WebSocketApi;
  public readonly wsAPIStage : apigwv2.WebSocketStage;
  public readonly customDomainUrl?: string;
  public readonly callbackEndpoint: string; // For Lambda to send messages back
  
  constructor(
    scope: Construct,
    id: string,
    props: WebsocketBackendAPIProps
  ) {
    super(scope, id);
    
    // NOTE: WebSocket APIs do NOT support mutual TLS in AWS API Gateway
    // We can only use custom domains with standard TLS for WebSocket APIs
    // mTLS is only available for HTTP APIs (REST API)

    // Optional: Reference existing custom domain (managed outside CDK)
    const customDomainName = process.env.WS_API_CUSTOM_DOMAIN_NAME;

    let domainName: apigwv2.IDomainName | undefined;

    // Only reference existing custom domain if domain name is provided
    if (customDomainName) {
      // Import the existing custom domain by name
      // This looks up the domain that was created outside of CDK
      // Note: We use the custom domain name itself as the regionalDomainName because
      // DNS aliases allow Lambda to use the custom domain directly for callbacks
      domainName = apigwv2.DomainName.fromDomainNameAttributes(this, 'WsApiCustomDomain', {
        name: customDomainName,
        regionalDomainName: customDomainName, // Custom domain resolves via DNS alias
        regionalHostedZoneId: 'Z2FDTNDATAQYW2', // Standard API Gateway v2 hosted zone for us-east-1
      });

      this.customDomainUrl = `wss://${customDomainName}`;

      console.log(`WebSocket API: Using existing custom domain at ${this.customDomainUrl}`);
    } else {
      console.log('WebSocket API: Using default API Gateway endpoint (no custom domain configured)');
    }
    
    // Create WebSocket API
    const webSocketApi = new apigwv2.WebSocketApi(this, 'WS-API');
    
    // Disable default endpoint if using custom domain (so API can only be accessed via custom domain)
    if (customDomainName) {
      const cfnWebSocketApi = webSocketApi.node.defaultChild as cdk.aws_apigatewayv2.CfnApi;
      cfnWebSocketApi.disableExecuteApiEndpoint = true;
    }
    
    const webSocketApiStage = new apigwv2.WebSocketStage(this, 'WS-API-prod', {
      webSocketApi,
      stageName: 'prod',
      autoDeploy: true,
    });
    
    this.wsAPI = webSocketApi;
    this.wsAPIStage = webSocketApiStage;

    // Determine the callback endpoint for Lambda to use
    // If custom domain is configured, Lambda can use it directly (DNS alias resolves to regional endpoint)
    // Note: Custom domain API mappings already include the stage, so we DON'T append /prod
    // Otherwise, use the default API endpoint which includes the stage
    if (customDomainName) {
      this.callbackEndpoint = `https://${customDomainName}`;
    } else {
      this.callbackEndpoint = webSocketApiStage.url.replace('wss:', 'https:');
    }

    // Create API mapping if custom domain is configured
    if (domainName) {
      new apigwv2.ApiMapping(this, 'WsApiMapping', {
        api: webSocketApi,
        domainName: domainName,
        stage: webSocketApiStage,
      });
    }
    
  }

}
