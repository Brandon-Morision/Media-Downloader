#!/usr/bin/env python3
"""
icon_manager.py
---------------
Unified icon management for Media Downloader.

This script consolidates all icon-related operations into a single tool:
- Creating Windows-compatible BMP-only .ico files from source images
- Verifying icon embedding in built executables
- Embedding icons into executables using available tools

Usage:
    python icon_manager.py create [--source SOURCE_PATH] [--output ICON_PATH]
    python icon_manager.py verify [--exe EXE_PATH]
    python icon_manager.py embed [--exe EXE_PATH] [--icon ICON_PATH] [--method METHOD]
    python icon_manager.py --help

The BMP-only format is required because PyInstaller cannot properly embed
PNG-compressed icon entries into EXE files. Windows can use PNG in ICO files,
but PyInstaller's resource handling expects raw BMP format.
"""

import os
import sys
import struct
import argparse
import subprocess
import shutil
from io import BytesIO

from version import get_version_string

try:
    from PIL import Image
except ImportError:
    print("[ERROR] PIL/Pillow not installed. Fix: pip install -r requirements.txt")
    sys.exit(1)

# Default paths
HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_ICON_PATH = os.path.join(HERE, "build_assets", "icon.ico")
DEFAULT_BACKUP_PATH = os.path.join(HERE, "build_assets", "icon.ico.bak")
DEFAULT_EXE_PATH = os.path.join(HERE, "dist", "NovaDrop", "NovaDrop.exe")

# Standard Windows icon sizes
STANDARD_SIZES = [16, 32, 48, 64, 128, 256]


def create_ico(source_path=None, output_path=None):
    """
    Create a Windows-compatible BMP-only .ico file from a source image.
    
    Args:
        source_path: Path to source image (PNG, JPG, etc.) or existing ICO
        output_path: Where to save the resulting .ico file
    
    Returns:
        True if successful, False otherwise
    """
    if source_path is None:
        source_path = DEFAULT_ICON_PATH
    if output_path is None:
        output_path = DEFAULT_ICON_PATH
    
    print(f"Creating Windows-compatible BMP-only .ico file")
    print("=" * 60)
    print()
    
    if not os.path.isfile(source_path):
        print(f"[ERROR] Source image not found: {source_path}")
        return False
    
    # Backup existing icon if we're overwriting
    if os.path.isfile(output_path) and output_path == DEFAULT_ICON_PATH:
        if not os.path.isfile(DEFAULT_BACKUP_PATH):
            shutil.copy2(output_path, DEFAULT_BACKUP_PATH)
            print(f"[OK] Backed up existing icon to: {DEFAULT_BACKUP_PATH}")
        print()
    
    # Open the source image
    try:
        img_source = Image.open(source_path)
        print(f"[OK] Opened source image: {source_path}")
    except Exception as e:
        print(f"[ERROR] Failed to open source image: {e}")
        return False
    
    # Extract the base image
    if hasattr(img_source, 'n_frames'):
        img_source.seek(0)
        base_img = img_source.convert('RGBA')
        print(f"[OK] Multi-frame image detected, using frame 0")
    else:
        base_img = img_source.convert('RGBA')
        print(f"[OK] Single image, converted to RGBA")
    
    base_size = base_img.size
    print(f"    Base size: {base_size[0]}x{base_size[1]}")
    print()
    
    # Generate standard Windows icon sizes
    images = []
    for size in STANDARD_SIZES:
        resized = base_img.resize((size, size), Image.Resampling.LANCZOS)
        images.append(resized)
        direction = "resized" if base_size[0] >= size else "upscaled"
        print(f"[OK] {size}x{size} ← {direction} from {base_size}")
    
    print()
    
    # Build ICO file
    try:
        ico_data = BytesIO()
        
        # ICONHEADER (6 bytes)
        ico_data.write(struct.pack('<HHH', 0, 1, len(images)))
        
        # ICONDIRENTRY for each image
        entries_data = BytesIO()
        offset = 6 + (len(images) * 16)
        
        for img in images:
            width, height = img.size
            bmp_data = _image_to_bmp_data(img)
            size = len(bmp_data)
            
            # ICONDIRENTRY (16 bytes)
            ico_data.write(struct.pack(
                '<BBBBHHII',
                width if width < 256 else 0,
                height if height < 256 else 0,
                0,  # bColorCount
                0,  # bReserved
                1,  # wPlanes
                32,  # wBitCount
                size,  # dwBytesInRes
                offset,  # dwImageOffset
            ))
            
            entries_data.write(bmp_data)
            offset += size
        
        ico_data.write(entries_data.getvalue())
        
        # Write to file
        with open(output_path, 'wb') as f:
            f.write(ico_data.getvalue())
        
        print(f"[OK] Saved Windows-compatible icon (BMP-only): {output_path}")
        print(f"     Size: {os.path.getsize(output_path)} bytes, {len(images)} images")
        print()
        return True
        
    except Exception as e:
        print(f"[ERROR] Failed to create ICO file: {e}")
        return False


def _image_to_bmp_data(img):
    """Convert a PIL Image to raw BMP image data for ICO embedding."""
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    
    width, height = img.size
    
    # Create INFOHEADER (40 bytes)
    infoheader = struct.pack(
        '<IiiHHIIiiII',
        40,              # biSize
        width,           # biWidth
        height * 2,      # biHeight (doubled for ICO, includes AND mask)
        1,               # biPlanes
        32,              # biBitCount (32-bit RGBA)
        0,               # biCompression (0 = uncompressed)
        0,               # biSizeImage
        0,               # biXPelsPerMeter
        0,               # biYPelsPerMeter
        0,               # biClrUsed
        0,               # biClrImportant
    )
    
    # Pixel data (bottom-to-top for BMP format)
    pixel_data = b''
    for y in range(height - 1, -1, -1):
        for x in range(width):
            r, g, b, a = img.getpixel((x, y))
            pixel_data += struct.pack('BBBB', b, g, r, a)
    
    # AND mask (all zeros = fully opaque)
    mask_data = b'\x00' * ((width * height + 7) // 8)
    
    return infoheader + pixel_data + mask_data


def verify_icon(exe_path=None):
    """
    Verify that an executable has embedded icon resources.
    
    Args:
        exe_path: Path to the executable to check
    
    Returns:
        True if icon is embedded, False otherwise
    """
    if exe_path is None:
        exe_path = DEFAULT_EXE_PATH
    
    print(f"Checking icon embedding: {exe_path}")
    print(f"Exists: {os.path.exists(exe_path)}")
    print()
    
    if not os.path.exists(exe_path):
        print("[ERROR] Executable not found")
        return False
    
    try:
        import ctypes
        shell32 = ctypes.windll.shell32
        shell32.ExtractIconExW.restype = ctypes.c_uint
        shell32.ExtractIconExW.argtypes = [
            ctypes.c_wchar_p, ctypes.c_int,
            ctypes.c_void_p, ctypes.c_void_p, ctypes.c_uint,
        ]
        
        # Step 1: count icons
        total_icons = shell32.ExtractIconExW(exe_path, -1, None, None, 0)
        print(f"Total icon groups reported: {total_icons}")
        
        if total_icons == 0:
            print("✗ FAILED — the exe has no icon resources")
            return False
        
        # Step 2: extract icon index 0
        large_arr = (ctypes.c_void_p * 1)()
        small_arr = (ctypes.c_void_p * 1)()
        extracted = shell32.ExtractIconExW(exe_path, 0, large_arr, small_arr, 1)
        
        print(f"Icons extracted at index 0: {extracted}")
        print(f"Large icon handle: {large_arr[0]}")
        print(f"Small icon handle: {small_arr[0]}")
        
        # Clean up handles
        user32 = ctypes.windll.user32
        if large_arr[0]:
            user32.DestroyIcon(large_arr[0])
        if small_arr[0]:
            user32.DestroyIcon(small_arr[0])
        
        if large_arr[0] or small_arr[0]:
            print("✓ SUCCESS — icon IS embedded and extractable")
            return True
        else:
            print("✗ FAILED — extraction returned no handles")
            return False
            
    except Exception as e:
        print(f"[ERROR] Verification failed: {e}")
        return False


def embed_icon(exe_path=None, icon_path=None, method="auto"):
    """
    Embed an icon into an executable using available tools.
    
    Args:
        exe_path: Path to the target executable
        icon_path: Path to the icon file to embed
        method: "auto", "rcedit", "resource_hacker", or "none"
    
    Returns:
        True if successful, False otherwise
    """
    if exe_path is None:
        exe_path = DEFAULT_EXE_PATH
    if icon_path is None:
        icon_path = DEFAULT_ICON_PATH
    
    print(f"Embedding icon into executable")
    print("=" * 60)
    print(f"EXE:  {exe_path}")
    print(f"Icon: {icon_path}")
    print(f"Method: {method}")
    print()
    
    if not os.path.isfile(exe_path):
        print(f"[ERROR] Executable not found: {exe_path}")
        return False
    
    if not os.path.isfile(icon_path):
        print(f"[ERROR] Icon file not found: {icon_path}")
        return False
    
    if method == "auto":
        # Try available methods in order of preference
        for try_method in ["rcedit", "resource_hacker"]:
            print(f"Trying method: {try_method}")
            if embed_icon(exe_path, icon_path, try_method):
                print(f"✓ SUCCESS using {try_method}")
                return True
            print(f"{try_method} failed, trying next method...")
            print()
        
        print("[ERROR] All embedding methods failed")
        print("Manual options:")
        print("1. Use Resource Hacker GUI: https://www.angusj.com/resourcehacker/")
        print("2. Install Node.js and run: npm install -g rcedit")
        return False
    
    elif method == "rcedit":
        return _embed_with_rcedit(exe_path, icon_path)
    
    elif method == "resource_hacker":
        return _embed_with_resource_hacker(exe_path, icon_path)
    
    else:
        print(f"[ERROR] Unknown method: {method}")
        return False


def _embed_with_rcedit(exe_path, icon_path):
    """Embed icon using rcedit (Node.js tool)."""
    try:
        # Check if rcedit is available
        result = subprocess.run(
            ["rcedit", "--version"],
            capture_output=True,
            text=True,
            timeout=5,
            creationflags=0x08000000 if os.name == "nt" else 0
        )
        
        if result.returncode != 0:
            print("[ERROR] rcedit not found or not working")
            print("Install with: npm install -g rcedit")
            return False
        
        print("[OK] rcedit is available")
        
        # Embed the icon
        result = subprocess.run(
            ["rcedit", exe_path, "--set-icon", icon_path],
            capture_output=True,
            text=True,
            timeout=30,
            creationflags=0x08000000 if os.name == "nt" else 0
        )
        
        if result.returncode == 0:
            print("✓ Icon embedded successfully with rcedit")
            return True
        else:
            print(f"[ERROR] rcedit failed: {result.stderr}")
            return False
            
    except FileNotFoundError:
        print("[ERROR] rcedit not found")
        print("Install with: npm install -g rcedit")
        return False
    except Exception as e:
        print(f"[ERROR] rcedit embedding failed: {e}")
        return False


def _embed_with_resource_hacker(exe_path, icon_path):
    """Embed icon using Resource Hacker."""
    # Try command line first
    rh_paths = [
        "ResourceHacker.exe",
        r"C:\Program Files\ResourceHacker\ResourceHacker.exe",
        r"C:\Program Files (x86)\ResourceHacker\ResourceHacker.exe",
    ]
    
    rh_exe = None
    for path in rh_paths:
        if os.path.isfile(path):
            rh_exe = path
            break
    
    if not rh_exe:
        print("[ERROR] Resource Hacker not found")
        print("Download from: https://www.angusj.com/resourcehacker/")
        print("Then use the GUI to manually embed the icon")
        return False
    
    print(f"[OK] Found Resource Hacker: {rh_exe}")
    
    try:
        # Try command line usage
        result = subprocess.run(
            [
                rh_exe,
                "-open", exe_path,
                "-save", exe_path,
                "-action", "addoverwrite",
                "-res", icon_path,
                "-mask", "ICONGROUP,MAINICON"
            ],
            capture_output=True,
            text=True,
            timeout=30,
            creationflags=0x08000000 if os.name == "nt" else 0
        )
        
        if result.returncode == 0:
            print("✓ Icon embedded successfully with Resource Hacker")
            return True
        else:
            print(f"[ERROR] Resource Hacker CLI failed: {result.stderr}")
            print("Please use Resource Hacker GUI manually:")
            print("1. Open Resource Hacker")
            print("2. File → Open → select the EXE")
            print("3. Right-click 'Icon Group' → 'Replace Icon...'")
            print("4. Select the icon file and save")
            return False
            
    except Exception as e:
        print(f"[ERROR] Resource Hacker embedding failed: {e}")
        print("Please use Resource Hacker GUI manually")
        return False


def main():
    parser = argparse.ArgumentParser(
        description=f"Unified icon management for Media Downloader v{get_version_string()}",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python icon_manager.py create                    # Create icon from existing source
  python icon_manager.py create --source logo.png # Create from specific image
  python icon_manager.py verify                    # Verify icon in built EXE
  python icon_manager.py embed                     # Embed icon using best available method
  python icon_manager.py embed --method rcedit     # Use specific method
        """
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")
    
    # Create command
    create_parser = subparsers.add_parser("create", help="Create Windows-compatible .ico file")
    create_parser.add_argument("--source", help="Source image path")
    create_parser.add_argument("--output", help="Output .ico file path")
    
    # Verify command
    verify_parser = subparsers.add_parser("verify", help="Verify icon embedding in EXE")
    verify_parser.add_argument("--exe", help="Executable path to check")
    
    # Embed command
    embed_parser = subparsers.add_parser("embed", help="Embed icon into executable")
    embed_parser.add_argument("--exe", help="Target executable path")
    embed_parser.add_argument("--icon", help="Icon file to embed")
    embed_parser.add_argument("--method", choices=["auto", "rcedit", "resource_hacker"],
                            default="auto", help="Embedding method")
    
    args = parser.parse_args()
    
    if args.command == "create":
        success = create_ico(args.source, args.output)
        sys.exit(0 if success else 1)
    
    elif args.command == "verify":
        success = verify_icon(args.exe)
        sys.exit(0 if success else 1)
    
    elif args.command == "embed":
        success = embed_icon(args.exe, args.icon, args.method)
        sys.exit(0 if success else 1)
    
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
