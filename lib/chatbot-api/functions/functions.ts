import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';

// Import Lambda L2 construct
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from "aws-cdk-lib/aws-s3";
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as bedrock from "aws-cdk-lib/aws-bedrock";
import { S3EventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { StepFunctionsStack } from './step-functions/step-functions';


interface LambdaFunctionStackProps {  
  readonly wsApiEndpoint : string;
  readonly sessionsTable: Table,
  readonly messagesTable: Table,
  readonly reviewsTable: Table,
  readonly downloadBucket : s3.Bucket;
  readonly driveSyncBucket : s3.Bucket;
  readonly knowledgeBucket : s3.Bucket;
  readonly knowledgeBase : bedrock.CfnKnowledgeBase;
  readonly knowledgeBaseSource: bedrock.CfnDataSource;
  readonly evalSummariesTable : Table;
  readonly evalResutlsTable : Table;
  readonly evalTestCasesBucket : s3.Bucket;
  readonly evalResultsBucket : s3.Bucket;
}

export class LambdaFunctionStack extends cdk.Stack {  
  public readonly chatFunction : lambda.Function;
  public readonly sessionFunction : lambda.Function;
  public readonly feedbackFunction : lambda.Function;
  public readonly deleteS3Function : lambda.Function;
  public readonly getS3Function : lambda.Function;
  public readonly uploadS3Function : lambda.Function;
  public readonly syncKBFunction : lambda.Function;
  public readonly driveBackfillFunction : lambda.Function;
  public readonly driveSyncFunction : lambda.Function;
  public readonly stepFunctionsStack : StepFunctionsStack;
  public readonly getS3TestCasesFunction : lambda.Function;
  public readonly uploadS3TestCasesFunction : lambda.Function;
  public readonly handleEvalResultsFunction : lambda.Function;
  public readonly metricsHandlerFunction : lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaFunctionStackProps) {
    super(scope, id);    

    const sessionAPIHandlerFunction = new lambda.Function(scope, 'SessionHandlerFunction', {
      runtime: lambda.Runtime.PYTHON_3_12, // Choose any supported Node.js runtime
      code: lambda.Code.fromAsset(path.join(__dirname, 'session-handler')), // Points to the lambda directory
      handler: 'lambda_function.lambda_handler', // Points to the 'hello' file in the lambda directory
      environment: {
        "SESSION_TABLE" : props.sessionsTable.tableName,
        "MESSAGES_TABLE": props.messagesTable.tableName,
        "REVIEW_TABLE": props.reviewsTable.tableName,
        "SESSION_S3_DOWNLOAD" : props.downloadBucket.bucketName
      },
      timeout: cdk.Duration.seconds(900),
      memorySize: 256
    });

    sessionAPIHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:*'
      ],
      resources: [props.downloadBucket.bucketArn,props.downloadBucket.bucketArn+"/*"]
    }));
    
    sessionAPIHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:Query',
        'dynamodb:Scan',
        'dynamodb:BatchWriteItem'
      ],
      resources: [
        props.sessionsTable.tableArn, 
        props.sessionsTable.tableArn + "/index/*",
        props.messagesTable.tableArn, 
        props.messagesTable.tableArn + "/index/*",
        props.reviewsTable.tableArn, 
        props.reviewsTable.tableArn + "/index/*",
      ]
    }));

    this.sessionFunction = sessionAPIHandlerFunction;

    // Define the Lambda function resource
    const websocketAPIFunction = new lambda.Function(scope, 'ChatHandlerFunction', {
      runtime: lambda.Runtime.NODEJS_20_X, // Choose any supported Node.js runtime
      code: lambda.Code.fromAsset(path.join(__dirname, 'websocket-chat')), // Points to the lambda directory
      handler: 'index.handler', // Points to the 'hello' file in the lambda directory
      environment : {
        // wsApiEndpoint is already in https format (not wss) for ApiGatewayManagementApiClient
        "WEBSOCKET_API_ENDPOINT" : props.wsApiEndpoint,
        "KB_ID" : props.knowledgeBase.attrKnowledgeBaseId,
        "PROMPT_DATA_BUCKET_NAME": process.env.CDK_STACK_NAME!.toLowerCase() + "-prompt-data-bucket"},
      timeout: cdk.Duration.seconds(900),
      memorySize: 256
    });
    websocketAPIFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModelWithResponseStream',
        'bedrock:InvokeModel'
      ],
      resources: ["*"]
    }));
    websocketAPIFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:Retrieve'
      ],
      resources: [props.knowledgeBase.attrKnowledgeBaseArn]
    }));

    websocketAPIFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetObject'
      ],
      resources: [props.knowledgeBucket.bucketArn + '/*']
    }));

    websocketAPIFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetObject'
      ],
      resources: ['arn:aws:s3:::' + process.env.CDK_STACK_NAME!.toLowerCase() + "-prompt-data-bucket" + '/*']
    }));

    websocketAPIFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'lambda:InvokeFunction'
      ],
      resources: [this.sessionFunction.functionArn]
    }));
    this.chatFunction = websocketAPIFunction;

    const feedbackAPIHandlerFunction = new lambda.Function(scope, 'FeedbackHandlerFunction', {
      runtime: lambda.Runtime.PYTHON_3_12, // Choose any supported Node.js runtime
      code: lambda.Code.fromAsset(path.join(__dirname, 'feedback-handler')), // Points to the lambda directory
      handler: 'lambda_function.lambda_handler', // Points to the 'hello' file in the lambda directory
      environment: {
        "FEEDBACK_TABLE" : props.messagesTable.tableName,
        "FEEDBACK_S3_DOWNLOAD" : props.downloadBucket.bucketName
      },
      timeout: cdk.Duration.seconds(30)
    });
    feedbackAPIHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:Query',
        'dynamodb:Scan'
      ],
      resources: [props.messagesTable.tableArn, props.messagesTable.tableArn + "/index/*"]
    }));

    feedbackAPIHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:*'
      ],
      resources: [props.downloadBucket.bucketArn,props.downloadBucket.bucketArn+"/*"]
    }));

    this.feedbackFunction = feedbackAPIHandlerFunction;
    
    const deleteS3APIHandlerFunction = new lambda.Function(scope, 'DeleteS3FilesHandlerFunction', {
      runtime: lambda.Runtime.PYTHON_3_12, // Choose any supported Node.js runtime
      code: lambda.Code.fromAsset(path.join(__dirname, 'knowledge-management/delete-s3')), // Points to the lambda directory
      handler: 'lambda_function.lambda_handler', // Points to the 'hello' file in the lambda directory
      environment: {
        "BUCKET" : props.knowledgeBucket.bucketName,        
      },
      timeout: cdk.Duration.seconds(30)
    });

    deleteS3APIHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:*'
      ],
      resources: [props.knowledgeBucket.bucketArn,props.knowledgeBucket.bucketArn+"/*"]
    }));
    this.deleteS3Function = deleteS3APIHandlerFunction;

    const getS3APIHandlerFunction = new lambda.Function(scope, 'GetS3FilesHandlerFunction', {
      runtime: lambda.Runtime.NODEJS_20_X, // Choose any supported Node.js runtime
      code: lambda.Code.fromAsset(path.join(__dirname, 'knowledge-management/get-s3')), // Points to the lambda directory
      handler: 'index.handler', // Points to the 'hello' file in the lambda directory
      environment: {
        "BUCKET" : props.knowledgeBucket.bucketName,        
      },
      timeout: cdk.Duration.seconds(30)
    });

    getS3APIHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:*'
      ],
      resources: [props.knowledgeBucket.bucketArn,props.knowledgeBucket.bucketArn+"/*"]
    }));
    this.getS3Function = getS3APIHandlerFunction;

    const kbSyncAPIHandlerFunction = new lambda.Function(scope, 'SyncKBHandlerFunction', {
      runtime: lambda.Runtime.PYTHON_3_12, // Choose any supported Node.js runtime
      code: lambda.Code.fromAsset(path.join(__dirname, 'knowledge-management/kb-sync')), // Points to the lambda directory
      handler: 'lambda_function.lambda_handler', // Points to the 'hello' file in the lambda directory
      environment: {
        "KB_ID" : props.knowledgeBase.attrKnowledgeBaseId,      
        "SOURCE" : props.knowledgeBaseSource.attrDataSourceId  
      },
      timeout: cdk.Duration.seconds(30)
    });

    kbSyncAPIHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:*'
      ],
      resources: [props.knowledgeBase.attrKnowledgeBaseArn]
    }));
    this.syncKBFunction = kbSyncAPIHandlerFunction;

    const uploadS3APIHandlerFunction = new lambda.Function(scope, 'UploadS3FilesHandlerFunction', {
      runtime: lambda.Runtime.NODEJS_20_X, // Choose any supported Node.js runtime
      code: lambda.Code.fromAsset(path.join(__dirname, 'knowledge-management/upload-s3')), // Points to the lambda directory
      handler: 'index.handler', // Points to the 'hello' file in the lambda directory
      environment: {
        "BUCKET" : props.knowledgeBucket.bucketName,        
      },
      timeout: cdk.Duration.seconds(30)
    });

    uploadS3APIHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:*'
      ],
      resources: [props.knowledgeBucket.bucketArn,props.knowledgeBucket.bucketArn+"/*"]
    }));
    this.uploadS3Function = uploadS3APIHandlerFunction;

    // Create Drive sync functions
    const driveSyncRole = new iam.Role(scope, 'DriveSyncRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });

    // Add S3 permissions
    driveSyncRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:PutObject',
        's3:DeleteObject'
      ],
      resources: [props.knowledgeBucket.bucketArn + '/*']
    }));

    // Add Secrets Manager permissions
    driveSyncRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'secretsmanager:GetSecretValue'
      ],
      resources: [process.env.GOOGLE_CREDENTIALS_SECRET_ARN!]
    }));

    driveSyncRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetObject',
        's3:PutObject',
        's3:DeleteObject'
      ],
      resources: [props.driveSyncBucket.bucketArn + '/*']
    }));

    // Add ListBucket permission for the sync state bucket
    driveSyncRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:ListBucket'
      ],
      resources: [props.driveSyncBucket.bucketArn]
    }));

    // Add Bedrock permissions to trigger Knowledge Base sync
    driveSyncRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:StartIngestionJob',
        'bedrock:GetIngestionJob',
        'bedrock:ListIngestionJobs'
      ],
      resources: [
        props.knowledgeBase.attrKnowledgeBaseArn,
        `${props.knowledgeBase.attrKnowledgeBaseArn}/*`
      ]
    }));

    // Add Lambda invoke permission for self-invocation (async pattern)
    driveSyncRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['lambda:InvokeFunction'],
      resources: ['*']  // Will be restricted to self after creation
    }));

    // Create backfill function
    const driveBackfillFunction = new lambda.Function(scope, 'DriveBackfillFunction', {
      runtime: lambda.Runtime.PYTHON_3_10,
      code: lambda.Code.fromAsset(path.join(__dirname, 'drive-sync'), {
        bundling: {
          image: lambda.Runtime.PYTHON_3_10.bundlingImage,
          command: [
            'bash', '-c',
            'pip install -r requirements.txt -t /asset-output --platform manylinux2014_x86_64 --only-binary=:all: --upgrade && cp -au . /asset-output'
          ],
        },
      }),
      handler: 'backfill_handler.handler',
      environment: {
        GOOGLE_CREDENTIALS_SECRET_ARN: process.env.GOOGLE_CREDENTIALS_SECRET_ARN!,
        GCP_DRIVE_FOLDER_ID: process.env.GCP_DRIVE_FOLDER_ID!,
        KNOWLEDGE_BUCKET_NAME: props.knowledgeBucket.bucketName,
        SYNC_STATE_BUCKET_NAME: props.driveSyncBucket.bucketName,
        KB_ID: props.knowledgeBase.attrKnowledgeBaseId,
        KB_DATA_SOURCE_ID: props.knowledgeBaseSource.attrDataSourceId
      },
      timeout: cdk.Duration.minutes(15),
      memorySize: 2048,
      role: driveSyncRole
    });

    // Create change sync function
    const driveSyncFunction = new lambda.Function(scope, 'DriveSyncFunction', {
      runtime: lambda.Runtime.PYTHON_3_10,
      code: lambda.Code.fromAsset(path.join(__dirname, 'drive-sync'), {
        bundling: {
          image: lambda.Runtime.PYTHON_3_10.bundlingImage,
          command: [
            'bash', '-c',
            'pip install -r requirements.txt -t /asset-output --platform manylinux2014_x86_64 --only-binary=:all: --upgrade && cp -au . /asset-output'
          ],
        },
      }),
      handler: 'change_sync_handler.handler',
      environment: {
        GOOGLE_CREDENTIALS_SECRET_ARN: process.env.GOOGLE_CREDENTIALS_SECRET_ARN!,
        GCP_DRIVE_FOLDER_ID: process.env.GCP_DRIVE_FOLDER_ID!,
        KNOWLEDGE_BUCKET_NAME: props.knowledgeBucket.bucketName,
        SYNC_STATE_BUCKET_NAME: props.driveSyncBucket.bucketName,
        KB_ID: props.knowledgeBase.attrKnowledgeBaseId,
        KB_DATA_SOURCE_ID: props.knowledgeBaseSource.attrDataSourceId
      },
      timeout: cdk.Duration.minutes(10),
      memorySize: 1024,
      role: driveSyncRole
    });

    // Create EventBridge rule for monthly sync
    const syncRule = new events.Rule(scope, 'DriveSyncRule', {
      schedule: events.Schedule.rate(cdk.Duration.days(30)),
      targets: [new targets.LambdaFunction(driveSyncFunction)]
    });

    this.driveBackfillFunction = driveBackfillFunction;
    this.driveSyncFunction = driveSyncFunction;

    const getS3TestCasesFunction = new lambda.Function(scope, 'GetS3TestCasesFilesHandlerFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      code: lambda.Code.fromAsset(path.join(__dirname, 'llm-eval/S3-get-test-cases')),
      handler: 'index.handler',
      environment: {
        "BUCKET": props.evalTestCasesBucket.bucketName,
      },
      timeout: cdk.Duration.seconds(30)
    });

    getS3TestCasesFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:ListBucket',
        's3:GetObject'
      ],
      resources: [props.evalTestCasesBucket.bucketArn, props.evalTestCasesBucket.bucketArn + "/*"]
    }));
    this.getS3TestCasesFunction = getS3TestCasesFunction;

    const uploadS3TestCasesFunction = new lambda.Function(scope, 'UploadS3TestCasesFilesHandlerFunction', {
      runtime: lambda.Runtime.NODEJS_20_X, // Choose any supported Node.js runtime
      code: lambda.Code.fromAsset(path.join(__dirname, 'llm-eval/S3-upload')), // Points to the lambda directory
      handler: 'index.handler', // Points to the 'hello' file in the lambda directory
      environment: {
        "BUCKET" : props.evalTestCasesBucket.bucketName,        
      },
      timeout: cdk.Duration.seconds(30)
    });

    uploadS3TestCasesFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:*'
      ],
      resources: [props.evalTestCasesBucket.bucketArn,props.evalTestCasesBucket.bucketArn+"/*"]
    }));
    this.uploadS3TestCasesFunction = uploadS3TestCasesFunction;


    const evalResultsAPIHandlerFunction = new lambda.Function(scope, 'EvalResultsHandlerFunction', {
      runtime: lambda.Runtime.PYTHON_3_12, // Choose any supported Node.js runtime
      code: lambda.Code.fromAsset(path.join(__dirname, 'llm-eval/eval-results-handler')), // Points to the lambda directory
      handler: 'lambda_function.lambda_handler', // Points to the 'hello' file in the lambda directory
      environment: {
        // Using the full table names: 
        // GenAiOsdChatStack-ChatbotAPIEvaluationResultsTableE72FCF7C-136Z3LGPGTSF1
        // GenAiOsdChatStack-ChatbotAPIEvaluationSummariesTableE9B95A54-1S7WAPF93R60M
        "EVALUATION_RESULTS_TABLE" : props.evalResutlsTable.tableName,
        "EVALUATION_SUMMARIES_TABLE" : props.evalSummariesTable.tableName
      },
      timeout: cdk.Duration.seconds(30)
    });
    evalResultsAPIHandlerFunction.addToRolePolicy(new iam.PolicyStatement({ 
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:Query',
        'dynamodb:Scan'
      ],
      resources: [props.evalResutlsTable.tableArn, props.evalResutlsTable.tableArn + "/index/*", props.evalSummariesTable.tableArn, props.evalSummariesTable.tableArn + "/index/*"]
    }));

    this.handleEvalResultsFunction = evalResultsAPIHandlerFunction;
    props.evalResutlsTable.grantReadWriteData(evalResultsAPIHandlerFunction);
    props.evalSummariesTable.grantReadWriteData(evalResultsAPIHandlerFunction);

    const metricsHandlerFunction = new lambda.Function(scope, 'MetricsHandlerFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      code: lambda.Code.fromAsset(path.join(__dirname, 'metrics-handler')),
      handler: 'lambda_function.lambda_handler',
      environment: {
        "DDB_TABLE_NAME": props.sessionsTable.tableName,
      },
      timeout: cdk.Duration.seconds(60) // Increased timeout for scanning large tables
    });

    metricsHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:Scan'
      ],
      resources: [props.sessionsTable.tableArn, props.sessionsTable.tableArn + "/index/*"]
    }));

    this.metricsHandlerFunction = metricsHandlerFunction;

    this.stepFunctionsStack = new StepFunctionsStack(scope, 'StepFunctionsStack', {
      knowledgeBase: props.knowledgeBase,
      evalSummariesTable: props.evalSummariesTable,
      evalResutlsTable: props.evalResutlsTable,
      evalTestCasesBucket: props.evalTestCasesBucket,
      evalResultsBucket: props.evalResultsBucket,
      wsEndpoint: props.wsApiEndpoint
    });
  }
}
