# CDK-RAG-App: Customizable AWS Retrieval-Augmented Generation Web Application 

1. **Quickstart**
   - [See the Quickstart Guide](#quickstart)

2. **Overview**
   - [Introduction to AWS CDK](#overview)
   - [Architecture Diagram](#architecture-diagram)

3. **Detailed AWS Services Summary**
   - [Amazon S3](#aws-services-summary)
   - [API Gateway](#aws-services-summary)
   - [Amazon Kendra](#aws-services-summary)
   - [Amazon Bedrock](#aws-services-summary)
   - [Amazon Cognito](#aws-services-summary)

4. **Configuration and Deployment**
   - [Setting Up the Node Environment](#1-setting-up-the-node-environment)
   - [Setting Up Environment Variables](#2-setting-up-environment-variables)
   - [Configuring the System Prompt](#3-configuring-the-system-prompt)
   - [Redeploying the Application](#4-redeploying-the-application)

5. **Technical Breakdown**

## Quickstart

1. **Prepare Environment**
   - **Set up the Node Environment**
   ```
      nvm use 22                 # Use node version 22
      npm install                # Install all dependencies
      npm install -g aws-cdk     # Install cdk-cli globally
   ```

   - **Copy Environment File**:
     - Duplicate `.env.example` and rename it to `.env`.
     - Edit the `.env` file with the necessary environment variables. Ensure all required variables are populated.

   - **System Prompt Configuration**:
     - Open and edit `system-prompt.txt` to define the roles, actions, and conditions for the RAG chatbot.

2. **Deploy the Application**

   - **Run Redeployment Script**:
     - Execute the following command in your terminal:
       ```bash
       sh redeploy.sh
       ```
     - This script will handle the bootstrapping and validation processes.

3. **Verify Deployment**

   - **Check Status**:
     - Go to the AWS Console and navigate to the CloudFront section to monitor the deployment status.
     - Once deployment is successful, use the CloudFront domain to access the application.

For detailed instructions and configurations, refer to the [Configuration and Deployment](#configuration-and-deployment) section.

## Overview

AWS Cloud Development Kit (CDK) is a framework that allows you to define cloud infrastructure in code and deploy it using AWS CloudFormation. With CDK, you can deploy complex stacks of AWS services using a single script, ensuring that all resources are configured correctly and consistently.

Our current CDK script deploys a suite of AWS services tailored to support Boston's Department of Innovation and Technology's procurement process. By integrating this tool into everyday workflows, the procurement team at the City of Boston are able to much more efficiently and accurately follow procurement guidelines and complete action items, in turn enhancing all departments' ability to better serve constituents.

This tool may also be customized to meet various GenAI needs. In cooperation with the Burnes Center of Social Change, where this tool's prototype was initially developed, many departments within the State of Massachusetts also decided to adopt it in both internal and constituent facing trials. 

## Architecture Diagram

Please find the architecture diagram in [Miro](https://miro.com/welcomeonboard/dmdPWE1BRlZnYzFqSzM0ZTVFbytiRzFQb29hbWdDbU1JbVBtb21BZTVOdEFOeWRyQTM5cmpQZzhDdnFSOXdBbVM1UTNNdE5tUlcrbDdpOGZxME5YL1lGZVB5T3ZMdzRMUzZzcWQ5cW0wdHZEYmI2UVBwMGp5cDFnUHpsYlNXY1F0R2lncW1vRmFBVnlLcVJzTmdFdlNRPT0hdjE=?share_link_id=555024095209). Access is limited to members of the **CoB DoIT** team. Please reach out to your product manager internally if you don't have access.

## AWS Services Summary

- **Amazon S3**: Storage for documents and data. 

We use s3 buckets to store prompt data, sources, feedback and even the entire the web application itself.

- **API Gateway**: Both WebSocket and REST APIs with appropriate authorizers. 

All of our backend functionality is on API Gateway. Websockets ensure a persistent and smooth connection between the client and the LLM whilst Rest APIs handle all the other requests. Both work together to link up different managed services in AWS.

- **Amazon Bedrock Knowledge Base**: For RAG (Retrieval-Augmented Generation) file ingestion and prompt enrichment.

We use Bedrock Knowledge Base with OpenSearch for indexing and searching specialized documents. Knowledge Base can handle document ingestion from S3 and automatically handles chunking and embedding these documents into vectors for semantic based retrieval, a big step up from traditional keyword search. 

- **Amazon Bedrock**: Provides core Generative AI functionality with ALMS (Advanced Language Models and Services).

We mainly use the powerful Claude models to maximize response quality and efficiency.

- **Amazon Cognito**: For OIDC integration with external SSO providers.

Cognito handles user groups, identity pools and app clients, which together form a secure and robust custom managed single sign in solution.

- **... And many more**: AWS Cloudfront (CDN & Hosting), Route 53 (Domain Management), AWS Cloudwatch (Logging & Reporting), DynamoDB (NoSQL DB), IAM Manager (Access Management).

The tool excels in retrieving semantically related information from extensive document collections, making it extremely effective for document-heavy applications that require highly specialized chatbot support.

## Configuration and Deployment

### 1. Setting up the Node Environment

- **Node.js Installation**:
   - To begin development, install **Node.js** version 22. If you don't have Node.js installed, download and install it from the [official Node.js website](https://nodejs.org/en/download/package-manager).
   - After installing Node.js, ensure that you are using version 22 by running:
     ```bash
     node -v
     ```

- **Install Dependencies**:
   - Run the following command to install project dependencies:
     ```bash
     npm install
     ```

- **AWS CDK Installation**:
   - The AWS CDK CLI is required to deploy the application. Install it globally by running:
     ```bash
     npm install -g aws-cdk
     ```
   - Verify that the AWS CDK has been installed correctly by checking the version:
     ```bash
     cdk --version
     ```

- **Corporate VPN Settings**:
   - If your development environment is running under a corporate VPN (such as Zscaler), you may encounter SSL certificate issues. To resolve this, you can either configure Zscaler’s SSL certificate for Node.js, or temporarily bypass SSL validation by running:
     ```bash
     export NODE_TLS_REJECT_UNAUTHORIZED=0
     ```
   - To make this bypass persistent across shell instances, add `export NODE_TLS_REJECT_UNAUTHORIZED=0` to your shell profile file (e.g., `.bashrc`, `.zshrc`).

### 2. Setting Up Environment Variables

- **File**: `.env.example`
- **Purpose**: This file contains essential environment variables required for the deployment of the AWS CDK script. It includes identification details, credentials, and secrets necessary for accessing AWS resources and services.

- **Steps to Configure**:
  1. **Copy the File**:
     - Duplicate `.env.example` and rename the copy to `.env`. This file will now be used to store your actual environment variables.
     - **Note**: The `.env` file is explicitly listed in `.gitignore`, which means it will not be included in version control commits and pushes. This helps protect sensitive information.
     
  2. **Edit the `.env` File**:
     - Open the newly created `.env` file in a text editor.
     - Populate this file with the correct values for the environment variables as specified in the `.env.example` file. Ensure all required variables are set properly.
     - **Caution**: It’s critical to fill out all mandatory environment variables. Incomplete or incorrect values could lead to deployment failures or configuration issues.

  3. **Validation**:
     - During the deployment process, a validation script will check the `.env` file to ensure that all required environment variables are correctly set. This step prevents the deployment of faulty or incomplete configurations.

### 3. Configuring the System Prompt

- **File**: `system-prompt.txt`
- **Purpose**: This file contains the system prompt for the RAG (Retrieval-Augmented Generation) chatbot. It defines the instructions for the LLM (Large Language Model), specifying how it should process and respond to user queries.

- **Steps to Configure**:
  1. **Understand the System Prompt**:
     - The system prompt should outline the roles, actions, and conditions that the LLM needs to follow to generate accurate responses. It essentially sets the behavior of the chatbot.

  2. **Editing the System Prompt**:
     - Open `system-prompt.txt` and define the necessary roles and actions that the chatbot should perform. Be precise to ensure the chatbot functions as intended.

  3. **Prompt Engineering**:
     - Prompt engineering is crucial for customizing the behavior of the LLM. Although it may seem straightforward, it involves intricate details to fine-tune the model's responses.
     - For advanced prompt engineering techniques and best practices, refer to [Anthropic's Prompt Engineering Interactive Tutorial](https://github.com/anthropics/courses/tree/master/prompt_engineering_interactive_tutorial). This resource provides valuable insights and tips for improving your prompt configurations.

### 4. Redeploying the Application

- **Command**: `sh redeploy.sh`
- **Purpose**: This shell script initiates the redeployment sequence of the application. It handles both the bootstrapping and validation processes.

- **Steps to Redeploy**:
  1. **Execute the Script**:
     - Run the command `sh redeploy.sh` in your terminal. This script orchestrates the deployment process, and automatically runs the bootstrapping and validation scripts.

  2. **Bootstrapping**:
     - The bootstrapping script initializes the application using the configurations specified in `system-prompt.txt`. This step sets up the application environment and prepares it for deployment. No action needed at this step.

  3. **Validation**:
     - The validation script checks the configurations in the `.env` file and `system-prompt.txt` to ensure everything is set correctly before proceeding with the actual deployment.
     - **Confirmation**: During the process, you will be prompted to review the system prompt settings to confirm the changes. Ensure the details are correct before proceeding.

  4. **Deployment Time**:
     - The redeployment process typically takes between 5 to 20 minutes. This duration may vary based on the complexity of the stack and network conditions.

  5. **Post-Deployment Verification**:
     - After deployment, check the AWS Console to verify the status of the stack. Navigate to the CloudFront section to view the status and details of your deployment.
     - **Accessing the Application**: If the deployment is successful, the CloudFront domain provided will serve as the entry point to your application. Use this domain to access and test the deployed application.
   
# Technical Breakdown

- [/bin](./bin/README-bin.md): This folder contains the basic configs and entry point for building the main application stack. The logic here has been abstracted and it is not recommended that any edits need to be done in code for your use case. Click on the link to view more.

- [/lib](./lib/README-lib.md): This folder contains the main application logic and configurations for setting up all the relevant AWS services. This is the main bulk of cdk deployment and should be edited with caution. Click on the link to view a rundown of its subfolders.

- [.env.example](./.env.example): This is an example environments variable configuration file. This serves as a reference to add your own environment/deployment-specific sensitive credentials. Copy the file, rename to .env and fill in the placeholders with proper values. For more info on the env var setup, see [Setting Up Environment Variables](#2-setting-up-environment-variables)

- [.gitignore](./.gitignore): This contains the files that are ignored by git which are not pushed to github and instead remain local. This includes sensitive information like the .env file, as well as large and version-specific build files generated post initial setup in cdk.out (cdk build files) and node_modules (node build files)

- [.npmignore](./.npmignore): This specifies which files and directories should be excluded or included when publishing an npm package. It ignores all files with the .ts extension and re-includes files with the .d.ts extension to ensure only built cdk ts files are picked up (as normally .ts files are compiled to .js on build time by default). The ! negation overrides the *.ts rule for files ending in .d.ts, ensuring they are included despite the broader .ts exclusion. This is to differentiate between code that needs to be deployed in the .ts form for lambda and other container services.It also ignores the .cdk.staging and cdk.out directories, which are generated by the cdk during the build process for staging deployment assets or outputs.

- [cdk.json](./cdk.json): AWS CDK specific configurations. This should not be modified regardless of your use case.

- [package.json, package-lock.json, tsconfig.json](./package.json): Configurations file for node packages and typescript. When executing initial deploy with existing cdk cli package installed globally, check its version with `cdk --version` and make sure it satisfies the cdk and cdk=lib version requirements in package.json. Modify with caution if needed.

- [redeploy.sh](./redeploy.sh): Bash script to redeploy application. This should be the main command for deployments. See [Redeploying the Application](#4-redeploying-the-application) for more info.

- [system-prompt.txt](./system-prompt.txt) This is a text file that contains the system prompt for the chatbot. This system prompt is bootstrapped into the application on each deployment. This setup accomodates no code low code editing for the procurement team to udpate the system prompt.

- [validate.sh](./validate.sh) This is the validate script used by redeploy.sh to ensure env vars and other credentials are correctly setup for deployment. This script can also be run on its own to validate without deployment.
