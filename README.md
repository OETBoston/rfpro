# CDK-RAG-App: Customizable AWS Retrieval-Augmented Generation Web Application 

1. **Quickstart**
   - [See the Quickstart Guide](#quickstart)

2. **Overview**
   - [Introduction to AWS CDK](#overview)
   - [Deployed AWS Services](#overview)

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

## AWS Services Summary

- **Amazon S3**: Storage for documents and data. 

We use s3 buckets to store prompt data, sources, feedback and even the entire the web application itself.

- **API Gateway**: Both WebSocket and REST APIs with appropriate authorizers. 

All of our backend functionality is on API Gateway. Websockets ensure a persistent and smooth connection between the client and the LLM whilst Rest APIs handle all the other requests. Both work together to link up different managed services in AWS.

- **Amazon Kendra**: For RAG (Retrieval-Augmented Generation) file ingestion and prompt enrichment.

We use Kendra for indexing and searching specialized documents. Kendra can handle multiple scheduled web scraping jobs and can source data from anywhere in and outside of AWS. Kendra automatically handles chunking and embedding these documents into vectors for semantic based retreival, a big step up from traditional keyword search. 

- **Amazon Bedrock**: Provides core Generative AI functionality with ALMS (Advanced Language Models and Services).

We mainly use the powerful Comprehend models to maximize response quality and efficiency.

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