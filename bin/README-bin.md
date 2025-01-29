# bin

The `bin` directory contains the entry point for the CDK application and scripts required to deploy the infrastructure.

## Directory Structure

- **README-bin.md**: Documentation for the `bin` directory.
- **cdk-rag-app.*:** Entry point scripts for the CDK application.

## Entry Point Script

The `cdk-rag-app` script is the main entry point for deploying the CDK stack. It initializes the application, loads environment variables, and defines the stack configuration.

### Key Components

1. **Source Map Support**: Enables enhanced debugging by mapping runtime errors to the original source files.
2. **AWS CDK App Initialization**:
   - Creates an instance of the CDK app.
   - Loads the `RagAppStack` defined in the `lib` directory.
3. **Environment Configuration**:
   - Reads environment variables from a `.env` file to define the AWS account and region for deployment.
   - Supports environment-agnostic stacks or specialized deployments.

### Example Script (`cdk-rag-app.ts` in case the original file was moditified or lost)

```typescript
#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { RagAppStack } from '../lib/cdk-rag-app-stack';

require('dotenv').config();

const app = new cdk.App();
new RagAppStack(app, process.env.CDK_STACK_NAME!, {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION 
  }
});