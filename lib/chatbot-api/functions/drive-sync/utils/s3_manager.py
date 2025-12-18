"""S3 operations manager for Drive sync."""
import json
from typing import Dict, Optional

import boto3
from botocore.exceptions import ClientError

class S3Manager:
    """Manages S3 operations for both Kendra and sync state buckets."""
    
    def __init__(self, kendra_bucket: str, state_bucket: str):
        """Initialize with bucket names.
        
        Args:
            kendra_bucket: Name of Kendra sources bucket
            state_bucket: Name of sync state bucket
        """
        self.s3 = boto3.client('s3')
        self.kendra_bucket = kendra_bucket
        self.state_bucket = state_bucket

    def upload_pdf(self, key: str, data: bytes) -> bool:
        """Upload a PDF to the Kendra bucket.
        
        Args:
            key: S3 object key
            data: File bytes
            
        Returns:
            True if successful, False otherwise
        """
        try:
            self.s3.put_object(
                Bucket=self.kendra_bucket,
                Key=key,
                Body=data,
                ContentType='application/pdf'
            )
            return True
        except Exception as e:
            print(f'Error uploading PDF {key}: {str(e)}')
            return False

    def delete_file(self, key: str) -> bool:
        """Delete a file from the Kendra bucket.
        
        Args:
            key: S3 object key
            
        Returns:
            True if successful, False otherwise
        """
        try:
            self.s3.delete_object(
                Bucket=self.kendra_bucket,
                Key=key
            )
            return True
        except Exception as e:
            print(f'Error deleting file {key}: {str(e)}')
            return False

    def get_sync_state(self) -> Optional[Dict]:
        """Get the current sync state from S3.
        
        Returns:
            Dict of sync state or None if not found
        """
        try:
            response = self.s3.get_object(
                Bucket=self.state_bucket,
                Key='sync_state.json'
            )
            return json.loads(response['Body'].read().decode('utf-8'))
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchKey':
                return None
            print(f'Error reading sync state: {str(e)}')
            return None

    def save_sync_state(self, state: Dict) -> bool:
        """Save sync state to S3.
        
        Args:
            state: Sync state dictionary
            
        Returns:
            True if successful, False otherwise
        """
        try:
            self.s3.put_object(
                Bucket=self.state_bucket,
                Key='sync_state.json',
                Body=json.dumps(state, indent=2).encode('utf-8'),
                ContentType='application/json'
            )
            return True
        except Exception as e:
            print(f'Error saving sync state: {str(e)}')
            return False

    def get_folder_metadata(self) -> Optional[Dict]:
        """Get folder structure metadata from S3.
        
        Returns:
            Dict of folder metadata or None if not found
        """
        try:
            response = self.s3.get_object(
                Bucket=self.state_bucket,
                Key='folder_metadata.json'
            )
            return json.loads(response['Body'].read().decode('utf-8'))
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchKey':
                return None
            print(f'Error reading folder metadata: {str(e)}')
            return None

    def save_folder_metadata(self, metadata: Dict) -> bool:
        """Save folder metadata to S3.
        
        Args:
            metadata: Folder metadata dictionary
            
        Returns:
            True if successful, False otherwise
        """
        try:
            self.s3.put_object(
                Bucket=self.state_bucket,
                Key='folder_metadata.json',
                Body=json.dumps(metadata, indent=2).encode('utf-8'),
                ContentType='application/json'
            )
            return True
        except Exception as e:
            print(f'Error saving folder metadata: {str(e)}')
            return False
