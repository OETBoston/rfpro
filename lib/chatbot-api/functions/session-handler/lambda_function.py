import os
import boto3
from botocore.exceptions import ClientError
import json
from datetime import datetime, timezone
from decimal import Decimal
import uuid

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

def get_session(session_id, user_id):
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
        
        chat_history = [
            {
                "user": message.get("user_prompt", ""),
                "chatbot": message.get("bot_response", ""),
                "metadata": json.dumps(message.get("sources", [])),
                "messageId": message.get("pk_message_id", "")
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

def lambda_handler(event, context):
    data = json.loads(event['body'])
    operation = data.get('operation')
    
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
        return get_session(data['session_id'], data['user_id'])
    elif operation == 'update_session':
        return update_session(data['session_id'], data['user_id'], data['new_chat_entry'])
    elif operation == 'list_sessions_by_user_id':
        return list_sessions_by_user_id(data['user_id'])
    elif operation == 'list_all_sessions_by_user_id':
        return list_sessions_by_user_id(data['user_id'],limit=100)
    elif operation == 'delete_session':
        return delete_session(data['session_id'], data['user_id'])
    elif operation == 'assemble_chat_history':
        return assemble_chat_history(data['session_id'])
    else:
        return {
            'statusCode': 400,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(f"Invalid operation: {operation}")
        }