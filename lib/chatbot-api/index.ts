import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as cdk from "aws-cdk-lib";

import { WebsocketBackendAPI } from "./gateway/websocket-api"
import { RestBackendAPI } from "./gateway/rest-api"
import { LambdaFunctionStack } from "./functions/functions"
import { TableStack } from "./tables/tables"
import { KendraIndexStack } from "./kendra/kendra"
import { S3BucketStack } from "./buckets/buckets"

import { WebSocketLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { WebSocketLambdaAuthorizer, HttpJwtAuthorizer  } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { aws_apigatewayv2 as apigwv2 } from "aws-cdk-lib";
import { Construct } from "constructs";
import { readFile } from 'fs/promises';
import { CloudFrontWebDistribution, Distribution } from "aws-cdk-lib/aws-cloudfront";
import { Role } from "aws-cdk-lib/aws-iam";

export interface ChatBotApiProps {
  readonly cloudfrontDistribution: CloudFrontWebDistribution;
  readonly httpAuthorizer: HttpJwtAuthorizer;
  readonly wsAuthorizer: WebSocketLambdaAuthorizer;
  readonly websiteBucket: s3.Bucket;
  readonly userPoolID: string;
  readonly userPoolClientID: string;
}

export class ChatBotApi extends Construct {
  constructor(scope: Construct, id: string, props: ChatBotApiProps) {
    super(scope, id);

    const tables = new TableStack(this, "TableStack");
    const buckets = new S3BucketStack(this, "BucketStack");
    const kendra = new KendraIndexStack(this, "KendraStack", { s3Bucket: buckets.kendraBucket });

    const restBackend = new RestBackendAPI(this, "RestBackend", {})
    const websocketBackend = new WebsocketBackendAPI(this, "WebsocketBackend", {})

    const lambdaFunctions = new LambdaFunctionStack(this, "LambdaFunctions",
      {
        wsApiEndpoint: websocketBackend.wsAPIStage.url,
        sessionsTable: tables.sessionsTable,
        messagesTable: tables.messagesTable,
        reviewsTable: tables.reviewsTable,
        kendraIndex: kendra.kendraIndex,
        kendraSource: kendra.kendraSource,
        feedbackBucket: buckets.feedbackBucket,
        knowledgeBucket: buckets.kendraBucket,
      }
    )

    websocketBackend.wsAPI.addRoute('getChatbotResponse', {
      integration: new WebSocketLambdaIntegration('chatbotResponseIntegration', lambdaFunctions.chatFunction),
    });
    websocketBackend.wsAPI.addRoute('$connect', {
      integration: new WebSocketLambdaIntegration('chatbotConnectionIntegration', lambdaFunctions.chatFunction),
      authorizer: props.wsAuthorizer
    });
    websocketBackend.wsAPI.addRoute('$default', {
      integration: new WebSocketLambdaIntegration('chatbotConnectionIntegration', lambdaFunctions.chatFunction),
    });
    websocketBackend.wsAPI.addRoute('$disconnect', {
      integration: new WebSocketLambdaIntegration('chatbotDisconnectionIntegration', lambdaFunctions.chatFunction),
    });
    websocketBackend.wsAPI.addRoute('generateEmail', {
      integration: new WebSocketLambdaIntegration('emailIntegration', lambdaFunctions.chatFunction),
    });

    websocketBackend.wsAPI.grantManageConnections(lambdaFunctions.chatFunction);

    const sessionAPIIntegration = new HttpLambdaIntegration('SessionAPIIntegration', lambdaFunctions.sessionFunction);
    restBackend.restAPI.addRoutes({
      path: "/user-session",
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST, apigwv2.HttpMethod.DELETE],
      integration: sessionAPIIntegration,
      authorizer: props.httpAuthorizer,
    })

    // SESSION_HANDLER
    // lambdaFunctions.chatFunction.addEnvironment(
    //   "mvp_user_session_handler_api_gateway_endpoint", restBackend.restAPI.apiEndpoint + "/user-session")
    lambdaFunctions.chatFunction.addEnvironment(
      "SESSION_HANDLER", lambdaFunctions.sessionFunction.functionName)
    

    const feedbackAPIIntegration = new HttpLambdaIntegration('FeedbackAPIIntegration', lambdaFunctions.feedbackFunction);
    restBackend.restAPI.addRoutes({
      path: "/user-feedback",
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST, apigwv2.HttpMethod.DELETE],
      integration: feedbackAPIIntegration,
      authorizer: props.httpAuthorizer,
    })

    const feedbackAPIDownloadIntegration = new HttpLambdaIntegration('FeedbackDownloadAPIIntegration', lambdaFunctions.feedbackFunction);
    restBackend.restAPI.addRoutes({
      path: "/user-feedback/download-feedback",
      methods: [apigwv2.HttpMethod.POST],
      integration: feedbackAPIDownloadIntegration,
      authorizer: props.httpAuthorizer,
    })

    const s3GetAPIIntegration = new HttpLambdaIntegration('S3GetAPIIntegration', lambdaFunctions.getS3Function);
    restBackend.restAPI.addRoutes({
      path: "/s3-bucket-data",
      methods: [apigwv2.HttpMethod.POST],
      integration: s3GetAPIIntegration,
      authorizer: props.httpAuthorizer,
    })

    const s3DeleteAPIIntegration = new HttpLambdaIntegration('S3DeleteAPIIntegration', lambdaFunctions.deleteS3Function);
    restBackend.restAPI.addRoutes({
      path: "/delete-s3-file",
      methods: [apigwv2.HttpMethod.POST],
      integration: s3DeleteAPIIntegration,
      authorizer: props.httpAuthorizer,
    })

    const s3UploadAPIIntegration = new HttpLambdaIntegration('S3UploadAPIIntegration', lambdaFunctions.uploadS3Function);
    restBackend.restAPI.addRoutes({
      path: "/signed-url",
      methods: [apigwv2.HttpMethod.POST],
      integration: s3UploadAPIIntegration,
      authorizer: props.httpAuthorizer,
    })

    const kendraSyncProgressAPIIntegration = new HttpLambdaIntegration('KendraSyncAPIIntegration', lambdaFunctions.syncKendraFunction);
    restBackend.restAPI.addRoutes({
      path: "/kendra-sync/still-syncing",
      methods: [apigwv2.HttpMethod.GET],
      integration: kendraSyncProgressAPIIntegration,
      authorizer: props.httpAuthorizer,
    })

    const kendraSyncAPIIntegration = new HttpLambdaIntegration('KendraSyncAPIIntegration', lambdaFunctions.syncKendraFunction);
    restBackend.restAPI.addRoutes({
      path: "/kendra-sync/sync-kendra",
      methods: [apigwv2.HttpMethod.GET],
      integration: kendraSyncAPIIntegration,
      authorizer: props.httpAuthorizer,
    })
    
    const kendraLastSyncAPIIntegration = new HttpLambdaIntegration('KendraLastSyncAPIIntegration', lambdaFunctions.syncKendraFunction);
    restBackend.restAPI.addRoutes({
      path: "/kendra-sync/get-last-sync",
      methods: [apigwv2.HttpMethod.GET],
      integration: kendraLastSyncAPIIntegration,
      authorizer: props.httpAuthorizer,
    })

    new cdk.CfnOutput(this, "WS-API - apiEndpoint", {
      value: websocketBackend.wsAPI.apiEndpoint || "",
    });
    new cdk.CfnOutput(this, "HTTP-API - apiEndpoint", {
      value: restBackend.restAPI.apiEndpoint || "",
    });

    const promptDataBucket = new s3.Bucket(this, "PromptDataBucket", {
      bucketName: process.env.CDK_STACK_NAME!.toLowerCase() + "-prompt-data-bucket",
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      enforceSSL: true,
    });

    readFile('./system-prompt.txt', 'utf8').then(systemPrompt => 
      new s3deploy.BucketDeployment(this, 'SystemPromptDeployment', {
      sources: [s3deploy.Source.data('system-prompt.txt', systemPrompt)],
      destinationBucket: promptDataBucket,
    }))

    const exportsAsset = s3deploy.Source.jsonData("aws-exports.json", {
      Auth: {
        region: cdk.Aws.REGION,
        userPoolId: props.userPoolID,
        userPoolWebClientId: props.userPoolClientID,
        oauth: {
          domain: process.env.COGNITO_DOMAIN_PREFIX!.concat(".auth.", cdk.Aws.REGION ,".amazoncognito.com"),
          scope: ["aws.cognito.signin.user.admin", "email", "openid", "profile"],
          redirectSignIn: "https://" + (process.env.CLOUDFRONT_CUSTOM_DOMAIN_URL ? process.env.CLOUDFRONT_CUSTOM_DOMAIN_URL : props.cloudfrontDistribution.distributionDomainName),
          redirectSignOut: process.env.COGNITO_USER_POOL_CLIENT_LOGOUT_URL!,
          responseType: "code"
        }
      },
      httpEndpoint: restBackend.restAPI.url,
      wsEndpoint: websocketBackend.wsAPIStage.url,
      federatedSignInProvider: process.env.COGNITO_OIDC_PROVIDER_NAME!
    });

    // Deploy the new file to the existing bucket
    new s3deploy.BucketDeployment(this, 'DeployAwsExports', {
      prune: false,
      retainOnDelete: false,
      sources: [exportsAsset],
      destinationBucket: props.websiteBucket,
      distribution: props.cloudfrontDistribution
    });
  }
}
