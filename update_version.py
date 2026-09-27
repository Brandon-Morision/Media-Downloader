#!/usr/bin/env python3
"""
update_version.py
-----------------
Script to update version numbers across all project files.

This script ensures version synchronization between:
- version.py (source of truth)
- browser_extension/manifest.json
- manifest.json (root level)
- installer.iss

Usage:
    python update_version.py <new_version>
    
Example:
    python update_version.py 0.3.0
"""

import sys
import os
import re
import json
from pathlib import Path

# Add current directory to path to import version module
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Ensure stdout and stderr handle utf-8 on Windows cp1252 terminals
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# File paths that need version updates.
#
# NOTE: the extension used to live under browser_extension/, but its
# files (manifest.json, popup.html, content.js, background.js) now sit
# at the project root alongside the desktop app — manifest.json below
# covers both. installer.iss is optional (not every checkout builds an
# installer), so it's marked accordingly rather than being a hard
# requirement — see REQUIRED_FILES below.
FILES_TO_UPDATE = {
    'version.py': None,  # Handled specially
    'manifest.json': 'version',
    'installer.iss': 'AppVersion',
}

# Files that MUST exist and update successfully for the run to be
# considered successful. Anything not in this set is best-effort: a
# missing/failed update is reported but does not abort the whole sync
# (previously ANY single failure — including a stale path that could
# never exist — caused an immediate sys.exit(1) before later files were
# even attempted, which is exactly how version.py/manifest.json drifted
# out of sync with README.md/CHANGES.md in the first place).
REQUIRED_FILES = {'version.py', 'manifest.json'}

HERE = os.path.dirname(os.path.abspath(__file__))


def validate_version(version_str: str) -> bool:
    """Validate semantic version format (MAJOR.MINOR.PATCH)."""
    pattern = r'^\d+\.\d+\.\d+$'
    return re.match(pattern, version_str) is not None


def update_version_py(version_str: str) -> bool:
    """Update version.py with the new version."""
    version_file = os.path.join(HERE, 'version.py')
    
    try:
        with open(version_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Update the __version__ line
        content = re.sub(
            r'__version__ = "[\d.]+"',
            f'__version__ = "{version_str}"',
            content
        )
        
        # Update version components
        major, minor, patch = version_str.split('.')
        content = re.sub(
            r'MAJOR = \d+',
            f'MAJOR = {major}',
            content
        )
        content = re.sub(
            r'MINOR = \d+',
            f'MINOR = {minor}',
            content
        )
        content = re.sub(
            r'PATCH = \d+',
            f'PATCH = {patch}',
            content
        )
        
        with open(version_file, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"✓ Updated version.py to {version_str}")
        return True
        
    except Exception as e:
        print(f"✗ Failed to update version.py: {e}")
        return False


def update_json_file(file_path: str, version_str: str) -> bool:
    """Update a JSON file with the new version."""
    full_path = os.path.join(HERE, file_path)
    
    try:
        with open(full_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        data['version'] = version_str
        
        with open(full_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        
        print(f"✓ Updated {file_path} to {version_str}")
        return True
        
    except Exception as e:
        print(f"✗ Failed to update {file_path}: {e}")
        return False


def update_iss_file(file_path: str, version_str: str) -> bool:
    """Update Inno Setup .iss file with the new version."""
    full_path = os.path.join(HERE, file_path)
    
    try:
        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Update AppVersion line
        content = re.sub(
            r'#define AppVersion   "[\d.]+"',
            f'#define AppVersion   "{version_str}"',
            content
        )
        
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"✓ Updated {file_path} to {version_str}")
        return True
        
    except Exception as e:
        print(f"✗ Failed to update {file_path}: {e}")
        return False


def main():
    if len(sys.argv) != 2:
        print("Usage: python update_version.py <new_version>")
        print("Example: python update_version.py 0.3.0")
        sys.exit(1)
    
    new_version = sys.argv[1]
    
    if not validate_version(new_version):
        print(f"✗ Invalid version format: {new_version}")
        print("Version must be in format: MAJOR.MINOR.PATCH (e.g., 0.3.0)")
        sys.exit(1)
    
    print(f"Updating version to {new_version}...")
    print("=" * 50)

    failed_required = []
    skipped_optional = []

    # Update version.py first (source of truth) — always required.
    if not update_version_py(new_version):
        sys.exit(1)

    # Update the remaining files. Optional files (not in REQUIRED_FILES)
    # that don't exist on disk are skipped with a note rather than
    # treated as failures — e.g. installer.iss isn't present in every
    # checkout. Required files that are missing or fail to write are
    # collected and reported, but we still attempt every remaining file
    # before exiting, instead of bailing on the first problem.
    for file_path, key in FILES_TO_UPDATE.items():
        if file_path == 'version.py':
            continue

        full_path = os.path.join(HERE, file_path)
        is_required = file_path in REQUIRED_FILES

        if not os.path.isfile(full_path):
            if is_required:
                print(f"✗ Required file not found: {file_path}")
                failed_required.append(file_path)
            else:
                print(f"… Skipping optional file (not found): {file_path}")
                skipped_optional.append(file_path)
            continue

        if file_path.endswith('.json'):
            ok = update_json_file(file_path, new_version)
        elif file_path.endswith('.iss'):
            ok = update_iss_file(file_path, new_version)
        else:
            print(f"✗ Don't know how to update {file_path}")
            ok = False

        if not ok and is_required:
            failed_required.append(file_path)

    print("=" * 50)
    if failed_required:
        print(f"✗ Version update to {new_version} completed with failures in required files:")
        for f in failed_required:
            print(f"    - {f}")
        sys.exit(1)

    print(f"✓ Successfully updated version to {new_version}")
    if skipped_optional:
        print(f"  (skipped optional, not-present files: {', '.join(skipped_optional)})")
    print("\nNext steps:")
    print("1. Review the changes")
    print("2. Commit the changes with a version bump message")
    print("3. Build and test the application")
    print("4. Create a release tag if ready")


if __name__ == "__main__":
    main()