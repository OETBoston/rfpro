# Session Handler Module

## Overview

The `session-handler` module is a part of the chatbot API that manages user sessions and messages. It interacts with AWS DynamoDB to store and retrieve session and message data, providing a robust backend for chat applications.

## Dependencies

- **Python 3.x**: Ensure you have Python 3.x installed.
- **Boto3**: AWS SDK for Python, used to interact with DynamoDB.
- **AWS Credentials**: Required for accessing DynamoDB tables.

## Environment Variables

- `SESSION_TABLE`: Name of the DynamoDB table for storing session data.
- `MESSAGES_TABLE`: Name of the DynamoDB table for storing message data.
- `REVIEW_TABLE`: Name of the DynamoDB table for storing review data.

## Functions

### 1. `add_new_session_with_first_message(session_id, user_id, title, first_chat_entry)`

- **Purpose**: Creates a new session and adds the first message.
- **Parameters**:
  - `session_id`: Unique identifier for the session.
  - `user_id`: Identifier for the user.
  - `title`: Title of the session.
  - `first_chat_entry`: Dictionary containing the user's prompt and the bot's response.
- **Returns**: JSON response with session and message IDs.

### 2. `add_message_to_existing_session(session_id, new_chat_entry)`

- **Purpose**: Adds a new message to an existing session.
- **Parameters**:
  - `session_id`: Identifier for the session.
  - `new_chat_entry`: Dictionary containing the user's prompt and the bot's response.
- **Returns**: JSON response with session and message IDs.

### 3. `get_session(session_id, user_id)`

- **Purpose**: Retrieves session data and its chat history.
- **Parameters**:
  - `session_id`: Identifier for the session.
  - `user_id`: Identifier for the user.
- **Returns**: JSON response with session data and chat history.

### 4. `update_session(session_id, user_id, new_chat_entry)`

- **Purpose**: Updates a session with a new message.
- **Parameters**:
  - `session_id`: Identifier for the session.
  - `user_id`: Identifier for the user.
  - `new_chat_entry`: User's new message.
- **Returns**: JSON response with the new message ID.

### 5. `delete_session(session_id, user_id)`

- **Purpose**: Deletes a session and all its messages.
- **Parameters**:
  - `session_id`: Identifier for the session.
  - `user_id`: Identifier for the user.
- **Returns**: JSON response confirming deletion.

### 6. `list_sessions_by_user_id(user_id, limit=15)`

- **Purpose**: Lists sessions for a specific user.
- **Parameters**:
  - `user_id`: Identifier for the user.
  - `limit`: Maximum number of sessions to return.
- **Returns**: List of session details.

### 7. `list_all_sessions(start_time, end_time, has_feedback, has_review, limit=250)`

- **Purpose**: Lists all sessions within a time range, optionally filtered by feedback and review status.
- **Parameters**:
  - `start_time`: Start of the time range.
  - `end_time`: End of the time range.
  - `has_feedback`: Filter by feedback presence.
  - `has_review`: Filter by review presence.
  - `limit`: Maximum number of sessions to return.
- **Returns**: List of session details.

### 8. `assemble_chat_history(session_id)`

- **Purpose**: Assembles the chat history for a session.
- **Parameters**:
  - `session_id`: Identifier for the session.
- **Returns**: List of formatted chat messages.

### 9. `lambda_handler(event, context)`

- **Purpose**: AWS Lambda handler function to route requests to the appropriate function based on the operation specified in the event.
- **Parameters**:
  - `event`: Event data containing the operation and parameters.
  - `context`: AWS Lambda context object.
- **Returns**: JSON response based on the operation.

## Deployment

1. **AWS Lambda**: Deploy the `lambda_function.py` as an AWS Lambda function.
2. **Environment Variables**: Set the required environment variables in the Lambda configuration.
3. **IAM Role**: Ensure the Lambda function has the necessary permissions to access DynamoDB tables.

## Usage

Invoke the Lambda function with an event containing the desired operation and parameters. The function will return a JSON response based on the operation performed.
