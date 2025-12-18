"""Metadata manager for Drive sync state."""
from datetime import datetime
from typing import Dict, Optional

from .s3_manager import S3Manager

class MetadataManager:
    """Manages sync state and folder structure metadata."""
    
    def __init__(self, s3_manager: S3Manager):
        """Initialize with S3 manager.
        
        Args:
            s3_manager: S3Manager instance
        """
        self.s3 = s3_manager
        self._sync_state = None
        self._folder_metadata = None
        
    def _load_sync_state(self) -> Dict:
        """Load or initialize sync state.
        
        Returns:
            Sync state dictionary
        """
        if self._sync_state is None:
            state = self.s3.get_sync_state()
            if state is None:
                state = {
                    'startPageToken': None,
                    'lastSyncTime': None,
                    'fileMap': {}
                }
            self._sync_state = state
        return self._sync_state
        
    def _load_folder_metadata(self) -> Dict:
        """Load or initialize folder metadata.
        
        Returns:
            Folder metadata dictionary
        """
        if self._folder_metadata is None:
            metadata = self.s3.get_folder_metadata()
            if metadata is None:
                metadata = {
                    'folderMap': {}
                }
            self._folder_metadata = metadata
        return self._folder_metadata

    def get_start_page_token(self) -> Optional[str]:
        """Get the current start page token.
        
        Returns:
            Start page token string or None if not set
        """
        return self._load_sync_state().get('startPageToken')

    def update_start_page_token(self, token: str) -> bool:
        """Update the start page token.
        
        Args:
            token: New start page token
            
        Returns:
            True if successful, False otherwise
        """
        state = self._load_sync_state()
        state['startPageToken'] = token
        state['lastSyncTime'] = datetime.utcnow().isoformat()
        return self.s3.save_sync_state(state)

    def get_file_mapping(self, file_id: str) -> Optional[Dict]:
        """Get S3 mapping for a Drive file.
        
        Args:
            file_id: Drive file ID
            
        Returns:
            Mapping dictionary or None if not found
        """
        return self._load_sync_state()['fileMap'].get(file_id)

    def update_file_mapping(self, file_id: str, s3_key: str, md5: str) -> bool:
        """Update or add a file mapping.
        
        Args:
            file_id: Drive file ID
            s3_key: S3 object key
            md5: File MD5 hash
            
        Returns:
            True if successful, False otherwise
        """
        state = self._load_sync_state()
        state['fileMap'][file_id] = {
            's3Key': s3_key,
            'md5Hash': md5,
            'lastModified': datetime.utcnow().isoformat()
        }
        return self.s3.save_sync_state(state)

    def remove_file(self, file_id: str) -> bool:
        """Remove a file mapping.
        
        Args:
            file_id: Drive file ID
            
        Returns:
            True if successful, False otherwise
        """
        state = self._load_sync_state()
        if file_id in state['fileMap']:
            del state['fileMap'][file_id]
            return self.s3.save_sync_state(state)
        return True

    def update_folder_structure(self, file_id: str, path: str, name: str) -> bool:
        """Update folder structure metadata.
        
        Args:
            file_id: Drive file ID
            path: Full folder path
            name: Original file name
            
        Returns:
            True if successful, False otherwise
        """
        metadata = self._load_folder_metadata()
        metadata['folderMap'][file_id] = {
            'path': path,
            'originalName': name
        }
        return self.s3.save_folder_metadata(metadata)

    def remove_folder_metadata(self, file_id: str) -> bool:
        """Remove folder metadata for a file.
        
        Args:
            file_id: Drive file ID
            
        Returns:
            True if successful, False otherwise
        """
        metadata = self._load_folder_metadata()
        if file_id in metadata['folderMap']:
            del metadata['folderMap'][file_id]
            return self.s3.save_folder_metadata(metadata)
        return True
