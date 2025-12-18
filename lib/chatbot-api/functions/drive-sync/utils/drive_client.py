"""Google Drive API client for file operations."""
import base64
import json
import os
from typing import Dict, List, Optional, Tuple

import boto3
from google.oauth2.credentials import Credentials
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
import io

class DriveClient:
    """Client for interacting with Google Drive API."""
    
    SUPPORTED_MIME_TYPES = {
        'application/pdf',
        'application/vnd.google-apps.document',
        'application/vnd.google-apps.spreadsheet',
        'application/vnd.google-apps.presentation'
    }
    
    EXPORT_MIME_TYPES = {
        'application/vnd.google-apps.document': 'application/pdf',
        'application/vnd.google-apps.spreadsheet': 'application/pdf',
        'application/vnd.google-apps.presentation': 'application/pdf'
    }

    def __init__(self, secret_arn: str):
        """Initialize the Drive client with service account credentials from Secrets Manager.
        
        Args:
            secret_arn: ARN of the secret containing service account JSON credentials
        """
        # Get credentials from Secrets Manager
        secrets_client = boto3.client('secretsmanager')
        secret_value = secrets_client.get_secret_value(SecretId=secret_arn)
        credentials_json = json.loads(secret_value['SecretString'])
        self.credentials = service_account.Credentials.from_service_account_info(credentials_json)
        self.service = build('drive', 'v3', credentials=self.credentials)

    def list_all_files(self) -> List[Dict]:
        """List all files in Drive recursively, filtering for supported types.
        
        Returns:
            List of file metadata dictionaries
        """
        results = []
        folder_id = os.environ['GCP_DRIVE_FOLDER_ID']
        
        print(f"Starting recursive scan from folder: {folder_id}")
        
        # First, verify we can access the folder itself
        try:
            folder_info = self.service.files().get(
                fileId=folder_id,
                fields='id, name, mimeType, capabilities',
                supportsAllDrives=True
            ).execute()
            print(f"Root folder info: Name='{folder_info.get('name')}', Type={folder_info.get('mimeType')}")
            print(f"Capabilities: {folder_info.get('capabilities', {})}")
        except Exception as e:
            print(f"ERROR: Cannot access folder {folder_id}: {str(e)}")
            return results
        
        # Get all files recursively
        folders_to_process = [folder_id]
        processed_folders = set()
        
        while folders_to_process:
            current_folder = folders_to_process.pop(0)
            
            # Skip if already processed
            if current_folder in processed_folders:
                continue
            processed_folders.add(current_folder)
            
            print(f"  Scanning folder: {current_folder}")
            
            page_token = None
            folder_item_count = 0
            folder_file_count = 0
            subfolder_count = 0
            
            while True:
                try:
                    # Query for all items in the current folder
                    query = f"'{current_folder}' in parents and trashed=false"
                    print(f"    Query: {query}")
                    response = self.service.files().list(
                        q=query,
                        spaces='drive',
                        fields='nextPageToken, files(id, name, mimeType, md5Checksum, modifiedTime, parents, shortcutDetails)',
                        pageToken=page_token,
                        supportsAllDrives=True,
                        includeItemsFromAllDrives=True
                    ).execute()
                    
                    items = response.get('files', [])
                    print(f"    API returned {len(items)} items")
                    folder_item_count += len(items)
                    
                    for item in items:
                        mime_type = item.get('mimeType')
                        item_name = item.get('name', 'Unknown')
                        
                        # If it's a folder, add to processing queue
                        if mime_type == 'application/vnd.google-apps.folder':
                            folders_to_process.append(item['id'])
                            subfolder_count += 1
                            print(f"    Found subfolder: {item_name} (ID: {item['id']})")
                        # If it's a shortcut, resolve it to the target file
                        elif mime_type == 'application/vnd.google-apps.shortcut':
                            shortcut_details = item.get('shortcutDetails', {})
                            target_id = shortcut_details.get('targetId')
                            target_mime_type = shortcut_details.get('targetMimeType')
                            
                            if target_id and target_mime_type:
                                # If target is a folder, add to processing queue
                                if target_mime_type == 'application/vnd.google-apps.folder':
                                    folders_to_process.append(target_id)
                                    subfolder_count += 1
                                    print(f"    Found folder shortcut: {item_name} -> Folder (ID: {target_id})")
                                # If target is a supported file type, add to results
                                elif target_mime_type in self.SUPPORTED_MIME_TYPES:
                                    # Create a new item with target information
                                    target_item = {
                                        'id': target_id,
                                        'name': item_name,
                                        'mimeType': target_mime_type,
                                        'parents': item.get('parents', [])
                                    }
                                    results.append(target_item)
                                    folder_file_count += 1
                                    print(f"    Found file shortcut: {item_name} -> {target_mime_type} (ID: {target_id})")
                                else:
                                    print(f"    Skipping shortcut to unsupported type: {item_name} -> {target_mime_type}")
                            else:
                                print(f"    Skipping invalid shortcut: {item_name}")
                        # If it's a supported file type, add to results
                        elif mime_type in self.SUPPORTED_MIME_TYPES:
                            results.append(item)
                            folder_file_count += 1
                            print(f"    Found file: {item_name} (Type: {mime_type})")
                        # Log unsupported types for debugging
                        else:
                            print(f"    Skipping item: {item_name} (Type: {mime_type})")
                    
                    page_token = response.get('nextPageToken')
                    if not page_token:
                        break
                        
                except Exception as e:
                    print(f'Error listing files in folder {current_folder}: {str(e)}')
                    break
            
            print(f"  Folder scan complete: {folder_item_count} items, {folder_file_count} files, {subfolder_count} subfolders")
        
        print(f"Recursive scan complete: {len(results)} total files found across {len(processed_folders)} folders")
        return results

    def get_changes(self, start_page_token: str) -> Tuple[List[Dict], str]:
        """Get changes since the last sync.
        
        Args:
            start_page_token: Token from previous sync
            
        Returns:
            Tuple of (list of changes, new start page token)
        """
        changes = []
        page_token = start_page_token
        new_start_token = None
        
        while page_token:
            try:
                response = self.service.changes().list(
                    pageToken=page_token,
                    spaces='drive',
                    fields='newStartPageToken, nextPageToken, changes(fileId, file(id, name, mimeType, md5Checksum, modifiedTime, parents), removed, time)',
                    supportsAllDrives=True,
                    includeItemsFromAllDrives=True
                ).execute()
                
                # Filter changes for supported file types
                filtered_changes = []
                for change in response.get('changes', []):
                    # Include if file was removed
                    if change.get('removed'):
                        filtered_changes.append(change)
                    # Or if it's a supported type
                    elif change.get('file', {}).get('mimeType') in self.SUPPORTED_MIME_TYPES:
                        filtered_changes.append(change)
                        
                changes.extend(filtered_changes)
                
                if response.get('newStartPageToken'):
                    new_start_token = response.get('newStartPageToken')
                    break
                    
                page_token = response.get('nextPageToken')
                
            except Exception as e:
                print(f'Error getting changes: {str(e)}')
                break
                
        return changes, new_start_token

    def download_file(self, file_id: str, mime_type: str) -> Optional[bytes]:
        """Download or export a file from Drive.
        
        Args:
            file_id: Drive file ID
            mime_type: File's MIME type
            
        Returns:
            File bytes if successful, None if failed
        """
        try:
            if mime_type == 'application/pdf':
                # Direct download for PDFs
                request = self.service.files().get_media(fileId=file_id)
            else:
                # Export Google Docs/Sheets/Slides to PDF
                request = self.service.files().export_media(
                    fileId=file_id,
                    mimeType='application/pdf'
                )
                
            file = io.BytesIO()
            downloader = MediaIoBaseDownload(file, request)
            done = False
            
            while not done:
                status, done = downloader.next_chunk()
                
            return file.getvalue()
            
        except Exception as e:
            print(f'Error downloading file {file_id}: {str(e)}')
            return None
