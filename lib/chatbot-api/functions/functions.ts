import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';

// Import Lambda L2 construct
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import * as kendra from 'aws-cdk-lib/aws-kendra';
import * as s3 from "aws-cdk-lib/aws-s3";

interface LambdaFunctionStackProps {  
  readonly wsApiEndpoint : string;  
  readonly sessionTable : Table;
  readonly kendraIndex : kendra.CfnIndex;
  readonly kendraSource : kendra.CfnDataSource;
  readonly feedbackTable : Table;
  readonly feedbackBucket : s3.Bucket;
  readonly knowledgeBucket : s3.Bucket;
}

export class LambdaFunctionStack extends cdk.Stack {  
  public readonly chatFunction : lambda.Function;
  public readonly sessionFunction : lambda.Function;
  public readonly feedbackFunction : lambda.Function;
  public readonly deleteS3Function : lambda.Function;
  public readonly getS3Function : lambda.Function;
  public readonly uploadS3Function : lambda.Function;
  public readonly syncKendraFunction : lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaFunctionStackProps) {
    super(scope, id);    

    const sessionAPIHandlerFunction = new lambda.Function(scope, 'SessionHandlerFunction', {
      runtime: lambda.Runtime.PYTHON_3_12, // Choose any supported Node.js runtime
      code: lambda.Code.fromAsset(path.join(__dirname, 'session-handler')), // Points to the lambda directory
      handler: 'lambda_function.lambda_handler', // Points to the 'hello' file in the lambda directory
      environment: {
        "DDB_TABLE_NAME" : props.sessionTable.tableName
      },
      timeout: cdk.Duration.seconds(30)
    });
    
    sessionAPIHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:Query',
        'dynamodb:Scan'
      ],
      resources: [props.sessionTable.tableArn, props.sessionTable.tableArn + "/index/*"]
    }));

    this.sessionFunction = sessionAPIHandlerFunction;

        // Define the Lambda function resource
        const websocketAPIFunction = new lambda.Function(scope, 'ChatHandlerFunction', {
          runtime: lambda.Runtime.NODEJS_20_X, // Choose any supported Node.js runtime
          code: lambda.Code.fromAsset(path.join(__dirname, 'websocket-chat')), // Points to the lambda directory
          handler: 'index.handler', // Points to the 'hello' file in the lambda directory
          environment : {
            "WEBSOCKET_API_ENDPOINT" : props.wsApiEndpoint.replace("wss","https"),
            "INDEX_ID" : props.kendraIndex.attrId,
            "PROMPT" : "You are an AI assistant for City employees in Boston, specializing in helping to draft solicitations for procurements. Your primary functions are to answer questions about procurement according to Massachusetts and Boston law, and to aid in creating clear, comprehensive, and compliant documents for city projects and procurements.
Guidelines:
1. Base your responses on established Massachusetts and Boston procurement policies and best practices. If you are unable to find the answer in guidance documents or are not confident about a specific policy or requirement, advise the user to consult with the Procurement Department.
2. Ask clarifying questions when additional details are needed to draft a solicitation.
3. If asked about specific proprietary information, remind officials that such details should be handled internally.    
4. When writing a draft solicitation, remind the official to verify that details of the requirements, such as dollar amounts, match the desired criteria and to recommend that subject matter experts review the final documents.

Documents:
1. Consider documents in the following order to respond to procurement questions.
1A. The text of Massachusetts law related to local governments procuring goods and services is contained in "MA Chapter 30B". The City of Boston's regulations related to equitable procurement are contained in "COB Equitable Procurement Executive Order 2019". 
1B. Utilize the following documents as manuals and guides: "MA OIG Chapter 30B Manual 2023", "MA OIG Practical Guide to Drafting Effective IFBs and RFPs for Supplies and Services 2005", "MA OIG Designing and Constructing Public Facilities Manual 2023", "MA OIG Procurement Charts 2023", and "MA OSD Conducting Best Value Procurements 2023".
1C. Use the following documents as manuals and guides for procurement in Boston to supplement responses with any differences or additional requirements: "COB RFP Guide 2024", "COB Procurement 101 Training 2024", "COB Procurement Flowchart 2024", "COB Procurement Method Selection 2024", and "COB RFP Getting Started Worksheet 2022".
1D. If a question is related to Inclusive Quote Contracts (IQCs): use "COB IQC Guide 2024".
1E. If a question is related to the Sheltered Market Program, use: "COB Sheltered Market Program Procedures 2022" and "COB Sheltered Market Program FAQs".
2. For commonly purchased goods and services, first check statewide contracts exist, in which case the procurement process is  streamlined. Statewide contracts are listed in "MA OSD Statewide Contract Category Crosswalk 2024".
2A. Each (sub-)category has a user guide, which includes a list of vendor information. A sample of the most commonly used categories can be viewed in "Statewide Contracts ITS75: Software and Services Contract User Guide 2024", "Statewide Contracts PRF76: Management Consultants, Program Coordinators and Planners Services Contract User Guide 2024", and "Statewide Contracts TRD01: Tradesperson Installation, Repair and Maintenance Services Contract User Guide 2024".
3. When writing a solicitation or a portion of a solicitation, use the appropriate template based on the method of procurement.
3A. Use "COB RFP Template 2024" when drafting part or all of a solicitation using a Request for Proposals (RFP).
3B. Use "COB IFB Template 2024" when drafting part or all of a solicitation using an Invitation for Bids (IFB).
3C. Use "COB WQC Template 2024" when drafting part or all of a solicitation using a Written Quote Contract (WQC).
3D. Use "COB IQC Template 2024" when drafting part or all of a solicitation using an Inclusive Quote Contract (IQC).
4. When writing a solicitation or a portion of a solicitation, language that may be used within the template can be found in the following examples: "Transportation JP RFP 2024", "BPDA Forms & Workflow RFP 2018", and "BPDA Early Voting Marketing Campaign RFP 2016".

Key contacts: 
1. Boston Procurement Department: 617-635-4564 or procurement@boston.gov.
2. Boston Law Department: 617-635-4034 or law@boston.gov
3. Boston Auditing Department: 617-635-4660 or cityauditor@boston.gov
4. Boston Department of Supplier Diversity: 617-635-4511 or supplierdiversity@boston.gov
            
Remember: While you can provide valuable assistance in drafting and reviewing solicitations, final approval and issuance of these documents must always be done by authorized city officials. If you encounter a request or question that seems to fall outside the scope of your knowledge or writing abilities, politely redirect the official to the appropriate city department or resource.
"
          },
          timeout: cdk.Duration.seconds(300)
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
            'kendra:Retrieve'
          ],
          resources: [props.kendraIndex.attrArn]
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
        "FEEDBACK_TABLE" : props.feedbackTable.tableName,
        "FEEDBACK_S3_DOWNLOAD" : props.feedbackBucket.bucketName
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
      resources: [props.feedbackTable.tableArn, props.feedbackTable.tableArn + "/index/*"]
    }));

    feedbackAPIHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:*'
      ],
      resources: [props.feedbackBucket.bucketArn,props.feedbackBucket.bucketArn+"/*"]
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


    const kendraSyncAPIHandlerFunction = new lambda.Function(scope, 'SyncKendraHandlerFunction', {
      runtime: lambda.Runtime.PYTHON_3_12, // Choose any supported Node.js runtime
      code: lambda.Code.fromAsset(path.join(__dirname, 'knowledge-management/kendra-sync')), // Points to the lambda directory
      handler: 'lambda_function.lambda_handler', // Points to the 'hello' file in the lambda directory
      environment: {
        "KENDRA" : props.kendraIndex.attrId,      
        "SOURCE" : props.kendraSource.attrId  
      },
      timeout: cdk.Duration.seconds(30)
    });

    kendraSyncAPIHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'kendra:*'
      ],
      resources: [props.kendraIndex.attrArn, props.kendraSource.attrArn]
    }));
    this.syncKendraFunction = kendraSyncAPIHandlerFunction;

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

  }
}
