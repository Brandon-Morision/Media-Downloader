#!/usr/bin/env python3
"""
updater.py
----------
Centralized update management for Media Downloader.

Provides dual-tier update capabilities:
1. Tool / Engine updates (yt-dlp and gallery-dl):
   - Checked against upstream releases (GitHub for yt-dlp, Codeberg for gallery-dl).
   - Downloaded and placed into ~/.media_downloader/tools/, taking precedence
     over bundled tools without requiring Windows Administrator / UAC elevation.
2. Core Desktop Application updates:
   - Checked against GitHub Releases for Media Downloader.
   - Downloads MediaDownloader Setup.exe to a temporary location.
   - Hands off to Inno Setup with automated restart flags to cleanly upgrade.
"""

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Callable, Dict, Optional, Tuple

from logger import get_logger
from version import __version__, compare_versions, get_github_repo

logger = get_logger(__name__)

# Constants
USER_DATA_DIR = Path.home() / ".media_downloader"
USER_TOOLS_DIR = USER_DATA_DIR / "tools"
TEMP_UPDATES_DIR = Path(tempfile.gettempdir()) / "MediaDownloader_Updates"

# Create directories
USER_TOOLS_DIR.mkdir(parents=True, exist_ok=True)
TEMP_UPDATES_DIR.mkdir(parents=True, exist_ok=True)

USER_AGENT = f"MediaDownloader/{__version__} (Windows; x64)"

CREATE_NO_WINDOW = 0x08000000 if os.name == "nt" else 0

_UPDATE_LOCK = threading.Lock()


def _make_request(url: str, timeout: int = 15) -> urllib.request.Request:
    """Create a urllib Request object with standardized headers."""
    req = urllib.request.Request(url)
    req.add_header("User-Agent", USER_AGENT)
    req.add_header("Accept", "application/json, application/octet-stream, */*")
    return req


def _fetch_json(url: str, timeout: int = 15) -> Optional[dict]:
    """Fetch and parse JSON from a URL, handling errors gracefully."""
    try:
        req = _make_request(url, timeout)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = resp.read()
            return json.loads(data.decode("utf-8", errors="replace"))
    except urllib.error.HTTPError as e:
        logger.warning(f"HTTP error fetching {url}: {e.code} {e.reason}")
        return None
    except Exception as e:
        logger.warning(f"Network error fetching {url}: {e}")
        return None


# ── Version Comparison Utilities ──────────────────────────────────────────────

def _normalize_version(v: str) -> str:
    """Normalize version string by stripping leading 'v' and extra whitespace."""
    return re.sub(r'^[vV]', '', (v or '').strip())


def is_version_newer(current: str, remote: str) -> bool:
    """
    Compare current installed version with remote version.
    Supports standard semver (1.32.6 vs 1.32.13) and date-based tags (2024.08.01 vs 2024.08.19).
    Returns True if remote is strictly newer than current.
    """
    c = _normalize_version(current)
    r = _normalize_version(remote)

    if not c or not r or c == "unknown" or r == "unknown":
        return False
    if c == r:
        return False

    try:
        # Split on non-alphanumeric characters (dots, dashes)
        c_parts = [int(x) if x.isdigit() else x for x in re.split(r'[\.\-\_]', c)]
        r_parts = [int(x) if x.isdigit() else x for x in re.split(r'[\.\-\_]', r)]

        # Compare segment by segment
        for c_part, r_part in zip(c_parts, r_parts):
            if isinstance(c_part, int) and isinstance(r_part, int):
                if r_part > c_part:
                    return True
                elif r_part < c_part:
                    return False
            else:
                c_str, r_str = str(c_part), str(r_part)
                if r_str > c_str:
                    return True
                elif r_str < c_str:
                    return False

        # If prefixes match, the one with more segments is newer
        return len(r_parts) > len(c_parts)
    except Exception as e:
        logger.debug(f"Version comparison fallback for '{c}' vs '{r}': {e}")
        return r != c


# ── Tool / Engine Version Inspection ──────────────────────────────────────────

def get_tool_version(tool_name: str) -> str:
    """
    Query the version of an installed tool by invoking its --version flag.
    Uses media_downloader.resolve_tool_path() so user-updated tools are tested first.
    """
    try:
        from media_downloader import resolve_tool_path
        tool_exe = resolve_tool_path(tool_name)
        flag = "-version" if tool_name == "ffmpeg" else "--version"
        result = subprocess.run(
            [tool_exe, flag],
            capture_output=True,
            text=True,
            timeout=5,
            creationflags=CREATE_NO_WINDOW,
        )
        if result.returncode == 0:
            version_str = result.stdout.strip().splitlines()[0]
            if tool_name == "ffmpeg":
                m = re.search(r'ffmpeg version (\S+)', version_str)
                if m:
                    return m.group(1).split('-')[0]
            return version_str.strip()
    except Exception as e:
        logger.debug(f"Failed to query {tool_name} version: {e}")
    return "Unknown"


def get_all_installed_versions() -> dict:
    """Return dictionary of all core components and their current versions."""
    from media_downloader import resolve_tool_path
    return {
        "app": {
            "version": __version__,
            "path": sys.executable if getattr(sys, "frozen", False) else os.path.abspath(__file__),
        },
        "yt-dlp": {
            "version": get_tool_version("yt-dlp"),
            "path": resolve_tool_path("yt-dlp"),
            "is_user_tool": os.path.dirname(resolve_tool_path("yt-dlp")) == str(USER_TOOLS_DIR),
        },
        "gallery-dl": {
            "version": get_tool_version("gallery-dl"),
            "path": resolve_tool_path("gallery-dl"),
            "is_user_tool": os.path.dirname(resolve_tool_path("gallery-dl")) == str(USER_TOOLS_DIR),
        },
        "ffmpeg": {
            "version": get_tool_version("ffmpeg"),
            "path": resolve_tool_path("ffmpeg"),
            "is_user_tool": False,
        },
    }


# ── Tool / Engine Upstream Checks ─────────────────────────────────────────────

def check_ytdlp_update() -> dict:
    """Check latest yt-dlp release on GitHub."""
    current_ver = get_tool_version("yt-dlp")
    result = {
        "tool": "yt-dlp",
        "current_version": current_ver,
        "latest_version": current_ver,
        "update_available": False,
        "asset_url": "",
        "asset_size": 0,
        "published_at": "",
    }

    url = "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest"
    data = _fetch_json(url)
    if not data:
        return result

    latest_tag = data.get("tag_name", "").strip()
    result["latest_version"] = latest_tag
    result["published_at"] = data.get("published_at", "")

    # Locate yt-dlp.exe asset
    for asset in data.get("assets", []):
        if asset.get("name") == "yt-dlp.exe":
            result["asset_url"] = asset.get("browser_download_url", "")
            result["asset_size"] = asset.get("size", 0)
            break

    if result["asset_url"] and is_version_newer(current_ver, latest_tag):
        result["update_available"] = True

    return result


def check_gallerydl_update() -> dict:
    """Check latest gallery-dl release on Codeberg (primary) with GitHub fallback."""
    current_ver = get_tool_version("gallery-dl")
    result = {
        "tool": "gallery-dl",
        "current_version": current_ver,
        "latest_version": current_ver,
        "update_available": False,
        "asset_url": "",
        "asset_size": 0,
        "published_at": "",
    }

    # Codeberg is mikf's primary release host with standalone Windows binaries
    data = _fetch_json("https://codeberg.org/api/v1/repos/mikf/gallery-dl/releases/latest")
    if data:
        latest_tag = _normalize_version(data.get("tag_name", ""))
        result["latest_version"] = latest_tag
        result["published_at"] = data.get("published_at", "")

        for asset in data.get("assets", []):
            # Prefer gallery-dl.exe, fallback to gallery-dl_x86.exe
            name = asset.get("name", "")
            if name == "gallery-dl.exe":
                result["asset_url"] = asset.get("browser_download_url", "")
                result["asset_size"] = asset.get("size", 0)
                break
            elif name == "gallery-dl_x86.exe" and not result["asset_url"]:
                result["asset_url"] = asset.get("browser_download_url", "")
                result["asset_size"] = asset.get("size", 0)

    # Fallback to GitHub if Codeberg check yielded nothing
    if not result["asset_url"]:
        gh_data = _fetch_json("https://api.github.com/repos/mikf/gallery-dl/releases/latest")
        if gh_data:
            latest_tag = _normalize_version(gh_data.get("tag_name", ""))
            result["latest_version"] = latest_tag
            for asset in gh_data.get("assets", []):
                if "gallery-dl" in asset.get("name", "") and asset.get("name", "").endswith(".exe"):
                    result["asset_url"] = asset.get("browser_download_url", "")
                    result["asset_size"] = asset.get("size", 0)
                    break

    if result["asset_url"] and is_version_newer(current_ver, result["latest_version"]):
        result["update_available"] = True

    return result


def check_tool_updates() -> dict:
    """Check update availability for both yt-dlp and gallery-dl."""
    yt = check_ytdlp_update()
    gdl = check_gallerydl_update()
    any_update = yt["update_available"] or gdl["update_available"]
    return {
        "ok": True,
        "any_update": any_update,
        "tools": {
            "yt-dlp": yt,
            "gallery-dl": gdl,
        },
    }


# ── File Streaming Downloader ─────────────────────────────────────────────────

def download_file_with_progress(
    url: str,
    dest_file: Path,
    on_progress: Optional[Callable[[dict], None]] = None,
    timeout: int = 60,
) -> bool:
    """
    Stream a file from URL to dest_file with chunked progress reporting.
    Progress dict: { "percent": int, "speed": str, "downloaded_bytes": int, "total_bytes": int }
    """
    tmp_file = dest_file.with_suffix(dest_file.suffix + ".tmp")
    req = _make_request(url, timeout)

    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            total_bytes = int(response.headers.get("Content-Length", 0))
            downloaded = 0
            chunk_size = 64 * 1024  # 64 KB
            start_time = time.time()
            last_progress_time = start_time

            with open(tmp_file, "wb") as f:
                while True:
                    chunk = response.read(chunk_size)
                    if not chunk:
                        break
                    f.write(chunk)
                    downloaded += len(chunk)

                    now = time.time()
                    if on_progress and (now - last_progress_time >= 0.15 or downloaded == total_bytes):
                        last_progress_time = now
                        elapsed = max(0.001, now - start_time)
                        speed_bps = downloaded / elapsed
                        speed_str = (
                            f"{speed_bps / (1024 * 1024):.1f} MB/s"
                            if speed_bps >= 1024 * 1024
                            else f"{speed_bps / 1024:.0f} KB/s"
                        )
                        pct = int((downloaded / total_bytes) * 100) if total_bytes > 0 else 0
                        on_progress({
                            "percent": min(100, pct),
                            "speed": speed_str,
                            "downloaded_bytes": downloaded,
                            "total_bytes": total_bytes,
                        })

        # Atomic replacement
        if dest_file.exists():
            dest_file.unlink()
        tmp_file.replace(dest_file)
        return True

    except Exception as e:
        logger.error(f"Download error from {url} to {dest_file}: {e}")
        if tmp_file.exists():
            try:
                tmp_file.unlink()
            except Exception:
                pass
        raise


# ── Tool / Engine Updater ─────────────────────────────────────────────────────

def update_engine_tool(
    tool_name: str,
    on_progress: Optional[Callable[[dict], None]] = None,
) -> dict:
    """
    Download latest executable for yt-dlp or gallery-dl into ~/.media_downloader/tools/.
    Returns result dictionary with ok, tool, new_version, and path.
    """
    if tool_name not in ("yt-dlp", "gallery-dl"):
        return {"ok": False, "error": f"Unsupported tool: {tool_name}"}

    with _UPDATE_LOCK:
        logger.info(f"Initiating update for engine tool: {tool_name}")
        info = check_ytdlp_update() if tool_name == "yt-dlp" else check_gallerydl_update()
        asset_url = info.get("asset_url")
        latest_ver = info.get("latest_version")

        if not asset_url:
            return {"ok": False, "error": f"No download URL available for {tool_name}."}

        target_exe = USER_TOOLS_DIR / f"{tool_name}.exe"

        try:
            download_file_with_progress(asset_url, target_exe, on_progress=on_progress)
        except PermissionError:
            logger.error(f"Permission denied updating {target_exe} — file in use")
            return {
                "ok": False,
                "error": f"Cannot update {tool_name} while a download is running. Please finish or cancel active downloads.",
            }
        except Exception as e:
            logger.error(f"Failed to download {tool_name}: {e}")
            return {"ok": False, "error": f"Download failed: {str(e)}"}

        # Verify the downloaded binary works
        new_version = get_tool_version(tool_name)
        logger.info(f"Successfully updated {tool_name} to version {new_version} at {target_exe}")

        return {
            "ok": True,
            "tool": tool_name,
            "version": new_version,
            "path": str(target_exe),
        }


# ── Application Updater ───────────────────────────────────────────────────────

def check_app_update(github_repo: Optional[str] = None) -> dict:
    """
    Check GitHub releases for Media Downloader.
    Returns details on latest release and whether an update is available.
    """
    repo = github_repo or get_github_repo()
    result = {
        "ok": True,
        "update_available": False,
        "current_version": __version__,
        "latest_version": __version__,
        "release_name": "",
        "release_notes": "",
        "asset_url": "",
        "asset_name": "",
        "asset_size": 0,
        "published_at": "",
    }

    url = f"https://api.github.com/repos/{repo}/releases/latest"
    data = _fetch_json(url)

    if not data:
        # Repository may not have releases published yet, or is private/unreachable
        logger.debug(f"No release data found for {repo}")
        return result

    raw_tag = data.get("tag_name", "").strip()
    latest_version = _normalize_version(raw_tag)
    result["latest_version"] = latest_version
    result["release_name"] = data.get("name") or f"Release {raw_tag}"
    result["release_notes"] = data.get("body", "")
    result["published_at"] = data.get("published_at", "")

    # Look for Windows installer asset
    for asset in data.get("assets", []):
        name = asset.get("name", "")
        if name.endswith("Setup.exe") or name == "MediaDownloader.exe" or (name.endswith(".exe") and "installer" in name.lower()):
            result["asset_name"] = name
            result["asset_url"] = asset.get("browser_download_url", "")
            result["asset_size"] = asset.get("size", 0)
            break

    # Compare versions using version.compare_versions
    try:
        cmp = compare_versions(latest_version)
        if cmp == -1:  # current is older than latest_version
            result["update_available"] = True
    except Exception as e:
        logger.debug(f"App version comparison failed: {e}")
        if is_version_newer(__version__, latest_version):
            result["update_available"] = True

    return result


def download_app_installer(
    asset_url: str,
    asset_name: str = "MediaDownloader_Setup.exe",
    on_progress: Optional[Callable[[dict], None]] = None,
) -> dict:
    """
    Download the MediaDownloader Setup.exe installer into TEMP_UPDATES_DIR.
    """
    if not asset_url:
        return {"ok": False, "error": "No installer asset URL provided."}

    dest_file = TEMP_UPDATES_DIR / (asset_name or "MediaDownloader_Setup.exe")
    logger.info(f"Downloading app installer from {asset_url} to {dest_file}")

    try:
        download_file_with_progress(asset_url, dest_file, on_progress=on_progress)
        return {
            "ok": True,
            "installer_path": str(dest_file),
            "size_bytes": os.path.getsize(dest_file),
        }
    except Exception as e:
        logger.error(f"Failed to download app installer: {e}")
        return {"ok": False, "error": f"Failed to download installer: {str(e)}"}


def run_installer_and_exit(installer_path: str, silent: bool = False) -> bool:
    """
    Launch the Inno Setup installer and terminate the current application.
    Flags passed:
      - /CLOSEAPPLICATIONS: Tells Inno Setup to automatically close the running app.
      - /RESTARTAPPLICATIONS: Tells Inno Setup to relaunch the app upon completion.
      - /SILENT (optional): Runs setup without showing the wizard windows.
    """
    if not os.path.isfile(installer_path):
        logger.error(f"Installer not found at {installer_path}")
        return False

    cmd = [installer_path, "/CLOSEAPPLICATIONS", "/RESTARTAPPLICATIONS"]
    if silent:
        cmd.append("/SILENT")

    logger.info(f"Launching installer: {cmd}")

    try:
        # DETACHED_PROCESS ensures the installer survives after our process exits
        flags = 0x00000008  # DETACHED_PROCESS
        subprocess.Popen(cmd, creationflags=flags)
        logger.info("Installer started detached; exiting application")
        return True
    except Exception as e:
        logger.error(f"Failed to launch installer {installer_path}: {e}")
        return False
