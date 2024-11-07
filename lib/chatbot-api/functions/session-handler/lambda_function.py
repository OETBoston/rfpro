import os, json
import boto3
import uuid
from datetime import datetime, timezone
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')
sessions_table = dynamodb.Table(os.environ['SESSIONS_TABLE'])
messages_table = dynamodb.Table(os.environ['MESSAGES_TABLE'])
reviews_table = dynamodb.Table(os.environ['REVIEWS_TABLE'])

# Custom JSON encoder to handle Decimal objects
class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)  # or str(obj) if you prefer
        return super(DecimalEncoder, self).default(obj)

# Helper function: Generate standardized success response
def _format_response(data):
    return {
        "statusCode": 200,
        "headers": {
            'Access-Control-Allow-Origin': '*'
        },
        "body": json.dumps(data, cls=DecimalEncoder)
    }

# Helper function to generate standardized error response
def _format_error_response(message):
    return {
        "statusCode": 400,
        "headers": {
            'Access-Control-Allow-Origin': '*'
        },
        "body": json.dumps({"error": message}, cls=DecimalEncoder)
    }

# Helper Function: Generates a unique session ID based on current timestamp and uuid.
def _generate_session_id():
    return f"SESSION-{int(datetime.now(timezone('US/Eastern')).timestamp())}-{uuid.uuid4().hex[:8]}"

# Helper Function: Generates a unique message ID based on current timestamp and uuid.
def _generate_message_id():
    return f"MESSAGE-{int(datetime.now(timezone('US/Eastern')).timestamp())}-{uuid.uuid4().hex[:8]}"

# Main Lambda Handler
def lambda_handler(event, context):
    try:
        data = json.loads(event.get('body', '{}'))
        action = data.get('action')
        response_data = None
        
        if action == 'create_session':
            response_data = create_session(data['user_id'], data['title'], data['user_prompt'], data['bot_response'], data['metadata'], data['sent_at'])
        elif action == 'update_message_feedback':
            response_data = update_message_feedback(data['message_id'], data['session_id'], data['feedback'])
        elif action == 'add_message':
            response_data = add_message(data['session_id'], data['user_prompt'], data['bot_response'], data['metadata'], data['sent_at'])
        elif action == 'add_review':
            response_data = add_review(data['session_id'], data['reviewed_by'], data['comments'])
        elif action == 'get_sessions_with_reviews':
            response_data = get_sessions_with_reviews()
        elif action == 'get_sessions_by_user':
            response_data = get_sessions_by_user(data['user_id'], data['limit']) if 'limit' in data else get_sessions_by_user(data['user_id'])
        elif action == 'get_messages_by_session':
            response_data = get_messages_by_session(data['session_id'])
        elif action == 'get_session':
            response_data = get_session(data['session_id'])
        elif action == 'get_message':
            response_data = get_message(data['message_id'])
        elif action == 'get_review':
            response_data = get_review(data['review_id'])
        elif action == 'get_review_by_session':
            response_data = get_review_by_session(data['session_id'])
        elif action == 'delete_session':
            response_data = delete_session(data['session_id'])
        elif action == 'delete_user_sessions':
            response_data = delete_user_sessions(data['user_id'])
        else:
            return _format_error_response("Invalid action")
        return _format_response(response_data)
    except Exception as e:
        return _format_error_response(f"Error processing request: {str(e)}")

def create_session(user_id, title, user_prompt, bot_response, metadata, sent_at):
    sent_at_datetime = datetime.fromisoformat(sent_at)
    current_time_datetime = datetime.utcnow()
    current_time = current_time_datetime.isoformat()
    session_id = _generate_session_id()
    message_id = _generate_message_id()
    
    # Create session entry
    sessions_table.put_item(
        Item={
            'pk_session_id': session_id,
            'user_id': user_id,
            'title': title,
            'created_at': sent_at,
            'updated_at': current_time,
            'message_count': 1
        }
    )
    
    # Create initial message
    response_time = Decimal(str((current_time_datetime - sent_at_datetime).total_seconds()))
    messages_table.put_item(
        Item={
            'pk_message_id': message_id,
            'sk_session_id': session_id,
            'user_prompt': user_prompt,
            'bot_response': bot_response,
            'metadata': metadata,
            'sent_at': sent_at,
            'response_time': response_time
        }
    )
    
    return {"status": "Session created", "session_id": session_id, "message_id": message_id}

def update_message_feedback(message_id, session_id, feedback):
    feedback_created_at = datetime.utcnow().isoformat()
    
    # Update message feedback
    messages_table.update_item(
        Key={'pk_message_id': message_id, 'sk_session_id': session_id},
        UpdateExpression="SET feedback_type = :ft, feedback_rank = :fr, feedback_category = :fc, feedback_message = :fm, feedback_created_at = :fca",
        ExpressionAttributeValues={
            ':ft': feedback['feedback_type'],
            ':fr': feedback['feedback_rank'],
            ':fc': feedback['feedback_category'],
            ':fm': feedback.get('feedback_message', None),
            ':fca': feedback_created_at
        }
    )
    
    # Update session's updated_at
    sessions_table.update_item(
        Key={'pk_session_id': session_id},
        UpdateExpression="SET updated_at = :ua",
        ExpressionAttributeValues={':ua': feedback_created_at}
    )
    
    return {"status": "Feedback updated", "message_id": message_id}

def add_message(session_id, user_prompt, bot_response, metadata, sent_at):
    sent_at_datetime = datetime.fromisoformat(sent_at)
    current_time_datetime = datetime.utcnow()
    current_time = current_time_datetime.isoformat()
    message_id = _generate_message_id()
    
    # Add new message
    response_time = Decimal(str((current_time_datetime - sent_at_datetime).total_seconds()))
    messages_table.put_item(
        Item={
            'pk_message_id': message_id,
            'sk_session_id': session_id,
            'user_prompt': user_prompt,
            'bot_response': bot_response,
            'metadata': metadata,
            'sent_at': sent_at,
            'response_time': response_time
        }
    )
    
    # Update session's updated_at and increment message_count
    sessions_table.update_item(
        Key={'pk_session_id': session_id},
        UpdateExpression="SET updated_at = :ua, message_count = message_count + :inc",
        ExpressionAttributeValues={':ua': current_time, ':inc': 1}
    )
    
    return {"status": "Message added", "session_id": session_id, "message_id": message_id}

def add_review(session_id, reviewed_by, comments):
    review_id = f"review-{int(datetime.now().timestamp())}"
    reviewed_at = datetime.utcnow().isoformat()
    
    reviews_table.put_item(
        Item={
            'pk_review_id': review_id,
            'session_id': session_id,
            'reviewed_by': reviewed_by,
            'comments': comments,
            'reviewed_at': reviewed_at
        }
    )
    
    return {"status": "Review added", "review_id": review_id}

def get_sessions_with_reviews():
    sessions = sessions_table.scan()['Items']
    reviews = reviews_table.scan()['Items']
    sessions_with_reviews = {s['pk_session_id']: s for s in sessions}
    
    for review in reviews:
        session_id = review['session_id']
        if session_id in sessions_with_reviews:
            sessions_with_reviews[session_id]['review'] = review
    
    return list(sessions_with_reviews.values())

def get_sessions_by_user(user_id, limit=15):
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

        # Only set ExclusiveStartKey if it's not None
        if last_evaluated_key:
            query_params['ExclusiveStartKey'] = last_evaluated_key

        response = sessions_table.query(**query_params)
        items.extend(response.get("Items", []))
        
        last_evaluated_key = response.get("LastEvaluatedKey")
        if not last_evaluated_key:
            break

    # Sort the items by timestamp in descending order
    sorted_items = sorted(items, key=lambda x: x['created_at'], reverse=True)

    # Map the items to the desired structure
    formatted_items = [
        {
            "session_id": item["pk_session_id"],
            "title": item["title"].strip(),
            "time_stamp": item["created_at"]
        }
        for item in sorted_items
    ]
    
    return formatted_items

def get_messages_by_session(session_id):
    response = messages_table.query(
        IndexName='SessionMessagesIndex',
        KeyConditionExpression='sk_session_id = :sid',
        ExpressionAttributeValues={':sid': session_id}
    )
    return response['Items']

def get_session(session_id):
    response = sessions_table.get_item(Key={'pk_session_id': session_id})
    return response.get('Item')

def get_message(message_id):
    response = messages_table.get_item(Key={'pk_message_id': message_id})
    return response.get('Item')

def get_review(review_id):
    response = reviews_table.get_item(Key={'pk_review_id': review_id})
    return response.get('Item')

def get_review_by_session(session_id):
    response = reviews_table.query(
        IndexName='SessionReviewIndex',
        KeyConditionExpression='session_id = :sid',
        ExpressionAttributeValues={':sid': session_id}
    )
    return response['Items']

# New function to delete a specific session and associated messages, reviews, and feedback
def delete_session(session_id):
    # Retrieve associated messages
    messages = messages_table.query(
        IndexName='SessionMessagesIndex',
        KeyConditionExpression='sk_session_id = :sid',
        ExpressionAttributeValues={':sid': session_id}
    )['Items']

    # Retrieve associated reviews
    reviews = reviews_table.query(
        IndexName='SessionReviewIndex',
        KeyConditionExpression='session_id = :sid',
        ExpressionAttributeValues={':sid': session_id}
    )['Items']

    # Delete the session, messages, and reviews
    with sessions_table.batch_writer() as batch:
        # Delete the session
        batch.delete_item(
            Key={'pk_session_id': session_id}
        )

    # Delete each message associated with the session
    with messages_table.batch_writer() as batch:
        for message in messages:
            batch.delete_item(
                Key={
                    'pk_message_id': message['pk_message_id'],
                    'sk_session_id': session_id
                }
            )

    # Delete each review associated with the session
    with reviews_table.batch_writer() as batch:
        for review in reviews:
            batch.delete_item(
                Key={'pk_review_id': review['pk_review_id']}
            )

    return {"status": "Session and associated items deleted", "session_id": session_id}

# Function to delete all sessions under a specific user
def delete_user_sessions(user_id):
    # Query for all sessions under the specified user
    sessions = sessions_table.query(
        IndexName='UserSessionsIndex',
        KeyConditionExpression='user_id = :uid',
        ExpressionAttributeValues={':uid': user_id}
    )['Items']

    # Delete each session and associated messages and reviews
    for session in sessions:
        delete_session(session['pk_session_id'])

    return {"status": "All sessions for user deleted", "user_id": user_id}