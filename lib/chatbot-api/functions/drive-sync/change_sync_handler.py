"""Lambda handler for Drive change sync operation."""
import json
import os
from typing import Dict, Any
import boto3

from utils.drive_client import DriveClient
from utils.file_processor import FileProcessor
from utils.s3_manager import S3Manager
from utils.metadata_manager import MetadataManager

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Handle Drive change sync request.
    
    Args:
        event: Lambda event
        context: Lambda context
        
    Returns:
        API Gateway response
    """
    try:
        # Initialize clients
        drive_client = DriveClient(os.environ['GOOGLE_CREDENTIALS_SECRET_ARN'])
        s3_manager = S3Manager(
            os.environ['KNOWLEDGE_BUCKET_NAME'],
            os.environ['SYNC_STATE_BUCKET_NAME']
        )
        metadata_manager = MetadataManager(s3_manager)
        
        # Get start token from last sync
        start_page_token = metadata_manager.get_start_page_token()
        if not start_page_token:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'success': False,
                    'error': 'No start page token found. Please run backfill first.'
                })
            }
        
        # Get changes
        changes, new_start_token = drive_client.get_changes(start_page_token)
        if not new_start_token:
            return {
                'statusCode': 500,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'success': False,
                    'error': 'Failed to get new start token'
                })
            }
        
        processed_count = 0
        errors = []
        
        # Process each change
        for change in changes:
            try:
                file_id = change['fileId']
                
                # Handle deletions
                if change.get('removed'):
                    # Get existing mapping
                    mapping = metadata_manager.get_file_mapping(file_id)
                    if mapping:
                        # Delete from S3 and metadata
                        s3_manager.delete_file(mapping['s3Key'])
                        metadata_manager.remove_file(file_id)
                        metadata_manager.remove_folder_metadata(file_id)
                        processed_count += 1
                    continue
                
                # Handle file updates
                file = change.get('file', {})
                mime_type = file.get('mimeType')
                
                # Skip unsupported types
                if not FileProcessor.is_supported_type(mime_type):
                    continue
                
                # Download and convert file
                file_data = drive_client.download_file(file_id, mime_type)
                if not file_data:
                    errors.append(f"Failed to download file: {file.get('name', file_id)}")
                    continue
                
                # Generate S3 key and upload
                s3_key = FileProcessor.generate_flat_key(file_id, file['name'])
                if not s3_manager.upload_pdf(s3_key, file_data):
                    errors.append(f"Failed to upload file: {file.get('name', file_id)}")
                    continue
                
                # Update metadata
                md5_hash = FileProcessor.calculate_hash(file_data)
                metadata_manager.update_file_mapping(file_id, s3_key, md5_hash)
                
                # Update folder structure
                parents = file.get('parents', [])
                if parents:
                    parent_path = parents[0]  # Using first parent for simplicity
                    metadata_manager.update_folder_structure(
                        file_id,
                        parent_path,
                        file['name']
                    )
                
                processed_count += 1
                
            except Exception as e:
                errors.append(f"Error processing change for file {file_id}: {str(e)}")
                continue
        
        # Save new start token
        metadata_manager.update_start_page_token(new_start_token)
        
        # Trigger Knowledge Base ingestion job
        print("Triggering Knowledge Base ingestion job...")
        try:
            bedrock_agent_client = boto3.client('bedrock-agent')
            kb_id = os.environ.get('KB_ID')
            kb_data_source_id = os.environ.get('KB_DATA_SOURCE_ID')
            
            if kb_id and kb_data_source_id:
                sync_response = bedrock_agent_client.start_ingestion_job(
                    knowledgeBaseId=kb_id,
                    dataSourceId=kb_data_source_id
                )
                print(f"Knowledge Base ingestion job started: {sync_response.get('ingestionJob', {}).get('ingestionJobId')}")
            else:
                print("WARNING: Knowledge Base ID or data source ID not configured, skipping ingestion")
        except Exception as e:
            print(f"WARNING: Failed to trigger Knowledge Base ingestion: {str(e)}")
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': True,
                'changes_processed': processed_count,
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
