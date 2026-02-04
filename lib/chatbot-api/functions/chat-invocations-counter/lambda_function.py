"""
Purpose: Monitor Invocations from the chat AWS Lambda Function in order to track total usage of the tool

Overview:
This script is an AWS Lambda function designed to monitor the number of invocations for the lambda function that deals with the chat. 
The script queries AWS CloudWatch for metrics related to the function's invocations and returns the total number of invocations in the last 24 hours.

Environment Variables:
- `CHAT_FUNCTION_NAME`: The name of the Lambda function whose invocation count is to be monitored. This variable must be set in the Lambda environment.

Functions:
- `lambda_handler`: The main entry point for the Lambda function. It retrieves the invocation metrics from CloudWatch for the specified Lambda function and returns the count.

Usage:
Deploy this script as an AWS Lambda function. 

"""

import boto3
import os
from datetime import datetime, timedelta

cloudwatch = boto3.client('cloudwatch')

def lambda_handler(event, context):
    chat_function_name = os.environ['CHAT_FUNCTION_NAME']
    
    end_time = datetime.utcnow()
    start_time = end_time - timedelta(days=1)
    
    response = cloudwatch.get_metric_statistics(
        Namespace='AWS/Lambda',
        MetricName='Invocations',
        Dimensions=[
            {
                'Name': 'FunctionName',
                'Value': chat_function_name
            },
        ],
        StartTime=start_time,
        EndTime=end_time,
        Period=86400,  # 1 day in seconds
        Statistics=['Sum']
    )
    
    invocations_count = response['Datapoints'][0]['Sum'] if response['Datapoints'] else 0
    
    return {
        'statusCode': 200,
        'body': f"{invocations_count}"
    }