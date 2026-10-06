#!/usr/bin/env python3
"""
app.py
------
Desktop wrapper for the Media Downloader UI using PyWebView.

Loads index.html in a native window and exposes a Python API object
to JavaScript as `pywebview.api`. Supports starting a download in the
background, pausing/resuming it (OS-level process suspend, via psutil),
cancelling it, and pushing progress back into the page.

Requirements:
    pip install pywebview gallery-dl yt-dlp psutil

Run:
    python app.py
"""

import json
import mimetypes
import os
import re
import secrets
import sys
import threading
import time
import urllib.parse
import uuid
import webview
from collections import OrderedDict

from logger import get_logger
from version import get_version_string, get_app_info
import updater

# pywebview renamed webview.FOLDER_DIALOG -> webview.FileDialog.FOLDER and
# deprecated the old constant. Prefer the new one but fall back for older
# pywebview installs that don't have FileDialog yet, so this doesn't break
# either way depending on what's installed.
try:
    _FOLDER_DIALOG = webview.FileDialog.FOLDER
except AttributeError:
    _FOLDER_DIALOG = webview.FOLDER_DIALOG

import traceback
import webview.util

# Monkey-patch pywebview js_bridge_call to safely check callback existence before evaluating,
# preventing unhandled JavascriptException: Cannot read properties of undefined in worker threads.
_orig_js_bridge_call = getattr(webview.util, "js_bridge_call", None)
if _orig_js_bridge_call:
    def _patched_js_bridge_call(window, func_name: str, param, value_id: str):
        if func_name in (
            "pywebviewMoveWindow",
            "pywebviewEventHandler",
            "pywebviewAsyncCallback",
            "pywebviewStateUpdate",
            "pywebviewStateDelete",
        ):
            return _orig_js_bridge_call(window, func_name, param, value_id)

        def get_nested_attribute(obj: object, attr_str: str):
            attributes = attr_str.split(".")
            for attr in attributes:
                obj = getattr(obj, attr, None)
                if obj is None:
                    return None
            return obj

        func = window._functions.get(func_name) or get_nested_attribute(window._js_api, func_name)
        if func is None:
            return _orig_js_bridge_call(window, func_name, param, value_id)

        def _safe_call():
            try:
                result = func(*param)
                result = json.dumps(result).replace("\\", "\\\\").replace("'", "\\'")
                retval = f"{{value: '{result}'}}"
            except Exception as e:
                error = {"message": str(e), "name": type(e).__name__, "stack": traceback.format_exc()}
                result = json.dumps(error).replace("\\", "\\\\").replace("'", "\\'")
                retval = f"{{isError: true, value: '{result}'}}"

            try:
                safe_js = (
                    f"(function() {{"
                    f"  try {{"
                    f"    var cbs = window.pywebview && window.pywebview._returnValuesCallbacks;"
                    f"    if (cbs && cbs['{func_name}'] && typeof cbs['{func_name}']['{value_id}'] === 'function') {{"
                    f"      cbs['{func_name}']['{value_id}']({retval});"
                    f"    }}"
                    f"  }} catch (err) {{"
                    f"    console.warn('Suppressed pywebview return callback error:', err);"
                    f"  }}"
                    f"}})();"
                )
                window.evaluate_js(safe_js)
            except Exception:
                pass

        threading.Thread(target=_safe_call, daemon=True).start()

    webview.util.js_bridge_call = _patched_js_bridge_call
    try:
        import webview.platforms.edgechromium as _ec
        _ec.js_bridge_call = _patched_js_bridge_call
    except Exception:
        pass

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import download_history
import search_history
from media_downloader import (
    _app_base_dir,
    download_from_ui,
    detect_tool,
    site_hint,
    auth_hint,
    pause_job,
    resume_job,
    cancel_job,
    job_status,
    extract_embedded_art,
    extract_video_thumbnail,
    get_default_download_dir,
    resolve_existing_media_path,
    resolve_media_subfolder,
)
from validators import (
    validate_url,
    validate_path,
    validate_config,
    validate_search_query,
    validate_job_id,
    validate_history_entry_id,
    validate_completion_action,
    ValidationError,
)

# ── Browser bridge ────────────────────────────────────────────────────────────
#
# A tiny HTTP server on localhost:6789 that the Chrome/Edge extension posts
# URLs to. The shared token is generated fresh on every app launch and
# written to a well-known location the extension can read via a separate
# /token endpoint (first-time pairing). After pairing the extension stores
# it in chrome.storage.local and sends it in every subsequent request.
#
# Only binds to 127.0.0.1 so it is unreachable from the network.

BRIDGE_PORT  = 6789
BRIDGE_TOKEN = secrets.token_hex(16)   # new token every launch
_bridge_api_ref = None                  # set to the Api instance once created

# ── known-media-path registry ─────────────────────────────────────────────
#
# get_media_url()/get_media_urls() previously handed out a working /media
# URL for ANY file the process could read, gated only by the per-launch
# bridge token — validate_path() only checked that the path existed and
# was a file, not that it had anything to do with this app. A leaked or
# guessed token (or a bug in the extension-origin CORS check) would then
# mean arbitrary local file disclosure, not just "read your downloads".
#
# This registry tracks paths the app has itself produced — completed
# download files and persisted history entries — and _serve_media()
# requires a match here (or containment in the art-cache dir, which is
# entirely app-generated) before streaming anything, independent of the
# token check. Bounded with a simple FIFO eviction so a very long-running
# session can't grow this unboundedly.
_KNOWN_MEDIA_PATHS = OrderedDict()   # normalized path -> None; dict used as an ordered set
_KNOWN_MEDIA_LOCK = threading.Lock()
_KNOWN_MEDIA_MAX = 20000


def _normalize_media_path(path: str) -> str:
    p = os.path.normpath(os.path.abspath(os.path.expanduser(path or "")))
    return os.path.normcase(p) if os.name == "nt" else p


def _register_known_media_path(path: str) -> None:
    if not path:
        return
    normalized = _normalize_media_path(path)
    with _KNOWN_MEDIA_LOCK:
        _KNOWN_MEDIA_PATHS.pop(normalized, None)  # re-insert at the end (most-recent)
        _KNOWN_MEDIA_PATHS[normalized] = None
        while len(_KNOWN_MEDIA_PATHS) > _KNOWN_MEDIA_MAX:
            _KNOWN_MEDIA_PATHS.popitem(last=False)


def _is_app_cache_path(path: str) -> bool:
    """Check if path is inside the app's own generated art_cache or thumb_cache directory."""
    if not path:
        return False
    try:
        from media_downloader import _art_cache_dir, _thumb_cache_dir
        normalized = _normalize_media_path(path)
        for cache_dir_fn in (_art_cache_dir, _thumb_cache_dir):
            cache_dir = _normalize_media_path(cache_dir_fn())
            try:
                if os.path.commonpath([normalized, cache_dir]) == cache_dir:
                    return True
            except ValueError:
                continue
    except Exception:
        pass
    return False


def _is_known_media_path(path: str) -> bool:
    if not path:
        return False
    if _is_app_cache_path(path):
        return True
    normalized = _normalize_media_path(path)
    with _KNOWN_MEDIA_LOCK:
        if normalized in _KNOWN_MEDIA_PATHS:
            return True

    # Allow any file in the default download directory or subfolders
    try:
        from media_downloader import get_default_download_dir
        dl_dir = _normalize_media_path(get_default_download_dir())
        if dl_dir and os.path.isdir(dl_dir):
            try:
                if os.path.commonpath([normalized, dl_dir]) == dl_dir:
                    return True
            except ValueError:
                pass
    except Exception:
        pass
    return False

# Initialize logger
logger = get_logger(__name__)


def resolve_entry_thumbnail_url(files: list, output_dir: str = None) -> str:
    """
    Resolve a thumbnail URL for a list of files produced by a download or bundle.
    Inspects files to find the first image, video, or audio file, extracts a thumbnail
    (or embedded cover art / video frame), registers the media path, and returns the
    authenticated bridge /media URL.
    """
    if not files and output_dir and os.path.isdir(output_dir):
        try:
            for root, _, fnames in os.walk(output_dir):
                for fn in fnames:
                    fext = os.path.splitext(fn)[1].lower()
                    if fext in (
                        ".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".jfif", ".avif",
                        ".mp4", ".mkv", ".webm", ".avi", ".mov", ".m4v", ".flv", ".ts", ".wmv",
                        ".mp3", ".m4a", ".flac", ".ogg", ".opus", ".aac", ".wma", ".wav"
                    ):
                        return resolve_entry_thumbnail_url([os.path.join(root, fn)], output_dir=output_dir)
        except Exception:
            pass

    if not files:
        return None
    for f in files:
        fpath = f.get("path") if isinstance(f, dict) else str(f)
        if not fpath:
            continue
        expanded = resolve_existing_media_path(fpath, output_dir=output_dir)
        if not expanded or not os.path.isfile(expanded):
            continue
        ext = os.path.splitext(expanded)[1].lower()
        if ext in (".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".jfif", ".avif"):
            _register_known_media_path(expanded)
            query = urllib.parse.urlencode({"token": BRIDGE_TOKEN, "path": expanded})
            return f"http://127.0.0.1:{BRIDGE_PORT}/media?{query}"
        elif ext in (".mp3", ".m4a", ".flac", ".ogg", ".opus", ".aac", ".wma", ".wav"):
            cover_path = extract_embedded_art(expanded)
            if cover_path and os.path.isfile(cover_path):
                _register_known_media_path(cover_path)
                query = urllib.parse.urlencode({"token": BRIDGE_TOKEN, "path": cover_path})
                return f"http://127.0.0.1:{BRIDGE_PORT}/media?{query}"
        elif ext in (".mp4", ".mkv", ".webm", ".avi", ".mov", ".m4v", ".flv", ".ts", ".wmv"):
            vthumb = extract_video_thumbnail(expanded)
            if vthumb and os.path.isfile(vthumb):
                _register_known_media_path(vthumb)
                query = urllib.parse.urlencode({"token": BRIDGE_TOKEN, "path": vthumb})
                return f"http://127.0.0.1:{BRIDGE_PORT}/media?{query}"
    return None


class _BridgeHandler(BaseHTTPRequestHandler):
    """Handles requests from the browser extension."""

    def log_message(self, fmt, *args):
        pass   # silence the default access log

    def _cors(self):
        # Allow requests from browser extensions and local app for media streaming/Web Audio API
        origin = self.headers.get("Origin", "")
        if origin.startswith("chrome-extension://") or origin.startswith("moz-extension://"):
            self.send_header("Access-Control-Allow-Origin", origin)
        else:
            self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Token, Range")
        self.send_header("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        """
        GET /token  — returns the current session token so the extension
        can pair itself on first install without the user having to copy
        anything manually.

        GET /media  — streams a local file (?path=...&token=...) for the
        built-in media player. Playback intentionally goes through this
        server rather than a file:// URI: Chromium/WebView2 treats every
        file:// resource as its own opaque origin and will silently refuse
        to load a <video>/<audio> src pointing at an arbitrary local path
        unless the page itself was loaded from that exact same file://
        location. Serving over http://127.0.0.1 sidesteps that entirely,
        and lets us support Range requests so seeking actually works.

        Both endpoints are only reachable from localhost so exposure is minimal.
        """
        parsed = urllib.parse.urlsplit(self.path)
        if parsed.path == "/token":
            body = json.dumps({"token": BRIDGE_TOKEN}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self._cors()
            self.end_headers()
            self.wfile.write(body)
        elif parsed.path == "/media":
            self._serve_media(parsed)
        else:
            self.send_response(404)
            self.end_headers()

    def _serve_media(self, parsed):
        qs = urllib.parse.parse_qs(parsed.query)
        token = (qs.get("token") or [""])[0]
        raw_path = (qs.get("path") or qs.get("p") or [""])[0]
        path = resolve_existing_media_path(raw_path)

        # Allow if valid session token, OR if path is an app-generated thumbnail cache file
        is_cache_thumb = _is_app_cache_path(path or raw_path)
        token_valid = secrets.compare_digest(token, BRIDGE_TOKEN)

        if not token_valid and not is_cache_thumb:
            self.send_response(403); self.end_headers(); return

        if not path or not os.path.isfile(path):
            self.send_response(404); self.end_headers(); return

        if not is_cache_thumb and not _is_known_media_path(path):
            try:
                from media_downloader import get_default_download_dir
                dl_dir = _normalize_media_path(get_default_download_dir())
                normalized = _normalize_media_path(path)
                if dl_dir and os.path.commonpath([normalized, dl_dir]) == dl_dir:
                    _register_known_media_path(path)
            except Exception:
                pass

        if not is_cache_thumb and not _is_known_media_path(path):
            # Valid token, but a path the app never actually produced —
            # don't serve it. 404 rather than 403 so this doesn't act as
            # an existence oracle for arbitrary filesystem paths.
            logger.warning(f"Rejected /media request for unregistered path: {path}")
            self.send_response(404); self.end_headers(); return

        file_size = os.path.getsize(path)
        ext = os.path.splitext(path)[1].lower()
        content_type = {
            ".m4a": "audio/mp4",
            ".mp3": "audio/mpeg",
            ".aac": "audio/aac",
            ".flac": "audio/flac",
            ".wav": "audio/wav",
            ".ogg": "audio/ogg",
            ".opus": "audio/ogg",
            ".wma": "audio/x-ms-wma",
            ".mp4": "video/mp4",
            ".m4v": "video/mp4",
            ".webm": "video/webm",
            ".mkv": "video/x-matroska",
            ".mov": "video/quicktime",
            ".avi": "video/x-msvideo",
            ".flv": "video/x-flv",
            ".ts": "video/mp2t",
            ".wmv": "video/x-ms-wmv",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
            ".gif": "image/gif",
            ".bmp": "image/bmp",
            ".jfif": "image/jpeg",
            ".avif": "image/avif",
        }.get(ext) or mimetypes.guess_type(path)[0] or "application/octet-stream"

        start, end, status = 0, file_size - 1, 200
        range_header = self.headers.get("Range")
        if range_header:
            m = re.match(r"bytes=(\d*)-(\d*)", range_header)
            if m:
                if m.group(1):
                    start = int(m.group(1))
                if m.group(2):
                    end = int(m.group(2))
                status = 206

        if file_size == 0 or start > end or end >= file_size:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{file_size}")
            self._cors()
            self.end_headers()
            return

        length = end - start + 1
        try:
            with open(path, "rb") as f:
                self.send_response(status)
                self.send_header("Content-Type", content_type)
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("Content-Length", str(length))
                if status == 206:
                    self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
                self._cors()
                self.end_headers()

                f.seek(start)
                remaining = length
                while remaining > 0:
                    chunk = f.read(min(65536, remaining))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    remaining -= len(chunk)
        except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError):
            pass  # player was closed/seeked mid-stream — not an error

    def do_POST(self):
        if self.path != "/add-url":
            self.send_response(404); self.end_headers(); return

        # Token check
        token = self.headers.get("X-Token", "")
        if not secrets.compare_digest(token, BRIDGE_TOKEN):
            logger.warning("Invalid token in /add-url request")
            self.send_response(403); self.end_headers(); return

        # Read body
        length = int(self.headers.get("Content-Length", 0))
        try:
            payload = json.loads(self.rfile.read(length))
        except Exception as e:
            logger.error(f"Failed to parse /add-url payload: {e}")
            self.send_response(400); self.end_headers(); return

        url   = payload.get("url", "").strip()
        title = payload.get("title", "").strip()

        # Validate URL
        if not validate_url(url):
            logger.warning(f"Invalid URL in /add-url request: {url}")
            self.send_response(400); self.end_headers(); return

        # Forward to the UI via evaluate_js
        if _bridge_api_ref:
            _bridge_api_ref._push_js(
                f"window.onBrowserUrl?.({json.dumps(url)}, {json.dumps(title)})"
            )
            logger.info(f"URL forwarded from browser extension: {url}")

        body = json.dumps({"ok": True}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)


_bridge_server_ref = None


def _start_bridge_server():
    """Start the bridge HTTP server on a daemon thread — never blocks the UI."""
    global _bridge_server_ref
    try:
        server = ThreadingHTTPServer(("127.0.0.1", BRIDGE_PORT), _BridgeHandler)
        _bridge_server_ref = server
        t = threading.Thread(target=server.serve_forever, daemon=True)
        t.start()
        logger.info(f"Bridge server started on port {BRIDGE_PORT}")
    except OSError as e:
        # Port already in use — another instance may be running, ignore.
        logger.warning(f"Bridge server port {BRIDGE_PORT} already in use: {e}")


def _stop_bridge_server():
    """Cleanly shut down the bridge server and release port 6789."""
    global _bridge_server_ref
    if _bridge_server_ref:
        try:
            _bridge_server_ref.shutdown()
            _bridge_server_ref.server_close()
        except Exception:
            pass
        _bridge_server_ref = None
        logger.info("Bridge server stopped and port released")


class Api:
    """
    Methods on this class are callable from JS as pywebview.api.<name>(...).
    Every method must return JSON-serializable data (dict, list, str, etc).
    PyWebView marshals the call automatically and returns a JS Promise.
    """

    def __init__(self):
        self._window = None
        self._active_job_ids = set()
        self._active_job_history = {}  # job_id -> history_id
        self._jobs_lock = threading.Lock()
        logger.info(f"NovaDrop {get_version_string()} initialized")
        self._recover_interrupted_history()

    def _recover_interrupted_history(self):
        """Transition any leftover 'running' downloads from an earlier abnormal app exit to 'cancelled'."""
        try:
            entries = download_history.list_entries()
            changed = False
            for e in entries:
                if e.get("status") == "running":
                    e["status"] = "cancelled"
                    e["error"] = "Interrupted when application closed."
                    e["finished_at"] = e.get("finished_at") or time.time()
                    changed = True
            if changed:
                download_history._save(entries)
                logger.info("Recovered previous interrupted download(s) in history")
        except Exception as e:
            logger.debug(f"History recovery check error: {e}")

    def set_window(self, window):
        global _bridge_api_ref
        self._window = window
        _bridge_api_ref = self   # allow bridge server to call _push_js

    # ── browser bridge token (for extension pairing) ──
    def get_bridge_info(self) -> dict:
        """Return the local server port and session token for the extension."""
        return {"port": BRIDGE_PORT, "token": BRIDGE_TOKEN}

    # ── version information ──
    def get_app_info(self) -> dict:
        """Return application version and metadata."""
        return get_app_info()

    def get_system_versions(self) -> dict:
        """Return versions of app and installed tools."""
        return updater.get_all_installed_versions()

    def get_installed_versions(self) -> dict:
        """Alias for get_system_versions."""
        return self.get_system_versions()

    def update_tool(self, tool_name: str) -> dict:
        """Alias for update_engine_async."""
        return self.update_engine_async(tool_name)

    # ── update checks & operations ──
    def check_updates_async(self) -> dict:
        """Check for updates for app and tools in background thread."""
        def run():
            try:
                tools_info = updater.check_tool_updates()
                app_info = updater.check_app_update()
                payload = {
                    "ok": True,
                    "app": app_info,
                    "tools": tools_info.get("tools", {}),
                    "any_update": bool(app_info.get("update_available") or tools_info.get("any_update")),
                }
                self._push_js(f"window.onUpdateCheckComplete?.({_js(payload)})")
            except Exception as e:
                logger.error(f"Error checking updates: {e}")
                self._push_js(f"window.onUpdateCheckComplete?.({_js({'ok': False, 'error': str(e)})})")

        threading.Thread(target=run, daemon=True).start()
        return {"ok": True, "checking": True}

    def check_engine_update_async(self, tool_name: str) -> dict:
        """Check update for a specific tool independently (yt-dlp, gallery-dl, or ffmpeg)."""
        def run():
            try:
                info = updater.check_single_tool_update(tool_name)
                payload = {
                    "ok": True,
                    "tool": tool_name,
                    "info": info,
                }
                self._push_js(f"window.onSingleToolCheckComplete?.({_js(payload)})")
            except Exception as e:
                logger.error(f"Error checking {tool_name} update: {e}")
                self._push_js(f"window.onSingleToolCheckComplete?.({_js({'ok': False, 'tool': tool_name, 'error': str(e)})})")

        threading.Thread(target=run, daemon=True).start()
        return {"ok": True, "checking": True, "tool": tool_name}

    def check_app_update_async(self) -> dict:
        """Check update for desktop app independently."""
        def run():
            try:
                app_info = updater.check_app_update()
                payload = {
                    "ok": True,
                    "info": app_info,
                    "app": app_info,
                }
                self._push_js(f"window.onAppCheckComplete?.({_js(payload)})")
            except Exception as e:
                logger.error(f"Error checking app update: {e}")
                self._push_js(f"window.onAppCheckComplete?.({_js({'ok': False, 'error': str(e)})})")

        threading.Thread(target=run, daemon=True).start()
        return {"ok": True, "checking": True}

    def update_engine_async(self, tool_name: str) -> dict:
        """Update an extractor or media tool (yt-dlp, gallery-dl, ffmpeg) in background thread."""
        with self._jobs_lock:
            if self._active_job_ids:
                return {
                    "ok": False,
                    "error": f"Cannot update {tool_name} while downloads are running. Please finish or cancel active downloads.",
                }

        def on_prog(snapshot: dict):
            self._push_js(f"window.onSingleToolProgress?.({_js({'tool': tool_name, **snapshot})})")
            self._push_js(f"window.onUpdateProgress?.({_js({'type': 'tool', 'tool': tool_name, **snapshot})})")

        def run():
            result = updater.update_engine_tool(tool_name, on_progress=on_prog)
            tool_payload = {"ok": result.get("ok", False), "tool": tool_name, "version": result.get("version"), "error": result.get("error")}
            self._push_js(f"window.onSingleToolUpdateComplete?.({_js(tool_payload)})")
            self._push_js(f"window.onEngineUpdateComplete?.({_js(result)})")

        threading.Thread(target=run, daemon=True).start()
        return {"ok": True, "updating": True, "tool": tool_name}

    def download_app_update_async(self, asset_url: str, asset_name: str = "") -> dict:
        """Download desktop app installer in background thread."""
        def on_prog(snapshot: dict):
            self._push_js(f"window.onAppDownloadProgress?.({_js(snapshot)})")
            self._push_js(f"window.onUpdateProgress?.({_js({'type': 'app', **snapshot})})")

        def run():
            result = updater.download_app_installer(asset_url, asset_name, on_progress=on_prog)
            self._push_js(f"window.onAppDownloadComplete?.({_js(result)})")
            self._push_js(f"window.onAppInstallerReady?.({_js(result)})")

        threading.Thread(target=run, daemon=True).start()
        return {"ok": True, "downloading": True}

    def apply_app_update(self, installer_path: str, silent: bool = False) -> dict:
        """Launch downloaded installer and exit the application."""
        self.cancel_all_active()
        success = updater.run_installer_and_exit(installer_path, silent=silent)
        if success:
            if self._window:
                try:
                    self._window.destroy()
                except Exception:
                    pass
            os._exit(0)
        return {"ok": False, "error": "Failed to launch installer."}

    def auto_update_all_async(self, auto_download_app: bool = True) -> dict:
        """
        Check updates and automatically download and install engine updates,
        and download the app installer in the background.
        """
        def run():
            try:
                self._push_js(f"window.onAutoUpdateStatus?.({_js({'status': 'checking', 'message': 'Checking updates for engines and application…'})})")
                self._push_js(f"window.onAutoUpdateStep?.('Scanning for engine and application updates…')")
                tools_info = updater.check_tool_updates()
                app_info = updater.check_app_update()

                updated_tools = []
                tools_data = tools_info.get("tools", {})
                for tool_name, tinfo in tools_data.items():
                    if tinfo.get("update_available"):
                        lat_ver = tinfo.get("latest_version", "")
                        msg = f"Updating {tool_name} to {lat_ver}…"
                        status_obj = {"status": "updating_engine", "tool": tool_name, "message": msg}
                        self._push_js(f"window.onAutoUpdateStatus?.({_js(status_obj)})")
                        self._push_js(f"window.onAutoUpdateStep?.({_js(msg)})")
                        res = updater.update_engine_tool(tool_name)
                        if res.get("ok"):
                            updated_tools.append(tool_name)
                            tool_payload = {"ok": True, "tool": tool_name, "version": res.get("version")}
                            self._push_js(f"window.onSingleToolUpdateComplete?.({_js(tool_payload)})")
                            self._push_js(f"window.onEngineUpdateComplete?.({_js(res)})")

                app_installer_ready = False
                asset_link = app_info.get("asset_url") or app_info.get("download_url")
                if app_info.get("update_available") and asset_link and auto_download_app and app_info.get("has_direct_installer", True):
                    app_lat = app_info.get("latest_version", "")
                    app_msg = f"Downloading MediaDownloader v{app_lat}…"
                    status_obj = {"status": "downloading_app", "message": app_msg}
                    self._push_js(f"window.onAutoUpdateStatus?.({_js(status_obj)})")
                    self._push_js(f"window.onAutoUpdateStep?.({_js(app_msg)})")
                    app_res = updater.download_app_installer(asset_link, app_info.get("asset_name", ""))
                    if app_res.get("ok"):
                        app_installer_ready = True
                        self._push_js(f"window.onAppDownloadComplete?.({_js(app_res)})")
                        self._push_js(f"window.onAppInstallerReady?.({_js(app_res)})")

                summary = {
                    "ok": True,
                    "updated_tools": updated_tools,
                    "app_update_available": app_info.get("update_available", False),
                    "app_installer_ready": app_installer_ready,
                    "app_info": app_info,
                    "message": "Auto-update complete",
                }
                self._push_js(f"window.onAutoUpdateStatus?.({_js({'status': 'completed', **summary})})")
                self._push_js(f"window.onAutoUpdateStep?.('All updates complete')")
            except Exception as e:
                logger.error(f"Auto-update error: {e}")
                self._push_js(f"window.onAutoUpdateStatus?.({_js({'status': 'error', 'error': str(e)})})")
                self._push_js(f"window.onAutoUpdateStep?.({_js(f'Error: {str(e)}')})")

        threading.Thread(target=run, daemon=True).start()
        return {"ok": True, "started": True}

    # ── detection (used for the live "auto tool" badge) ──
    def detect(self, url: str) -> dict:
        if not url or not url.startswith("http"):
            return {"tool": "", "hint": "", "auth_hint": ""}
        return {"tool": detect_tool(url), "hint": site_hint(url), "auth_hint": auth_hint(url)}

    # ── start a download in the background, return its job_id immediately ──
    def start_download(self, url: str, cfg: dict, tool_override: str = "", client_job_id: str = "") -> dict:
        """Alias for start_download_async."""
        return self.start_download_async(url, cfg, tool_override, client_job_id)

    def start_download_async(self, url: str, cfg: dict, tool_override: str = "", client_job_id: str = "") -> dict:
        # Validate URL
        if not validate_url(url):
            logger.warning(f"Invalid URL provided: {url}")
            return {"ok": False, "error": "Please provide a valid URL starting with http(s)."}

        # Validate configuration
        try:
            validated_cfg = validate_config(cfg)
        except ValidationError as e:
            logger.warning(f"Invalid download configuration: {e}")
            return {"ok": False, "error": f"Invalid configuration: {str(e)}"}

        # Prefer a client-supplied job id. The frontend generates this
        # synchronously and sets its own currentJobId BEFORE awaiting this
        # call, so on_line/on_progress callbacks that fire while this
        # (async, IPC round-trip) call is still in flight land against an
        # id the UI is already watching. Previously the id was generated
        # here and only reached the frontend once the returned promise
        # resolved — callbacks that arrived first were silently dropped by
        # the frontend's `if (jobId !== currentJobId) return;` guard,
        # losing the earliest progress line(s)/percent on every download.
        if client_job_id and validate_job_id(client_job_id):
            job_id = client_job_id
        else:
            job_id = str(uuid.uuid4())

        # Pre-seed history entry immediately so mid-download closures or crashes are never lost
        url_path = urllib.parse.urlsplit(url).path
        initial_name = cfg.get("title") or (os.path.basename(url_path) if url_path else "") or url
        base_out = cfg.get("output_dir") or get_default_download_dir()
        tool = tool_override or detect_tool(url)
        fmt = cfg.get("format", "auto")
        # Resolve the subfolder up-front so history shows the real destination
        out_dir = resolve_media_subfolder(base_out, tool, url, fmt)
        initial_thumb = cfg.get("thumbnail") or None

        history_id = ""
        if not cfg.get("dry_run"):
            try:
                history_id = download_history.add_entry({
                    "url": url,
                    "tool": tool,
                    "output_dir": out_dir,
                    "filename": initial_name,
                    "files": [],
                    "size_bytes": 0,
                    "status": "running",
                    "job_id": job_id,
                    "error": None,
                    "thumbnail": initial_thumb,
                    "started_at": time.time(),
                    "finished_at": None,
                })
            except Exception as e:
                logger.error(f"Failed to pre-seed download history: {e}")

        with self._jobs_lock:
            self._active_job_ids.add(job_id)
            if history_id:
                self._active_job_history[job_id] = history_id
        
        # Prevent Windows sleep/standby during active downloads
        try:
            from sleep_manager import sleep_manager
            sleep_manager.prevent_sleep()
        except Exception:
            pass

        logger.info(f"Starting download job {job_id} for URL: {url}")

        def on_line(line: str):
            self._push_js(f"window.onDownloadLine?.({_js(job_id)}, {_js(line)})")

        def on_progress(snapshot: dict):
            # Update Windows Taskbar Progress bar
            pct = snapshot.get("percent", 0)
            try:
                from taskbar_manager import taskbar
                taskbar.set_progress(pct, 100, state="normal")
            except Exception:
                pass

            payload = {
                "items_done": snapshot.get("items_done", 0),
                "limit": snapshot.get("limit", 0),
                "current_file": snapshot.get("current_file") or "",
                "percent": pct,
                "speed": snapshot.get("speed") or "",
                "eta": snapshot.get("eta") or "",
                "downloaded_bytes": snapshot.get("downloaded_bytes"),
                "total_bytes": snapshot.get("total_bytes"),
            }
            self._push_js(f"window.onDownloadProgress?.({_js(job_id)}, {_js(payload)})")

        def run():
            try:
                result = download_from_ui(
                    url, validated_cfg, tool_override=tool_override,
                    on_line=on_line, on_progress=on_progress, job_id=job_id,
                )
            finally:
                with self._jobs_lock:
                    self._active_job_ids.discard(job_id)
                    remaining = len(self._active_job_ids)

                if remaining == 0:
                    try:
                        from sleep_manager import sleep_manager
                        sleep_manager.restore_sleep()
                    except Exception:
                        pass

                    try:
                        from taskbar_manager import taskbar
                        if not result.get("ok") and (result.get("error") != "Cancelled by user."):
                            taskbar.set_progress(100, 100, state="error")
                            def _clear_err():
                                time.sleep(3.5)
                                taskbar.clear()
                            threading.Thread(target=_clear_err, daemon=True).start()
                        else:
                            taskbar.clear()
                    except Exception:
                        pass

            status = job_status(job_id)
            files = status.get("files", []) if status.get("ok") else []
            if not files and result.get("files"):
                files = result.get("files", [])
            for f in files:
                fpath = f.get("path") if isinstance(f, dict) else str(f)
                if fpath:
                    _register_known_media_path(fpath)

            # Record/update history (skip dry-runs — nothing was actually downloaded).
            thumb_url = None
            if not cfg.get("dry_run"):
                try:
                    if len(files) == 1:
                        display_name = files[0]["name"]
                    elif len(files) > 1:
                        display_name = f"{len(files)} files"
                    else:
                        display_name = initial_name

                    status_label = (
                        "done" if result.get("ok")
                        else "cancelled" if (result.get("state") == "cancelled" or result.get("error") == "Cancelled by user." or status.get("state") == "cancelled")
                        else "error"
                    )
                    thumb_url = resolve_entry_thumbnail_url(files, output_dir=result.get("output_dir") or out_dir) or initial_thumb
                    detected_cat = Api._detect_entry_category(files, display_name)
                    hist_payload = {
                        "url": url,
                        "tool": result.get("tool", tool),
                        "output_dir": result.get("output_dir", out_dir),
                        "filename": display_name,
                        "category": detected_cat,
                        "files": files,
                        "size_bytes": sum((f.get("size") or 0) for f in files),
                        "status": status_label,
                        "error": result.get("error"),
                        "thumbnail": thumb_url,
                        "started_at": status.get("started_at"),
                        "finished_at": status.get("finished_at") or time.time(),
                    }

                    if history_id and download_history.update_entry(history_id, hist_payload):
                        pass
                    else:
                        download_history.add_entry(hist_payload)
                except Exception as e:
                    logger.error(f"Failed to record/update download history: {e}")
                finally:
                    with self._jobs_lock:
                        self._active_job_history.pop(job_id, None)

            self._push_js(
                f"window.onDownloadDone?.({_js(job_id)}, "
                f"{_js(bool(result['ok']))}, "
                f"{_js(result.get('error') or '')}, "
                f"{_js(result.get('output_dir') or '')}, "
                f"{_js(files)}, "
                f"{_js(history_id)}, "
                f"{_js(thumb_url)})"
            )

            # Windows 10/11 Native Interactive Rich Toast Notification
            try:
                from toast_manager import toast
                if result.get("ok"):
                    toast.show_download_complete(
                        title=display_name,
                        files=files,
                        output_dir=result.get("output_dir") or out_dir,
                        thumbnail=thumb_url
                    )
                elif not result.get("ok") and (result.get("error") != "Cancelled by user."):
                    toast.show_download_failed(
                        title=display_name,
                        error=result.get("error")
                    )
            except Exception as e:
                logger.debug(f"Failed to display native toast notification: {e}")

        threading.Thread(target=run, daemon=True).start()
        return {"ok": True, "started": True, "job_id": job_id}

    # ── job controls ──
    def pause_download(self, job_id: str) -> dict:
        if not validate_job_id(job_id):
            logger.warning(f"Invalid job ID for pause: {job_id}")
            return {"ok": False, "error": "Invalid job ID"}
        return pause_job(job_id)

    def resume_download(self, job_id: str) -> dict:
        if not validate_job_id(job_id):
            logger.warning(f"Invalid job ID for resume: {job_id}")
            return {"ok": False, "error": "Invalid job ID"}
        return resume_job(job_id)

    def cancel_download(self, job_id: str) -> dict:
        if not validate_job_id(job_id):
            logger.warning(f"Invalid job ID for cancel: {job_id}")
            return {"ok": False, "error": "Invalid job ID"}
        res = cancel_job(job_id)
        with self._jobs_lock:
            remaining = len(self._active_job_ids)
        if remaining == 0:
            try:
                from sleep_manager import sleep_manager
                sleep_manager.restore_sleep()
            except Exception:
                pass
            try:
                from taskbar_manager import taskbar
                taskbar.clear()
            except Exception:
                pass
        return res

    # ── windows 11 taskbar progress controls (ITaskbarList3) ──
    def set_taskbar_progress(self, percent: float, state: str = "normal") -> dict:
        """Update Windows 7/10/11 taskbar icon progress bar (ITaskbarList3)."""
        try:
            from taskbar_manager import taskbar
            taskbar.set_progress(percent, 100, state=state)
            return {"ok": True}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def clear_taskbar_progress(self) -> dict:
        """Clear Windows taskbar icon progress bar."""
        try:
            from taskbar_manager import taskbar
            taskbar.clear()
            return {"ok": True}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    # ── windows 10/11 native interactive toast notifications ──
    def show_native_toast(self, title: str, message: str, image_path: str = None, actions: list = None) -> dict:
        """Display native Windows 10/11 interactive toast notification."""
        try:
            from toast_manager import toast
            toast.show_toast(title, message, image_path=image_path, actions=actions)
            return {"ok": True}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def set_native_toast_enabled(self, enabled: bool) -> dict:
        """Toggle native toast notifications on or off."""
        try:
            from toast_manager import toast
            toast.set_enabled(enabled)
            return {"ok": True, "enabled": enabled}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    # ── windows sleep prevention ──
    def set_sleep_prevention(self, prevent: bool) -> dict:
        """Prevent or restore system sleep policy manually."""
        try:
            from sleep_manager import sleep_manager
            if prevent:
                sleep_manager.prevent_sleep()
            else:
                sleep_manager.restore_sleep()
            return {"ok": True, "preventing": sleep_manager.is_preventing()}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    # ── windows 11 dwm window effects ──
    def apply_window_backdrop(self, backdrop: str = "mica") -> dict:
        """Apply Windows 11 DWM backdrop (mica, mica_alt, acrylic, auto)."""
        try:
            from taskbar_manager import taskbar
            hwnd = taskbar._find_hwnd()
            if hwnd:
                from window_effects import window_effects
                window_effects.apply_fluent_effects(hwnd, backdrop=backdrop)
                return {"ok": True}
            return {"ok": False, "error": "HWND not found"}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def get_status(self, job_id: str) -> dict:
        if not validate_job_id(job_id):
            logger.warning(f"Invalid job ID for status: {job_id}")
            return {"ok": False, "error": "Invalid job ID"}
        return job_status(job_id)

    # ── native folder picker ──
    def pick_folder(self) -> str:
        if not self._window:
            logger.warning("Folder picker called but no window available")
            return ""
        result = self._window.create_file_dialog(_FOLDER_DIALOG)
        if result and len(result) > 0:
            path = result[0]
            if validate_path(path, must_exist=False):
                logger.debug(f"Folder selected: {path}")
                return path
            else:
                logger.warning(f"Invalid path selected: {path}")
        logger.debug("Folder picker cancelled")
        return ""

    def get_default_output_dir(self) -> str:
        """Return the default media download folder (~/Downloads/media)."""
        return get_default_download_dir()

    # ── clipboard read (for clipboard monitor feature) ──
    def read_clipboard(self) -> str:
        """Return current clipboard text, or empty string on any failure."""
        if os.name == "nt":
            try:
                import ctypes
                from ctypes import wintypes
                user32 = ctypes.windll.user32
                kernel32 = ctypes.windll.kernel32
                user32.OpenClipboard.argtypes = [wintypes.HWND]
                user32.OpenClipboard.restype = wintypes.BOOL
                user32.CloseClipboard.restype = wintypes.BOOL
                user32.GetClipboardData.argtypes = [wintypes.UINT]
                user32.GetClipboardData.restype = wintypes.HANDLE
                kernel32.GlobalLock.argtypes = [wintypes.HGLOBAL]
                kernel32.GlobalLock.restype = wintypes.LPVOID
                kernel32.GlobalUnlock.argtypes = [wintypes.HGLOBAL]
                kernel32.GlobalUnlock.restype = wintypes.BOOL

                # Try opening clipboard with retries in case another process holds it momentarily
                for _ in range(3):
                    if user32.OpenClipboard(None):
                        try:
                            # 13 = CF_UNICODETEXT
                            h = user32.GetClipboardData(13)
                            if h:
                                p = kernel32.GlobalLock(h)
                                if p:
                                    try:
                                        val = ctypes.c_wchar_p(p).value
                                        return (val or "").strip()
                                    finally:
                                        kernel32.GlobalUnlock(h)
                            return ""
                        finally:
                            user32.CloseClipboard()
                    time.sleep(0.02)
            except Exception as e:
                logger.debug(f"Direct ctypes clipboard read failed, using fallback: {e}")

        try:
            import subprocess as _sp
            # Fallback to PowerShell if ctypes unavailable
            result = _sp.run(
                ["powershell", "-NoProfile", "-Command",
                 "[System.Windows.Forms.Clipboard]::GetText()"],
                capture_output=True, text=True, timeout=2,
                creationflags=0x08000000  # CREATE_NO_WINDOW
            )
            clipboard_text = (result.stdout or "").strip()
            return clipboard_text
        except Exception as e:
            logger.error(f"Failed to read clipboard: {e}")
            return ""

    # ── show a Windows toast notification (queue finished, etc.) ──
    def notify(self, title: str, message: str) -> dict:
        """
        Fire a Windows balloon/toast notification from the system tray.

        SECURITY: title/message can originate from untrusted data (e.g. a
        download's source URL, which in turn can come from the clipboard
        monitor or the browser extension's /add-url endpoint). Previously
        these were spliced directly into a PowerShell -Command string —
        a URL containing a single quote + semicolon could break out of the
        quoted literal and execute arbitrary PowerShell. Fixed two ways,
        belt-and-suspenders:
          1. Escape embedded single quotes ('' is the literal-quote escape
             inside a PowerShell single-quoted string).
          2. Ship the whole script via -EncodedCommand (base64 UTF-16LE)
             instead of -Command, so even a successful escape of the
             quoting can't inject additional shell-level tokens — the
             encoded blob is parsed as one opaque script body.
        """
        try:
            import subprocess as _sp
            import base64

            def _ps_single_quote_escape(s: str) -> str:
                return (s or "").replace("'", "''")

            safe_title   = _ps_single_quote_escape(title)[:200]
            safe_message = _ps_single_quote_escape(message)[:500]

            # Use the app's own icon (same file used for the window
            # titlebar/taskbar — see _find_icon_file()/_apply_window_icon)
            # instead of a generic Windows system icon, so the balloon
            # notification is actually recognizable as coming from this
            # app rather than looking like a stock OS alert. Falls back
            # to the generic icon if the file can't be found for any
            # reason — same graceful-degradation pattern used elsewhere.
            icon_path = _find_icon_file()
            safe_icon_path = _ps_single_quote_escape(icon_path)
            if safe_icon_path:
                icon_setup = (
                    f"if (Test-Path '{safe_icon_path}') {{"
                    f"$n.Icon = New-Object System.Drawing.Icon('{safe_icon_path}')"
                    "} else {"
                    "$n.Icon = [System.Drawing.SystemIcons]::Information"
                    "};"
                )
            else:
                icon_setup = "$n.Icon = [System.Drawing.SystemIcons]::Information;"

            script = (
                "Add-Type -AssemblyName System.Windows.Forms;"
                "Add-Type -AssemblyName System.Drawing;"
                "$n=New-Object System.Windows.Forms.NotifyIcon;"
                f"{icon_setup}"
                "$n.Visible=$true;"
                f"$n.ShowBalloonTip(4000,'{safe_title}','{safe_message}',"
                "[System.Windows.Forms.ToolTipIcon]::None);"
                "Start-Sleep -Seconds 5;"
                "$n.Dispose()"
            )
            encoded = base64.b64encode(script.encode("utf-16-le")).decode("ascii")
            _sp.Popen(
                ["powershell", "-NoProfile", "-WindowStyle", "Hidden", "-EncodedCommand", encoded],
                creationflags=0x08000000
            )
            logger.info(f"Notification shown: {title}")
            return {"ok": True}
        except Exception as e:
            logger.error(f"Failed to show notification: {e}")
            return {"ok": False, "error": str(e)}

    # ── post-download queue completion automation ──
    def close_app(self) -> dict:
        """Gracefully closes the application window and terminates the process."""
        logger.info("Application close requested")
        def _delayed_exit():
            time.sleep(0.5)
            if self._window:
                try:
                    self._window.destroy()
                except Exception:
                    pass
            os._exit(0)
        threading.Thread(target=_delayed_exit, daemon=True).start()
        return {"ok": True}

    def execute_completion_action(self, action: str) -> dict:
        """
        Execute post-download completion action.
        Allowed actions: 'nothing', 'exit', 'sleep', 'shutdown'.
        """
        if not action or action == "nothing":
            return {"ok": True, "action": "nothing"}

        if not validate_completion_action(action):
            logger.warning(f"Invalid completion action requested: {action}")
            return {"ok": False, "error": f"Invalid action: {action}"}

        logger.info(f"Executing post-download completion action: {action}")
        if action == "exit":
            return self.close_app()
        elif action == "sleep":
            if os.name == "nt":
                import subprocess as _sp
                try:
                    _sp.Popen(["rundll32.exe", "powrprof.dll,SetSuspendState", "0,1,0"])
                    return {"ok": True, "action": "sleep"}
                except Exception as e:
                    logger.error(f"Failed to sleep system: {e}")
                    return {"ok": False, "error": str(e)}
            return {"ok": False, "error": "Sleep only supported on Windows"}
        elif action == "shutdown":
            if os.name == "nt":
                import subprocess as _sp
                try:
                    # 60s countdown with custom notification message
                    _sp.run(
                        ["shutdown", "/s", "/t", "60", "/c", "Media Downloader queue finished. Shutting down system in 60s."],
                        check=False,
                        creationflags=0x08000000
                    )
                    return {"ok": True, "action": "shutdown", "timeout": 60}
                except Exception as e:
                    logger.error(f"Failed to schedule system shutdown: {e}")
                    return {"ok": False, "error": str(e)}
            return {"ok": False, "error": "Shutdown only supported on Windows"}
        return {"ok": False, "error": f"Unsupported action: {action}"}

    def cancel_shutdown(self) -> dict:
        """Aborts a pending Windows shutdown initiated by queue completion."""
        if os.name == "nt":
            import subprocess as _sp
            try:
                _sp.run(["shutdown", "/a"], check=False, creationflags=0x08000000)
                logger.info("Pending system shutdown aborted successfully")
                return {"ok": True}
            except Exception as e:
                logger.warning(f"Failed to abort shutdown: {e}")
                return {"ok": False, "error": str(e)}
        return {"ok": False, "error": "Not applicable on non-Windows"}

    def open_output_folder(self, path: str = "") -> dict:
        """Open the directory containing the file (with file selected if possible),
        or the directory itself, in Windows File Explorer."""
        try:
            import subprocess as _sp
            default_dir = get_default_download_dir()
            target = (path or "").strip()

            # If no path provided, open default download folder
            if not target:
                folder_to_open = default_dir if (default_dir and os.path.isdir(default_dir)) else os.path.expanduser("~")
                _sp.Popen(f'explorer "{os.path.normpath(folder_to_open)}"')
                logger.info(f"Opened default folder: {folder_to_open}")
                return {"ok": True}

            # Attempt resolving as media file or expanding user/relative path
            resolved = resolve_existing_media_path(target)
            expanded = resolved or os.path.expanduser(target)
            norm = os.path.normpath(expanded)

            # 1. Target (or resolved target) is an existing file -> open containing folder and select file
            if os.path.isfile(norm):
                # Critical Windows Explorer fix:
                # Explorer expects: explorer /select,"C:\path\to\file.mp4"
                # If passed as ['explorer', f'/select,{norm}'], Python's list2cmdline wraps
                # the entire token in quotes: explorer "/select,C:\path\to\file.mp4"
                # which causes Explorer to fail switch parsing and fall back to user Documents!
                _sp.Popen(f'explorer /select,"{norm}"')
                logger.info(f"Opened containing folder with item selected: {norm}")
                return {"ok": True}

            # 2. Target is an existing directory -> open directory
            if os.path.isdir(norm):
                _sp.Popen(f'explorer "{norm}"')
                logger.info(f"Opened directory: {norm}")
                return {"ok": True}

            # 3. Target might be a missing file whose parent directory exists
            parent = os.path.dirname(norm)
            if parent and os.path.isdir(parent):
                _sp.Popen(f'explorer "{parent}"')
                logger.info(f"Target file missing, opened parent directory: {parent}")
                return {"ok": True}

            # 4. Check if target exists as a file or folder in default download dir or canonical subfolders
            if default_dir and os.path.isdir(default_dir):
                base_name = os.path.basename(norm)
                for sub in ("", "Videos", "Music", "Images"):
                    cand_dir = os.path.join(default_dir, sub) if sub else default_dir
                    file_cand = os.path.join(cand_dir, base_name)
                    if os.path.isfile(file_cand):
                        _sp.Popen(f'explorer /select,"{file_cand}"')
                        logger.info(f"Opened containing folder with candidate selected: {file_cand}")
                        return {"ok": True}
                    if os.path.isdir(file_cand):
                        _sp.Popen(f'explorer "{file_cand}"')
                        logger.info(f"Opened candidate folder: {file_cand}")
                        return {"ok": True}

            # 5. Fallback safely to default media directory (never create random dirs in CWD or open Documents)
            folder_to_open = default_dir if (default_dir and os.path.isdir(default_dir)) else os.path.expanduser("~")
            _sp.Popen(f'explorer "{os.path.normpath(folder_to_open)}"')
            logger.info(f"Opened fallback folder: {folder_to_open}")
            return {"ok": True}
        except Exception as e:
            logger.error(f"Failed to open folder {path}: {e}")
            return {"ok": False, "error": str(e)}

    def open_extension_folder(self) -> dict:
        """Open the browser_extension directory in Windows File Explorer."""
        try:
            base_dir = _app_base_dir()
            ext_dir = os.path.join(base_dir, "browser_extension")
            if not os.path.isdir(ext_dir):
                ext_dir = os.path.join(os.getcwd(), "browser_extension")
            if os.path.isdir(ext_dir):
                import subprocess as _sp
                _sp.Popen(["explorer", os.path.normpath(ext_dir)])
                logger.info(f"Opened browser extension folder: {ext_dir}")
                return {"ok": True, "path": ext_dir}
            return {"ok": False, "error": "Extension folder not found."}
        except Exception as e:
            logger.error(f"Failed to open extension folder: {e}")
            return {"ok": False, "error": str(e)}

    # ── download history ──
    def list_history(self) -> dict:
        try:
            entries = download_history.list_entries()
            history_modified = False
            for e in entries:
                files = e.get("files") or []
                for f in files:
                    if isinstance(f, dict):
                        fpath = f.get("path")
                        real_path = resolve_existing_media_path(fpath, output_dir=e.get("output_dir"))
                        if real_path and os.path.isfile(real_path):
                            if fpath != real_path or not f.get("size"):
                                f["path"] = real_path
                                f["name"] = os.path.basename(real_path)
                                f["size"] = os.path.getsize(real_path)
                                history_modified = True
                            _register_known_media_path(real_path)
                    else:
                        _register_known_media_path(f)

                # Resolve thumbnail URL for the entry (embedded audio art, video frame, or image)
                thumb_url = e.get("thumbnail")
                valid_thumb = False
                if thumb_url and "/media?" in thumb_url:
                    try:
                        parsed = urllib.parse.urlsplit(thumb_url)
                        qs = urllib.parse.parse_qs(parsed.query)
                        old_p = (qs.get("path") or qs.get("p") or [""])[0]
                        if old_p and os.path.isfile(old_p):
                            _register_known_media_path(old_p)
                            query = urllib.parse.urlencode({"token": BRIDGE_TOKEN, "path": old_p})
                            thumb_url = f"http://127.0.0.1:{BRIDGE_PORT}/media?{query}"
                            valid_thumb = True
                    except Exception:
                        pass

                if not valid_thumb and files:
                    thumb_url = resolve_entry_thumbnail_url(files, output_dir=e.get("output_dir"))

                if thumb_url != e.get("thumbnail"):
                    e["thumbnail"] = thumb_url
                    history_modified = True

            if history_modified:
                try:
                    download_history._save(entries)
                except Exception:
                    pass

            logger.debug(f"Retrieved {len(entries)} history entries with thumbnails")
            return {"ok": True, "entries": entries}
        except Exception as e:
            logger.error(f"Failed to list history: {e}")
            return {"ok": False, "error": str(e)}

    @staticmethod
    def _classify_media_ext(ext: str) -> str:
        ext = ext.lower()
        if ext in (".mp4", ".mkv", ".webm", ".avi", ".mov", ".flv", ".m4v", ".ts", ".wmv"):
            return "video"
        if ext in (".mp3", ".m4a", ".flac", ".wav", ".ogg", ".opus", ".aac", ".wma"):
            return "music"
        if ext in (".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".jfif", ".avif", ".svg", ".tiff", ".heic"):
            return "image"
        return "other"

    @classmethod
    def _detect_dominant_category(cls, files: list) -> str:
        video_count = 0
        audio_count = 0
        image_count = 0
        for f in files:
            if isinstance(f, dict):
                raw = f.get("ext") or f.get("name") or f.get("path") or ""
            else:
                raw = str(f)
            ext = os.path.splitext(raw)[1].lower() if "." in raw else ""
            if not ext and raw.startswith("."):
                ext = raw.lower()
            if ext in (".mp4", ".mkv", ".webm", ".avi", ".mov", ".flv", ".m4v", ".ts", ".wmv"):
                video_count += 1
            elif ext in (".mp3", ".m4a", ".flac", ".wav", ".ogg", ".opus", ".aac", ".wma"):
                audio_count += 1
            elif ext in (".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".jfif", ".avif", ".svg", ".tiff", ".heic"):
                image_count += 1

        if audio_count > video_count and audio_count >= image_count:
            return "music"
        if image_count > video_count and image_count > audio_count:
            return "image"
        if video_count > audio_count and video_count >= image_count:
            return "video"
        if audio_count > 0:
            return "music"
        if image_count > 0:
            return "image"
        if video_count > 0:
            return "video"
        return "other"

    @classmethod
    def _detect_entry_category(cls, files: list, filename: str = "") -> str:
        # Check files in bundle/album first (e.g. bulk music albums)
        if files:
            dominant = cls._detect_dominant_category(files)
            if dominant != "other":
                return dominant
        # Fallback to extension of filename if present
        if filename:
            ext = os.path.splitext(filename)[1].lower()
            if ext:
                classified = cls._classify_media_ext(ext)
                if classified != "other":
                    return classified
        return "video"

    def scan_media_library(self, root_dir: str = "") -> dict:
        """
        Scan the media directory and its subfolders (Videos, Music, Images, etc.)
        for any and all supported media files, merging with existing download history.
        Maintains the exact same media hierarchy (albums, bundles, single files, thumbnails,
        playable file lists, categories) as the downloads history.
        """
        import hashlib
        try:
            from media_downloader import get_default_download_dir
            target_dir = (root_dir or "").strip()
            if not target_dir:
                target_dir = get_default_download_dir()
            else:
                target_dir = os.path.expanduser(target_dir)

            if not os.path.isdir(target_dir):
                try:
                    os.makedirs(target_dir, exist_ok=True)
                except Exception:
                    target_dir = get_default_download_dir()

            # Ensure canonical subfolders always exist
            for sub in ("Videos", "Music", "Images"):
                try:
                    os.makedirs(os.path.join(target_dir, sub), exist_ok=True)
                except Exception:
                    pass

            SUPPORTED_VIDEO_EXTS = {".mp4", ".mkv", ".webm", ".avi", ".mov", ".flv", ".m4v", ".ts", ".wmv"}
            SUPPORTED_AUDIO_EXTS = {".mp3", ".m4a", ".flac", ".wav", ".ogg", ".opus", ".aac", ".wma"}
            SUPPORTED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".jfif", ".avif", ".svg", ".tiff", ".heic"}
            ALL_SUPPORTED_EXTS = SUPPORTED_VIDEO_EXTS | SUPPORTED_AUDIO_EXTS | SUPPORTED_IMAGE_EXTS

            norm_target_dir = os.path.normcase(os.path.abspath(target_dir))
            canonical_dirs = {
                os.path.normcase(os.path.abspath(os.path.join(target_dir, "Videos"))),
                os.path.normcase(os.path.abspath(os.path.join(target_dir, "Music"))),
                os.path.normcase(os.path.abspath(os.path.join(target_dir, "Images"))),
            }

            # 1. Load download history entries
            history_entries = download_history.list_entries()
            claimed_paths = set()
            history_items = []
            history_modified = False

            for e in history_entries:
                files = e.get("files") or []
                valid_files = []
                for f in files:
                    if isinstance(f, dict):
                        fpath = f.get("path")
                        real_p = resolve_existing_media_path(fpath, output_dir=e.get("output_dir"))
                        if real_p and os.path.isfile(real_p):
                            if fpath != real_p or not f.get("size"):
                                f["path"] = real_p
                                f["name"] = os.path.basename(real_p)
                                f["size"] = os.path.getsize(real_p)
                                history_modified = True
                            _register_known_media_path(real_p)
                            claimed_paths.add(os.path.normcase(os.path.abspath(real_p)))
                            valid_files.append(f)
                    else:
                        real_p = resolve_existing_media_path(str(f), output_dir=e.get("output_dir"))
                        if real_p and os.path.isfile(real_p):
                            _register_known_media_path(real_p)
                            claimed_paths.add(os.path.normcase(os.path.abspath(real_p)))
                            valid_files.append({"name": os.path.basename(real_p), "path": real_p, "size": os.path.getsize(real_p)})

                # Check if dedicated album directory itself exists and has files (never walk root media dir)
                out_d = e.get("output_dir")
                has_files_on_disk = len(valid_files) > 0
                if not has_files_on_disk and out_d and os.path.isdir(out_d):
                    norm_out = os.path.normcase(os.path.abspath(out_d))
                    if norm_out != norm_target_dir and norm_out not in canonical_dirs:
                        for root_w, _, fnames in os.walk(out_d):
                            for fn in fnames:
                                ext_w = os.path.splitext(fn)[1].lower()
                                if ext_w in ALL_SUPPORTED_EXTS:
                                    full_w = os.path.join(root_w, fn)
                                    valid_files.append({"name": fn, "path": full_w, "size": os.path.getsize(full_w)})
                                    claimed_paths.add(os.path.normcase(os.path.abspath(full_w)))
                                    _register_known_media_path(full_w)
                                    has_files_on_disk = True

                if has_files_on_disk:
                    e_copy = dict(e)
                    e_copy["files"] = valid_files
                    e_copy["state"] = "done"

                    # Resolve thumbnail
                    thumb_url = e_copy.get("thumbnail")
                    valid_thumb = False
                    if thumb_url and "/media?" in thumb_url:
                        try:
                            parsed = urllib.parse.urlsplit(thumb_url)
                            qs = urllib.parse.parse_qs(parsed.query)
                            old_p = (qs.get("path") or qs.get("p") or [""])[0]
                            if old_p and os.path.isfile(old_p):
                                _register_known_media_path(old_p)
                                query = urllib.parse.urlencode({"token": BRIDGE_TOKEN, "path": old_p})
                                thumb_url = f"http://127.0.0.1:{BRIDGE_PORT}/media?{query}"
                                valid_thumb = True
                        except Exception:
                            pass

                    if not valid_thumb and valid_files:
                        thumb_url = resolve_entry_thumbnail_url(valid_files, output_dir=e_copy.get("output_dir"))

                    if thumb_url:
                        e_copy["thumbnail"] = thumb_url

                    # Always re-detect category from actual files so bulk audio albums are categorized correctly
                    detected_cat = self._detect_entry_category(valid_files, e_copy.get("filename", ""))
                    e_copy["category"] = detected_cat
                    if e.get("category") != detected_cat:
                        e["category"] = detected_cat
                        history_modified = True

                    history_items.append(e_copy)

            if history_modified:
                try:
                    download_history._save(history_entries)
                except Exception:
                    pass

            # 2. Walk target_dir to find all unclaimed supported media files
            dir_media_files = {}
            for root, dirs, fnames in os.walk(target_dir):
                norm_root = os.path.normcase(os.path.abspath(root))
                base_name = os.path.basename(root)
                if base_name.startswith(".") or base_name == "node_modules":
                    continue

                media_in_dir = []
                for fn in fnames:
                    ext = os.path.splitext(fn)[1].lower()
                    if ext in ALL_SUPPORTED_EXTS:
                        f_full = os.path.join(root, fn)
                        norm_f = os.path.normcase(os.path.abspath(f_full))
                        if norm_f not in claimed_paths:
                            try:
                                f_size = os.path.getsize(f_full)
                                f_mtime = os.path.getmtime(f_full)
                            except OSError:
                                f_size = 0
                                f_mtime = 0
                            _register_known_media_path(f_full)
                            media_in_dir.append({
                                "name": fn,
                                "path": f_full,
                                "size": f_size,
                                "mtime": f_mtime,
                                "ext": ext,
                            })

                if media_in_dir:
                    dir_media_files[norm_root] = {
                        "dir_path": root,
                        "files": media_in_dir,
                    }

            # 3. Create library items from discovered unclaimed files
            disk_items = []
            for norm_dir, dir_info in dir_media_files.items():
                dir_path = dir_info["dir_path"]
                files = dir_info["files"]

                is_root_or_canonical = (norm_dir == norm_target_dir) or (norm_dir in canonical_dirs)

                if is_root_or_canonical:
                    # Direct files in media/, Videos/, Music/, Images/ -> Individual items
                    for f in files:
                        cat = self._classify_media_ext(f["ext"])
                        thumb = resolve_entry_thumbnail_url([f["path"]], output_dir=dir_path)
                        f_hash = hashlib.md5(f["path"].encode("utf-8", errors="ignore")).hexdigest()[:12]
                        disk_items.append({
                            "id": f"disk-{f_hash}",
                            "historyId": None,
                            "url": "",
                            "tool": "local",
                            "state": "done",
                            "status": "done",
                            "output_dir": dir_path,
                            "filename": f["name"],
                            "category": cat,
                            "isAlbum": False,
                            "files": [{"name": f["name"], "path": f["path"], "size": f["size"]}],
                            "size_bytes": f["size"],
                            "thumbnail": thumb or "",
                            "finished_at": f["mtime"],
                            "isDiskItem": True,
                        })
                else:
                    # Subfolder containing media files -> Bundle / Album!
                    folder_name = os.path.basename(dir_path)
                    dominant_cat = self._detect_dominant_category(files)
                    is_album = (dominant_cat == "gallery" or dominant_cat == "image") and len(files) > 1
                    thumb = resolve_entry_thumbnail_url([f["path"] for f in files], output_dir=dir_path)
                    total_size = sum(f["size"] for f in files)
                    newest_mtime = max((f["mtime"] for f in files), default=0)
                    folder_hash = hashlib.md5(dir_path.encode("utf-8", errors="ignore")).hexdigest()[:12]

                    if len(files) == 1:
                        display_title = files[0]["name"]
                    else:
                        display_title = folder_name

                    disk_items.append({
                        "id": f"disk-folder-{folder_hash}",
                        "historyId": None,
                        "url": "",
                        "tool": "local",
                        "state": "done",
                        "status": "done",
                        "output_dir": dir_path,
                        "filename": display_title,
                        "category": dominant_cat,
                        "isAlbum": is_album,
                        "files": [{"name": f["name"], "path": f["path"], "size": f["size"]} for f in files],
                        "size_bytes": total_size,
                        "thumbnail": thumb or "",
                        "finished_at": newest_mtime,
                        "isDiskItem": True,
                    })

            # 4. Merge history items + disk items, sorted newest first
            all_items = history_items + disk_items
            all_items.sort(key=lambda x: (x.get("finished_at") or x.get("started_at") or 0), reverse=True)

            logger.info(f"scan_media_library scanned {len(all_items)} total items ({len(history_items)} history, {len(disk_items)} disk) from {target_dir}")
            return {"ok": True, "entries": all_items}
        except Exception as e:
            logger.error(f"Failed to scan media library: {e}", exc_info=True)
            return {"ok": False, "error": str(e), "entries": []}

    def get_item_thumbnail_url(self, path: str, output_dir: str = "") -> dict:
        """Resolve a thumbnail URL for any media file (audio cover art, video frame, or image)."""
        if not path:
            return {"ok": False}
        expanded = resolve_existing_media_path(path, output_dir=output_dir)
        if not expanded:
            return {"ok": False}

        if os.path.isdir(expanded):
            for root, _, fnames in os.walk(expanded):
                for fn in fnames:
                    fext = os.path.splitext(fn)[1].lower()
                    if fext in (
                        ".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".jfif", ".avif",
                        ".mp4", ".mkv", ".webm", ".avi", ".mov", ".m4v", ".flv", ".ts", ".wmv",
                        ".mp3", ".m4a", ".flac", ".ogg", ".opus", ".aac", ".wma", ".wav"
                    ):
                        return self.get_item_thumbnail_url(os.path.join(root, fn), output_dir=output_dir)
            return {"ok": False}

        if not validate_path(expanded, must_exist=True, must_be_file=True):
            return {"ok": False}
        try:
            ext = os.path.splitext(expanded)[1].lower()
            if ext in (".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".jfif", ".avif"):
                return self.get_media_url(expanded)
            elif ext in (".mp3", ".m4a", ".flac", ".ogg", ".opus", ".aac", ".wma", ".wav"):
                return self.get_cover_art_url(expanded)
            elif ext in (".mp4", ".mkv", ".webm", ".avi", ".mov", ".m4v", ".flv", ".ts", ".wmv"):
                return self.get_video_thumbnail_url(expanded)
            return {"ok": False}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def delete_history_entry(self, entry_id: str) -> dict:
        if not validate_history_entry_id(entry_id):
            logger.warning(f"Invalid history entry ID: {entry_id}")
            return {"ok": False, "error": "Invalid entry ID"}
        
        try:
            success = download_history.delete_entry(entry_id)
            logger.info(f"History entry {entry_id} deleted: {success}")
            return {"ok": success}
        except Exception as e:
            logger.error(f"Failed to delete history entry {entry_id}: {e}")
            return {"ok": False, "error": str(e)}

    def clear_history(self) -> dict:
        try:
            cleared = download_history.clear_all()
            logger.info(f"Cleared {cleared} history entries")
            return {"ok": True, "cleared": cleared}
        except Exception as e:
            logger.error(f"Failed to clear history: {e}")
            return {"ok": False, "error": str(e)}

    # ── search autocomplete (recent queries only — not URLs) ──
    def get_recent_searches(self) -> dict:
        try:
            return {"ok": True, "queries": search_history.list_queries()}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    # ── built-in media player ──
    def get_media_url(self, path: str) -> dict:
        """Resolve a local file path to a URL a <video>/<audio> element can
        load directly, so playback never needs an external app like VLC.

        Deliberately NOT a file:// URI — Chromium/WebView2 treats each
        file:// resource as its own opaque origin and will silently refuse
        to load one from a page that wasn't itself loaded from that exact
        path. Routing through the local bridge server (127.0.0.1-only,
        token-gated, same one used by the browser extension) avoids that
        and also gives us Range support for seeking.
        """
        if not path:
            return {"ok": False, "error": "No path provided."}

        expanded = resolve_existing_media_path(path)
        if not expanded or not os.path.isfile(expanded):
            logger.warning(f"File not found for media URL: {path}")
            return {"ok": False, "error": f"File not found: {os.path.basename(path)}"}

        try:
            _register_known_media_path(expanded)
            query = urllib.parse.urlencode({"token": BRIDGE_TOKEN, "path": expanded})
            return {"ok": True, "url": f"http://127.0.0.1:{BRIDGE_PORT}/media?{query}"}
        except Exception as e:
            logger.error(f"Failed to generate media URL for {path}: {e}")
            return {"ok": False, "error": str(e)}

    def get_media_urls(self, paths: list) -> dict:
        """Batch form of get_media_url — the gallery view needs a URL per
        thumbnail, and a downloaded gallery can easily have 50+ files, so
        this resolves them all in one round trip instead of one pywebview
        call per image. Missing/unreadable files are simply omitted from
        the result rather than failing the whole batch."""
        urls = {}
        from media_downloader import get_default_download_dir
        dl_dir = get_default_download_dir()
        for path in paths or []:
            try:
                expanded = os.path.expanduser(path)
                if not os.path.isfile(expanded):
                    candidate = os.path.join(dl_dir, path)
                    if os.path.isfile(candidate):
                        expanded = candidate
                    elif os.path.isfile(os.path.join(dl_dir, os.path.basename(path))):
                        expanded = os.path.join(dl_dir, os.path.basename(path))

                if os.path.isfile(expanded):
                    _register_known_media_path(expanded)
                    query = urllib.parse.urlencode({"token": BRIDGE_TOKEN, "path": expanded})
                    urls[path] = f"http://127.0.0.1:{BRIDGE_PORT}/media?{query}"
            except Exception as e:
                logger.warning(f"Failed to generate media URL for {path}: {e}")
        return {"ok": True, "urls": urls}

    # ── cover art for the audio player (mp3/m4a embedded art) ──
    def get_cover_art_url(self, path: str) -> dict:
        """Extract an audio file's embedded cover art (via the already-
        bundled ffmpeg — see extract_embedded_art) and serve it through
        the same local media-server URL mechanism as everything else.
        Returns ok:False (not an error toast — just "no art") whenever
        there's genuinely no embedded art, so the player can fall back to
        its generic note-icon disc without alarming anyone."""
        if not path:
            return {"ok": False}
        expanded = resolve_existing_media_path(path)
        if not expanded or not validate_path(expanded, must_exist=True, must_be_file=True):
            logger.warning(f"Invalid path for cover art extraction: {path}")
            return {"ok": False}
        
        try:
            cover_path = extract_embedded_art(expanded)
            if not cover_path:
                return {"ok": False}
            return self.get_media_url(cover_path)
        except Exception as e:
            logger.error(f"Failed to extract cover art from {path}: {e}")
            return {"ok": False, "error": str(e)}

    # ── video-frame thumbnail for the gallery grid ──
    def get_video_thumbnail_url(self, path: str) -> dict:
        """Extract a representative frame from a video file (via the
        bundled ffmpeg — see extract_video_thumbnail) and serve it
        through the same local media-server URL mechanism as everything
        else. Mirrors get_cover_art_url's contract: any failure returns
        ok:False without an error message — "no thumbnail" isn't
        something to alarm the user about, the gallery just falls back
        to its generic video-tile icon."""
        if not path:
            return {"ok": False}
        expanded = resolve_existing_media_path(path)
        if not expanded or not validate_path(expanded, must_exist=True, must_be_file=True):
            logger.warning(f"Invalid path for video thumbnail extraction: {path}")
            return {"ok": False}

        try:
            from media_downloader import extract_video_thumbnail
            thumb_path = extract_video_thumbnail(expanded)
            if not thumb_path:
                return {"ok": False}
            return self.get_media_url(thumb_path)
        except Exception as e:
            logger.error(f"Failed to extract video thumbnail from {path}: {e}")
            return {"ok": False, "error": str(e)}

    # ── open a single file with the OS default app (non-playable files) ──
    def open_file(self, path: str) -> dict:
        if not path:
            return {"ok": False, "error": "No path provided."}
        expanded = resolve_existing_media_path(path)
        if not expanded or not validate_path(expanded, must_exist=True, must_be_file=True):
            logger.warning(f"Invalid path for opening file: {path}")
            return {"ok": False, "error": "File not found or invalid path."}
        
        try:
            os.startfile(expanded)  # Windows-only, matches this app's target platform
            logger.info(f"Opened file: {expanded}")
            return {"ok": True}
        except Exception as e:
            logger.error(f"Failed to open file {path}: {e}")
            return {"ok": False, "error": str(e)}

    # ── open a download's source URL in the default OS browser ──
    def open_url_external(self, url: str) -> dict:
        """Hand a URL off to the user's default browser — the "open link
        in browser" action next to a finished download's name. Mirrors
        open_file()'s use of os.startfile, which on Windows routes a URL
        through ShellExecute to whatever's registered as the default
        browser. Restricted to validate_url() (http/https only, same
        check used everywhere else a URL enters this app) so this can't
        be used to hand ShellExecute an arbitrary scheme or local path."""
        if not validate_url(url):
            logger.warning(f"Invalid URL for open_url_external: {url}")
            return {"ok": False, "error": "Invalid URL."}

        try:
            os.startfile(url)  # Windows-only, matches this app's target platform
            logger.info(f"Opened URL in default browser: {url}")
            return {"ok": True}
        except Exception as e:
            logger.error(f"Failed to open URL {url}: {e}")
            return {"ok": False, "error": str(e)}

    # ── media search (YouTube via yt-dlp ytsearch prefix) ──
    def search(self, query: str, limit: int = 12) -> dict:
        """
        Search YouTube for videos matching query. Runs yt-dlp in a background
        thread and pushes results back to the UI via window.onSearchResults().

        Returns immediately with {"ok": True, "searching": True} so the UI
        can show a loading state without blocking.
        """
        if not validate_search_query(query):
            logger.warning("Invalid search query provided")
            return {"ok": False, "error": "Invalid search query"}

        query   = query.strip()
        limit   = max(1, min(limit, 30))  # cap at 30

        try:
            search_history.add_query(query)
        except Exception as e:
            logger.warning(f"Failed to add search history: {e}")

        def run():
            from media_downloader import resolve_tool_path, CREATE_NO_WINDOW
            import subprocess, json as _json

            ytdlp = resolve_tool_path("yt-dlp")
            cmd   = [
                ytdlp,
                f"ytsearch{limit}:{query}",
                "--dump-json",          # one JSON object per line
                "--no-playlist",
                "--flat-playlist",
                "--no-warnings",
            ]

            try:
                proc = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=30,
                    creationflags=CREATE_NO_WINDOW,
                )
                results = []
                for line in proc.stdout.splitlines():
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        info = _json.loads(line)
                        vid_id  = info.get("id", "")
                        results.append({
                            "id":        vid_id,
                            "title":     info.get("title", "Unknown"),
                            "channel":   info.get("channel") or info.get("uploader", ""),
                            "duration":  info.get("duration"),
                            "views":     info.get("view_count"),
                            "thumbnail": info.get("thumbnail") or f"https://i.ytimg.com/vi/{vid_id}/hqdefault.jpg",
                            "url":       info.get("webpage_url") or f"https://www.youtube.com/watch?v={vid_id}",
                        })
                    except Exception:
                        continue

                self._push_js(
                    f"window.onSearchResults?.({_json.dumps(results)}, {_json.dumps(query)})"
                )

            except subprocess.TimeoutExpired:
                logger.warning(f"Search timed out for query: {query}")
                self._push_js(
                    f"window.onSearchError?.({_json.dumps('Search timed out — try again')})"
                )
            except Exception as e:
                logger.error(f"Search failed for query '{query}': {e}")
                self._push_js(
                    f"window.onSearchError?.({_json.dumps(str(e))})"
                )

        threading.Thread(target=run, daemon=True).start()
        return {"ok": True, "searching": True}

    # ── link preview (thumbnail/title for a pasted URL, before it's queued) ──
    def preview_link(self, url: str, request_id: str = "") -> dict:
        """
        Best-effort metadata preview for a pasted link — title, thumbnail,
        duration/channel for video, or a representative image + item count
        for a gallery. Runs in a background thread and reports back via
        window.onLinkPreview() so the debounced call from typing never
        blocks the UI. request_id is echoed back untouched so the frontend
        can discard stale responses if the user kept typing.
        """
        if not validate_url(url):
            logger.warning(f"Invalid URL for link preview: {url}")
            return {"ok": False, "error": "Invalid URL"}

        def run():
            from media_downloader import resolve_tool_path, CREATE_NO_WINDOW, _ytdlp_extra_headers
            import subprocess, json as _json
            import urllib.parse as _urlparse

            tool = detect_tool(url)
            result = {"ok": False}
            try:
                if tool == "yt-dlp":
                    ytdlp = resolve_tool_path("yt-dlp")
                    # Same extra headers the real download uses (see
                    # _ytdlp_extra_headers) — without these, a site that
                    # needs them just to be reachable would fail this
                    # metadata-only probe even though the actual download
                    # works fine, making preview look broken for exactly
                    # the sites that need it least to look that way.
                    cmd = [ytdlp, "--dump-single-json", "--no-warnings", "--no-playlist"]
                    cmd += _ytdlp_extra_headers(url)
                    cmd.append(url)
                    proc = subprocess.run(
                        cmd, capture_output=True, text=True, timeout=20, creationflags=CREATE_NO_WINDOW,
                    )
                    info = _json.loads(proc.stdout)
                    if info.get("_type") == "playlist" and info.get("entries"):
                        first = (info.get("entries") or [{}])[0] or {}
                        title = "Playlist: " + (info.get("title") or first.get("title") or "")
                        thumbs = first.get("thumbnails") or []
                        thumb = first.get("thumbnail") or (thumbs[-1].get("url") if thumbs else "")
                        channel = first.get("channel") or first.get("uploader") or ""
                        duration = first.get("duration")
                        views = first.get("view_count")
                        description = first.get("description") or ""
                    else:
                        title = info.get("title") or ""
                        thumbs = info.get("thumbnails") or []
                        thumb = info.get("thumbnail") or (thumbs[-1].get("url") if thumbs else "")
                        channel = info.get("channel") or info.get("uploader") or ""
                        duration = info.get("duration")
                        views = info.get("view_count")
                        description = info.get("description") or ""

                    available_qualities = []
                    formats = info.get("formats") or []
                    if formats:
                        video_heights = set()
                        format_sizes = {}
                        has_audio = False
                        for f in formats:
                            h = f.get("height")
                            vc = f.get("vcodec")
                            ac = f.get("acodec")
                            fs = f.get("filesize") or f.get("filesize_approx")
                            if h and vc and vc != "none":
                                try:
                                    ih = int(h)
                                    video_heights.add(ih)
                                    if fs and (ih not in format_sizes or fs > format_sizes[ih]):
                                        format_sizes[ih] = fs
                                except (ValueError, TypeError):
                                    pass
                            if ac and ac != "none":
                                has_audio = True

                        known_res = [
                            (2160, "2160p", "4K (Ultra HD)"),
                            (1440, "1440p", "1440p (QHD)"),
                            (1080, "1080p", "1080p (Full HD)"),
                            (720, "720p", "720p (HD)"),
                            (480, "480p", "480p (SD)"),
                            (360, "360p", "360p"),
                        ]
                        for target_h, fmt_key, label in known_res:
                            matching = [h for h in video_heights if abs(h - target_h) <= 20]
                            if matching:
                                match_h = matching[0]
                                size_bytes = format_sizes.get(match_h)
                                available_qualities.append({
                                    "id": fmt_key,
                                    "label": label,
                                    "height": match_h,
                                    "type": "video",
                                    "ext": "MP4",
                                    "size_bytes": size_bytes,
                                })
                        if not available_qualities and video_heights:
                            max_h = max(video_heights)
                            available_qualities.append({
                                "id": f"{max_h}p",
                                "label": f"{max_h}p",
                                "height": max_h,
                                "type": "video",
                                "ext": "MP4",
                                "size_bytes": format_sizes.get(max_h),
                            })

                        if has_audio:
                            available_qualities.append({"id": "mp3", "label": "MP3", "type": "audio", "ext": "MP3"})
                            available_qualities.append({"id": "m4a", "label": "M4A", "type": "audio", "ext": "M4A"})

                    is_playlist = (
                        info.get("_type") == "playlist"
                        or bool(info.get("entries"))
                        or "list=" in url.lower()
                        or "/playlist" in url.lower()
                        or "/sets/" in url.lower()
                        or "/album" in url.lower()
                    )
                    playlist_count = len(info.get("entries") or []) if info.get("entries") else None

                    result = {
                        "ok": True, "tool": "yt-dlp", "title": title,
                        "thumbnail": thumb, "channel": channel, "duration": duration,
                        "views": views, "description": description[:180] if description else "",
                        "available_qualities": available_qualities,
                        "is_playlist": is_playlist,
                        "playlist_count": playlist_count,
                        "url": url,
                    }
                else:
                    gallerydl = resolve_tool_path("gallery-dl")
                    cmd = [gallerydl, "--range", "1-2", "-o", "retries=0", "-j", "--no-input", url]
                    thumb = None
                    count = 0
                    try:
                        proc = subprocess.run(
                            cmd,
                            capture_output=True, text=True, timeout=6, creationflags=CREATE_NO_WINDOW,
                        )
                        parsed_items = []
                        for line in proc.stdout.splitlines():
                            line = line.strip()
                            if line:
                                try:
                                    parsed_items.append(_json.loads(line))
                                except Exception:
                                    pass
                        if parsed_items:
                            thumb, count = _extract_gallery_preview(parsed_items)
                    except Exception as ge:
                        logger.warning(f"Gallery preview probe warning for {url}: {ge}")

                    host = _urlparse.urlparse(url).hostname or url
                    path_parts = [p for p in _urlparse.urlparse(url).path.split("/") if p]
                    title_hint = f"{host} (Gallery)"
                    if len(path_parts) >= 2 and path_parts[0] in ("users", "u", "user", "r", "channel", "c"):
                        title_hint = f"{path_parts[1]} on {host}"
                    elif path_parts:
                        title_hint = f"{path_parts[-1]} on {host}"

                    result = {
                        "ok": True,
                        "tool": "gallery-dl",
                        "type": "gallery",
                        "title": title_hint,
                        "thumbnail": thumb or "",
                        "count": count or 0,
                        "url": url,
                    }
            except subprocess.TimeoutExpired:
                host = _urlparse.urlparse(url).hostname or url
                tool = detect_tool(url)
                result = {
                    "ok": True,
                    "tool": tool,
                    "type": "gallery" if tool == "gallery-dl" else "video",
                    "title": host,
                    "thumbnail": "",
                    "url": url,
                    "fallback": True,
                }
            except Exception as e:
                logger.warning(f"Link preview exception for {url}: {e}")
                host = _urlparse.urlparse(url).hostname or url
                tool = detect_tool(url)
                result = {
                    "ok": True,
                    "tool": tool,
                    "type": "gallery" if tool == "gallery-dl" else "video",
                    "title": host,
                    "thumbnail": "",
                    "url": url,
                    "fallback": True,
                }

            self._push_js(f"window.onLinkPreview?.({_js(request_id)}, {_js(result)})")

        threading.Thread(target=run, daemon=True).start()
        return {"ok": True, "started": True}

    # ── playlist inspector (extract tracks/videos from a playlist without downloading) ──
    def inspect_playlist(self, url: str, request_id: str = "") -> dict:
        """
        Extract playlist / album entries using yt-dlp --flat-playlist -J.
        Non-blocking background thread that calls window.onPlaylistPreview(request_id, result).
        """
        if not validate_url(url):
            logger.warning(f"Invalid URL for playlist inspection: {url}")
            return {"ok": False, "error": "Invalid URL"}

        def run():
            from media_downloader import resolve_tool_path, CREATE_NO_WINDOW, _ytdlp_extra_headers
            import subprocess, json as _json

            ytdlp = resolve_tool_path("yt-dlp")
            cmd = [ytdlp, "--flat-playlist", "-J", "--no-warnings"]
            cmd += _ytdlp_extra_headers(url)
            cmd.append(url)

            try:
                proc = subprocess.run(
                    cmd, capture_output=True, text=True, timeout=35, creationflags=CREATE_NO_WINDOW
                )
                if proc.returncode != 0 and not proc.stdout:
                    err = (proc.stderr or "").strip() or "Failed to extract playlist entries"
                    self._push_js(f"window.onPlaylistPreview?.({_js(request_id)}, {_js({'ok': False, 'error': err})})")
                    return

                data = _json.loads(proc.stdout)
                raw_entries = data.get("entries") or []
                entries = []
                for idx, entry in enumerate(raw_entries, start=1):
                    if not entry:
                        continue
                    vid_id = entry.get("id", "")
                    entry_url = entry.get("url") or (f"https://www.youtube.com/watch?v={vid_id}" if vid_id else "")
                    thumbs = entry.get("thumbnails") or []
                    thumb = entry.get("thumbnail") or (thumbs[-1].get("url") if thumbs else (f"https://i.ytimg.com/vi/{vid_id}/hqdefault.jpg" if vid_id else ""))
                    entries.append({
                        "index": idx,
                        "id": vid_id,
                        "title": entry.get("title") or f"Track #{idx}",
                        "duration": entry.get("duration"),
                        "uploader": entry.get("uploader") or entry.get("channel") or "",
                        "thumbnail": thumb,
                        "url": entry_url,
                    })

                playlist_title = data.get("title") or "Playlist"
                playlist_uploader = data.get("uploader") or data.get("channel") or ""
                result = {
                    "ok": True,
                    "title": playlist_title,
                    "uploader": playlist_uploader,
                    "count": len(entries),
                    "entries": entries,
                    "url": url,
                }
                self._push_js(f"window.onPlaylistPreview?.({_js(request_id)}, {_js(result)})")
            except subprocess.TimeoutExpired:
                self._push_js(f"window.onPlaylistPreview?.({_js(request_id)}, {_js({'ok': False, 'error': 'Playlist inspection timed out'})})")
            except Exception as e:
                self._push_js(f"window.onPlaylistPreview?.({_js(request_id)}, {_js({'ok': False, 'error': str(e)})})")

        threading.Thread(target=run, daemon=True).start()
        return {"ok": True, "started": True}
    #    download subprocess doesn't keep running orphaned after the UI
    #    that was tracking it disappears ──
    def cancel_all_active(self):
        with self._jobs_lock:
            ids = list(self._active_job_ids)
            history_map = dict(self._active_job_history)
        for jid in ids:
            try:
                cancel_job(jid)
            except Exception:
                pass
            hid = history_map.get(jid)
            if hid:
                try:
                    st = job_status(jid)
                    files = st.get("files", []) if st.get("ok") else []
                    download_history.update_entry(hid, {
                        "status": "cancelled",
                        "error": "Interrupted when application closed.",
                        "files": files,
                        "finished_at": time.time(),
                    })
                except Exception:
                    pass
        with self._jobs_lock:
            self._active_job_ids.clear()
            self._active_job_history.clear()
        try:
            from sleep_manager import sleep_manager
            sleep_manager.restore_sleep()
        except Exception:
            pass
        try:
            from taskbar_manager import taskbar
            taskbar.clear()
        except Exception:
            pass

    # ── internal ──
    def _push_js(self, code: str):
        if self._window:
            try:
                self._window.evaluate_js(code)
            except Exception:
                pass  # window may have closed mid-download; ignore


def _extract_gallery_preview(data):
    """
    Best-effort walk of gallery-dl's `-j` dump looking for the first
    downloadable file URL to use as a preview thumbnail, plus a rough
    item count. Supports both nested lists and dicts.
    """
    from media_downloader import _SCANNABLE_EXTENSIONS
    IMG_EXT = tuple(_SCANNABLE_EXTENSIONS)
    found = {"url": None, "count": 0}

    def walk(node):
        if isinstance(node, dict):
            for k in ("thumbnail", "thumbnail_url", "preview", "poster", "file_url", "url"):
                v = node.get(k)
                if isinstance(v, str) and v.startswith("http"):
                    if any(v.lower().split("?")[0].endswith(ext) for ext in IMG_EXT) or k in ("thumbnail", "poster", "preview"):
                        if found["url"] is None:
                            found["url"] = v
                        break
            for val in node.values():
                walk(val)
        elif isinstance(node, list):
            if (len(node) >= 2 and isinstance(node[0], int) and isinstance(node[1], str)
                    and (node[1].lower().split("?")[0].endswith(IMG_EXT) or node[1].startswith("http"))):
                found["count"] += 1
                if found["url"] is None:
                    found["url"] = node[1]
                return
            for item in node:
                walk(item)

    walk(data)
    return found["url"], found["count"]


def _js(value) -> str:
    """
    Serialize a Python value into a JS literal for use inside an
    evaluate_js() call. json.dumps produces valid JS for str/int/float/
    bool/None (JSON is a subset of JS expression syntax for these), and
    correctly escapes newlines, control characters, unicode, quotes, and
    backslashes — all of which a hand-rolled template-literal escaper
    would need to special-case individually.
    """
    return json.dumps(value)


def _find_icon_file() -> str:
    """Same two candidate locations icon embedding already uses (see
    MediaDownloader.spec and installer.iss) — packaged installs get
    icon.ico copied to {app}\\icon.ico by the installer; dev-mode runs
    read it straight from build_assets/."""
    base = _app_base_dir()
    for candidate in (
        os.path.join(base, "icon.ico"),
        os.path.join(base, "build_assets", "icon.ico"),
    ):
        if os.path.isfile(candidate):
            return candidate
    return ""


def _apply_window_icon():
    """
    Explicitly set the window's title-bar/taskbar icon via the Win32 API
    (WM_SETICON), rather than relying on the exe's own embedded icon
    resource propagating automatically. This matters specifically for
    the TASKBAR icon on a live running window — Explorer/shortcut icons
    are a separate concern already handled by the icon embedded in the
    exe (see MediaDownloader.spec) plus installer.iss's explicit
    IconFilename on each shortcut. WebView2-hosted windows don't always
    pick up the host exe's icon resource for their own window class, so
    this sets it directly instead of assuming it "just works". Best
    effort — purely cosmetic, so any failure here is silently ignored
    rather than disrupting the app.
    """
    if os.name != "nt":
        return
    icon_path = _find_icon_file()
    if not icon_path:
        return
    try:
        import ctypes
        user32 = ctypes.windll.user32
        user32.FindWindowW.restype = ctypes.c_void_p
        user32.LoadImageW.restype = ctypes.c_void_p

        hwnd = user32.FindWindowW(None, "NovaDrop")
        if not hwnd:
            hwnd = user32.FindWindowW(None, "Media Downloader")
        if not hwnd:
            return

        IMAGE_ICON = 1
        LR_LOADFROMFILE = 0x00000010
        WM_SETICON = 0x0080
        ICON_SMALL, ICON_BIG = 0, 1

        h_small = user32.LoadImageW(0, icon_path, IMAGE_ICON, 16, 16, LR_LOADFROMFILE)
        h_big   = user32.LoadImageW(0, icon_path, IMAGE_ICON, 32, 32, LR_LOADFROMFILE)
        if h_small:
            user32.SendMessageW(hwnd, WM_SETICON, ICON_SMALL, h_small)
        if h_big:
            user32.SendMessageW(hwnd, WM_SETICON, ICON_BIG, h_big)

        try:
            from taskbar_manager import taskbar
            taskbar.set_hwnd(hwnd)
        except Exception:
            pass

        try:
            from window_effects import window_effects
            window_effects.apply_fluent_effects(hwnd)
        except Exception:
            pass
    except Exception:
        pass


def _startup_update_check(api):
    """Background check on startup to illuminate the update indicator and populate update states."""
    time.sleep(4)
    try:
        tools_info = updater.check_tool_updates()
        app_info = updater.check_app_update()
        any_update = bool(app_info.get("update_available") or tools_info.get("any_update"))
        payload = {
            "ok": True,
            "any_update": any_update,
            "app_update": app_info.get("update_available", False),
            "app_version": app_info.get("latest_version"),
            "app": app_info,
            "tools_update": tools_info.get("any_update", False),
            "tools": tools_info.get("tools", {}),
        }
        if any_update:
            api._push_js(f"window.onUpdateAvailable?.({_js(payload)})")
        api._push_js(f"window.onUpdateCheckComplete?.({_js(payload)})")
    except Exception as e:
        logger.debug(f"Startup update check failed: {e}")


def main():
    _start_bridge_server()
    api = Api()

    if getattr(sys, "frozen", False):
        here = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(sys.executable)))
    else:
        here = os.path.dirname(os.path.abspath(__file__))
    react_dist = os.path.join(here, "frontend", "dist", "index.html")
    dev_server_url = "http://localhost:5173"

    # Priority:
    # 1. Dev server if VITE_DEV=1
    # 2. Modern React bundle if frontend/dist/index.html exists
    # 3. Fallback to index.html
    if os.environ.get("VITE_DEV") == "1":
        url_target = dev_server_url
        logger.info(f"Loading Vite dev server from {url_target}")
    elif os.path.isfile(react_dist):
        url_target = react_dist
        logger.info(f"Loading modern React frontend from {url_target}")
    else:
        url_target = os.path.join(here, "index.html")
        logger.info(f"Loading legacy frontend from {url_target}")

    window = webview.create_window(
        "NovaDrop",
        url_target,
        js_api=api,
        width=1280,
        height=860,
        min_size=(900, 600),
        background_color="#090a0f",
    )
    api.set_window(window)

    def _on_closing():
        api.cancel_all_active()
        try:
            from sleep_manager import sleep_manager
            sleep_manager.restore_sleep()
        except Exception:
            pass
        try:
            from taskbar_manager import taskbar
            taskbar.clear()
        except Exception:
            pass
        _stop_bridge_server()

    window.events.closing += _on_closing
    window.events.loaded += _apply_window_icon
    threading.Thread(target=_startup_update_check, args=(api,), daemon=True).start()
    webview.start(debug=False)
    _on_closing()
    os._exit(0)


if __name__ == "__main__":
    main()
