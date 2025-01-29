# Feedback Management Lambda Function

This Lambda function handles operations related to feedback management, including submitting, retrieving, downloading, and deleting feedback. It integrates with Amazon DynamoDB and S3 to provide robust data storage and retrieval capabilities.

## Features

### 1. **POST** - Submit Feedback
Handles the submission of feedback data, storing it in a DynamoDB table.

- **Input**:
  - `sessionId`: The session identifier.
  - `messageId`: The message identifier.
  - `feedbackType`: The type of feedback (e.g., positive, negative, neutral). Defaults to `neutral`.
  - `feedbackRank`: A numeric rank for feedback.
  - `feedbackCategory`: The category of the feedback. Defaults to `general`.
  - `feedbackMessage`: Additional details or comments from the user.
- **Process**:
  - Updates the corresponding message in the DynamoDB table with the feedback details.
- **Output**:
  - `FeedbackID`: The ID of the updated feedback.
  - `updated_attributes`: A dictionary of the updated attributes.

### 2. **GET** - Retrieve Feedback
Retrieves feedback records based on time range or other filters.

- **Input**:
  - `startTime`: The start time for the feedback records to retrieve.
  - `endTime`: The end time for the feedback records to retrieve.
- **Process**:
  - Scans the DynamoDB table or queries by session ID and filters by the specified time range.
- **Output**:
  - A list of feedback items, including details like session ID, feedback comments, type, and timestamp.

### 3. **POST** - Download Feedback
Generates a CSV file containing feedback records for a specific session and time range.

- **Input**:
  - `startTime`: The start time for the feedback records to include in the CSV.
  - `endTime`: The end time for the feedback records to include in the CSV.
  - `session_id`: The session identifier.
- **Process**:
  - Queries DynamoDB for feedback records.
  - Formats the data into a CSV structure.
  - Uploads the CSV file to an S3 bucket.
  - Generates a presigned URL for downloading the file.
- **Output**:
  - `download_url`: A presigned URL for downloading the CSV file.

### 4. **DELETE** - Delete Feedback
Removes feedback details from a specific message in DynamoDB.

- **Input**:
  - `session_id`: The session identifier.
  - `message_id`: The message identifier.
- **Process**:
  - Removes feedback attributes from the specified message.
- **Output**:
  - A success message and the updated attributes of the message.

## Integration with AWS Services

### DynamoDB
- Table: `FEEDBACK_TABLE` (retrieved from environment variables).
- Stores feedback records with composite keys:
  - `pk_message_id`: Partition key for message ID.
  - `sk_session_id`: Sort key for session ID.
- Feedback attributes include type, rank, category, and comments.

### S3
- Bucket: `FEEDBACK_S3_DOWNLOAD` (retrieved from environment variables).
- Used to store CSV files for feedback downloads.

## Key Components

### `DecimalEncoder`
Custom JSON encoder to handle `Decimal` objects from DynamoDB.

```python
class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return str(obj)
        return super().default(obj)