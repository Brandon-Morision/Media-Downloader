#!/usr/bin/env python3
"""
logger.py
---------
Centralized logging configuration for Media Downloader.

Provides a consistent logging framework across all modules with:
- File and console logging
- Rotating log files to prevent excessive disk usage
- Structured log levels (DEBUG, INFO, WARNING, ERROR, CRITICAL)
- Thread-safe logging operations
- Easy integration for new modules

Usage:
    from logger import get_logger
    
    logger = get_logger(__name__)
    logger.info("Application started")
    logger.error("Failed to download", exc_info=True)
"""

import logging
import logging.handlers
import os
import sys
from pathlib import Path

# Log directory and file configuration
LOG_DIR = Path.home() / ".media_downloader" / "logs"
LOG_FILE = LOG_DIR / "media_downloader.log"
LOG_MAX_BYTES = 10 * 1024 * 1024  # 10 MB per log file
LOG_BACKUP_COUNT = 5  # Keep up to 5 backup log files

# Ensure log directory exists
LOG_DIR.mkdir(parents=True, exist_ok=True)


def get_logger(name: str, level: int = logging.INFO) -> logging.Logger:
    """
    Get a configured logger instance.
    
    Args:
        name: Logger name (typically __name__ of the calling module)
        level: Logging level (default: logging.INFO)
    
    Returns:
        Configured logger instance
    
    Example:
        logger = get_logger(__name__)
        logger.info("Processing download")
        logger.error("Download failed", exc_info=True)
    """
    logger = logging.getLogger(name)
    
    # Avoid adding multiple handlers if logger already configured
    if logger.handlers:
        return logger
    
    logger.setLevel(level)
    
    # Prevent propagation to root logger to avoid duplicate logs
    logger.propagate = False
    
    # Create formatters
    detailed_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    simple_formatter = logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%H:%M:%S'
    )
    
    # File handler with rotation
    try:
        file_handler = logging.handlers.RotatingFileHandler(
            LOG_FILE,
            maxBytes=LOG_MAX_BYTES,
            backupCount=LOG_BACKUP_COUNT,
            encoding='utf-8'
        )
        file_handler.setLevel(logging.DEBUG)  # File gets all messages
        file_handler.setFormatter(detailed_formatter)
        logger.addHandler(file_handler)
    except (IOError, OSError) as e:
        # If file logging fails, still allow console logging
        sys.stderr.write(f"Warning: Could not setup file logging: {e}\n")
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)  # Console respects the requested level
    console_handler.setFormatter(simple_formatter)
    logger.addHandler(console_handler)
    
    return logger


def set_log_level(level: int) -> None:
    """
    Set the global logging level for all loggers.
    
    Args:
        level: Logging level (logging.DEBUG, logging.INFO, etc.)
    
    Example:
        set_log_level(logging.DEBUG)  # Enable debug logging
    """
    logging.getLogger().setLevel(level)
    
    # Update all existing loggers
    for logger_name in logging.root.manager.loggerDict:
        logger = logging.getLogger(logger_name)
        logger.setLevel(level)


def get_log_file_path() -> str:
    """
    Get the path to the current log file.
    
    Returns:
        Absolute path to the log file
    """
    return str(LOG_FILE.absolute())


def clear_logs() -> bool:
    """
    Clear all log files by removing the log directory.
    
    Returns:
        True if successful, False otherwise
    """
    try:
        if LOG_DIR.exists():
            import shutil
            shutil.rmtree(LOG_DIR)
            LOG_DIR.mkdir(parents=True, exist_ok=True)
        return True
    except Exception as e:
        sys.stderr.write(f"Error clearing logs: {e}\n")
        return False


# Convenience functions for common logging patterns
def log_function_call(logger: logging.Logger):
    """
    Decorator to log function calls with arguments.
    
    Usage:
        @log_function_call(get_logger(__name__))
        def my_function(arg1, arg2):
            pass
    """
    def decorator(func):
        def wrapper(*args, **kwargs):
            logger.debug(f"Calling {func.__name__} with args={args}, kwargs={kwargs}")
            try:
                result = func(*args, **kwargs)
                logger.debug(f"{func.__name__} returned successfully")
                return result
            except Exception as e:
                logger.error(f"{func.__name__} failed with error: {e}", exc_info=True)
                raise
        return wrapper
    return decorator


def log_exception(logger: logging.Logger, message: str = "Error occurred"):
    """
    Context manager to automatically log exceptions.
    
    Usage:
        with log_exception(logger, "Processing file"):
            # risky operation
            process_file()
    """
    class ExceptionLogger:
        def __init__(self, logger, message):
            self.logger = logger
            self.message = message
        
        def __enter__(self):
            return self
        
        def __exit__(self, exc_type, exc_val, exc_tb):
            if exc_type is not None:
                self.logger.error(f"{self.message}: {exc_val}", exc_info=True)
            return False  # Don't suppress exceptions
    
    return ExceptionLogger(logger, message)


# Pre-configured loggers for common use cases
def get_app_logger() -> logging.Logger:
    """Get logger for main application events."""
    return get_logger("media_downloader.app", logging.INFO)


def get_download_logger() -> logging.Logger:
    """Get logger for download operations."""
    return get_logger("media_downloader.download", logging.INFO)


def get_api_logger() -> logging.Logger:
    """Get logger for API endpoints."""
    return get_logger("media_downloader.api", logging.INFO)


def get_build_logger() -> logging.Logger:
    """Get logger for build operations."""
    return get_logger("media_downloader.build", logging.INFO)


if __name__ == "__main__":
    # Demo logging usage
    logger = get_logger(__name__, logging.DEBUG)
    
    logger.debug("This is a debug message")
    logger.info("This is an info message")
    logger.warning("This is a warning message")
    logger.error("This is an error message")
    
    print(f"\nLog file location: {get_log_file_path()}")
    print("Check the log file for detailed output with timestamps and module info.")