import json
import uuid
import boto3
import os
from datetime import datetime
from boto3.dynamodb.conditions import Key, Attr

dynamodb = boto3.resource('dynamodb')
messages_table = dynamodb.Table(os.environ.get('MESSAGES_TABLE'))

from decimal import Decimal

class DecimalEncoder(json.JSONEncoder):
  def default(self, obj):
    if isinstance(obj, Decimal):
      return str(obj)
    return json.JSONEncoder.default(self, obj)
    

def lambda_handler(event, context):
    print(event)
    http_method = event.get('routeKey')
    if 'POST' in http_method:
        if event.get('rawPath') == '/user-feedback/download-feedback':
            return download_feedback(event)
        return post_feedback(event)
    elif 'GET' in http_method:
        return get_feedback(event)
    elif 'DELETE' in http_method:
        return delete_feedback(event)
    else:
        return {
            'statusCode': 405,
            'body': json.dumps('Method Not Allowed')
        }

def post_feedback(event):
    try:
        feedback_data = json.loads(event['body'])
        session_id = feedback_data['session_id']
        message_id = feedback_data['message_id']
        feedback_type = feedback_data.get('feedback_type', 'neutral')
        feedback_rank = feedback_data.get('feedback_rank', 0)
        feedback_category = feedback_data.get('feedback_category', 'general')
        feedback_message = feedback_data.get('feedback_message', '')
        feedback_created_at = datetime.utcnow().isoformat()

        response = messages_table.update_item(
            Key={
                'pk_message_id': message_id,
                'sk_session_id': session_id
            },
            UpdateExpression="SET feedback_type = :type, feedback_rank = :rank, feedback_category = :category, \
                              feedback_message = :message, feedback_created_at = :created_at",
            ExpressionAttributeValues={
                ':type': feedback_type,
                ':rank': Decimal(feedback_rank),
                ':category': feedback_category,
                ':message': feedback_message,
                ':created_at': feedback_created_at
            },
            ReturnValues="UPDATED_NEW"
        )

        return {
            'headers': {'Access-Control-Allow-Origin': '*'},
            'statusCode': 200,
            'body': json.dumps({
                'FeedbackID': message_id,
                'updated_attributes': response['Attributes']
            })
        }

    except Exception as e:
        print(e)
        return {
            'headers': {'Access-Control-Allow-Origin': '*'},
            'statusCode': 500,
            'body': json.dumps({'error': f'Failed to submit feedback: {str(e)}'})
        }
        
    
def download_feedback(event):
    data = json.loads(event['body'])
    start_time = data.get('startTime') + "T00:00:00"
    end_time = data.get('endTime') + "T23:59:59"
    session_id = data.get('session_id')

    try:
        query_kwargs = {
            'IndexName': 'SessionMessagesIndex',
            'KeyConditionExpression': Key('sk_session_id').eq(session_id) & Key('created_at').between(start_time, end_time),
            'FilterExpression': Attr('feedback_type').exists(),
            'ScanIndexForward': False
        }
        response = messages_table.query(**query_kwargs)
        items = response.get('Items', [])

        csv_content = "FeedbackID, SessionID, UserPrompt, FeedbackComment, Topic, Problem, Feedback, ChatbotMessage, CreatedAt\n"
        for item in items:
            csv_content += f"{item['pk_message_id']},{item['sk_session_id']},{item.get('user_prompt', '')},{item.get('feedback_message', '').replace(',', '')},{item.get('feedback_category', '')},, \
                            {item.get('feedback_type', '')},{item.get('bot_response', '').replace(',', '')},{item.get('feedback_created_at', '')}\n"

        s3 = boto3.client('s3')
        S3_DOWNLOAD_BUCKET = os.environ["FEEDBACK_S3_DOWNLOAD"]
        file_name = f"feedback-{start_time}-{end_time}.csv"
        s3.put_object(Bucket=S3_DOWNLOAD_BUCKET, Key=file_name, Body=csv_content)

        presigned_url = s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': S3_DOWNLOAD_BUCKET, 'Key': file_name},
            ExpiresIn=3600
        )

        return {
            'headers': {'Access-Control-Allow-Origin': '*'},
            'statusCode': 200,
            'body': json.dumps({'download_url': presigned_url})
        }

    except Exception as e:
        print(e)
        return {
            'headers': {'Access-Control-Allow-Origin': '*'},
            'statusCode': 500,
            'body': json.dumps({'error': f'Failed to retrieve feedback for download: {str(e)}'})
        }
        

def get_feedback(event):
    try:
        query_params = event.get('queryStringParameters', {})
        session_id = query_params.get('session_id')
        start_time = query_params.get('startTime') + "T00:00:00"
        end_time = query_params.get('endTime') + "T23:59:59"

        query_kwargs = {
            'IndexName': 'SessionMessagesIndex',
            'KeyConditionExpression': Key('sk_session_id').eq(session_id) & Key('created_at').between(start_time, end_time),
            'FilterExpression': Attr('feedback_type').exists(),
            'ScanIndexForward': False
        }

        response = messages_table.query(**query_kwargs)
        items = response.get('Items', [])

        formatted_feedback = [
            {
                "FeedbackID": item['pk_message_id'],
                "SessionID": item['sk_session_id'],
                "UserPrompt": item.get('user_prompt', ''),
                "FeedbackComment": item.get('feedback_message', ''),
                "Topic": item.get('feedback_category', ''),
                "Problem": "",
                "Feedback": item.get('feedback_type', ''),
                "ChatbotMessage": item.get('bot_response', ''),
                "CreatedAt": item.get('feedback_created_at', '')
            }
            for item in items
        ]

        return {
            'headers': {'Access-Control-Allow-Origin': '*'},
            'statusCode': 200,
            'body': json.dumps({'Items': formatted_feedback})
        }

    except Exception as e:
        print(e)
        return {
            'headers': {'Access-Control-Allow-Origin': '*'},
            'statusCode': 500,
            'body': json.dumps({'error': f'Failed to retrieve feedback: {str(e)}'})
        }


def delete_feedback(event):
    try:
        data = json.loads(event['body'])
        session_id = data['session_id']
        message_id = data['message_id']

        response = messages_table.update_item(
            Key={
                'pk_message_id': message_id,
                'sk_session_id': session_id
            },
            UpdateExpression="REMOVE feedback_type, feedback_rank, feedback_category, feedback_message, feedback_created_at",
            ReturnValues="UPDATED_NEW"
        )

        return {
            'headers': {'Access-Control-Allow-Origin': '*'},
            'statusCode': 200,
            'body': json.dumps({'message': 'Feedback deleted successfully', 'updated_attributes': response['Attributes']})
        }

    except Exception as e:
        print(e)
        return {
            'headers': {'Access-Control-Allow-Origin': '*'},
            'statusCode': 500,
            'body': json.dumps({'error': f'Failed to delete feedback: {str(e)}'})
        }