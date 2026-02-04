"""
Purpose: Lambda functions to deal with requests surrounding KPIs (chatbot uses/interactions)

Overview:
This file provides an AWS Lambda function designed to handle HTTP requests for managing KPIs.
It queries session and message data from the existing DynamoDB tables.
Admin users can access all functionalities, while non-admins have limited permissions.

Environment variables:
- `SESSIONS_TABLE`: The name of the DynamoDB table storing sessions.
- `MESSAGES_TABLE`: The name of the DynamoDB table storing messages.
- `INTERACTION_S3_DOWNLOAD`: The S3 bucket used for storing downloadable interaction data CSV files.

Functions:
- `lambda_handler`: Main entry point for the Lambda function.
- `download_interactions`: Handles POST requests to generate and return a downloadable CSV file of interactions.
- `get_interactions`: Handles GET requests to retrieve chatbot interactions with optional pagination support.
- `delete_interactions`: Handles DELETE requests to remove specific message entries from the DynamoDB table.
- `get_daily_users`: Handles GET requests to retrieve daily unique user counts (computed from sessions).
"""

import json
import boto3
import os
from datetime import datetime, timedelta
from boto3.dynamodb.conditions import Key, Attr
from decimal import Decimal
from collections import defaultdict

# Initialize DynamoDB client
dynamodb = boto3.resource('dynamodb')
sessions_table = dynamodb.Table(os.environ.get('SESSIONS_TABLE'))
messages_table = dynamodb.Table(os.environ.get('MESSAGES_TABLE'))


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj) if obj % 1 else int(obj)
        return json.JSONEncoder.default(self, obj)


def lambda_handler(event, context):
    # Continue with normal API Gateway request processing
    admin = False
    try:
        claims = event["requestContext"]["authorizer"]["jwt"]["claims"]
        # Use cognito:groups for authorization
        groups = claims.get('cognito:groups', [])
        if isinstance(groups, str):
            admin = "AdminUsers" in groups
        else:
            admin = "AdminUsers" in groups
        if not admin:
            print("User is not in AdminUsers group")
    except Exception as e:
        print(f"Caught error checking admin access: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps('Unable to check user role, please ensure you have Cognito configured correctly with cognito:groups.')
        }
    
    http_method = event.get('routeKey')
    
    if http_method == "GET /daily-logins": 
        return get_daily_users(event)
    elif http_method == 'POST /chatbot-use/download' and admin:
        print('Downloading interactions')
        return download_interactions(event)
    elif 'GET' in http_method and admin:
        return get_interactions(event)
    elif 'DELETE' in http_method and admin:
        return delete_interactions(event)
    else:
        return {
            'statusCode': 405,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps('Method Not Allowed')
        }


def get_daily_users(event):
    """
    Compute daily unique user counts on-demand from the sessions table.
    Returns data formatted for bar chart display.
    """
    try:
        query_params = event.get('queryStringParameters', {})
        start_date = query_params.get('startDate')
        end_date = query_params.get('endDate')
        
        # Parse and validate dates
        start_date = datetime.strptime(start_date, "%Y-%m-%d")
        end_date = datetime.strptime(end_date, "%Y-%m-%d")
        
        # Format for DynamoDB query
        start_date_str = start_date.strftime("%Y-%m-%d")
        end_date_str = (end_date + timedelta(days=1)).strftime("%Y-%m-%d")  # Include end date
        
        # Scan sessions within the date range
        scan_kwargs = {
            'FilterExpression': Attr('created_at').gte(start_date_str) & Attr('created_at').lt(end_date_str),
            'ProjectionExpression': 'user_id, created_at'
        }
        
        response = sessions_table.scan(**scan_kwargs)
        all_sessions = response.get('Items', [])
        
        # Handle pagination
        while 'LastEvaluatedKey' in response:
            scan_kwargs['ExclusiveStartKey'] = response['LastEvaluatedKey']
            response = sessions_table.scan(**scan_kwargs)
            all_sessions.extend(response.get('Items', []))
        
        # Group sessions by date and count unique users per day
        daily_users = defaultdict(set)
        for session in all_sessions:
            created_at = session.get('created_at', '')
            user_id = session.get('user_id', '')
            if created_at and user_id:
                # Extract date part (YYYY-MM-DD)
                date_key = created_at.split('T')[0]
                daily_users[date_key].add(user_id)
        
        # Convert to list format expected by frontend
        logins = [
            {'Timestamp': date, 'Count': len(users)}
            for date, users in daily_users.items()
        ]
        
        # Sort by date
        logins.sort(key=lambda x: x['Timestamp'])

        return {
            'headers': {'Access-Control-Allow-Origin': "*"},
            'statusCode': 200,
            'body': json.dumps({'logins': logins}, cls=DecimalEncoder)
        }

    except Exception as e:
        print(f"Error retrieving daily users: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            'headers': {'Access-Control-Allow-Origin': "*"},
            'statusCode': 500,
            'body': json.dumps({'error': f"Failed to retrieve daily users: {str(e)}"})
        }


def download_interactions(event):
    """
    Generate a CSV file of all interactions within the given time range.
    Queries from messages and sessions tables.
    """
    data = json.loads(event['body'])
    start_time = data.get('startTime')
    end_time = data.get('endTime')
    
    start_time = datetime.strptime(start_time, '%Y-%m-%dT%H:%M:%S.%fZ')
    end_time = datetime.strptime(end_time, '%Y-%m-%dT%H:%M:%S.%fZ')

    start_time_iso = start_time.isoformat(timespec='milliseconds') + 'Z'
    end_time_iso = end_time.isoformat(timespec='milliseconds') + 'Z'

    if not start_time or not end_time:
        return {
            'statusCode': 400,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Missing required query parameters'})
        }

    try:
        # First, get all sessions in the time range
        sessions_response = sessions_table.scan(
            FilterExpression=Attr("created_at").between(start_time_iso, end_time_iso)
        )
        sessions = sessions_response.get('Items', [])
        
        # Handle pagination
        while 'LastEvaluatedKey' in sessions_response:
            sessions_response = sessions_table.scan(
                FilterExpression=Attr("created_at").between(start_time_iso, end_time_iso),
                ExclusiveStartKey=sessions_response['LastEvaluatedKey']
            )
            sessions.extend(sessions_response.get('Items', []))
        
        # Build a map of session_id -> user_id
        session_user_map = {s['pk_session_id']: s.get('user_id', 'Unknown') for s in sessions}
        session_ids = list(session_user_map.keys())
        
        # Get all messages for these sessions
        all_messages = []
        for session_id in session_ids:
            msg_response = messages_table.query(
                IndexName='SessionMessagesIndex',
                KeyConditionExpression=Key('sk_session_id').eq(session_id)
            )
            for msg in msg_response.get('Items', []):
                msg['user_id'] = session_user_map.get(session_id, 'Unknown')
            all_messages.extend(msg_response.get('Items', []))
        
        # Also get messages created in the time range (for existing sessions)
        msg_scan = messages_table.scan(
            FilterExpression=Attr("created_at").between(start_time_iso, end_time_iso)
        )
        
        existing_message_ids = set(m['pk_message_id'] for m in all_messages)
        for msg in msg_scan.get('Items', []):
            if msg['pk_message_id'] not in existing_message_ids:
                # Get user_id from session if not already known
                session_id = msg.get('sk_session_id')
                if session_id and session_id not in session_user_map:
                    session_resp = sessions_table.get_item(Key={'pk_session_id': session_id})
                    if 'Item' in session_resp:
                        session_user_map[session_id] = session_resp['Item'].get('user_id', 'Unknown')
                msg['user_id'] = session_user_map.get(session_id, 'Unknown')
                all_messages.append(msg)
        
    except Exception as e:
        print(f"Error retrieving interaction data: {str(e)}")
        return {
            'headers': {'Access-Control-Allow-Origin': "*"},
            'statusCode': 500,
            'body': json.dumps('Failed to retrieve interaction data for download: ' + str(e))
        }

    def clean_csv(field):
        field = str(field).replace('"', '""')
        if ',' in field or '\n' in field or '"' in field:
            field = f'"{field}"'
        return field
    
    # Build CSV content
    csv_content = "Timestamp,Username,User Prompt,Bot Message,Response Time\n"
    for item in all_messages:
        # Gracefully handle missing response_time (backwards compatibility)
        response_time = item.get('response_time', 0)
        if response_time is None:
            response_time = 0
        csv_content += (
            f"{clean_csv(item.get('created_at', ''))},"
            f"{clean_csv(item.get('user_id', 'Unknown'))},"
            f"{clean_csv(item.get('user_prompt', ''))},"
            f"{clean_csv(item.get('bot_response', ''))},"
            f"{clean_csv(response_time)}\n"
        )
    
    s3 = boto3.client('s3')
    S3_DOWNLOAD_BUCKET = os.environ["INTERACTION_S3_DOWNLOAD"]

    start_date = start_time.strftime('%Y-%m-%d')
    end_date = end_time.strftime('%Y-%m-%d')

    try:
        file_name = f"interaction-data-{start_date}_to_{end_date}.csv"
        s3.put_object(Bucket=S3_DOWNLOAD_BUCKET, Key=file_name, Body=csv_content)
        presigned_url = s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': S3_DOWNLOAD_BUCKET, 'Key': file_name},
            ExpiresIn=3600
        )

    except Exception as e:
        print(f"S3 error: {str(e)}")
        return {
            'headers': {'Access-Control-Allow-Origin': "*"},
            'statusCode': 500,
            'body': json.dumps('Failed to generate download link: ' + str(e))
        }

    return {
        'headers': {'Access-Control-Allow-Origin': "*"},
        'statusCode': 200,
        'body': json.dumps({'download_url': presigned_url})
    }


def get_interactions(event):
    """
    Retrieve chatbot interactions from the messages table.
    Supports pagination via nextPageToken.
    """
    try:
        query_params = event.get('queryStringParameters', {})
        print("Query params:", query_params)
        start_time = query_params.get('startTime')
        end_time = query_params.get('endTime')
        exclusive_start_key = query_params.get('nextPageToken')
        
        start_time = datetime.strptime(start_time, '%Y-%m-%dT%H:%M:%S.%fZ')
        end_time = datetime.strptime(end_time, '%Y-%m-%dT%H:%M:%S.%fZ')
        start_time_iso = start_time.isoformat(timespec='milliseconds') + 'Z'
        end_time_iso = end_time.isoformat(timespec='milliseconds') + 'Z'
        
        if not start_time or not end_time:
            return {
                'statusCode': 400,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Missing required query parameters'})
            }

        # First, get messages in the time range
        scan_kwargs = {
            'FilterExpression': Attr("created_at").between(start_time_iso, end_time_iso),
        }
        
        if exclusive_start_key:
            scan_kwargs['ExclusiveStartKey'] = json.loads(exclusive_start_key)

        response = messages_table.scan(**scan_kwargs)
        messages = response.get('Items', [])
        
        # Get user_ids from sessions
        session_ids = set(m.get('sk_session_id') for m in messages if m.get('sk_session_id'))
        session_user_map = {}
        
        for session_id in session_ids:
            session_resp = sessions_table.get_item(Key={'pk_session_id': session_id})
            if 'Item' in session_resp:
                session_user_map[session_id] = session_resp['Item'].get('user_id', 'Unknown')
        
        # Format response to match expected KPI format
        formatted_items = []
        for msg in messages:
            session_id = msg.get('sk_session_id', '')
            # Gracefully handle missing response_time (backwards compatibility)
            response_time = msg.get('response_time', 0)
            if response_time is None:
                response_time = 0
            formatted_items.append({
                'Timestamp': msg.get('created_at', ''),
                'Username': session_user_map.get(session_id, 'Unknown'),
                'UserPrompt': msg.get('user_prompt', ''),
                'BotMessage': msg.get('bot_response', ''),
                'ResponseTime': response_time,
                'MessageId': msg.get('pk_message_id', ''),
                'SessionId': session_id
            })
        
        # Sort by timestamp descending
        formatted_items.sort(key=lambda x: x['Timestamp'], reverse=True)

        body = {
            'Items': formatted_items
        }

        if 'LastEvaluatedKey' in response:
            body['NextPageToken'] = json.dumps(response['LastEvaluatedKey'])

        return {
            'headers': {'Access-Control-Allow-Origin': "*"},
            'statusCode': 200,
            'body': json.dumps(body, cls=DecimalEncoder)
        }

    except Exception as e:
        print(f"Error retrieving interactions: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            'headers': {'Access-Control-Allow-Origin': "*"},
            'statusCode': 500,
            'body': json.dumps({'error': f"Failed to retrieve data: {str(e)}"})
        }


def delete_interactions(event):
    """
    Delete a message from the messages table.
    Requires MessageId and SessionId in query parameters.
    """
    try:
        query_params = event.get('queryStringParameters', {})
        message_id = query_params.get('MessageId')
        session_id = query_params.get('SessionId')

        if not message_id or not session_id:
            return {
                'headers': {'Access-Control-Allow-Origin': '*'},
                'statusCode': 400,
                'body': json.dumps('Missing MessageId or SessionId')
            }
            
        response = messages_table.delete_item(
            Key={
                'pk_message_id': message_id,
                'sk_session_id': session_id
            }
        )
        
        return {
            'headers': {'Access-Control-Allow-Origin': '*'},
            'statusCode': 200,
            'body': json.dumps({'message': 'Interaction item deleted successfully'})
        }
    except Exception as e:
        print(f"Error deleting interaction: {str(e)}")
        return {
            'headers': {'Access-Control-Allow-Origin': '*'},
            'statusCode': 500,
            'body': json.dumps('Failed to delete interaction item: ' + str(e))
        }
