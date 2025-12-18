import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from "constructs";

export class S3BucketStack extends cdk.Stack {
  public readonly kendraBucket: s3.Bucket;
  public readonly downloadBucket: s3.Bucket;
  public readonly driveSyncBucket: s3.Bucket;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Create a new S3 bucket
     this.kendraBucket = new s3.Bucket(scope, 'KendraSourcesBucket', {
      //bucketName: process.env.CDK_STACK_NAME!.toLowerCase() + "-s3-kendra-sources",
      versioned: true,
      // accessControl: s3.BucketAccessControl.PUBLIC_READ,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        ignorePublicAcls: false,
        blockPublicPolicy: false,
        restrictPublicBuckets: false,
      }),
      cors: [{
        allowedMethods: [s3.HttpMethods.GET,s3.HttpMethods.POST,s3.HttpMethods.PUT,s3.HttpMethods.DELETE],
        allowedOrigins: ['*'],      
        allowedHeaders: ["*"]
      }]
    });

    // Define a policy statement
    const policyStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:GetObject', 's3:PutObject'],
      resources: [this.kendraBucket.bucketArn + '/*'],
      principals: [new iam.AnyPrincipal()]
    });

    // Add the policy to the bucket
    this.kendraBucket.addToResourcePolicy(policyStatement);
    
    this.downloadBucket = new s3.Bucket(scope, 'DownloadBucket', {
      // bucketName: 'feedback-download',
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [{
        allowedMethods: [s3.HttpMethods.GET,s3.HttpMethods.POST,s3.HttpMethods.PUT,s3.HttpMethods.DELETE],
        allowedOrigins: ['*'], 
        allowedHeaders: ["*"]     
      }]
    });

    // Create Drive sync state bucket
    this.driveSyncBucket = new s3.Bucket(scope, 'DriveSyncBucket', {
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });
  }
}
