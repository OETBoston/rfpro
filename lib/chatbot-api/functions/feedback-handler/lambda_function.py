import json
import uuid
import boto3
import os
from datetime import datetime
from boto3.dynamodb.conditions import Key, Attr
import traceback
import csv
import io

dynamodb = boto3.resource('dynamodb')
messages_table = dynamodb.Table(os.environ.get('FEEDBACK_TABLE'))

from decimal import Decimal

class DecimalEncoder(json.JSONEncoder):
    """
    Updated decimal encoder to follow encoder in the session-handler lambda function
    """
    def default(self, obj):
        if isinstance(obj, Decimal):
            return str(obj)
        return super().default(obj)
    


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
        """
        feedback_data needs to access one layer deeper in JSON
        feedback_type is the "feedbackType" field in input feedbackData JSON ("positive" or "negative" feedback)
        feedback_rank is the "feedbackRank" field in input feedbackData JSON (satisfaction rating). What is default value for thumbs up?
        feedback_category is the "feedbackCategory" field in input feedbackData JSON (category of feedback)
        feedback_message is the "feedbackMessage" field in input feedbackData JSON (additional details from user feedback)
        """
        feedback_data = json.loads(event['body'])['feedbackData']
        session_id = feedback_data['sessionId']
        message_id = feedback_data['messageId']
        feedback_type = feedback_data.get('feedbackType', 'neutral')
        feedback_rank = feedback_data.get('feedbackRank', None)
        feedback_category = feedback_data.get('feedbackCategory', 'general')
        feedback_message = feedback_data.get('feedbackMessage', '')
        feedback_created_at = datetime.utcnow().isoformat()
        if feedback_rank:
            feedback_rank = Decimal(feedback_rank)

        response = messages_table.update_item(
            Key={
                'pk_message_id': message_id,
                'sk_session_id': session_id
            },
            UpdateExpression="SET feedback_type = :type, feedback_rank = :rank, feedback_category = :category, \
                              feedback_message = :message, feedback_created_at = :created_at",
            ExpressionAttributeValues={
                ':type': feedback_type,
                ':rank': feedback_rank,
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
            }, cls=DecimalEncoder) # use JSON decimal encoder to serialize decimal feedback rank
        }

    except Exception as e:
        print(e)
        return {
            'headers': {'Access-Control-Allow-Origin': '*'},
            'statusCode': 500,
            'body': json.dumps({'error': f'Failed to submit feedback: {str(e)}'})
        }
        
    
def download_feedback(event):
    print("[download_feedback] event:", event)
    data = json.loads(event['body'])
    print("[download_feedback] parsed body:", data)
    start_time = data.get('startTime')
    end_time = data.get('endTime')
    topic = data.get('topic')
    print(f"[download_feedback] start_time: {start_time} (type: {type(start_time)}), end_time: {end_time} (type: {type(end_time)}), topic: {topic} (type: {type(topic)})")

    try:
        filter_expression = Key('feedback_created_at').between(start_time, end_time) & Attr('feedback_type').exists()
        if topic in {"Positive", "Negative"}:
            filter_expression = Key('feedback_created_at').between(start_time, end_time) & Attr('feedback_type').eq(topic.lower())
        elif topic in {"Error Messages", "Not Clear", "Poorly Formatted", "Inaccurate", "Not Relevant to My Question", "Other"}:
            filter_expression = Key('feedback_created_at').between(start_time, end_time) & Attr('feedback_category').eq(topic)

        print(f"[download_feedback] Using filter expression: {filter_expression}")

        all_items = []
        last_evaluated_key = None

        while True:
            if last_evaluated_key:
                response = messages_table.scan(
                    FilterExpression=filter_expression,
                    ExclusiveStartKey=last_evaluated_key
                )
            else:
                response = messages_table.scan(
                    FilterExpression=filter_expression
                )
            items = response.get('Items', [])
            all_items.extend(items)
            last_evaluated_key = response.get('LastEvaluatedKey')
            if not last_evaluated_key:
                break

        print(f"[download_feedback] items: {all_items}")

        # Use csv module to write CSV properly
        output = io.StringIO()
        writer = csv.writer(output, quoting=csv.QUOTE_ALL)
        # Define columns
        columns = [
            "FeedbackID", "SessionID", "UserPrompt", "FeedbackComment", "FeedbackCategory", "FeedbackType", "FeedbackRank", "ChatbotMessage", "CreatedAt"
        ]
        writer.writerow(columns)
        for item in all_items:
            writer.writerow([
                item.get('pk_message_id', ''),
                item.get('sk_session_id', ''),
                item.get('user_prompt', ''),
                item.get('feedback_message', ''),
                item.get('feedback_category', ''),
                item.get('feedback_type', ''),
                item.get('feedback_rank', ''),
                item.get('bot_response', ''),
                item.get('feedback_created_at', ''),
            ])
        csv_content = output.getvalue()
        output.close()
        print(f"[download_feedback] csv_content: {csv_content}")

        s3 = boto3.client('s3')
        S3_DOWNLOAD_BUCKET = os.environ["FEEDBACK_S3_DOWNLOAD"]
        file_name = f"feedback-{start_time}-{end_time}.csv"
        print(f"[download_feedback] Uploading to S3 bucket: {S3_DOWNLOAD_BUCKET}, file_name: {file_name}")
        s3.put_object(Bucket=S3_DOWNLOAD_BUCKET, Key=file_name, Body=csv_content)

        presigned_url = s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': S3_DOWNLOAD_BUCKET, 'Key': file_name},
            ExpiresIn=3600
        )
        print(f"[download_feedback] presigned_url: {presigned_url}")

        return {
            'headers': {'Access-Control-Allow-Origin': '*'},
            'statusCode': 200,
            'body': json.dumps({'download_url': presigned_url})
        }

    except Exception as e:
        print("[download_feedback] Exception occurred:", e)
        traceback.print_exc()
        return {
            'headers': {'Access-Control-Allow-Origin': '*'},
            'statusCode': 500,
            'body': json.dumps({'error': f'Failed to retrieve feedback for download: {str(e)}'})
        }
        

def get_feedback(event):
    try:
        query_params = event.get('queryStringParameters', {})
        print(f"Query parameters received: {query_params}")
        
        start_time = query_params.get('startTime')
        end_time = query_params.get('endTime')
        topic = query_params.get('topic')
        print(f"Filtering by time range: {start_time} to {end_time}, topic: {topic}")

        filter_expression = Key('feedback_created_at').between(start_time, end_time) & Attr('feedback_type').exists()
        if topic in {"Positive", "Negative"}:
            filter_expression = Key('feedback_created_at').between(start_time, end_time) & Attr('feedback_type').eq(topic.lower())
        elif topic in {"Error Messages", "Not Clear", "Poorly Formatted", "Inaccurate", "Not Relevant to My Question", "Other"}:
            filter_expression = Key('feedback_created_at').between(start_time, end_time) & Attr('feedback_category').eq(topic)
        
        print(f"Using filter expression: {filter_expression}")

        all_items = []
        last_evaluated_key = None
        
        while True:
            if last_evaluated_key:
                print(f"Continuing scan with LastEvaluatedKey: {last_evaluated_key}")
                response = messages_table.scan(
                    FilterExpression=filter_expression,
                    ExclusiveStartKey=last_evaluated_key
                )
            else:
                print("Starting initial scan")
                response = messages_table.scan(
                    FilterExpression=filter_expression
                )
            
            items = response.get('Items', [])
            print(f"Retrieved {len(items)} items in this batch")
            all_items.extend(items)
            
            last_evaluated_key = response.get('LastEvaluatedKey')
            if not last_evaluated_key:
                print("No more items to scan")
                break
            print(f"More items available, continuing scan")

        print(f"Total items retrieved: {len(all_items)}")

        formatted_feedback = [
            {
                "FeedbackID": item['pk_message_id'],
                "SessionID": item['sk_session_id'],
                "UserPrompt": item.get('user_prompt', ''),
                "FeedbackComments": item.get('feedback_message', ''),
                "FeedbackCategory": item.get('feedback_category', ''),
                "FeedbackRank": item.get('feedback_rank', ''),
                "FeedbackType": item.get('feedback_type', ''),
                "ChatbotMessage": item.get('bot_response', ''),
                "CreatedAt": item.get('feedback_created_at', '')
            }
            for item in all_items
        ]

        print(f"Formatted {len(formatted_feedback)} feedback items")

        return {
            'headers': {'Access-Control-Allow-Origin': '*'},
            'statusCode': 200,
            'body': json.dumps({
                'Items': formatted_feedback
            }, cls=DecimalEncoder)
        }

    except Exception as e:
        print(f"Error in get_feedback: {str(e)}")
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