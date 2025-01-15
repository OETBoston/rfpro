# AWS Lambda Functions Overview

This documentation provides an overview of four Lambda functions (`delete-s3`, `get-s3`, `kendra-sync`, and `upload-s3`), detailing their functionality, AWS integrations, and intended use cases.

---

## 1. **Delete S3 Object (`delete-s3`)**

### Description
This function is responsible for deleting an object from an S3 bucket.

### Key Features
- Parses the request body to identify the object key to delete.
- Deletes the specified object from the S3 bucket.
- Uses the bucket name retrieved from an environment variable (`BUCKET`).

### Error Handling
- If deletion fails, it returns a 502 status code with a "FAILED" message.

### AWS Services
- **S3**: Deletes the object specified by the key in the request payload.

---

## 2. **Get S3 Objects (`get-s3`)**

### Description
This function lists objects in an S3 bucket, supporting paginated results using `ContinuationToken`.

### Key Features
- Retrieves objects from an S3 bucket using the `ListObjectsV2Command`.
- Supports pagination through `ContinuationToken`.
- Bucket name is specified via an environment variable (`BUCKET`).
- Returns a JSON response containing the list of objects.

### Error Handling
- Returns a 500 status code and a relevant error message if the operation fails.

### AWS Services
- **S3**: Lists objects from the bucket using the AWS SDK.

---

## 3. **Kendra Sync Operations (`kendra-sync`)**

### Description
Manages Amazon Kendra synchronization jobs, including starting a new sync job, checking ongoing jobs, and retrieving the last sync timestamp.

### Key Features
- **Sync Management**:
  - Starts a new data source sync job in Amazon Kendra.
  - Checks if any sync jobs are currently running.
- **Last Sync Retrieval**:
  - Retrieves the timestamp of the last successful sync job.
- Supports multiple API paths (`sync-kendra`, `still-syncing`, and `last-sync`).
- Bucket and source IDs are retrieved from environment variables (`KENDRA`, `SOURCE`).

### AWS Services
- **Kendra**: Interacts with Kendra APIs to manage sync jobs and retrieve sync job histories.

### Endpoints
- `/sync-kendra`: Starts a new sync job if none are running.
- `/still-syncing`: Checks if a sync job is currently running.
- `/last-sync`: Retrieves the timestamp of the last successful sync.

---

## 4. **Upload S3 Object (`upload-s3`)**

### Description
Generates a presigned URL for uploading objects to an S3 bucket.

### Key Features
- Generates a presigned upload URL with a 5-minute expiration (`URL_EXPIRATION_SECONDS`).
- Allows clients to upload files directly to S3 without exposing credentials.
- Accepts `fileName` and `fileType` in the request body to specify the uploaded object's details.
- Bucket name is specified via an environment variable (`BUCKET`).

### Error Handling
- Returns a 500 status code with an error message if URL generation fails.

### AWS Services
- **S3**: Generates a presigned URL for uploading objects using the AWS SDK.

---

## Shared Features Across Functions

### Common AWS Integrations
- **S3**: All functions interact with Amazon S3 for object management tasks.
- **Environment Variables**:
  - `BUCKET`: Specifies the S3 bucket name for `delete-s3`, `get-s3`, and `upload-s3`.
  - `KENDRA` and `SOURCE`: Used by `kendra-sync` for Amazon Kendra configurations.

### CORS Support
All functions include `Access-Control-Allow-Origin: *` in their response headers for cross-origin support during development.

---

## Notes
- Ensure that all required environment variables (`BUCKET`, `KENDRA`, `SOURCE`) are correctly set before deploying the Lambda functions.
- Use CloudWatch logs to monitor execution and debug any errors.
- The `kendra-sync` function is tightly coupled with Amazon Kendra, so ensure Kendra resources are properly configured in the AWS account.