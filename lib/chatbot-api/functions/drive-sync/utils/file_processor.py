"""File processing utilities for Drive sync."""
import hashlib
import re
from typing import Optional

class FileProcessor:
    """Handles file type detection and key generation."""
    
    SUPPORTED_MIME_TYPES = {
        'application/pdf',
        'application/vnd.google-apps.document',
        'application/vnd.google-apps.spreadsheet',
        'application/vnd.google-apps.presentation'
    }

    @staticmethod
    def is_supported_type(mime_type: str) -> bool:
        """Check if file type is supported.
        
        Args:
            mime_type: MIME type to check
            
        Returns:
            True if supported, False otherwise
        """
        return mime_type in FileProcessor.SUPPORTED_MIME_TYPES

    @staticmethod
    def generate_flat_key(file_id: str, name: str) -> str:
        """Generate a unique, flat S3 key for a file.
        
        Args:
            file_id: Google Drive file ID
            name: Original file name
            
        Returns:
            Flattened S3 key
        """
        # Extract base name without extension
        base_name = re.sub(r'\.[^.]+$', '', name)
        
        # Clean name - remove special chars, spaces to dashes
        clean_name = re.sub(r'[^a-zA-Z0-9-]', '-', base_name)
        clean_name = re.sub(r'-+', '-', clean_name).strip('-')
        
        # Combine with file ID and .pdf extension
        return f"{clean_name}-{file_id}.pdf"

    @staticmethod
    def calculate_hash(data: bytes) -> str:
        """Calculate MD5 hash of file data.
        
        Args:
            data: File bytes
            
        Returns:
            MD5 hash string
        """
        return hashlib.md5(data).hexdigest()
