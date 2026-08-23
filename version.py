#!/usr/bin/env python3
"""
version.py
----------
Centralized version management for Media Downloader.

This module provides a single source of truth for version information
across all components:
- Desktop application
- Browser extension
- Windows installer

The version format follows semantic versioning: MAJOR.MINOR.PATCH

Usage:
    from version import __version__, get_version_string
    
    print(f"Media Downloader {get_version_string()}")
"""

__version__ = "0.2.3"
__app_name__ = "Media Downloader"
__author__ = "Brandon"
__copyright__ = "2024"

# Version components
MAJOR, MINOR, PATCH = __version__.split('.')
MAJOR = int(MAJOR)
MINOR = int(MINOR)
PATCH = int(PATCH)


def get_version_string() -> str:
    """Get the full version string."""
    return __version__


def get_version_tuple() -> tuple:
    """Get version as a tuple of integers (MAJOR, MINOR, PATCH)."""
    return (MAJOR, MINOR, PATCH)


def get_app_info() -> dict:
    """Get complete application information."""
    return {
        "name": __app_name__,
        "version": __version__,
        "author": __author__,
        "copyright": __copyright__,
        "major": MAJOR,
        "minor": MINOR,
        "patch": PATCH,
    }


def get_extension_version() -> str:
    """Get version formatted for browser extension manifest."""
    return __version__


def get_installer_version() -> str:
    """Get version formatted for Inno Setup installer."""
    return __version__


def compare_versions(version_str: str) -> int:
    """
    Compare the current version with a given version string.
    
    Args:
        version_str: Version string to compare (e.g., "0.2.3")
    
    Returns:
        -1 if current version is older
        0 if versions are equal
        1 if current version is newer
    """
    try:
        major, minor, patch = map(int, version_str.split('.'))
        current = (MAJOR, MINOR, PATCH)
        other = (major, minor, patch)
        
        if current < other:
            return -1
        elif current > other:
            return 1
        else:
            return 0
    except (ValueError, AttributeError):
        raise ValueError(f"Invalid version string: {version_str}")


def is_beta() -> bool:
    """Check if current version is a beta release."""
    # This can be expanded to check for beta flags in the future
    return False


def get_display_version() -> str:
    """Get version string for display in UI."""
    if is_beta():
        return f"{__version__} (Beta)"
    return __version__


# For backwards compatibility
VERSION = __version__
VERSION_TUPLE = get_version_tuple()


if __name__ == "__main__":
    # Display version information
    print(f"{__app_name__} v{__version__}")
    print(f"Version components: {get_version_tuple()}")
    print(f"Extension version: {get_extension_version()}")
    print(f"Installer version: {get_installer_version()}")
    print()
    print("Full app info:")
    for key, value in get_app_info().items():
        print(f"  {key}: {value}")