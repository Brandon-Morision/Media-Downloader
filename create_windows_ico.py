#!/usr/bin/env python3
"""
create_windows_ico.py (DEPRECATED)
-----------------------------------
This script is deprecated. Use icon_manager.py instead.

New usage:
    python icon_manager.py create [--source SOURCE_PATH] [--output ICON_PATH]

This file is kept for backward compatibility but delegates to icon_manager.py.
"""

import sys
import os

# Add current directory to path to import icon_manager
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    # Import and run the icon manager
    import icon_manager
    
    print("This script is deprecated. Using icon_manager.py instead...")
    print()
    
    # Call the create function with default arguments
    success = icon_manager.create_ico()
    
    if success:
        print()
        print("Next step:")
        print("    python build_windows.py")
        print()
    
    sys.exit(0 if success else 1)
