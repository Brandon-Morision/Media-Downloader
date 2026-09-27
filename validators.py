#!/usr/bin/env python3
"""
validators.py
-------------
Input validation utilities for Media Downloader API endpoints.

Provides centralized validation functions for:
- URLs and web addresses
- File paths and directory paths
- User input strings
- Configuration parameters
- API request data

Usage:
    from validators import validate_url, validate_path
    
    if not validate_url(user_input):
        return {"ok": False, "error": "Invalid URL"}
"""

import re
import os
import urllib.parse
from typing import Optional, Dict, Any, List
from logger import get_logger

logger = get_logger(__name__)


# Regex patterns for validation
URL_PATTERN = re.compile(
    r'^https?://'  # http:// or https://
    # domain — TLD length capped at 63 (the DNS label length limit) rather
    # than 6, so long modern TLDs (.technology, .photography,
    # .international, punycode .xn--... labels, etc.) validate the same
    # way the frontend's isLikelyUrl() already treats them, instead of
    # being accepted client-side and then rejected here.
    r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,63}\.?|'  # domain
    r'localhost|'  # localhost
    r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # IP address
    r'(?::\d+)?'  # optional port
    r'(?:/?|[/?]\S+)$', re.IGNORECASE
)

SAFE_FILENAME_PATTERN = re.compile(r'^[a-zA-Z0-9._-]+$')

# Allowed schemes for URLs
ALLOWED_SCHEMES = {'http', 'https'}

# Maximum lengths for various inputs
MAX_URL_LENGTH = 2048
MAX_PATH_LENGTH = 4096
MAX_STRING_LENGTH = 1024
MAX_QUERY_LENGTH = 256


class ValidationError(Exception):
    """Custom exception for validation errors."""
    pass


def validate_url(url: str, allow_fragments: bool = True) -> bool:
    """
    Validate a URL string.
    
    Args:
        url: URL string to validate
        allow_fragments: Whether to allow URL fragments (#section)
    
    Returns:
        True if valid, False otherwise
    
    Examples:
        >>> validate_url("https://example.com")
        True
        >>> validate_url("ftp://example.com")
        False
        >>> validate_url("not a url")
        False
    """
    if not url or not isinstance(url, str):
        logger.warning("Invalid URL: empty or not a string")
        return False
    
    if len(url) > MAX_URL_LENGTH:
        logger.warning(f"URL exceeds maximum length: {len(url)} > {MAX_URL_LENGTH}")
        return False
    
    try:
        parsed = urllib.parse.urlparse(url)
        
        # Check scheme
        if parsed.scheme.lower() not in ALLOWED_SCHEMES:
            logger.warning(f"Invalid URL scheme: {parsed.scheme}")
            return False
        
        # Check netloc (domain/IP)
        if not parsed.netloc:
            logger.warning("URL missing network location")
            return False
        
        # Check for fragments if not allowed
        if not allow_fragments and parsed.fragment:
            logger.warning("URL fragments not allowed")
            return False
        
        # Additional check against regex pattern
        if not URL_PATTERN.match(url):
            logger.warning(f"URL does not match valid pattern: {url}")
            return False
        
        return True
        
    except Exception as e:
        logger.error(f"URL validation error: {e}")
        return False


def validate_path(path: str, must_exist: bool = False, must_be_dir: bool = False, 
                  must_be_file: bool = False) -> bool:
    """
    Validate a file system path.
    
    Args:
        path: Path string to validate
        must_exist: Whether the path must exist on the filesystem
        must_be_dir: If must_exist=True, path must be a directory
        must_be_file: If must_exist=True, path must be a file
    
    Returns:
        True if valid, False otherwise
    
    Examples:
        >>> validate_path("C:\\Users\\Documents")
        True
        >>> validate_path("../../../etc/passwd", must_exist=False)
        False  # Path traversal attempt
    """
    if not path or not isinstance(path, str):
        logger.warning("Invalid path: empty or not a string")
        return False
    
    if len(path) > MAX_PATH_LENGTH:
        logger.warning(f"Path exceeds maximum length: {len(path)} > {MAX_PATH_LENGTH}")
        return False
    
    try:
        # Normalize the path
        normalized = os.path.normpath(path)
        
        # Check for path traversal attempts
        if ".." in normalized:
            logger.warning(f"Path traversal attempt detected: {path}")
            return False
        
        # Check if path exists (if required)
        if must_exist:
            if not os.path.exists(normalized):
                logger.warning(f"Path does not exist: {normalized}")
                return False
            
            if must_be_dir and not os.path.isdir(normalized):
                logger.warning(f"Path is not a directory: {normalized}")
                return False
            
            if must_be_file and not os.path.isfile(normalized):
                logger.warning(f"Path is not a file: {normalized}")
                return False
        
        return True
        
    except Exception as e:
        logger.error(f"Path validation error: {e}")
        return False


def validate_string(value: str, min_length: int = 0, max_length: int = MAX_STRING_LENGTH,
                   allow_empty: bool = False, pattern: Optional[re.Pattern] = None) -> bool:
    """
    Validate a string value.
    
    Args:
        value: String to validate
        min_length: Minimum allowed length
        max_length: Maximum allowed length
        allow_empty: Whether empty strings are allowed
        pattern: Optional regex pattern the string must match
    
    Returns:
        True if valid, False otherwise
    """
    if not isinstance(value, str):
        logger.warning("Invalid string: not a string type")
        return False
    
    if not allow_empty and not value.strip():
        logger.warning("Empty string not allowed")
        return False
    
    if len(value) < min_length:
        logger.warning(f"String below minimum length: {len(value)} < {min_length}")
        return False
    
    if len(value) > max_length:
        logger.warning(f"String exceeds maximum length: {len(value)} > {max_length}")
        return False
    
    if pattern and not pattern.match(value):
        logger.warning(f"String does not match required pattern")
        return False
    
    return True


def validate_config(config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate download configuration dictionary.
    
    Args:
        config: Configuration dictionary to validate
    
    Returns:
        Validated and sanitized configuration dictionary
    
    Raises:
        ValidationError: If configuration is invalid
    """
    if not isinstance(config, dict):
        raise ValidationError("Configuration must be a dictionary")
    
    validated = {}
    
    # Validate output directory
    output = config.get('output')
    if output and isinstance(output, str) and output.strip():
        output_str = output.strip()
        if not validate_path(output_str, must_exist=False):
            raise ValidationError(f"Invalid output directory: {output_str}")
        validated['output'] = output_str
    else:
        validated['output'] = os.path.join(os.path.expanduser("~"), "Downloads", "media")
    
    # Validate limit
    if 'limit' in config:
        limit = config['limit']
        try:
            limit_int = int(limit)
            if limit_int < 0 or limit_int > 10000:
                raise ValidationError(f"Limit out of range: {limit_int}")
            validated['limit'] = limit_int
        except (ValueError, TypeError):
            raise ValidationError(f"Invalid limit value: {limit}")
    
    # Validate filename template (gallery-dl's -o filename=... value, e.g.
    # "{category}_{id}.{extension}"). This is a gallery-dl format-string
    # template, not a filesystem path, so validate_path()'s traversal
    # checks don't apply — just bound the length and reject characters
    # that are illegal in Windows filenames (aside from the braces used
    # for template fields, which are intentional here).
    if 'filename' in config:
        filename = config['filename']
        if filename:
            if not validate_string(filename, max_length=256):
                raise ValidationError(f"Invalid filename template: {filename}")
            if re.search(r'[<>:"/\\|?*]', filename):
                raise ValidationError(
                    f"Filename template contains illegal characters: {filename}"
                )
        validated['filename'] = filename

    # Validate format
    if 'format' in config:
        format_val = config['format']
        valid_formats = {
            'auto', 'mp4', 'mp3', 'm4a', 'best',
            '2160p', '1440p', '1080p', '720p', '480p',
            'flac', 'wav', 'opus'
        }
        if format_val not in valid_formats:
            raise ValidationError(f"Invalid format: {format_val}")
        validated['format'] = format_val
    
    # Validate rate limiting
    if 'rate_limit' in config:
        rate_limit = config['rate_limit']
        if rate_limit:
            if not isinstance(rate_limit, str) or not re.match(r'^[0-9]+(?:\.[0-9]+)?[kKmMgG]?B?$', rate_limit.strip()):
                raise ValidationError(f"Invalid rate limit format: {rate_limit}")
            validated['rate_limit'] = rate_limit.strip()
        else:
            validated['rate_limit'] = ""

    # Validate custom CLI arguments
    if 'custom_args' in config:
        custom_args = config['custom_args']
        if custom_args:
            if not isinstance(custom_args, str) or len(custom_args) > 512:
                raise ValidationError("Custom arguments exceed maximum allowed length (512 characters)")
            validated['custom_args'] = custom_args.strip()
        else:
            validated['custom_args'] = ""

    # Validate playlist items selection (e.g. '1-5, 8, 10-12')
    if 'playlist_items' in config:
        playlist_items = config['playlist_items']
        if playlist_items:
            if not isinstance(playlist_items, str):
                raise ValidationError("Playlist items must be a string specification")
            raw_tokens = playlist_items.split(',')
            if any(not tok.strip() for tok in raw_tokens):
                raise ValidationError("Invalid playlist items specification: empty items found")
            items = [tok.strip() for tok in raw_tokens]
            valid_spec = re.compile(r'^(\d+|\d+-\d+|:\d+|\d+:)$')
            for it in items:
                m = valid_spec.match(it)
                if not m:
                    raise ValidationError(f"Invalid playlist item specifier: {it}")
                if '-' in it and not it.startswith('-') and not it.endswith('-'):
                    p1, p2 = it.split('-', 1)
                    if int(p1) > int(p2):
                        raise ValidationError(f"Invalid range in playlist items: {it} (start > end)")
            validated['playlist_items'] = ','.join(items)
        else:
            validated['playlist_items'] = ""

    # Validate username (if provided)
    if 'username' in config:
        username = config['username']
        if username and not validate_string(username, max_length=256):
            raise ValidationError(f"Invalid username: {username}")
        validated['username'] = username
    
    # Validate password (if provided)
    if 'password' in config:
        password = config['password']
        if password and not validate_string(password, max_length=256):
            raise ValidationError(f"Invalid password")
        validated['password'] = password
    
    # Validate cookies browser
    if 'cookies' in config:
        cookies = config['cookies']
        valid_browsers = {'chrome', 'firefox', 'safari', 'edge', 'opera', 'brave', 'chromium'}
        if cookies and cookies.lower() not in valid_browsers:
            raise ValidationError(f"Invalid cookies browser: {cookies}")
        validated['cookies'] = cookies.lower() if cookies else None
    
    # Validate sleep/rate limiting
    if 'sleep' in config:
        sleep = config['sleep']
        try:
            sleep_float = float(sleep)
            if sleep_float < 0 or sleep_float > 60:
                raise ValidationError(f"Sleep value out of range: {sleep_float}")
            validated['sleep'] = sleep_float
        except (ValueError, TypeError):
            raise ValidationError(f"Invalid sleep value: {sleep}")
    
    # Copy boolean flags
    for key in ['verbose', 'dry_run', 'zip', 'metadata', 'sponsorblock']:
        if key in config:
            validated[key] = bool(config[key])
    
    return validated


def validate_search_query(query: str) -> bool:
    """
    Validate a search query string.
    
    Args:
        query: Search query to validate
    
    Returns:
        True if valid, False otherwise
    """
    if not query or not isinstance(query, str):
        return False
    
    query = query.strip()
    
    if len(query) < 2:
        logger.warning("Search query too short")
        return False
    
    if len(query) > MAX_QUERY_LENGTH:
        logger.warning(f"Search query exceeds maximum length: {len(query)} > {MAX_QUERY_LENGTH}")
        return False
    
    # Check for potentially dangerous patterns
    dangerous_patterns = ['<script', 'javascript:', 'data:', 'vbscript:']
    for pattern in dangerous_patterns:
        if pattern.lower() in query.lower():
            logger.warning(f"Potentially dangerous pattern in search query: {pattern}")
            return False
    
    return True


def sanitize_filename(filename: str) -> str:
    """
    Sanitize a filename by removing or replacing dangerous characters.
    
    Args:
        filename: Filename to sanitize
    
    Returns:
        Sanitized filename safe for filesystem use
    """
    if not filename:
        return "unnamed"
    
    # Remove or replace dangerous characters
    dangerous_chars = '<>:"/\\|?*'
    for char in dangerous_chars:
        filename = filename.replace(char, '_')
    
    # Remove leading/trailing spaces and dots
    filename = filename.strip('. ')
    
    # Ensure filename is not empty after sanitization
    if not filename:
        return "unnamed"
    
    # Limit length
    if len(filename) > 255:
        filename = filename[:255]
    
    return filename


def validate_job_id(job_id: str) -> bool:
    """
    Validate a job ID format.
    
    Args:
        job_id: Job ID string to validate
    
    Returns:
        True if valid, False otherwise
    """
    if not job_id or not isinstance(job_id, str):
        return False
    
    # Job IDs should be UUIDs or similar format
    try:
        # Check if it looks like a UUID (hex string with hyphens)
        uuid_pattern = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)
        if uuid_pattern.match(job_id):
            return True
        
        # Also accept simple hex strings
        if re.match(r'^[0-9a-f]{32}$', job_id.lower()):
            return True
        
        logger.warning(f"Invalid job ID format: {job_id}")
        return False
        
    except Exception as e:
        logger.error(f"Job ID validation error: {e}")
        return False


def validate_api_request(data: Dict[str, Any], required_fields: List[str], 
                        optional_fields: Optional[Dict[str, type]] = None) -> Dict[str, Any]:
    """
    Validate an API request payload.
    
    Args:
        data: Request data dictionary
        required_fields: List of required field names
        optional_fields: Dictionary of optional field names and their expected types
    
    Returns:
        Validated data dictionary
    
    Raises:
        ValidationError: If request is invalid
    """
    if not isinstance(data, dict):
        raise ValidationError("Request data must be a dictionary")
    
    # Check required fields
    for field in required_fields:
        if field not in data:
            raise ValidationError(f"Missing required field: {field}")
        if not data[field]:
            raise ValidationError(f"Required field cannot be empty: {field}")
    
    # Validate optional field types if specified
    if optional_fields:
        for field, expected_type in optional_fields.items():
            if field in data and data[field] is not None:
                if not isinstance(data[field], expected_type):
                    raise ValidationError(f"Field '{field}' must be {expected_type.__name__}")
    
    return data


# Convenience functions for common validation scenarios
def validate_download_request(url: str, config: Dict[str, Any]) -> bool:
    """
    Validate a download request (URL + configuration).
    
    Args:
        url: URL to download from
        config: Download configuration
    
    Returns:
        True if valid, False otherwise
    """
    if not validate_url(url):
        logger.warning(f"Invalid download URL: {url}")
        return False
    
    try:
        validate_config(config)
        return True
    except ValidationError as e:
        logger.warning(f"Invalid download configuration: {e}")
        return False


def validate_history_entry_id(entry_id: str) -> bool:
    """
    Validate a history entry ID.
    
    Args:
        entry_id: History entry ID to validate
    
    Returns:
        True if valid, False otherwise
    """
    if not entry_id or not isinstance(entry_id, str):
        return False
    
    # Accept UUID format or simple alphanumeric
    if validate_job_id(entry_id):
        return True
    
    # Also accept simple alphanumeric strings
    if re.match(r'^[a-zA-Z0-9_-]+$', entry_id):
        return True
    
    logger.warning(f"Invalid history entry ID format: {entry_id}")
    return False


def validate_completion_action(action: str) -> bool:
    """
    Validate a post-download queue completion action.
    Allowed: 'nothing', 'exit', 'sleep', 'shutdown'
    """
    if not isinstance(action, str):
        return False
    return action.strip().lower() in {"nothing", "exit", "sleep", "shutdown"}


if __name__ == "__main__":
    # Demo validation functions
    print("Testing validators...")
    print()
    
    # URL validation
    test_urls = [
        "https://example.com",
        "http://localhost:8080",
        "ftp://example.com",
        "not a url",
        "javascript:alert('xss')",
    ]
    
    for url in test_urls:
        result = validate_url(url)
        print(f"URL: {url:40} Valid: {result}")
    
    print()
    
    # Path validation
    test_paths = [
        "C:\\Users\\Documents",
        "../../../etc/passwd",
        "valid/path",
        "",
    ]
    
    for path in test_paths:
        result = validate_path(path, must_exist=False)
        print(f"Path: {path:40} Valid: {result}")
    
    print()
    
    # Config validation
    test_config = {
        "output": "C:\\Downloads",
        "limit": 50,
        "format": "mp4",
        "username": "testuser",
        "password": "testpass",
    }
    
    try:
        validated = validate_config(test_config)
        print(f"Config validation: PASSED")
        print(f"Validated config: {validated}")
    except ValidationError as e:
        print(f"Config validation: FAILED - {e}")