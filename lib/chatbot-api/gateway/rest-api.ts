import * as path from "path";
import * as cdk from "aws-cdk-lib";

import { Construct } from "constructs";
import { Duration, aws_apigatewayv2 as apigwv2 } from "aws-cdk-lib";

import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as ssm from "aws-cdk-lib/aws-ssm";
// import { Shared } from "../shared";
import * as appsync from "aws-cdk-lib/aws-appsync";
// import { parse } from "graphql";
import { readFileSync } from "fs";
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';

export interface RestBackendAPIProps {
  readonly driveBackfillFunction: lambda.Function;
  readonly driveSyncFunction: lambda.Function;
}

export class RestBackendAPI extends Construct {
  public readonly restAPI: apigwv2.HttpApi;
  public readonly customDomainUrl?: string;
  
  constructor(scope: Construct, id: string, props: RestBackendAPIProps) {
    super(scope, id);

    // Optional: Reference existing custom domain (managed outside CDK)
    // If environment variable is not provided, the default API Gateway endpoint will be used
    const customDomainName = process.env.REST_API_CUSTOM_DOMAIN_NAME;

    let domainName: apigwv2.IDomainName | undefined;
    let disableDefaultEndpoint = false;

    // Only reference existing custom domain if domain name is provided
    if (customDomainName) {
      // Import the existing custom domain by name
      // This looks up the domain that was created outside of CDK
      // We need to provide the regionalDomainName (the API Gateway target) and regionalHostedZoneId
      // These are standard values for API Gateway in us-east-1
      domainName = apigwv2.DomainName.fromDomainNameAttributes(this, 'RestApiCustomDomain', {
        name: customDomainName,
        regionalDomainName: customDomainName, // The custom domain itself
        regionalHostedZoneId: 'Z2FDTNDATAQYW2', // Standard API Gateway v2 hosted zone for us-east-1
      });

      this.customDomainUrl = `https://${customDomainName}`;
      disableDefaultEndpoint = true; // Only disable default endpoint when custom domain is configured

      console.log(`REST API: Using existing custom domain at ${this.customDomainUrl}`);
    } else {
      console.log('REST API: Using default API Gateway endpoint (no custom domain configured)');
    }

    // Create HTTP API
    const httpApi = new apigwv2.HttpApi(this, 'HTTP-API', {
      corsPreflight: {
        allowHeaders: ['*'],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.HEAD,
          apigwv2.CorsHttpMethod.OPTIONS,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.DELETE,
        ],
        allowOrigins: ['*'],
        maxAge: Duration.days(10),
      },
      // Only disable default endpoint if custom domain is configured
      disableExecuteApiEndpoint: disableDefaultEndpoint,
    });
    this.restAPI = httpApi;

    // Create API mapping if custom domain is configured
    if (domainName) {
      new apigwv2.ApiMapping(this, 'RestApiMapping', {
        api: httpApi,
        domainName: domainName,
        stage: httpApi.defaultStage!,
      });
    }
    /*const appSyncLambdaResolver = new lambda.Function(
      this,
      "GraphQLApiHandler",
      {
        code: props.shared.sharedCode.bundleWithLambdaAsset(
          path.join(__dirname, "./functions/api-handler")
        ),
        handler: "index.handler",
        runtime: props.shared.pythonRuntime,
        architecture: props.shared.lambdaArchitecture,
        timeout: cdk.Duration.minutes(10),
        memorySize: 512,
        tracing: lambda.Tracing.ACTIVE,
        logRetention: logs.RetentionDays.ONE_WEEK,        
        environment: {          
        },
      }
    );

    function addPermissions(apiHandler: lambda.Function) {
      if (props.ragEngines?.workspacesTable) {
        props.ragEngines.workspacesTable.grantReadWriteData(apiHandler);
      }

      if (props.ragEngines?.documentsTable) {
        props.ragEngines.documentsTable.grantReadWriteData(apiHandler);
        props.ragEngines?.dataImport.rssIngestorFunction?.grantInvoke(
          apiHandler
        );
      }

      if (props.ragEngines?.auroraPgVector) {
        props.ragEngines.auroraPgVector.database.secret?.grantRead(apiHandler);
        props.ragEngines.auroraPgVector.database.connections.allowDefaultPortFrom(
          apiHandler
        );

        props.ragEngines.auroraPgVector.createAuroraWorkspaceWorkflow.grantStartExecution(
          apiHandler
        );
      }

      if (props.ragEngines?.openSearchVector) {
        apiHandler.addToRolePolicy(
          new iam.PolicyStatement({
            actions: ["aoss:APIAccessAll"],
            resources: [
              props.ragEngines?.openSearchVector.openSearchCollection.attrArn,
            ],
          })
        );

        props.ragEngines.openSearchVector.createOpenSearchWorkspaceWorkflow.grantStartExecution(
          apiHandler
        );
      }

      if (props.ragEngines?.kendraRetrieval) {
        props.ragEngines.kendraRetrieval.createKendraWorkspaceWorkflow.grantStartExecution(
          apiHandler
        );

        props.ragEngines?.kendraRetrieval?.kendraS3DataSourceBucket?.grantReadWrite(
          apiHandler
        );

        if (props.ragEngines.kendraRetrieval.kendraIndex) {
          apiHandler.addToRolePolicy(
            new iam.PolicyStatement({
              actions: [
                "kendra:Retrieve",
                "kendra:Query",
                "kendra:BatchDeleteDocument",
                "kendra:BatchPutDocument",
                "kendra:StartDataSourceSyncJob",
                "kendra:DescribeDataSourceSyncJob",
                "kendra:StopDataSourceSyncJob",
                "kendra:ListDataSourceSyncJobs",
                "kendra:ListDataSources",
                "kendra:DescribeIndex",
              ],
              resources: [
                props.ragEngines.kendraRetrieval.kendraIndex.attrArn,
                `${props.ragEngines.kendraRetrieval.kendraIndex.attrArn}/*`,
              ],
            })
          );
        }

        for (const item of props.config.rag.engines.kendra.external ?? []) {
          if (item.roleArn) {
            apiHandler.addToRolePolicy(
              new iam.PolicyStatement({
                actions: ["sts:AssumeRole"],
                resources: [item.roleArn],
              })
            );
          } else {
            apiHandler.addToRolePolicy(
              new iam.PolicyStatement({
                actions: ["kendra:Retrieve", "kendra:Query"],
                resources: [
                  `arn:${cdk.Aws.PARTITION}:kendra:${
                    item.region ?? cdk.Aws.REGION
                  }:${cdk.Aws.ACCOUNT_ID}:index/${item.kendraId}`,
                ],
              })
            );
          }
        }
      }

      if (props.ragEngines?.fileImportWorkflow) {
        props.ragEngines.fileImportWorkflow.grantStartExecution(apiHandler);
      }

      if (props.ragEngines?.websiteCrawlingWorkflow) {
        props.ragEngines.websiteCrawlingWorkflow.grantStartExecution(
          apiHandler
        );
      }

      if (props.ragEngines?.deleteWorkspaceWorkflow) {
        props.ragEngines.deleteWorkspaceWorkflow.grantStartExecution(
          apiHandler
        );
      }

      if (props.ragEngines?.sageMakerRagModels) {
        apiHandler.addToRolePolicy(
          new iam.PolicyStatement({
            actions: ["sagemaker:InvokeEndpoint"],
            resources: [props.ragEngines.sageMakerRagModels.model.endpoint.ref],
          })
        );
      }

      for (const model of props.models) {
        apiHandler.addToRolePolicy(
          new iam.PolicyStatement({
            actions: ["sagemaker:InvokeEndpoint"],
            resources: [model.endpoint.ref],
          })
        );
      }

      apiHandler.addToRolePolicy(
        new iam.PolicyStatement({
          actions: [
            "comprehend:DetectDominantLanguage",
            "comprehend:DetectSentiment",
          ],
          resources: ["*"],
        })
      );

      props.shared.xOriginVerifySecret.grantRead(apiHandler);
      props.shared.apiKeysSecret.grantRead(apiHandler);
      props.shared.configParameter.grantRead(apiHandler);
      props.modelsParameter.grantRead(apiHandler);
      props.sessionsTable.grantReadWriteData(apiHandler);
      props.userFeedbackBucket.grantReadWrite(apiHandler);
      props.ragEngines?.uploadBucket.grantReadWrite(apiHandler);
      props.ragEngines?.processingBucket.grantReadWrite(apiHandler);

      if (props.config.bedrock?.enabled) {
        apiHandler.addToRolePolicy(
          new iam.PolicyStatement({
            actions: [
              "bedrock:ListFoundationModels",
              "bedrock:ListCustomModels",
              "bedrock:InvokeModel",
              "bedrock:InvokeModelWithResponseStream",
            ],
            resources: ["*"],
          })
        );

        if (props.config.bedrock?.roleArn) {
          apiHandler.addToRolePolicy(
            new iam.PolicyStatement({
              actions: ["sts:AssumeRole"],
              resources: [props.config.bedrock.roleArn],
            })
          );
        }
      }
    }

    addPermissions(appSyncLambdaResolver);*/

    // Add Drive sync routes
    new apigwv2.HttpRoute(this, 'DriveBackfillRoute', {
      httpApi: httpApi,
      integration: new HttpLambdaIntegration(
        'DriveBackfillIntegration',
        props.driveBackfillFunction
      ),
      routeKey: apigwv2.HttpRouteKey.with('/drive/backfill', apigwv2.HttpMethod.POST)
    });

    new apigwv2.HttpRoute(this, 'DriveSyncRoute', {
      httpApi: httpApi,
      integration: new HttpLambdaIntegration(
        'DriveSyncIntegration',
        props.driveSyncFunction
      ),
      routeKey: apigwv2.HttpRouteKey.with('/drive/sync', apigwv2.HttpMethod.POST)
    });
  }
}
