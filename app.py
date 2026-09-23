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

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import download_history
import search_history
from media_downloader import (
    download_from_ui,
    detect_tool,
    site_hint,
    auth_hint,
    pause_job,
    resume_job,
    cancel_job,
    job_status,
    extract_embedded_art,
)
from validators import (
    validate_url,
    validate_path,
    validate_config,
    validate_search_query,
    validate_job_id,
    validate_history_entry_id,
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
    return os.path.normpath(os.path.abspath(os.path.expanduser(path or "")))


def _register_known_media_path(path: str) -> None:
    if not path:
        return
    normalized = _normalize_media_path(path)
    with _KNOWN_MEDIA_LOCK:
        _KNOWN_MEDIA_PATHS.pop(normalized, None)  # re-insert at the end (most-recent)
        _KNOWN_MEDIA_PATHS[normalized] = None
        while len(_KNOWN_MEDIA_PATHS) > _KNOWN_MEDIA_MAX:
            _KNOWN_MEDIA_PATHS.popitem(last=False)


def _is_known_media_path(path: str) -> bool:
    normalized = _normalize_media_path(path)
    with _KNOWN_MEDIA_LOCK:
        if normalized in _KNOWN_MEDIA_PATHS:
            return True
    # Anything inside the app's own generated-cache directories (audio
    # cover art, video-frame thumbnails) is safe to serve unconditionally
    # — these are entirely app-produced files, never user-supplied paths.
    try:
        from media_downloader import _art_cache_dir, _thumb_cache_dir
        for cache_dir_fn in (_art_cache_dir, _thumb_cache_dir):
            cache_dir = _normalize_media_path(cache_dir_fn())
            try:
                if os.path.commonpath([normalized, cache_dir]) == cache_dir:
                    return True
            except ValueError:
                continue  # different drives on Windows, etc — definitely not contained
    except Exception:
        pass
    return False

# Initialize logger
logger = get_logger(__name__)


class _BridgeHandler(BaseHTTPRequestHandler):
    """Handles requests from the browser extension."""

    def log_message(self, fmt, *args):
        pass   # silence the default access log

    def _cors(self):
        # Allow requests from any chrome-extension:// origin
        origin = self.headers.get("Origin", "")
        if origin.startswith("chrome-extension://") or origin.startswith("moz-extension://"):
            self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Token")

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
        if not secrets.compare_digest(token, BRIDGE_TOKEN):
            self.send_response(403); self.end_headers(); return

        path = os.path.expanduser((qs.get("path") or [""])[0])
        if not path or not os.path.isfile(path):
            self.send_response(404); self.end_headers(); return

        if not _is_known_media_path(path):
            # Valid token, but a path the app never actually produced —
            # don't serve it. 404 rather than 403 so this doesn't act as
            # an existence oracle for arbitrary filesystem paths.
            logger.warning(f"Rejected /media request for unregistered path: {path}")
            self.send_response(404); self.end_headers(); return

        file_size = os.path.getsize(path)
        content_type = mimetypes.guess_type(path)[0] or "application/octet-stream"

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


def _start_bridge_server():
    """Start the bridge HTTP server on a daemon thread — never blocks the UI."""
    try:
        server = ThreadingHTTPServer(("127.0.0.1", BRIDGE_PORT), _BridgeHandler)
        t = threading.Thread(target=server.serve_forever, daemon=True)
        t.start()
        logger.info(f"Bridge server started on port {BRIDGE_PORT}")
    except OSError as e:
        # Port already in use — another instance may be running, ignore.
        logger.warning(f"Bridge server port {BRIDGE_PORT} already in use: {e}")


class Api:
    """
    Methods on this class are callable from JS as pywebview.api.<name>(...).
    Every method must return JSON-serializable data (dict, list, str, etc).
    PyWebView marshals the call automatically and returns a JS Promise.
    """

    def __init__(self):
        self._window = None
        self._active_job_ids = set()
        self._jobs_lock = threading.Lock()
        logger.info(f"Media Downloader {get_version_string()} initialized")

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

    def update_engine_async(self, tool_name: str) -> dict:
        """Update an extractor tool (yt-dlp or gallery-dl) in background thread."""
        with self._jobs_lock:
            if self._active_job_ids:
                return {
                    "ok": False,
                    "error": "Cannot update tools while a download is running. Please finish or cancel active downloads.",
                }

        def on_prog(snapshot: dict):
            self._push_js(f"window.onUpdateProgress?.({_js({'type': 'tool', 'tool': tool_name, **snapshot})})")

        def run():
            result = updater.update_engine_tool(tool_name, on_progress=on_prog)
            self._push_js(f"window.onEngineUpdateComplete?.({_js(result)})")

        threading.Thread(target=run, daemon=True).start()
        return {"ok": True, "updating": True, "tool": tool_name}

    def download_app_update_async(self, asset_url: str, asset_name: str = "") -> dict:
        """Download desktop app installer in background thread."""
        def on_prog(snapshot: dict):
            self._push_js(f"window.onUpdateProgress?.({_js({'type': 'app', **snapshot})})")

        def run():
            result = updater.download_app_installer(asset_url, asset_name, on_progress=on_prog)
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

    # ── detection (used for the live "auto tool" badge) ──
    def detect(self, url: str) -> dict:
        if not url or not url.startswith("http"):
            return {"tool": "", "hint": "", "auth_hint": ""}
        return {"tool": detect_tool(url), "hint": site_hint(url), "auth_hint": auth_hint(url)}

    # ── start a download in the background, return its job_id immediately ──
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
        with self._jobs_lock:
            self._active_job_ids.add(job_id)
        
        logger.info(f"Starting download job {job_id} for URL: {url}")

        def on_line(line: str):
            self._push_js(f"window.onDownloadLine?.({_js(job_id)}, {_js(line)})")

        def on_progress(snapshot: dict):
            # Passed as a single object rather than a long positional
            # argument list — adding new fields (like downloaded_bytes/
            # total_bytes below) doesn't require touching this call or
            # remembering an argument order on the JS side.
            payload = {
                "items_done": snapshot.get("items_done", 0),
                "limit": snapshot.get("limit", 0),
                "current_file": snapshot.get("current_file") or "",
                "percent": snapshot.get("percent", 0),
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

            status = job_status(job_id)
            files = status.get("files", []) if status.get("ok") else []
            for f in files:
                _register_known_media_path(f.get("path") if isinstance(f, dict) else None)
            history_id = ""

            # Record history (skip dry-runs — nothing was actually downloaded).
            if not cfg.get("dry_run"):
                try:
                    if len(files) == 1:
                        display_name = files[0]["name"]
                    elif len(files) > 1:
                        display_name = f"{len(files)} files"
                    else:
                        display_name = os.path.basename(urllib.parse.urlparse(url).path) or url

                    status_label = (
                        "done" if result.get("ok")
                        else "cancelled" if result.get("error") == "Cancelled by user."
                        else "error"
                    )
                    history_id = download_history.add_entry({
                        "url": url,
                        "tool": result.get("tool", ""),
                        "output_dir": result.get("output_dir", ""),
                        "filename": display_name,
                        "files": files,
                        "size_bytes": sum((f.get("size") or 0) for f in files),
                        "status": status_label,
                        "error": result.get("error"),
                        "started_at": status.get("started_at"),
                        "finished_at": status.get("finished_at"),
                    })
                except Exception as e:
                    logger.error(f"Failed to record download history: {e}")

            self._push_js(
                f"window.onDownloadDone?.({_js(job_id)}, "
                f"{_js(bool(result['ok']))}, "
                f"{_js(result.get('error') or '')}, "
                f"{_js(result.get('output_dir') or '')}, "
                f"{_js(files)}, "
                f"{_js(history_id)})"
            )

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
        return cancel_job(job_id)

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

    # ── clipboard read (for clipboard monitor feature) ──
    def read_clipboard(self) -> str:
        """Return current clipboard text, or empty string on any failure."""
        try:
            import subprocess as _sp
            # Use PowerShell to read clipboard — works reliably in packaged
            # Windows apps where tkinter/pyperclip aren't available.
            result = _sp.run(
                ["powershell", "-NoProfile", "-Command",
                 "[System.Windows.Forms.Clipboard]::GetText()"],
                capture_output=True, text=True, timeout=2,
                creationflags=0x08000000  # CREATE_NO_WINDOW
            )
            clipboard_text = (result.stdout or "").strip()
            logger.debug(f"Clipboard read: {len(clipboard_text)} characters")
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
    def open_output_folder(self, path: str) -> dict:
        if not path:
            logger.warning("No path provided for opening folder")
            return {"ok": False, "error": "No path provided."}
        
        if not validate_path(path, must_exist=True, must_be_dir=True):
            logger.warning(f"Invalid path for opening folder: {path}")
            return {"ok": False, "error": f"Invalid directory path: {path}"}
        
        try:
            import subprocess as _sp
            import os
            expanded = os.path.expanduser(path)
            _sp.Popen(["explorer", os.path.normpath(expanded)])
            logger.info(f"Opened folder: {expanded}")
            return {"ok": True}
        except Exception as e:
            logger.error(f"Failed to open folder {path}: {e}")
            return {"ok": False, "error": str(e)}

    # ── download history ──
    def list_history(self) -> dict:
        try:
            entries = download_history.list_entries()
            for e in entries:
                for f in (e.get("files") or []):
                    _register_known_media_path(f.get("path") if isinstance(f, dict) else None)
            logger.debug(f"Retrieved {len(entries)} history entries")
            return {"ok": True, "entries": entries}
        except Exception as e:
            logger.error(f"Failed to list history: {e}")
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
        if not validate_path(path, must_exist=True, must_be_file=True):
            logger.warning(f"Invalid path for media URL: {path}")
            return {"ok": False, "error": "File not found or invalid path."}

        try:
            expanded = os.path.expanduser(path)
            if not _is_known_media_path(expanded):
                logger.warning(f"Media URL requested for unregistered path: {expanded}")
                return {"ok": False, "error": "This file isn't recognized by the app."}
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
        for path in paths or []:
            try:
                if validate_path(path, must_exist=True, must_be_file=True):
                    expanded = os.path.expanduser(path)
                    if not _is_known_media_path(expanded):
                        logger.warning(f"Media URL requested for unregistered path: {expanded}")
                        continue
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
        if not validate_path(path, must_exist=True, must_be_file=True):
            logger.warning(f"Invalid path for cover art extraction: {path}")
            return {"ok": False}
        
        try:
            expanded = os.path.expanduser(path)
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
        if not validate_path(path, must_exist=True, must_be_file=True):
            logger.warning(f"Invalid path for video thumbnail extraction: {path}")
            return {"ok": False}

        try:
            from media_downloader import extract_video_thumbnail
            expanded = os.path.expanduser(path)
            thumb_path = extract_video_thumbnail(expanded)
            if not thumb_path:
                return {"ok": False}
            return self.get_media_url(thumb_path)
        except Exception as e:
            logger.error(f"Failed to extract video thumbnail from {path}: {e}")
            return {"ok": False, "error": str(e)}

    # ── open a single file with the OS default app (non-playable files) ──
    def open_file(self, path: str) -> dict:
        if not validate_path(path, must_exist=True, must_be_file=True):
            logger.warning(f"Invalid path for opening file: {path}")
            return {"ok": False, "error": "File not found or invalid path."}
        
        try:
            expanded = os.path.expanduser(path)
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
                    else:
                        title = info.get("title") or ""
                        thumbs = info.get("thumbnails") or []
                        thumb = info.get("thumbnail") or (thumbs[-1].get("url") if thumbs else "")
                        channel = info.get("channel") or info.get("uploader") or ""
                        duration = info.get("duration")
                    result = {
                        "ok": True, "tool": "yt-dlp", "title": title,
                        "thumbnail": thumb, "channel": channel, "duration": duration,
                    }
                else:
                    gallerydl = resolve_tool_path("gallery-dl")
                    proc = subprocess.run(
                        [gallerydl, "-j", "--no-input", url],
                        capture_output=True, text=True, timeout=20, creationflags=CREATE_NO_WINDOW,
                    )
                    data = _json.loads(proc.stdout)
                    thumb, count = _extract_gallery_preview(data)
                    host = _urlparse.urlparse(url).hostname or url
                    # Previously gated on `if thumb:` alone, which threw
                    # away a perfectly good "found 47 items" result
                    # whenever _extract_gallery_preview's best-effort JSON
                    # walk couldn't pin down a thumbnail URL specifically
                    # (which varies a lot by extractor — see that
                    # function's docstring). A text-only preview (no
                    # image, just a count) is still far better than no
                    # preview at all, and the frontend already handles a
                    # missing thumbnail gracefully.
                    if thumb or count:
                        result = {"ok": True, "tool": "gallery-dl", "title": host, "thumbnail": thumb or "", "count": count}
            except subprocess.TimeoutExpired:
                result = {"ok": False, "reason": "timeout"}
            except Exception as e:
                result = {"ok": False, "reason": "error", "error": str(e)}

            self._push_js(f"window.onLinkPreview?.({_js(request_id)}, {_js(result)})")

        threading.Thread(target=run, daemon=True).start()
        return {"ok": True, "started": True}
    #    download subprocess doesn't keep running orphaned after the UI
    #    that was tracking it disappears ──
    def cancel_all_active(self):
        with self._jobs_lock:
            ids = list(self._active_job_ids)
        for jid in ids:
            try:
                cancel_job(jid)
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
    item count. The exact shape of this output varies by extractor
    (nested lists tagged with a numeric level — 3 generally means "an
    actual file" — but it isn't identical everywhere), so this
    deliberately doesn't try to be a canonical parser. It just needs to
    find something reasonable for a live preview; if it comes up empty,
    the caller simply shows no thumbnail rather than treating it as an error.
    """
    from media_downloader import _SCANNABLE_EXTENSIONS
    IMG_EXT = tuple(_SCANNABLE_EXTENSIONS)  # broader than a hand-rolled list — stays in sync with the gallery scanner's own definition
    found = {"url": None, "count": 0}

    def walk(node):
        if isinstance(node, list):
            if (len(node) >= 2 and isinstance(node[0], int) and isinstance(node[1], str)
                    and node[1].lower().split("?")[0].endswith(IMG_EXT)):
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
    from media_downloader import _app_base_dir
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
    except Exception:
        pass


def _startup_update_check(api):
    """Background check on startup to illuminate the update indicator if needed."""
    time.sleep(4)
    try:
        tools_info = updater.check_tool_updates()
        app_info = updater.check_app_update()
        any_update = bool(app_info.get("update_available") or tools_info.get("any_update"))
        if any_update:
            payload = {
                "any_update": True,
                "app_update": app_info.get("update_available", False),
                "app_version": app_info.get("latest_version"),
                "tools_update": tools_info.get("any_update", False),
                "tools": tools_info.get("tools", {}),
            }
            api._push_js(f"window.onUpdateAvailable?.({_js(payload)})")
    except Exception as e:
        logger.debug(f"Startup update check failed: {e}")


def main():
    _start_bridge_server()
    api = Api()
    window = webview.create_window(
        "Media Downloader",
        "index.html",
        js_api=api,
        width=1280,
        height=860,
        min_size=(900, 600),
        background_color="#0a0a0b",
    )
    api.set_window(window)
    window.events.closing += api.cancel_all_active
    window.events.loaded += _apply_window_icon
    threading.Thread(target=_startup_update_check, args=(api,), daemon=True).start()
    webview.start(debug=False)


if __name__ == "__main__":
    main()
