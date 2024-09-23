#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { RagAppStack } from '../lib/cdk-rag-app-stack';

require('dotenv').config();

const app = new cdk.App();
new RagAppStack(app, process.env.CDK_STACK_NAME!, {
  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */

  /* To specialize this stack for the AWS Account and Region that are 
   * implied by the current CLI configuration. */
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION
  }

  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});