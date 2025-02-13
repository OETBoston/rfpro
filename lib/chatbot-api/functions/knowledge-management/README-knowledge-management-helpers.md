# Chatbot API Lambda Functions

This repository contains a set of AWS Lambda functions designed to assist with various operations related to S3 and Kendra. These functions are intended to be used as helper services for larger, more customized Lambda functions within a chatbot API. Below is a detailed description of each function and its purpose.

## Functions Overview

### 1. Delete S3 Object

**File:** `lib/chatbot-api/functions/knowledge-management/delete-s3/lambda_function.py`

**Description:**  
This Lambda function deletes an object from an S3 bucket. It expects an event containing the S3 object key to be deleted. The function uses the `boto3` library to interact with AWS S3.

**Environment Variables:**
- `BUCKET`: The name of the S3 bucket from which the object will be deleted.

**Key Operations:**
- Parses the incoming event to extract the object key.
- Deletes the specified object from the S3 bucket.
- Returns a success or failure response.

### 2. Get S3 Objects

**File:** `lib/chatbot-api/functions/knowledge-management/get-s3/index.mjs`

**Description:**  
This function retrieves a list of objects from an S3 bucket. It uses the AWS SDK for JavaScript to interact with S3 and supports pagination through continuation tokens.

**Environment Variables:**
- `BUCKET`: The name of the S3 bucket to list objects from.

**Key Operations:**
- Uses `ListObjectsV2Command` to list objects in the specified bucket.
- Supports pagination with `ContinuationToken`.
- Returns the list of objects or an error message.

### 3. Upload S3 Object

**File:** `lib/chatbot-api/functions/knowledge-management/upload-s3/index.mjs`

**Description:**  
This function generates a presigned URL for uploading an object to an S3 bucket. It uses the AWS SDK for JavaScript and the `s3-request-presigner` package to create the URL.

**Environment Variables:**
- `BUCKET`: The name of the S3 bucket where the object will be uploaded.

**Key Operations:**
- Parses the incoming request to extract the file name and type.
- Generates a presigned URL for uploading the file to S3.
- Returns the presigned URL or an error message.

### 4. Kendra Sync

**File:** `lib/chatbot-api/functions/knowledge-management/kendra-sync/lambda_function.py`

**Description:**  
This function manages synchronization jobs for AWS Kendra. It checks the status of sync jobs and can start new sync jobs if none are currently running.

**Environment Variables:**
- `KENDRA`: The ID of the Kendra index.
- `SOURCE`: The ID of the data source for Kendra.

**Key Operations:**
- Checks if any sync jobs are currently running.
- Starts a new sync job if none are running.
- Provides the status of the last successful sync job.

## Usage

These Lambda functions are designed to be integrated into larger systems where they provide specific functionalities related to S3 and Kendra. They can be deployed and managed using AWS Lambda and are triggered by events such as HTTP requests or other AWS services.

## Deployment

To deploy these functions, ensure that you have the necessary AWS credentials and permissions. You can use AWS SAM, the Serverless Framework, or AWS CloudFormation to manage the deployment process.

## Contributing

Contributions to improve these helper functions are welcome. Please ensure that any changes are well-documented and tested before submitting a pull request.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.
