import os
import boto3
from botocore.exceptions import ClientError
import json
from datetime import datetime, timezone
from decimal import Decimal
import uuid
from boto3.dynamodb.conditions import Key, Attr
import csv
import io
from concurrent.futures import ThreadPoolExecutor

SESSIONS_TABLE = os.getenv("SESSION_TABLE")
MESSAGES_TABLE = os.getenv("MESSAGES_TABLE")
REVIEWS_TABLE = os.getenv("REVIEW_TABLE")

dynamodb = boto3.resource("dynamodb", region_name='us-east-1')
sessions_table = dynamodb.Table(SESSIONS_TABLE)
messages_table = dynamodb.Table(MESSAGES_TABLE)
reviews_table = dynamodb.Table(REVIEWS_TABLE)

# Custom JSON encoder
class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)

def _generate_message_id():
    return f"MESSAGE-{int(datetime.now().timestamp())}-{uuid.uuid4().hex[:8]}"

def _generate_review_id():
    return f"REVIEW-{int(datetime.now().timestamp())}-{uuid.uuid4().hex[:8]}"

def add_new_session_with_first_message(session_id, user_id, title, first_chat_entry):
    try:
        session_id = session_id
        message_id = _generate_message_id()

        sessions_table.put_item(
            Item={
                'pk_session_id': session_id,
                'user_id': user_id,
                'title': title.strip(),
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat(),
                'message_count': 1
            }
        )

        messages_table.put_item(
            Item={
                'pk_message_id': message_id,
                'sk_session_id': session_id,
                'user_prompt': first_chat_entry['user_prompt'],
                'bot_response': first_chat_entry['bot_response'],
                'sources': first_chat_entry.get('sources', []),
                'created_at': datetime.now().isoformat(),
                'response_time': Decimal("0")
            }
        )

        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                "session_id": session_id,
                "message_id": message_id
            })
        }

    except ClientError as error:
        print(f"Error creating new session: {error}")
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(str(error))
        }


def add_message_to_existing_session(session_id, new_chat_entry):
    try:
        message_id = _generate_message_id()

        messages_table.put_item(
            Item={
                'pk_message_id': message_id,
                'sk_session_id': session_id,
                'user_prompt': new_chat_entry['user_prompt'],
                'bot_response': new_chat_entry['bot_response'],
                'sources': new_chat_entry.get('sources', []),
                'created_at': datetime.now().isoformat(),
                'response_time': Decimal("0")
            }
        )

        sessions_table.update_item(
            Key={'pk_session_id': session_id},
            UpdateExpression="SET updated_at = :updated_at, message_count = message_count + :inc",
            ExpressionAttributeValues={
                ':updated_at': datetime.now().isoformat(),
                ':inc': 1
            }
        )

        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                "session_id": session_id,
                "message_id": message_id
            })
        }

    except ClientError as error:
        print(f"Error adding message to session {session_id}: {error}")
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(str(error))
        }

def get_session(session_id, user_id, isAdmin):
    """
    Add message_id to chat_history JSON so that it can be parsed by the frontend 
    for the get_feedback() function inside feedback handler Lambda function
    """
    try:
        session_response = sessions_table.get_item(Key={'pk_session_id': session_id})
        if 'Item' not in session_response:
            return {
                'statusCode': 200,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({})
            }

        session_data = session_response['Item']

        messages_response = messages_table.query(
            IndexName='SessionMessagesIndex',
            KeyConditionExpression="sk_session_id = :sid",
            ExpressionAttributeValues={':sid': session_id},
            ScanIndexForward=True
        )

        messages = messages_response.get('Items', [])
        
        if isAdmin:
            chat_history = [
                {
                    "user": message.get("user_prompt", ""),
                    "chatbot": message.get("bot_response", ""),
                    "metadata": json.dumps(message.get("sources", [])),
                    "messageId": message.get("pk_message_id", ""),
                    "userFeedback": {
                        "feedbackType": message.get("feedback_type", "").title(),
                        "feedbackCategory": message.get("feedback_category", ""),
                        "feedbackMessage": message.get("feedback_message", ""),
                        "feedbackRank": str(message.get("feedback_rank", ""))
                    }
                }
                for message in messages
            ]
        else:
            chat_history = [
                {
                    "user": message.get("user_prompt", ""),
                    "chatbot": message.get("bot_response", ""),
                    "metadata": json.dumps(message.get("sources", [])),
                    "messageId": message.get("pk_message_id", ""),
                    "userFeedback": {}
                }
                for message in messages
            ]

        session_data["chat_history"] = chat_history

        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(session_data, cls=DecimalEncoder)
        }

    except ClientError as error:
        print(f"DynamoDB ClientError: {error}")
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(str(error))
        }



def update_session(session_id, user_id, new_chat_entry):
    try:
        message_id = _generate_message_id()
        
        messages_table.put_item(
            Item={
                'pk_message_id': message_id,
                'sk_session_id': session_id,
                'user_prompt': new_chat_entry,
                'bot_response': None,
                'sent_at': datetime.now().isoformat(),
                'response_time': Decimal("0")
            }
        )
        
        sessions_table.update_item(
            Key={'pk_session_id': session_id},
            UpdateExpression="SET updated_at = :updated_at, message_count = message_count + :inc",
            ExpressionAttributeValues={
                ':updated_at': datetime.now().isoformat(),
                ':inc': 1
            }
        )
        
        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({"message_id": message_id}, cls=DecimalEncoder)
        }
    except ClientError as error:
        print(f"DynamoDB ClientError: {error}")
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(str(error))
        }


def delete_session(session_id, user_id):
    try:

        messages = messages_table.query(
            IndexName='SessionMessagesIndex',
            KeyConditionExpression="sk_session_id = :sid",
            ExpressionAttributeValues={':sid': session_id}
        )['Items']
        
        with messages_table.batch_writer() as batch:
            for message in messages:
                batch.delete_item(Key={'pk_message_id': message['pk_message_id'], 'sk_session_id': session_id})
        
        sessions_table.delete_item(Key={'pk_session_id': session_id})
        
        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(f"Session {session_id} deleted.")
        }
    except ClientError as error:
        print(f"DynamoDB ClientError: {error}")
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(str(error))
        }

def list_sessions_by_user_id(user_id, limit=15):
    items = []
    last_evaluated_key = None

    while len(items) < limit:
        query_params = {
            'IndexName': 'UserSessionsIndex',
            'KeyConditionExpression': 'user_id = :uid',
            'ExpressionAttributeValues': {':uid': user_id},
            'ScanIndexForward': False,
            'Limit': limit - len(items)
        }

        if last_evaluated_key:
            query_params['ExclusiveStartKey'] = last_evaluated_key

        response = sessions_table.query(**query_params)
        items.extend(response.get("Items", []))
        
        last_evaluated_key = response.get("LastEvaluatedKey")
        if not last_evaluated_key:
            break

    sorted_items = sorted(items, key=lambda x: x['created_at'], reverse=True)

    formatted_items = [
        {
            "session_id": item["pk_session_id"],
            "title": item["title"].strip(),
            "time_stamp": item["created_at"]
        }
        for item in sorted_items
    ]
    
    return formatted_items


def list_all_sessions(start_time, end_time, has_feedback, has_review, user_id, limit=10000):
    # Get all (or first 250) sessions from sessions table
    items = []
    last_evaluated_key = None

    while len(items) < limit:
        if last_evaluated_key:
            response = sessions_table.scan(
                FilterExpression=Key('created_at').between(start_time, end_time),
                ExclusiveStartKey=last_evaluated_key,
                Limit=limit-len(items)
            )
        else: 
            response = sessions_table.scan(
                FilterExpression=Key('created_at').between(start_time, end_time),
                Limit=limit
            )
        last_evaluated_key = response.get('LastEvaluatedKey')
        
        items.extend(response.get('Items', []))
        
        if not last_evaluated_key:
            break

    # Add a check to see if the items retreive up to the limit
    total_items = len(items)
    if limit <= total_items:
        print(f"Warning: Limit {limit} restricts the number of items retrieved, increase limit to retrieve all items")

    # Get list of session IDs that have at least 1 feedback response
    sessions_with_feedback = set()
    while True:
        if last_evaluated_key:
            # Check if last_evaluated_key contains the necessary keys before using it
            if last_evaluated_key and 'pk_message_id' in last_evaluated_key and 'sk_session_id' in last_evaluated_key:
                response = messages_table.scan(
                    FilterExpression=Attr('feedback_type').exists(),
                    ExclusiveStartKey={
                        'pk_message_id': last_evaluated_key['pk_message_id'],
                        'sk_session_id': last_evaluated_key['sk_session_id']
                    }
                )
            else: 
                response = messages_table.scan(
                    FilterExpression=Attr('feedback_type').exists()
                )
        else: 
            response = messages_table.scan(
                FilterExpression=Attr('feedback_type').exists()
            )
        last_evaluated_key = response.get('LastEvaluatedKey')
        
        scan_items = response.get('Items', [])
        session_id_set = set([item["sk_session_id"] for item in scan_items])
        sessions_with_feedback.update(session_id_set)
        
        if not last_evaluated_key:
            break

    # Get list of session IDs that have at least 1 review
    sessions_with_review = {}
    while True:
        if last_evaluated_key:
            response = reviews_table.scan(
                FilterExpression=Attr('reviewed_by').eq(user_id),
                ExclusiveStartKey=last_evaluated_key
            )
        else: 
            response = reviews_table.scan(
                FilterExpression=Attr('reviewed_by').eq(user_id)
            )
        last_evaluated_key = response.get('LastEvaluatedKey')

        scan_items = response.get('Items', [])
        for item in scan_items:
            sessions_with_review[item["session_id"]] = item["pk_review_id"]
        if not last_evaluated_key:
            break

    # Sort items by created_at in descending order to get the latest sessions
    sorted_items = sorted(items, key=lambda x: x['created_at'], reverse=True)

    # Limit the results to the specified limit
    limited_items = sorted_items[:limit]

    # Format the limited items
    formatted_items = [
        {
            "session_id": item["pk_session_id"],
            "title": item["title"].strip(),
            "time_stamp": item["created_at"],
            "has_feedback": ("Yes" if item["pk_session_id"] in sessions_with_feedback else "No"),
            "has_review": ("Yes" if item["pk_session_id"] in sessions_with_review else "No"),
            "review_id": sessions_with_review.get(item["pk_session_id"],"")
        }
        for item in limited_items
    ]
    
    if has_feedback in {"yes", "no"}:
        formatted_items = [
            item for item in formatted_items if item["has_feedback"].lower() == has_feedback 
        ]

    if has_review in {"yes", "no"}:
        formatted_items = [
            item for item in formatted_items if item["has_review"].lower() == has_review
        ]

    return formatted_items


def update_review_session(review_id, session_id, user_id):
    """
    Create or update review session by an admin user.
    Each entry can be uniquely identified by session id + user id
    """
    
    try:
        if review_id:
            reviews_table.update_item(
                Key={'pk_review_id': review_id},
                UpdateExpression="SET reviewed_by = :reviewed_by, reviewed_at = :reviewed_at",
                ExpressionAttributeValues={
                    ':reviewed_by': user_id,
                    ':reviewed_at': datetime.now().isoformat()
                }
            )
        else:
            review_id = _generate_review_id()

            reviews_table.put_item(
                Item={
                    'pk_review_id': review_id,
                    'session_id': session_id,
                    'reviewed_by': user_id,
                    'comments': "",
                    'reviewed_at': datetime.now().isoformat()
                }
            )

        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                "review_id": review_id,
                "session_id": session_id
            })
        }

    except ClientError as error:
        print(f"Error adding message to session {session_id}: {error}")
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(str(error))
        }


def delete_review_session(review_id, session_id, user_id):
    try:
        if review_id:
            reviews_table.delete_item(Key={'pk_review_id': review_id})
        
        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(f"Review {review_id} deleted.")
        }
    except ClientError as error:
        print(f"DynamoDB ClientError: {error}")
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(str(error))
        }
    

def assemble_chat_history(session_id):
    """
    Assemble chat history for a given session ID by retrieving messages
    from the messages table and formatting them as required.
    """
    try:
        response = messages_table.query(
            IndexName='SessionMessagesIndex',
            KeyConditionExpression="sk_session_id = :sid",
            ExpressionAttributeValues={':sid': session_id},
            ScanIndexForward=True
        )
        
        # Extract and format messages
        messages = response.get('Items', [])
        chat_history = []
        for message in messages:
            chat_history.append({
                "M": {
                    "user": {"S": message.get("user_prompt", "")},
                    "chatbot": {"S": message.get("bot_response", "")},
                    "metadata": {"S": json.dumps(message.get("metadata", []))}
                }
            })
        
        return chat_history
    except ClientError as error:
        print(f"Error assembling chat history for session {session_id}: {error}")
        return []

def download_all_sessions_csv(start_time=None, end_time=None, job_id=None):
    """
    Scan all sessions in the given time range (or all if not provided), write to a CSV, upload to S3, and return a presigned URL.
    Uses parallel processing and efficient batch operations to minimize DynamoDB calls.
    Supports polling mechanism for long-running exports.
    """
    import csv
    import io
    import boto3
    import os
    from boto3.dynamodb.conditions import Key
    from concurrent.futures import ThreadPoolExecutor
    print(f"[download_all_sessions_csv] start_time: {start_time}, end_time: {end_time}, job_id: {job_id}")
    try:
        # Use the broadest possible range if not provided
        if not start_time:
            start_time = "0000-01-01T00:00:00"
        if not end_time:
            end_time = "9999-12-31T23:59:59"
        print(f"[download_all_sessions_csv] Using range: {start_time} to {end_time}")

        # Create S3 client first
        s3 = boto3.client('s3')
        S3_DOWNLOAD_BUCKET = os.environ["SESSION_S3_DOWNLOAD"]
        file_name = f"all-sessions-{start_time}-{end_time}.csv"
        
        # If this is a status check, verify if the file exists
        if job_id:
            try:
                s3.head_object(Bucket=S3_DOWNLOAD_BUCKET, Key=file_name)
                # File exists, generate presigned URL
                presigned_url = s3.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': S3_DOWNLOAD_BUCKET, 'Key': file_name},
                    ExpiresIn=3600
                )
                return {
                    'headers': {'Access-Control-Allow-Origin': '*'},
                    'statusCode': 200,
                    'body': json.dumps({
                        'status': 'completed',
                        'download_url': presigned_url
                    })
                }
            except:
                # File doesn't exist yet
                return {
                    'headers': {'Access-Control-Allow-Origin': '*'},
                    'statusCode': 200,
                    'body': json.dumps({
                        'status': 'processing'
                    })
                }

        # Create a temporary file to stream the CSV
        temp_file = io.StringIO()
        writer = csv.writer(temp_file, quoting=csv.QUOTE_ALL)
        
        # Write header
        columns = [
            # Session information
            "SessionID", "UserID", "Title", "CreatedAt", "UpdatedAt", "MessageCount",
            # Message information
            "MessageID", "UserPrompt", "BotResponse", "MessageCreatedAt", "ResponseTime",
            # Feedback information
            "FeedbackType", "FeedbackCategory", "FeedbackMessage", "FeedbackRank", "FeedbackCreatedAt",
            # Review information
            "ReviewID", "ReviewedBy", "ReviewComments", "ReviewedAt"
        ]
        writer.writerow(columns)

        def get_messages_for_session(session_id):
            """Get messages for a single session"""
            try:
                response = messages_table.query(
                    IndexName='SessionMessagesIndex',
                    KeyConditionExpression="sk_session_id = :sid",
                    ExpressionAttributeValues={':sid': session_id},
                    Limit=100
                )
                return session_id, response.get('Items', [])
            except Exception as e:
                print(f"Error getting messages for session {session_id}: {e}")
                return session_id, []

        def get_review_for_session(session_id):
            """Get review for a single session"""
            try:
                response = reviews_table.scan(
                    FilterExpression=Attr('session_id').eq(session_id),
                    Limit=1
                )
                return session_id, response.get('Items', [{}])[0] if response.get('Items') else {}
            except Exception as e:
                print(f"Error getting review for session {session_id}: {e}")
                return session_id, {}

        # Process sessions in batches
        batch_size = 100  # Process 100 sessions at a time
        last_evaluated_key = None
        total_sessions = 0
        total_messages = 0

        while True:
            # Get batch of sessions
            if last_evaluated_key:
                response = sessions_table.scan(
                    FilterExpression=Key('created_at').between(start_time, end_time),
                    ExclusiveStartKey=last_evaluated_key,
                    Limit=batch_size
                )
            else:
                response = sessions_table.scan(
                    FilterExpression=Key('created_at').between(start_time, end_time),
                    Limit=batch_size
                )
            
            sessions = response.get('Items', [])
            if not sessions:
                break

            total_sessions += len(sessions)
            print(f"[download_all_sessions_csv] Processing batch of {len(sessions)} sessions. Total so far: {total_sessions}")

            # Get all session IDs in this batch
            session_ids = [session['pk_session_id'] for session in sessions]

            # Parallel fetch of messages and reviews
            messages_by_session = {}
            reviews_by_session = {}
            
            with ThreadPoolExecutor(max_workers=10) as executor:
                # Fetch messages in parallel
                message_futures = [executor.submit(get_messages_for_session, sid) for sid in session_ids]
                for future in message_futures:
                    session_id, messages = future.result()
                    messages_by_session[session_id] = messages
                    total_messages += len(messages)

                # Fetch reviews in parallel
                review_futures = [executor.submit(get_review_for_session, sid) for sid in session_ids]
                for future in review_futures:
                    session_id, review = future.result()
                    reviews_by_session[session_id] = review

            # Write data for this batch
            for session in sessions:
                session_id = session['pk_session_id']
                messages = messages_by_session.get(session_id, [])
                review = reviews_by_session.get(session_id, {})

                if not messages:
                    # Write session info with empty message fields
                    writer.writerow([
                        session.get('pk_session_id', ''),
                        session.get('user_id', ''),
                        session.get('title', ''),
                        session.get('created_at', ''),
                        session.get('updated_at', ''),
                        session.get('message_count', ''),
                        '', '', '', '', '',  # Message fields
                        '', '', '', '', '',  # Feedback fields
                        '', '', '', ''       # Review fields
                    ])
                else:
                    for message in messages:
                        writer.writerow([
                            # Session information
                            session.get('pk_session_id', ''),
                            session.get('user_id', ''),
                            session.get('title', ''),
                            session.get('created_at', ''),
                            session.get('updated_at', ''),
                            session.get('message_count', ''),
                            # Message information
                            message.get('pk_message_id', ''),
                            message.get('user_prompt', ''),
                            message.get('bot_response', ''),
                            message.get('created_at', ''),
                            message.get('response_time', ''),
                            # Feedback information
                            message.get('feedback_type', ''),
                            message.get('feedback_category', ''),
                            message.get('feedback_message', ''),
                            message.get('feedback_rank', ''),
                            message.get('feedback_created_at', ''),
                            # Review information
                            review.get('pk_review_id', ''),
                            review.get('reviewed_by', ''),
                            review.get('comments', ''),
                            review.get('reviewed_at', '')
                        ])

            # Get the next batch
            last_evaluated_key = response.get('LastEvaluatedKey')
            if not last_evaluated_key:
                break

            # Periodically upload to S3 to prevent memory issues
            if total_sessions % 200 == 0:  # Every 200 sessions
                print(f"[download_all_sessions_csv] Uploading intermediate results. Sessions: {total_sessions}, Messages: {total_messages}")
                temp_file.seek(0)
                s3.put_object(
                    Bucket=S3_DOWNLOAD_BUCKET,
                    Key=f"temp-{file_name}",
                    Body=temp_file.getvalue()
                )
                temp_file = io.StringIO()
                writer = csv.writer(temp_file, quoting=csv.QUOTE_ALL)
                writer.writerow(columns)  # Write header again

        print(f"[download_all_sessions_csv] Completed processing. Total sessions: {total_sessions}, Total messages: {total_messages}")

        # Final upload to S3
        temp_file.seek(0)
        s3.put_object(
            Bucket=S3_DOWNLOAD_BUCKET,
            Key=file_name,
            Body=temp_file.getvalue()
        )
        temp_file.close()

        # Generate presigned URL
        presigned_url = s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': S3_DOWNLOAD_BUCKET, 'Key': file_name},
            ExpiresIn=3600
        )
        print(f"[download_all_sessions_csv] presigned_url: {presigned_url}")
        
        return {
            'headers': {'Access-Control-Allow-Origin': '*'},
            'statusCode': 200,
            'body': json.dumps({
                'status': 'completed',
                'download_url': presigned_url
            })
        }
    except Exception as e:
        print(f"[download_all_sessions_csv] Exception: {e}")
        import traceback
        traceback.print_exc()
        return {
            'headers': {'Access-Control-Allow-Origin': '*'},
            'statusCode': 500,
            'body': json.dumps({'error': f'Failed to download sessions: {str(e)}'})
        }

def lambda_handler(event, context):
    isAdmin = False
    try:
        request_context = event["requestContext"]["authorizer"]["jwt"]["claims"]
        if "Admin" in request_context["cognito:groups"]:
            isAdmin = True
    except:
        print("Could not check for Admin role")
        print(event)

    data = json.loads(event['body'])
    operation = data.get('operation')
    print(f"[lambda_handler] operation: {operation}")
    print(f"[lambda_handler] data: {data}")

    if operation == 'add_new_session_with_first_message':
        return add_new_session_with_first_message(
            data.get('session_id'),
            data['user_id'],
            data['title'],
            data['new_chat_entry']
        )
    elif operation == 'add_message_to_existing_session':
        return add_message_to_existing_session(
            data['session_id'],
            data['new_chat_entry']
        )
    elif operation == 'get_session':
        return get_session(data['session_id'], data['user_id'], isAdmin)
    elif operation == 'update_session':
        return update_session(data['session_id'], data['user_id'], data['new_chat_entry'])
    elif operation == 'list_sessions_by_user_id':
        return list_sessions_by_user_id(data['user_id'])
    elif operation == 'list_all_sessions_by_user_id':
        return list_sessions_by_user_id(data['user_id'],limit=100)
    elif operation == 'list_all_sessions':
        return list_all_sessions(data['start_time'], data['end_time'], data['has_feedback'], data['has_review'], data['user_id'])
    elif operation == 'delete_session':
        return delete_session(data['session_id'], data['user_id'])
    elif operation == 'assemble_chat_history':
        return assemble_chat_history(data['session_id'])
    elif operation == 'update_review_session':
        return update_review_session(data['review_id'], data['session_id'], data['user_id'])
    elif operation == 'delete_review_session':
        return delete_review_session(data['review_id'], data['session_id'], data['user_id'])
    elif operation == 'download_all_sessions_csv':
        return download_all_sessions_csv(data.get('start_time'), data.get('end_time'), data.get('job_id'))
    else:
        return {
            'statusCode': 400,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(f"Invalid operation: {operation}")
        }