"""Lambda handler for Drive backfill operation."""
import json
import os
from typing import Dict, Any
import boto3

from utils.drive_client import DriveClient
from utils.file_processor import FileProcessor
from utils.s3_manager import S3Manager
from utils.metadata_manager import MetadataManager

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Handle Drive backfill request.
    
    Args:
        event: Lambda event
        context: Lambda context
        
    Returns:
        API Gateway response
    """
    # Check if this is an async invocation (from another Lambda or direct invoke)
    is_async = event.get('source') == 'async' or 'requestContext' not in event
    
    # If called from API Gateway, invoke self asynchronously and return immediately
    if not is_async and 'requestContext' in event:
        print("API Gateway invocation detected - triggering async execution")
        lambda_client = boto3.client('lambda')
        lambda_client.invoke(
            FunctionName=context.function_name,
            InvocationType='Event',  # Async invocation
            Payload=json.dumps({'source': 'async'})
        )
        return {
            'statusCode': 202,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': True,
                'message': 'Drive backfill operation started in background',
                'status': 'processing'
            })
        }
    
    try:
        print(f"Starting Drive backfill operation")
        print(f"Environment - Kendra Bucket: {os.environ.get('KENDRA_BUCKET_NAME')}")
        print(f"Environment - Sync State Bucket: {os.environ.get('SYNC_STATE_BUCKET_NAME')}")
        print(f"Environment - Drive Folder ID: {os.environ.get('GCP_DRIVE_FOLDER_ID')}")
        
        # Initialize clients
        print("Initializing Drive client...")
        drive_client = DriveClient(os.environ['GOOGLE_CREDENTIALS_SECRET_ARN'])
        
        print("Initializing S3 manager...")
        s3_manager = S3Manager(
            os.environ['KENDRA_BUCKET_NAME'],
            os.environ['SYNC_STATE_BUCKET_NAME']
        )
        metadata_manager = MetadataManager(s3_manager)
        
        # Get current Drive state
        print("Getting Drive start page token...")
        start_token = drive_client.service.changes().getStartPageToken().execute()
        start_page_token = start_token.get('startPageToken')
        print(f"Start page token: {start_page_token}")
        
        # List all files
        print("Listing all files recursively from Drive...")
        files = drive_client.list_all_files()
        print(f"Found {len(files)} files in Drive")
        
        processed_count = 0
        errors = []
        
        # Process each file
        for idx, file in enumerate(files, 1):
            try:
                file_id = file['id']
                file_name = file.get('name', file_id)
                mime_type = file['mimeType']
                
                print(f"Processing file {idx}/{len(files)}: {file_name} (ID: {file_id}, Type: {mime_type})")
                
                # Download and convert file
                print(f"  Downloading file: {file_name}")
                file_data = drive_client.download_file(file_id, mime_type)
                if not file_data:
                    error_msg = f"Failed to download file: {file_name}"
                    print(f"  ERROR: {error_msg}")
                    errors.append(error_msg)
                    continue
                
                print(f"  Downloaded {len(file_data)} bytes")
                
                # Generate S3 key and upload
                s3_key = FileProcessor.generate_flat_key(file_id, file_name)
                print(f"  Uploading to S3 with key: {s3_key}")
                
                if not s3_manager.upload_pdf(s3_key, file_data):
                    error_msg = f"Failed to upload file: {file_name}"
                    print(f"  ERROR: {error_msg}")
                    errors.append(error_msg)
                    continue
                
                print(f"  Successfully uploaded to S3")
                
                # Update metadata
                md5_hash = FileProcessor.calculate_hash(file_data)
                metadata_manager.update_file_mapping(file_id, s3_key, md5_hash)
                
                # Store folder structure
                parents = file.get('parents', [])
                if parents:
                    parent_path = parents[0]  # Using first parent for simplicity
                    metadata_manager.update_folder_structure(
                        file_id,
                        parent_path,
                        file_name
                    )
                
                processed_count += 1
                print(f"  ✓ Successfully processed file {idx}/{len(files)}")
                
            except Exception as e:
                error_msg = f"Error processing file {file.get('name', file_id)}: {str(e)}"
                print(f"  ERROR: {error_msg}")
                errors.append(error_msg)
                continue
        
        # Save final state
        print(f"Saving final sync state with token: {start_page_token}")
        metadata_manager.update_start_page_token(start_page_token)
        print(f"Backfill complete. Processed {processed_count} files with {len(errors)} errors")
        
        # Trigger Kendra data source sync
        print("Triggering Kendra data source sync...")
        try:
            kendra_client = boto3.client('kendra')
            kendra_index_id = os.environ.get('KENDRA_INDEX_ID')
            kendra_data_source_id = os.environ.get('KENDRA_DATA_SOURCE_ID')
            
            if kendra_index_id and kendra_data_source_id:
                sync_response = kendra_client.start_data_source_sync_job(
                    Id=kendra_data_source_id,
                    IndexId=kendra_index_id
                )
                print(f"Kendra sync job started: {sync_response.get('ExecutionId')}")
            else:
                print("WARNING: Kendra index or data source ID not configured, skipping sync")
        except Exception as e:
            print(f"WARNING: Failed to trigger Kendra sync: {str(e)}")
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': True,
                'processed_files': processed_count,
                'errors': errors
            })
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': False,
                'error': str(e)
            })
        }
