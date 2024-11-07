import json
import boto3
import os

# Retrieve environment variables for Kendra index and source index
kendra_index = os.environ['KENDRA']
source_index = os.environ['SOURCE']

# Initialize a Kendra client
client = boto3.client('kendra')

def check_running():
    """
    Check if any sync jobs for the specified data source and index are currently running.

    Returns:
        bool: True if there are any ongoing sync or sync-indexing jobs, False otherwise.
    """
    # List ongoing sync jobs with status 'SYNCING'
    syncing = client.list_data_source_sync_jobs(
        Id=source_index,
        IndexId=kendra_index,
        StatusFilter='SYNCING'
    )
    
    # List ongoing sync jobs with status 'SYNCING_INDEXING'
    syncing_indexing = client.list_data_source_sync_jobs(
        Id=source_index,
        IndexId=kendra_index,
        StatusFilter='SYNCING_INDEXING'
    )
    
    # Combine the history of both job types
    hist = syncing_indexing['History'] + syncing['History']
    
    # Check if there are any jobs in the history
    if len(hist) > 0:
        return True

def get_last_sync():    
    syncs = client.list_data_source_sync_jobs(
        Id=source_index,
        IndexId=kendra_index,
        StatusFilter='SUCCEEDED'
    )
    hist = syncs["History"]
    time = hist[0]["EndTime"].strftime('%B %d, %Y, %I:%M%p UTC')
    return {
                'statusCode': 200,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps(time)
            }


def lambda_handler(event, context):
    """
    AWS Lambda handler function for handling requests.

    Args:
        event (dict): The event dictionary containing request data.
        context (dict): The context dictionary containing information about the Lambda function execution.

    Returns:
        dict: A response dictionary with a status code, headers, and body.
    """
    
    # Retrieve the resource path from the event dictionary
    resource_path = event.get('rawPath', '')
    
    # Check if the request is for syncing Kendra
    if "sync-kendra" in resource_path:
        if check_running():
            return {
                'statusCode': 200,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps('STILL SYNCING')
            }
        
        
        else:
            # Check if the request is for syncing Kendra
            client.start_data_source_sync_job(
                    Id=source_index,
                    IndexId=kendra_index
            )
        
            return {
                'statusCode': 200,
                'headers': {
                'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps('STARTED SYNCING')
            }
   
    # Check if the request is for checking the sync status        
    elif "still-syncing" in resource_path:
        status_msg = 'STILL SYNCING' if check_running() else 'DONE SYNCING'
        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(status_msg)
            }
    elif "last-sync" in resource_path:
        return get_last_sync()