# WebSocket Chatbot Lambda Function

This Lambda function is designed to handle WebSocket connections for a chatbot application. It processes user messages, retrieves relevant documents using Amazon Kendra, and generates responses using AI models. The function is part of a larger serverless architecture that leverages AWS services to provide real-time chat capabilities.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Dependencies](#dependencies)
4. [Environment Variables](#environment-variables)
5. [Functionality](#functionality)
6. [Deployment](#deployment)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)

## Overview

The WebSocket Chatbot Lambda function is responsible for:

- Managing WebSocket connections.
- Enhancing user prompts with historical context.
- Retrieving relevant documents from an Amazon Kendra index.
- Generating AI-driven responses using Claude and Mistral models.
- Maintaining chat sessions and storing session data.

## Architecture

The function interacts with several AWS services:

- **AWS Lambda**: Executes the function in response to WebSocket events.
- **Amazon API Gateway**: Manages WebSocket connections.
- **Amazon Kendra**: Retrieves relevant documents based on user queries.
- **Amazon S3**: Stores system prompts and other data.
- **AWS SDK**: Interfaces with AWS services.

## Dependencies

The function relies on the following npm packages:

- `@aws-sdk/client-apigatewaymanagementapi`
- `@aws-sdk/client-kendra`
- `@aws-sdk/client-lambda`
- `@aws-sdk/client-s3`
- `@aws-sdk/util-stream-node`

Additionally, it uses custom AI models defined in:

- `./models/claude3Sonnet.mjs`
- `./models/mistral7b.mjs`

## Environment Variables

The function requires several environment variables to be set:

- `WEBSOCKET_API_ENDPOINT`: The endpoint for the WebSocket API.
- `PROMPT_DATA_BUCKET_NAME`: The name of the S3 bucket containing prompt data.
- `SESSION_HANDLER`: The name of the Lambda function handling session data.
- `INDEX_ID`: The ID of the Kendra index used for document retrieval.

## Functionality

### WebSocket Event Handling

The function handles different WebSocket events:

- **$connect**: Establishes a new connection.
- **$disconnect**: Closes an existing connection.
- **getChatbotResponse**: Processes user messages and generates responses.

### Prompt Enhancement

The function enhances user prompts by incorporating historical chat context, ensuring that queries are contextually relevant.

### Document Retrieval

It retrieves documents from an Amazon Kendra index, filtering results based on confidence levels to ensure relevance.

### AI Response Generation

The function uses Claude and Mistral models to generate AI-driven responses, streaming results back to the client.

### Session Management

It manages chat sessions, storing and retrieving session data using another Lambda function.

## Deployment

To deploy the function:

1. Ensure all dependencies are installed.
2. Package the Lambda function code and dependencies.
3. Deploy using AWS CLI or AWS SAM, setting the necessary environment variables.

## Testing

To test the function:

1. Use a WebSocket client to connect to the API Gateway endpoint.
2. Send messages and observe responses.
3. Verify that session data is correctly stored and retrieved.

## Troubleshooting

- **Connection Issues**: Ensure the WebSocket API endpoint is correctly configured.
- **Document Retrieval Errors**: Check Kendra index permissions and query parameters.
- **AI Model Errors**: Verify model configurations and payload formats.