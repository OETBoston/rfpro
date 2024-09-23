# CDK-RAG-APP: Customizable AWS Retreival Augmented Generation Web Application

## Index
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

3. **Configuration and Deployment**
   - [Setting Up Environment Variables](#1-setting-up-environment-variables)
   - [Configuring the System Prompt](#2-configuring-the-system-prompt)
   - [Redeploying the Application](#3-redeploying-the-application)


## Quickstart

1. **Prepare Environment**

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

Our current CDK script deploys a suite of AWS services tailored to support Boston's Department of Innovation and Technology's procurement process. This tool, however, can be customized to meet various GenAI needs. The stack includes:

- **Amazon S3 Buckets**: Storage for documents and data.
- **API Gateway**: Both WebSocket and REST APIs with appropriate authorizers.
- **Amazon Kendra**: For RAG (Retrieval-Augmented Generation) file ingestion and prompt enrichment.
- **Amazon Bedrock**: Provides core Generative AI functionality with ALMS (Advanced Language Models and Services).
- **Amazon Cognito User Pools**: For OIDC integration with external SSO providers.

The tool excels in retrieving semantically related information from extensive document collections, making it extremely effective for document-heavy applications that require highly specialized chatbot support.

## AWS Services Summary

- **Amazon S3**: Scalable storage service for storing and retrieving any amount of data at any time.
- **API Gateway**: Managed service for creating, publishing, maintaining, monitoring, and securing APIs at any scale. Supports REST and WebSocket APIs.
- **Amazon Kendra**: Intelligent search service powered by machine learning, optimized for large-scale document retrieval.
- **Amazon Bedrock**: Provides foundational models and services for building and deploying AI applications.
- **Amazon Cognito**: User authentication and management service with support for OIDC and SSO integration.

## Configuration and Deployment

### 1. Setting Up Environment Variables

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

### 2. Configuring the System Prompt

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

### 3. Redeploying the Application

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