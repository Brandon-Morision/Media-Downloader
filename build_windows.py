"""
build_windows.py
-----------------
One-shot build script for the Windows desktop app. Run this on a Windows
machine (PyInstaller builds are not cross-platform — see README_BUILD.md).

What it does:
    1. Checks that build_assets/tools/gallery-dl.exe and yt-dlp.exe exist
       (does NOT download them automatically — see download_tools() below
       for why, and README_BUILD.md for where to get them).
    2. Checks pyinstaller, pywebview, and psutil are installed.
    3. Runs `pyinstaller MediaDownloader.spec`.
    4. Prints the resulting dist/ path.

Usage:
    python build_windows.py
"""

import os
import shutil
import subprocess
import sys

from logger import get_build_logger

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS_DIR = os.path.join(HERE, "build_assets", "tools")
SPEC_FILE = os.path.join(HERE, "MediaDownloader.spec")
ICON_FILE = os.path.join(HERE, "build_assets", "icon.ico")

REQUIRED_TOOLS = ["gallery-dl.exe", "yt-dlp.exe", "ffmpeg.exe", "ffprobe.exe"]
REQUIRED_PACKAGES = ["PyInstaller", "webview", "psutil", "PIL"]

# Initialize logger
logger = get_build_logger()


def check_platform():
    if os.name != "nt":
        logger.warning("This script builds a Windows .exe and is meant to run on Windows.")
        logger.warning("PyInstaller does not cross-compile — building here will produce a binary for THIS OS.")
        logger.warning("Continuing anyway since you might just be validating the spec file.")
        print("  [WARNING] This script builds a Windows .exe and is meant to")
        print("            run on Windows. PyInstaller does not cross-compile —")
        print("            building here will produce a binary for THIS OS, not")
        print("            Windows. Continuing anyway since you might just be")
        print("            validating the spec file.\n")


def check_python_packages():
    missing = []
    for pkg in REQUIRED_PACKAGES:
        try:
            # Map package names to their import names
            import_map = {
                "PyInstaller": "PyInstaller",
                "webview": "webview", 
                "psutil": "psutil",
                "PIL": "PIL",  # Pillow package imports as PIL
            }
            import_name = import_map.get(pkg, pkg)
            __import__(import_name)
            logger.debug(f"Found package: {pkg} (imported as {import_name})")
        except ImportError as e:
            missing.append(pkg)
            logger.warning(f"Missing package: {pkg} - {e}")
    
    if missing:
        logger.error(f"Missing Python packages: {', '.join(missing)}")
        print(f"  [ERROR] Missing Python packages: {', '.join(missing)}")
        print(f"          Fix:  pip install -r requirements.txt\n")
        sys.exit(1)
    
    logger.info("All required Python packages are installed")


def check_bundled_tools():
    missing = [t for t in REQUIRED_TOOLS if not os.path.isfile(os.path.join(TOOLS_DIR, t))]
    if missing:
        logger.error(f"Missing bundled tool binaries in {TOOLS_DIR}: {', '.join(missing)}")
        print(f"  [ERROR] Missing bundled tool binaries in {TOOLS_DIR}:")
        for t in missing:
            print(f"            - {t}")
        print()
        print("  Download the standalone Windows releases and place them there")
        print("  (rename to exactly the filenames above after downloading):")
        print("    yt-dlp.exe     : https://github.com/yt-dlp/yt-dlp/releases/latest")
        print("    gallery-dl.exe : https://codeberg.org/mikf/gallery-dl/releases")
        print("                     (download gallery-dl_x86.exe, rename to gallery-dl.exe)")
        print("    ffmpeg.exe     : https://www.gyan.dev/ffmpeg/builds/")
        print("    ffprobe.exe    :   → ffmpeg-release-essentials.zip → bin/ folder")
        print("                     (both ffmpeg.exe and ffprobe.exe live in the bin/ folder)")
        print()
        print("  (Not auto-downloaded by this script on purpose — you should pin")
        print("   and verify specific versions yourself rather than always grabbing")
        print("   'latest' silently at build time. See README_BUILD.md.)\n")
        sys.exit(1)
    
    logger.info("All required tool binaries found")
    print("  [OK] Found bundled tool binaries:")
    for t in REQUIRED_TOOLS:
        path = os.path.join(TOOLS_DIR, t)
        size_mb = os.path.getsize(path) / (1024 * 1024)
        logger.debug(f"Tool {t}: {size_mb:.1f} MB")
        print(f"         {t}  ({size_mb:.1f} MB)")
    
    # Check for icon file (optional but recommended)
    if os.path.isfile(ICON_FILE):
        size_kb = os.path.getsize(ICON_FILE) / 1024
        logger.info(f"Icon file found: {size_kb:.1f} KB")
        print(f"         icon.ico  ({size_kb:.1f} KB)")
    else:
        logger.info("No icon.ico found — PyInstaller will use default icon")
        print("         [INFO] No icon.ico found — PyInstaller will use default icon")
        print("                Create one with: python icon_manager.py create")
    print()


def run_pyinstaller():
    logger.info("Running PyInstaller...")
    print("  Running PyInstaller…\n")
    result = subprocess.run([sys.executable, "-m", "PyInstaller", "--noconfirm", SPEC_FILE], cwd=HERE)
    if result.returncode != 0:
        logger.error(f"PyInstaller build failed with exit code {result.returncode}")
        print("\n  [ERROR] PyInstaller build failed — see output above.\n")
        sys.exit(result.returncode)
    logger.info("PyInstaller build completed successfully")


def main():
    logger.info("Starting NovaDrop Windows build process")
    print()
    print("  " + "=" * 56)
    print("   NovaDrop — Windows build")
    print("  " + "=" * 56)
    print()

    check_platform()
    check_python_packages()
    check_bundled_tools()
    run_pyinstaller()

    dist_dir = os.path.join(HERE, "dist", "NovaDrop")
    logger.info(f"Build completed successfully. Output: {dist_dir}")
    print()
    print("  " + "=" * 56)
    print("  Build complete.")
    print(f"  Output: {dist_dir}")
    print("  Run NovaDrop.exe from inside that folder to test it,")
    print("  or hand the whole NovaDrop folder to an installer")
    print("  builder (Inno Setup, etc.) — see README_BUILD.md.")
    print("  " + "=" * 56)
    print()


if __name__ == "__main__":
    main()
