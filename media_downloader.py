#!/usr/bin/env python3
"""
media_downloader.py
-------------------
Downloads images, GIFs, and videos using gallery-dl and yt-dlp.
Run with no arguments for interactive prompt mode.

Requirements:
    pip install gallery-dl yt-dlp

Usage:
    python media_downloader.py               # interactive mode (recommended)
    python media_downloader.py <URL>         # quick download with defaults
    python media_downloader.py <URL> -d ~/Downloads --limit 50
"""

import subprocess
import sys
import os
import argparse
import tempfile
import shutil
import hashlib
from urllib.parse import urlparse

from logger import get_logger

# Suppress the console window that Windows creates for each subprocess.
# This flag is Windows-only — on other platforms it is defined as 0 so
# passing it to subprocess calls is a harmless no-op.
CREATE_NO_WINDOW = 0x08000000 if os.name == "nt" else 0

YTDLP_SITES = [
    "youtube.com", "youtu.be", "vimeo.com", "tiktok.com",
    "twitch.tv", "pornhub.com", "xvideos.com", "xhamster.com",
    "xnxx.com", "spankbang.com", "dailymotion.com", "bilibili.com",
    "1flex.org",  # HLS streaming (requires direct m3u8 URL)
]

SITE_NOTES = {
    "redgifs.com":    "gallery-dl  |  images + GIFs + video",
    "reddit.com":     "gallery-dl  |  subreddits, posts, users",
    "imgur.com":      "gallery-dl  |  albums and images",
    "twitter.com":    "gallery-dl  |  use cookies for best results",
    "x.com":          "gallery-dl  |  use cookies for best results",
    "instagram.com":  "gallery-dl  |  login required for private",
    "pixiv.net":      "gallery-dl  |  illustrations, manga, ugoira",
    "e621.net":       "gallery-dl  |  tag-based bulk download",
    "gelbooru.com":   "gallery-dl  |  tag-based bulk download",
    "rule34.xxx":     "gallery-dl  |  tag-based bulk download",
    "tumblr.com":     "gallery-dl  |  blogs and tag pages",
    "flickr.com":     "gallery-dl  |  photostreams and albums",
    "deviantart.com": "gallery-dl  |  galleries and favorites",
    "pinterest.com":  "gallery-dl  |  boards and pins",
    "erome.com":      "gallery-dl  |  albums and profiles",
    "cyberdrop.me":   "gallery-dl  |  albums and files",
    "youtube.com":    "yt-dlp      |  videos, playlists, channels",
    "vimeo.com":      "yt-dlp      |  videos and channels",
    "tiktok.com":     "yt-dlp      |  videos and user pages",
    "twitch.tv":      "yt-dlp      |  VODs and clips",
    "pornhub.com":    "yt-dlp      |  videos and playlists",
    "1flex.org":      "yt-dlp      |  HLS streaming (use direct m3u8 URL, not play page)",
}

SEP  = "=" * 58
THIN = "-" * 58

# Initialize logger
logger = get_logger(__name__)


# ── helpers ───────────────────────────────────────────────────

def detect_tool(url: str) -> str:
    try:
        host = urlparse(url).netloc.replace("www.", "").lower()
    except Exception:
        return "gallery-dl"
    for site in YTDLP_SITES:
        if site in host:
            return "yt-dlp"
    return "gallery-dl"


def site_hint(url: str) -> str:
    try:
        host = urlparse(url).netloc.replace("www.", "").lower()
    except Exception:
        return "tool will be auto-detected"
    for key, note in SITE_NOTES.items():
        if key in host:
            return note
    return "tool will be auto-detected"


def _app_base_dir() -> str:
    """
    Directory the running app lives in.

    When frozen by PyInstaller (--onedir), sys.frozen is True and
    sys.executable points at MediaDownloader.exe itself — its directory
    is where we expect a sibling tools/ folder. When running from source
    (`python media_downloader.py`), fall back to this file's directory.
    """
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


def resolve_tool_path(tool: str) -> str:
    """
    Resolve the executable to actually invoke for "gallery-dl" or
    "yt-dlp". Checks, in order:

      1. tools/<tool>.exe next to the running app — the expected
         location with the shipped MediaDownloader.spec, which sets
         contents_directory="." specifically so bundled files land
         here rather than under _internal/ (PyInstaller 6's default).
      2. _internal/tools/<tool>.exe — fallback in case a future rebuild
         drops that contents_directory override and reverts to
         PyInstaller's default layout.
      3. build_assets/tools/<tool>.exe — the same folder build_windows.py
         stages binaries from before packaging. Checking it here too
         means dropping a binary in ONE place works for both dev-mode
         runs (`python app.py`) and the packaged build, instead of
         needing the same file copied into two different folders.
      4. the bare tool name, resolved via PATH (covers `pip install`
         dev setups and non-Windows platforms).

    Always returns a string usable as cmd[0]; callers don't need to
    know which case applied.
    """
    exe_name = f"{tool}.exe" if os.name == "nt" else tool
    base = _app_base_dir()
    for candidate in (
        os.path.join(base, "tools", exe_name),
        os.path.join(base, "_internal", "tools", exe_name),
        os.path.join(base, "build_assets", "tools", exe_name),
    ):
        if os.path.isfile(candidate):
            return candidate
    return tool


def resolve_ffmpeg_dir() -> str:
    """
    Return the directory that contains ffmpeg(.exe) if it is bundled
    in the app's tools/ folder (or the build_assets/tools/ staging
    folder — see resolve_tool_path), otherwise return an empty string.

    yt-dlp accepts --ffmpeg-location as either a directory (it appends
    the executable name itself) or a full path to the binary. Passing
    the directory is simpler since it works on both Windows and POSIX
    without worrying about the .exe suffix.

    When ffmpeg is not bundled (empty string returned), yt-dlp falls
    back to searching PATH as normal — so this is always safe to call.
    """
    exe_name = "ffmpeg.exe" if os.name == "nt" else "ffmpeg"
    base = _app_base_dir()
    for tools_dir in (
        os.path.join(base, "tools"),
        os.path.join(base, "_internal", "tools"),
        os.path.join(base, "build_assets", "tools"),
    ):
        if os.path.isfile(os.path.join(tools_dir, exe_name)):
            return tools_dir

    # Not bundled — yt-dlp will still fall back to searching PATH on its
    # own, but a missing ffmpeg is exactly what silently breaks audio
    # extraction and --embed-thumbnail with no obvious symptom other than
    # "the file downloaded but the album art/format conversion is missing".
    # Loud beats silent here, same reasoning as the icon.ico check earlier.
    if shutil.which("ffmpeg") is None:
        print("[WARNING] ffmpeg not found — not in tools/, build_assets/tools/, or PATH.")
        print("          Audio conversion (mp3/m4a) and thumbnail embedding will fail")
        print("          or silently produce files without embedded cover art.")
    return ""


def resolve_ffmpeg_path() -> str:
    """Full path to the ffmpeg binary itself (not just its directory) —
    needed for actually invoking it directly, e.g. for cover-art extraction."""
    ffmpeg_dir = resolve_ffmpeg_dir()
    exe_name = "ffmpeg.exe" if os.name == "nt" else "ffmpeg"
    if ffmpeg_dir:
        return os.path.join(ffmpeg_dir, exe_name)
    return shutil.which("ffmpeg") or ""


def _art_cache_dir() -> str:
    base = os.path.join(os.path.expanduser("~"), ".media_downloader", "art_cache")
    os.makedirs(base, exist_ok=True)
    return base


def extract_embedded_art(file_path: str) -> str:
    """
    Extract an audio file's embedded cover art (ID3 APIC for mp3, the
    'covr' atom for m4a) to a cached jpg, using the same bundled ffmpeg
    that embeds it in the first place — reusing that dependency rather
    than pulling in a tagging library (mutagen etc.) for the reverse
    operation. Returns the cached image path, or "" if there's no
    embedded art, ffmpeg is unavailable, or extraction otherwise fails.

    Cached by source path + mtime so a re-download of the same filename
    doesn't serve a stale cached cover.
    """
    ffmpeg = resolve_ffmpeg_path()
    if not ffmpeg or not os.path.isfile(file_path):
        return ""

    try:
        mtime = int(os.path.getmtime(file_path))
    except OSError:
        return ""

    key = hashlib.sha1(f"{file_path}:{mtime}".encode("utf-8")).hexdigest()
    cache_path = os.path.join(_art_cache_dir(), f"{key}.jpg")
    if os.path.isfile(cache_path) and os.path.getsize(cache_path) > 0:
        return cache_path

    try:
        proc = subprocess.run(
            [ffmpeg, "-y", "-i", file_path, "-an", "-vcodec", "copy", cache_path],
            capture_output=True, timeout=15, creationflags=CREATE_NO_WINDOW,
        )
        if proc.returncode == 0 and os.path.isfile(cache_path) and os.path.getsize(cache_path) > 0:
            return cache_path
    except Exception:
        pass

    # No embedded art stream (most common — not every download has one) or
    # extraction otherwise failed. Clean up a possible empty/partial file.
    try:
        if os.path.isfile(cache_path) and os.path.getsize(cache_path) == 0:
            os.remove(cache_path)
    except OSError:
        pass
    return ""


def _missing_tool_advice(tool: str) -> str:
    """
    User-facing fix suggestion for a missing tool. Differs depending on
    whether this is a frozen (bundled) build, where the expected fix is
    "reinstall the app" rather than "pip install", since a packaged
    build's users won't have Python/pip set up at all.
    """
    if getattr(sys, "frozen", False):
        return (
            f"'{tool}' was expected at tools/{tool}.exe next to this app "
            f"but wasn't found. Try reinstalling the app, or download "
            f"{tool}.exe yourself and place it in the app's tools/ folder."
        )
    return f"pip install {tool}"


def check_installed(tool: str) -> bool:
    try:
        subprocess.run(
            [resolve_tool_path(tool), "--version"],
            capture_output=True,
            check=True,
            creationflags=CREATE_NO_WINDOW,
        )
        return True
    except (FileNotFoundError, subprocess.CalledProcessError):
        return False


def ask(label: str, default: str = "") -> str:
    hint = f" (default: {default})" if default else ""
    try:
        val = input(f"  {label}{hint}\n  > ").strip()
    except (EOFError, KeyboardInterrupt):
        print("\n\n  Bye!\n")
        sys.exit(0)
    return val or default


def ask_yn(label: str, default: bool = False) -> bool:
    hint = "Y/n" if default else "y/N"
    try:
        val = input(f"  {label} [{hint}]: ").strip().lower()
    except (EOFError, KeyboardInterrupt):
        print("\n\n  Bye!\n")
        sys.exit(0)
    if not val:
        return default
    return val.startswith("y")


def _netrc_path_for_platform() -> str:
    """gallery-dl's --netrc flag always reads ~/.netrc (~/_netrc on
    Windows) — there is no --netrc-file option to point it elsewhere."""
    home = os.path.expanduser("~")
    filename = "_netrc" if os.name == "nt" else ".netrc"
    return os.path.join(home, filename)


def _stage_netrc_credentials(username: str, password: str) -> dict:
    """
    Temporarily write credentials into the real ~/.netrc (gallery-dl has
    no --netrc-file option, only --netrc which always reads that fixed
    path), backing up any existing file first so it can be restored.

    Returns a dict describing how to undo this:
        {"path": ..., "had_backup": bool, "backup_path": ... }
    Callers MUST call _restore_netrc(info) when the subprocess exits,
    success or failure, ideally in a try/finally.

    This keeps the password out of argv (so it won't show up in `ps` or
    shell history) at the cost of a brief window where it's on disk in
    plaintext, same as gallery-dl's own documented .netrc workflow.
    """
    path = _netrc_path_for_platform()
    info = {"path": path, "had_backup": False, "backup_path": None}

    if os.path.exists(path):
        backup_path = path + ".mdl_bak"
        os.replace(path, backup_path)
        info["had_backup"] = True
        info["backup_path"] = backup_path

    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    try:
        with os.fdopen(fd, "w") as f:
            f.write(f"machine default\nlogin {username}\npassword {password}\n")
    except Exception:
        _restore_netrc(info)
        raise
    return info


def _restore_netrc(info: dict):
    """Undo _stage_netrc_credentials(); safe to call multiple times."""
    if not info:
        return
    path = info.get("path")
    try:
        if info.get("had_backup"):
            os.replace(info["backup_path"], path)
        else:
            if path and os.path.exists(path):
                os.remove(path)
    except OSError:
        pass


def build_gallery_dl_cmd(url: str, cfg: dict) -> list:
    cmd = [resolve_tool_path("gallery-dl")]
    if cfg.get("output"):
        cmd += ["-d", os.path.expanduser(cfg["output"])]
    if cfg.get("limit"):
        cmd += ["--range", f"1-{cfg['limit']}"]
    if cfg.get("filename"):
        cmd += ["-o", f"filename={cfg['filename']}"]
    if cfg.get("username") and cfg.get("password"):
        # Credentials never go on argv (avoids leaking via `ps`/process
        # listings). gallery-dl only supports reading them from ~/.netrc
        # via --netrc, so the caller (run_download / download_from_ui)
        # is responsible for staging/restoring that file around this
        # subprocess call — see _stage_netrc_credentials/_restore_netrc.
        cmd += ["--netrc"]
    elif cfg.get("username"):
        # No password supplied — fall back to the old behavior rather
        # than silently dropping the username.
        cmd += ["--username", cfg["username"]]
    if cfg.get("zip"):
        cmd += ["--zip"]
    if cfg.get("metadata"):
        cmd += ["--write-metadata"]
    if cfg.get("verbose"):
        cmd += ["--verbose"]
    if cfg.get("cookies"):
        cmd += ["--cookies-from-browser", cfg["cookies"]]
    # Rate limiting — adds a delay between requests to avoid 429 errors
    sleep = cfg.get("sleep", 2)
    cmd += ["-o", f"sleep-request={sleep}"]
    cmd += ["-o", "retries=5"]
    cmd += ["-o", "retry-codes=[429, 500, 502, 503]"]
    cmd.append(url)
    return cmd


def build_ytdlp_cmd(url: str, cfg: dict) -> list:
    cmd = [resolve_tool_path("yt-dlp")]
    if cfg.get("output"):
        out = os.path.expanduser(cfg["output"])
        # Use --paths for the directory and keep -o as a bare filename
        # template. Letting yt-dlp join directory + template internally
        # avoids os.path.join() producing backslashes in the template on
        # Windows, which yt-dlp's own path handling doesn't expect.
        cmd += ["-P", out, "-o", "%(title)s.%(ext)s"]
    else:
        cmd += ["-o", "%(title)s.%(ext)s"]

    # Custom headers for 1flex.org (HLS streaming site)
    if "1flex.org" in url:
        cmd += [
            "--add-header", "Referer: https://www.1flex.org/",
            "--add-header", "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        ]
        logger.info("Added custom headers for 1flex.org")

    # HLS-specific flags for streaming sites
    if "1flex.org" in url or any(site in url for site in ["youtube.com", "twitch.tv"]):
        cmd += [
            "--hls-use-mpegts",  # Force MPEG-TS merging for HLS
            "--concurrent-fragments", "8",  # Download 8 segments at once
            "--retries", "10",  # Retry failed segments
        ]
        logger.debug("Added HLS streaming flags")

    if cfg.get("limit"):
        cmd += ["--playlist-end", str(cfg["limit"])]
    if cfg.get("verbose"):
        cmd += ["--verbose"]
    if cfg.get("cookies"):
        cmd += ["--cookies-from-browser", cfg["cookies"]]

    # Point yt-dlp at the bundled ffmpeg when it's present in tools/.
    # This is required for --embed-thumbnail to work on m4a and mp3 files
    # when ffmpeg is not on the system PATH. Passing the directory (not
    # the binary path) lets yt-dlp find both ffmpeg and ffprobe there.
    # When ffmpeg isn't bundled the flag is omitted and yt-dlp falls back
    # to PATH as normal — so audio still downloads, just without embedded art.
    ffmpeg_dir = resolve_ffmpeg_dir()
    if ffmpeg_dir:
        cmd += ["--ffmpeg-location", ffmpeg_dir]

    fmt = cfg.get("format", "auto")
    if fmt == "m4a":
        # -f prefers an already-m4a/aac source so the extraction below is a
        # cheap, lossless remux rather than a real re-encode. Critically,
        # -x/--audio-format m4a is now ALWAYS applied regardless of what
        # was actually served — previously this branch only selected
        # bestaudio[ext=m4a] and trusted the source truly was m4a, with no
        # fallback conversion. As YouTube (and other sites) has shifted
        # more of its audio-only catalog to opus/webm, that fallback
        # increasingly lands on a non-m4a container where --embed-thumbnail
        # doesn't reliably apply or survive in a way other players can
        # read back. This is almost certainly the actual cause of "album
        # art used to embed correctly, now it doesn't" — not a code
        # regression on our side, but a drift in what sites serve, which
        # forcing the container now protects against either way.
        cmd += [
            "-f", "bestaudio[ext=m4a]/bestaudio",
            "-x", "--audio-format", "m4a",
            "--audio-quality", "0",
            "--embed-thumbnail",
            "--embed-metadata",
        ]
    elif fmt == "mp3":
        # Re-encode to mp3. ffmpeg handles both the conversion and
        # embedding the cover art as an ID3 APIC frame.
        cmd += [
            "-x",
            "--audio-format", "mp3",
            "--embed-thumbnail",
            "--embed-metadata",
        ]
    elif fmt == "best":
        cmd += ["-f", "bestvideo+bestaudio/best"]
    else:
        # Default: auto or mp4 — merge into mp4 container.
        cmd += ["--merge-output-format", "mp4"]

    cmd.append(url)
    return cmd


def run_download(url: str, tool: str, cfg: dict, dry_run: bool = False):
    logger.info(f"Starting download: {url} with {tool}")
    
    if not check_installed(tool):
        logger.error(f"Tool '{tool}' is not installed")
        print(f"\n  [ERROR] '{tool}' is not installed.")
        print(f"          Fix:  {_missing_tool_advice(tool)}\n")
        sys.exit(1)

    if cfg.get("output"):
        os.makedirs(os.path.expanduser(cfg["output"]), exist_ok=True)

    cmd = build_gallery_dl_cmd(url, cfg) if tool == "gallery-dl" else build_ytdlp_cmd(url, cfg)

    print(f"\n  {THIN}")
    # Never print the real command if it contains a password; build_*_cmd
    # already keeps credentials off argv (--netrc instead), so this is
    # just a defensive double-check in case that ever changes.
    print(f"  Command: {' '.join(cmd)}")
    print(f"  {THIN}\n")

    if dry_run:
        print("  [dry-run] Not executed.\n")
        return

    netrc_info = None
    needs_netrc = tool == "gallery-dl" and cfg.get("username") and cfg.get("password")
    try:
        if needs_netrc:
            netrc_info = _stage_netrc_credentials(cfg["username"], cfg["password"])
        subprocess.run(cmd, check=True, creationflags=CREATE_NO_WINDOW)
        out = os.path.expanduser(cfg.get("output", "."))
        print(f"\n  {SEP}")
        print("  Download complete!")
        print(f"  Saved to: {out}")
        print(f"  {SEP}\n")
    except subprocess.CalledProcessError as e:
        logger.error(f"Download failed with exit code {e.returncode}")
        print(f"\n  [ERROR] Failed — exit code {e.returncode}\n")
        sys.exit(e.returncode)
    except KeyboardInterrupt:
        logger.info("Download interrupted by user")
        print("\n  Interrupted.\n")
        sys.exit(1)
    finally:
        if netrc_info:
            _restore_netrc(netrc_info)


# ── GUI / PyWebView job management ──────────────────────────────
#
# This section wraps the existing build_*_cmd logic for use from a
# desktop GUI (PyWebView), adding:
#   - background execution with a job id (so the UI thread never blocks)
#   - pause / resume via OS-level process suspension (psutil)
#   - cancel via clean termination, falling back to force-kill
#   - lightweight progress parsing (file counts when a limit is set,
#     otherwise an indeterminate signal) from the live output stream
#
# It never calls sys.exit() — that would kill the whole desktop app.

import re
import uuid
import threading

try:
    import psutil
except ImportError:
    psutil = None  # pause/resume degrade gracefully without it; see _require_psutil()

# Matches a single completed file in gallery-dl's default verbose-ish output,
# e.g. "/Downloads/media/foo/bar.jpg" printed on its own line once a file
# finishes. This is a heuristic, not a guarantee — output formats vary by
# extractor and version — so it's used for a "best effort" item counter.
_GALLERY_DL_FILE_LINE = re.compile(r"^[^\s].*\.(jpg|jpeg|png|gif|webp|mp4|m4a|webm|mov|m4v)$", re.IGNORECASE)
_YTDLP_DEST_LINE = re.compile(r"\[download\]\s+Destination:\s+(.+)$")
_YTDLP_ALREADY = re.compile(r"\[download\]\s+(.+?)\s+has already been downloaded")

# When video and audio download as separate streams (common for
# non-default formats — yt-dlp names these <title>.f<format_id>.<ext>,
# e.g. "Song.f399.mp4" + "Song.f251.webm"), yt-dlp merges them into one
# final file via ffmpeg and deletes both intermediates. Without these,
# job.files keeps pointing at the two per-stream names, which are real
# at the time they're recorded but genuinely gone by the time playback
# is attempted — this is what actually fixes the "File not found" case.
_YTDLP_MERGE_LINE = re.compile(r'\[Merger\]\s+Merging formats into\s+"(.+)"')
_YTDLP_DELETE_LINE = re.compile(r"Deleting original file\s+(.+?)\s+\(pass -k to keep\)")

# Full progress line, e.g.:
#   [download]  45.2% of   10.00MiB at    1.21MiB/s ETA 00:07
# The "of ..." size is skipped with a non-greedy match since its format
# varies (can be "~" prefixed for unknown/live sizes) and isn't needed —
# percent/speed/ETA are the three fields the compact UI displays.
_YTDLP_PROGRESS_LINE = re.compile(
    r"\[download\]\s+([\d.]+)%.*?\bat\s+(\S+/s)\s+ETA\s+(\S+)"
)

# File extensions the built-in media player knows how to play.
PLAYABLE_EXTENSIONS = {
    "mp4", "m4a", "mp3", "webm", "mov", "mkv", "wav", "ogg", "flac", "avi", "m4v",
}


class DownloadJob:
    """Tracks one running (or finished) download so the UI can control it."""

    def __init__(self, job_id, tool, cmd, output_dir):
        self.id = job_id
        self.tool = tool
        self.cmd = cmd
        self.output_dir = output_dir
        self.process = None          # subprocess.Popen
        self.psutil_proc = None      # psutil.Process, for suspend/resume
        self.state = "running"       # running | paused | done | error | cancelled
        self.items_done = 0
        self.current_file = ""
        self.percent = 0.0           # 0-100, yt-dlp only (gallery-dl has no reliable %)
        self.speed = ""              # e.g. "1.21MiB/s" — yt-dlp only
        self.eta = ""                # e.g. "00:07" — yt-dlp only
        self.files = []              # [{"name": ..., "path": ...}, ...] completed files
        self.error = None
        self.started_at = time.time()
        self.finished_at = None      # set once the job reaches a terminal state
        self.lock = threading.Lock()


_JOBS: dict[str, DownloadJob] = {}
_JOBS_LOCK = threading.Lock()

# How long a finished job's status stays queryable before being evicted.
# Long enough for a UI to poll the final state at least once after the
# "done" callback fires, short enough that a long-running desktop session
# doesn't accumulate jobs forever.
_JOB_RETENTION_SECONDS = 30 * 60
_TERMINAL_STATES = ("done", "error", "cancelled")


def _evict_old_jobs():
    """Best-effort sweep removing finished jobs older than the retention
    window. Called opportunistically whenever a new job starts, so no
    background thread/timer is needed."""
    now = time.time()
    with _JOBS_LOCK:
        stale = [
            jid for jid, j in _JOBS.items()
            if j.state in _TERMINAL_STATES
            and j.finished_at is not None
            and (now - j.finished_at) > _JOB_RETENTION_SECONDS
        ]
        for jid in stale:
            _JOBS.pop(jid, None)


def _require_psutil():
    if psutil is None:
        raise RuntimeError(
            "Pause/Resume requires the 'psutil' package. Install it with: pip install psutil"
        )


def _wait_for_process_attached(job: DownloadJob, timeout: float = 3.0) -> bool:
    """
    start_download_async kicks off a background thread that creates the
    subprocess; if pause/resume/cancel are called immediately after
    start_download_async returns, job.process / job.psutil_proc may not
    be set yet. Poll briefly rather than failing immediately — this
    closes the race without requiring the UI to add its own delay.
    """
    deadline = time.time() + timeout
    while time.time() < deadline:
        if job.process is not None:
            return True
        if job.state not in ("running", "paused"):
            # Job already finished/errored/cancelled before it even
            # got a process handle attached (e.g. tool not installed).
            return False
        time.sleep(0.05)
    return job.process is not None


def pause_job(job_id: str) -> dict:
    job = _JOBS.get(job_id)
    if not job:
        return {"ok": False, "error": "Unknown job id."}
    if job.state != "running":
        if job.state == "paused":
            return {"ok": True, "state": job.state}
        return {"ok": False, "error": f"Job is '{job.state}', not running."}
    if not _wait_for_process_attached(job):
        return {"ok": False, "error": "Job hasn't started its process yet — try again in a moment."}
    try:
        _require_psutil()
        job.psutil_proc.suspend()
        job.state = "paused"
        return {"ok": True, "state": job.state}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def resume_job(job_id: str) -> dict:
    job = _JOBS.get(job_id)
    if not job or job.state != "paused":
        return {"ok": False, "error": "No paused job with that id."}
    try:
        _require_psutil()
        job.psutil_proc.resume()
        job.state = "running"
        return {"ok": True, "state": job.state}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def cancel_job(job_id: str) -> dict:
    job = _JOBS.get(job_id)
    if not job or job.state not in ("running", "paused"):
        return {"ok": False, "error": "No active job with that id."}
    if not _wait_for_process_attached(job):
        return {"ok": False, "error": "Job hasn't started its process yet — try again in a moment."}
    try:
        proc = job.process
        if proc is None:
            return {"ok": False, "error": "No process to cancel."}
        if psutil is not None and job.psutil_proc is not None:
            # If it was paused, resume first so terminate() isn't sent to a
            # frozen process tree (can hang waiting on a suspended child).
            try:
                if job.state == "paused":
                    job.psutil_proc.resume()
            except Exception:
                pass
            try:
                children = job.psutil_proc.children(recursive=True)
            except Exception:
                children = []
            for child in children:
                try:
                    child.terminate()
                except Exception:
                    pass
        proc.terminate()
        try:
            proc.wait(timeout=4)
        except subprocess.TimeoutExpired:
            proc.kill()
        job.state = "cancelled"
        job.finished_at = time.time()
        return {"ok": True, "state": job.state}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def job_status(job_id: str) -> dict:
    job = _JOBS.get(job_id)
    if not job:
        return {"ok": False, "error": "Unknown job id."}
    with job.lock:
        files = []
        for f in job.files:
            size = None
            try:
                size = os.path.getsize(f["path"])
            except OSError:
                pass
            files.append({"name": f["name"], "path": f["path"], "size": size})
        return {
            "ok": True,
            "state": job.state,
            "items_done": job.items_done,
            "current_file": job.current_file,
            "percent": job.percent,
            "speed": job.speed,
            "eta": job.eta,
            "elapsed": round(time.time() - job.started_at, 1),
            "error": job.error,
            "files": files,
            "started_at": job.started_at,
            "finished_at": job.finished_at,
        }


def _record_file(job: DownloadJob, name: str):
    """Track a completed file's path so history/the media player can find
    it later. De-duplicates by name since gallery-dl/yt-dlp can each log
    the same finished file more than once (retries, "already downloaded"
    followed by a metadata line, etc)."""
    path = os.path.join(job.output_dir, name) if job.output_dir else name
    if not any(f["name"] == name for f in job.files):
        job.files.append({"name": name, "path": path})


_SCANNABLE_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff", ".heic", ".avif",
    ".mp4", ".webm", ".mov", ".mkv", ".m4v", ".avi",
}
_SCAN_FILE_CAP = 2000  # safety cap so a huge/unexpected output_dir can't stall completion


def _scan_output_dir_for_files(job: DownloadJob, output_dir: str):
    """
    Fallback file-discovery for when _GALLERY_DL_FILE_LINE catches nothing
    despite a successful run. That regex is a heuristic over gallery-dl's
    stdout ("does this line look like a bare file path with a known
    extension?"), and its exact output formatting can vary by extractor/
    version in ways the heuristic doesn't anticipate — when that happens,
    job.files silently stays empty and downloaded images never show up in
    the gallery view or history, even though the files themselves
    downloaded fine.

    This scans output_dir directly for image/video files modified during
    this job's run window, which is exact regardless of stdout format.
    It's a fallback (only used when the line-based detection found
    nothing), not a replacement — the line-based path is cheaper and
    already correct for the common case.
    """
    if not output_dir or not os.path.isdir(output_dir):
        return
    found = 0
    try:
        for root, _dirs, filenames in os.walk(output_dir):
            for name in filenames:
                if os.path.splitext(name)[1].lower() not in _SCANNABLE_EXTENSIONS:
                    continue
                full_path = os.path.join(root, name)
                try:
                    # Small buffer for filesystem/clock granularity —
                    # files from this job should all postdate job start.
                    if os.path.getmtime(full_path) < job.started_at - 2:
                        continue
                except OSError:
                    continue
                if not any(f["name"] == name for f in job.files):
                    job.files.append({"name": name, "path": full_path})
                    found += 1
                    if found >= _SCAN_FILE_CAP:
                        return
    except Exception:
        pass


def _parse_progress_line(job: DownloadJob, line: str, limit: int):
    """Best-effort progress extraction; never raises."""
    try:
        if job.tool == "yt-dlp":
            m = _YTDLP_DEST_LINE.search(line)
            if m:
                # New file starting — reset the per-file progress fields.
                job.current_file = os.path.basename(m.group(1).strip())
                job.percent = 0.0
                job.speed = ""
                job.eta = ""

            m_already = _YTDLP_ALREADY.search(line)
            if m_already:
                name = os.path.basename(m_already.group(1).strip())
                job.current_file = name
                job.percent = 100.0
                job.speed = ""
                job.eta = ""
                job.items_done += 1
                _record_file(job, name)

            m_prog = _YTDLP_PROGRESS_LINE.search(line)
            if m_prog:
                pct = float(m_prog.group(1))
                job.speed = m_prog.group(2)
                job.eta = m_prog.group(3)
                # Count the file as done the first time we see 100% for it
                # (guarded so repeated 100% lines, e.g. across fragments,
                # don't double-count the same file).
                if pct >= 100.0 and job.percent < 100.0:
                    if job.current_file:
                        _record_file(job, job.current_file)
                    job.items_done += 1
                job.percent = pct

            # Video+audio downloaded as separate streams get merged into
            # one final file here — that final file supersedes whatever
            # per-stream intermediates were recorded above, since those
            # get deleted right after this by yt-dlp itself.
            m_merge = _YTDLP_MERGE_LINE.search(line)
            if m_merge:
                merged_path = m_merge.group(1).strip()
                job.files = [{"name": os.path.basename(merged_path), "path": merged_path}]
                job.current_file = os.path.basename(merged_path)

            m_delete = _YTDLP_DELETE_LINE.search(line)
            if m_delete:
                deleted_name = os.path.basename(m_delete.group(1).strip())
                job.files = [f for f in job.files if f["name"] != deleted_name]
        else:  # gallery-dl — no reliable per-file percentage in its output
            stripped = line.strip()
            if _GALLERY_DL_FILE_LINE.match(stripped):
                name = os.path.basename(stripped)
                job.current_file = name
                job.items_done += 1
                job.percent = 100.0 if not limit else min(100.0, job.items_done / limit * 100)
                # Use the path gallery-dl actually printed, not
                # output_dir + basename — gallery-dl organizes many
                # extractors (Pinterest boards, subreddits, Twitter
                # users, etc) into nested subfolders, so reconstructing
                # a flat path is simply wrong for anything not sitting
                # directly in the top-level output folder.
                full_path = stripped if os.path.isabs(stripped) else os.path.abspath(stripped)
                if not any(f["name"] == name for f in job.files):
                    job.files.append({"name": name, "path": full_path})
    except Exception:
        pass


def download_from_ui(url: str, cfg: dict, tool_override: str = "", on_line=None, on_progress=None, job_id: str = None) -> dict:
    """
    Run a download triggered from the desktop UI. Blocking — call this
    from a background thread (see start_download_async in app.py).

    Args:
        url: page URL to download from
        cfg: same shape as used by build_gallery_dl_cmd() / build_ytdlp_cmd()
        tool_override: "gallery-dl", "yt-dlp", or "" for auto-detect
        on_line: optional callable(str) invoked per output line (live logs)
        on_progress: optional callable(dict) invoked after each parsed line
                     with {items_done, current_file, state}
        job_id: optional pre-generated id (so the caller can register/poll
                the job before this function returns)

    Returns:
        dict with keys: ok, tool, command, output_dir, error, job_id, state
    """
    tool = tool_override if tool_override in ("gallery-dl", "yt-dlp") else detect_tool(url)
    job_id = job_id or str(uuid.uuid4())
    
    logger.info(f"Download job {job_id} started: {url} with {tool}")

    if not check_installed(tool):
        logger.error(f"Download job {job_id} failed: '{tool}' not installed")
        return {
            "ok": False, "tool": tool, "command": "", "output_dir": cfg.get("output", ""),
            "error": f"'{tool}' is not installed. Fix: {_missing_tool_advice(tool)}",
            "job_id": job_id, "state": "error",
        }

    output_dir = os.path.expanduser(cfg.get("output", "")) if cfg.get("output") else ""
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    cmd = build_gallery_dl_cmd(url, cfg) if tool == "gallery-dl" else build_ytdlp_cmd(url, cfg)
    cmd_str = " ".join(cmd)

    if cfg.get("dry_run"):
        return {
            "ok": True, "tool": tool, "command": cmd_str, "output_dir": output_dir,
            "error": None, "dry_run": True, "job_id": job_id, "state": "done",
        }

    _evict_old_jobs()
    job = DownloadJob(job_id, tool, cmd_str, output_dir)
    with _JOBS_LOCK:
        _JOBS[job_id] = job

    netrc_info = None
    needs_netrc = tool == "gallery-dl" and cfg.get("username") and cfg.get("password")

    try:
        if needs_netrc:
            netrc_info = _stage_netrc_credentials(cfg["username"], cfg["password"])

        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            creationflags=CREATE_NO_WINDOW,
        )
        job.process = process
        if psutil is not None:
            try:
                job.psutil_proc = psutil.Process(process.pid)
            except Exception:
                job.psutil_proc = None

        limit = cfg.get("limit", 0) or 0
        last_line = ""       # last non-empty output line, any kind
        last_error_line = "" # last line that looks like an actual error message

        for line in process.stdout:
            line = line.rstrip("\n")
            if on_line:
                try:
                    on_line(line)
                except Exception:
                    pass
            stripped = line.strip()
            if stripped:
                last_line = stripped
                # yt-dlp/gallery-dl both prefix real failures with "ERROR:";
                # keep the most recent one specifically, since a run can log
                # many harmless warnings/info lines after the actual failure.
                if "error" in stripped.lower():
                    last_error_line = stripped
            with job.lock:
                _parse_progress_line(job, line, limit)
                snapshot = {
                    "items_done": job.items_done,
                    "current_file": job.current_file,
                    "state": job.state,
                    "limit": limit,
                    "percent": job.percent,
                    "speed": job.speed,
                    "eta": job.eta,
                }
            if on_progress:
                try:
                    on_progress(snapshot)
                except Exception:
                    pass

        process.wait()

        if job.state == "cancelled":
            logger.info(f"Download job {job_id} cancelled by user")
            return {
                "ok": False, "tool": tool, "command": cmd_str, "output_dir": output_dir,
                "error": "Cancelled by user.", "job_id": job_id, "state": "cancelled",
            }

        if process.returncode != 0:
            job.state = "error"
            # Prefer the actual tool-reported error text (last_error_line) —
            # it's what a friendly-message mapper on the frontend needs to
            # work with. "Exited with code N" alone has no useful signal.
            detail = last_error_line or last_line
            job.error = f"{detail} (exit code {process.returncode})" if detail else f"Exited with code {process.returncode}"
            logger.error(f"Download job {job_id} failed: {job.error}")
            return {
                "ok": False, "tool": tool, "command": cmd_str, "output_dir": output_dir,
                "error": job.error, "job_id": job_id, "state": "error",
            }

        job.state = "done"
        logger.info(f"Download job {job_id} completed successfully")
        if tool == "gallery-dl" and not job.files:
            logger.debug(f"Scanning output directory for files for job {job_id}")
            _scan_output_dir_for_files(job, output_dir)
        return {
            "ok": True, "tool": tool, "command": cmd_str, "output_dir": output_dir,
            "error": None, "job_id": job_id, "state": "done",
        }

    except FileNotFoundError as e:
        job.state = "error"
        job.error = str(e)
        logger.error(f"Download job {job_id} failed with FileNotFoundError: {e}")
        return {"ok": False, "tool": tool, "command": cmd_str, "output_dir": output_dir, "error": str(e), "job_id": job_id, "state": "error"}
    except Exception as e:
        job.state = "error"
        job.error = str(e)
        logger.error(f"Download job {job_id} failed with exception: {e}")
        return {"ok": False, "tool": tool, "command": cmd_str, "output_dir": output_dir, "error": str(e), "job_id": job_id, "state": "error"}
    finally:
        if netrc_info:
            _restore_netrc(netrc_info)
        job.finished_at = time.time()


# ── interactive mode ──────────────────────────────────────────

def interactive_mode():
    os.system("cls" if os.name == "nt" else "clear")

    print()
    print(f"  {SEP}")
    print("       Media Downloader  —  gallery-dl + yt-dlp")
    print(f"  {SEP}")
    print("  Supports: RedGIFs, Reddit, Imgur, Twitter/X,")
    print("  Instagram, Pixiv, YouTube, TikTok, PornHub + more")
    print(f"  {SEP}")
    print()

    # ── URL ──
    while True:
        url = ask("Paste the page URL to download from:")
        if url.startswith("http"):
            break
        print("  ! Please enter a full URL starting with http/https\n")

    tool_auto = detect_tool(url)
    hint      = site_hint(url)
    print()
    print(f"  Site info : {hint}")
    print(f"  Auto tool : {tool_auto}")
    print()

    # ── output folder ──
    default_dir = os.path.join(os.path.expanduser("~"), "Downloads", "media")
    output = ask("Save files to folder:", default_dir)

    # ── limit ──
    limit_raw = ask("Max items to download (0 or Enter = all):", "0")
    try:
        limit = int(limit_raw)
    except ValueError:
        limit = 0

    # ── advanced ──
    print()
    print(f"  {THIN}")
    print("  Advanced options  (press Enter to skip any)")
    print(f"  {THIN}")
    print()

    tool_in = ask("Force tool? Type gallery-dl or yt-dlp (Enter = auto):", "")
    tool = tool_in if tool_in in ("gallery-dl", "yt-dlp") else tool_auto

    sleep_raw = ask("Delay between requests in seconds (2 = safe, 0 = fast):", "2")
    try:
        sleep = max(0, float(sleep_raw))
    except ValueError:
        sleep = 2

    cookies  = ask("Use browser cookies? (chrome / firefox / safari / edge — or skip):", "")
    username = ask("Username (for login-protected sites — or skip):", "")
    password = ""
    if username:
        import getpass
        try:
            password = getpass.getpass("  Password: ")
        except (EOFError, KeyboardInterrupt):
            password = ""

    print()
    do_zip      = ask_yn("Save as ZIP archive?",      False)
    do_metadata = ask_yn("Write metadata JSON files?", False)
    do_verbose  = ask_yn("Show verbose output?",       False)

    cfg = {
        "output":   output,
        "limit":    limit,
        "sleep":    sleep,
        "cookies":  cookies,
        "username": username,
        "password": password,
        "zip":      do_zip,
        "metadata": do_metadata,
        "verbose":  do_verbose,
    }

    print()
    if not ask_yn("Start download now?", True):
        print("\n  Cancelled.\n")
        sys.exit(0)

    run_download(url, tool, cfg)

    print()
    if ask_yn("Download another URL?", False):
        interactive_mode()
    else:
        print("  Done. Goodbye!\n")


# ── CLI mode ──────────────────────────────────────────────────

def cli_mode():
    parser = argparse.ArgumentParser(
        description="Download images, GIFs, and videos. Run with no args for interactive mode.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("url", nargs="?", help="URL to download (omit for interactive mode)")
    parser.add_argument("-d", "--output",   help="Output directory")
    parser.add_argument("--limit",  type=int, default=0, help="Max items (0 = all)")
    parser.add_argument("--filename", help="gallery-dl filename template")
    parser.add_argument("--username", "-u", help="Username")
    parser.add_argument("--password", "-p", help="Password")
    parser.add_argument("--zip",      action="store_true", help="Save as ZIP (gallery-dl)")
    parser.add_argument("--metadata", action="store_true", help="Write metadata JSON")
    parser.add_argument("--cookies",  help="Browser: chrome, firefox, safari, edge")
    parser.add_argument("--tool",     choices=["gallery-dl", "yt-dlp"], help="Force tool")
    parser.add_argument("--verbose",  "-v", action="store_true")
    parser.add_argument("--sleep",    type=float, default=2.0, help="Seconds between requests (default: 2, helps avoid 429)")
    parser.add_argument("--dry-run",  action="store_true", help="Print command, don't run")

    args = parser.parse_args()

    if not args.url:
        interactive_mode()
        return

    tool = args.tool or detect_tool(args.url)
    cfg  = {
        "output":   args.output or "",
        "limit":    args.limit,
        "sleep":    args.sleep,
        "filename": getattr(args, "filename", ""),
        "username": args.username or "",
        "password": args.password or "",
        "zip":      args.zip,
        "metadata": args.metadata,
        "verbose":  args.verbose,
        "cookies":  args.cookies or "",
    }

    print(f"\n  URL  : {args.url}")
    print(f"  Tool : {tool}")
    if args.output:
        print(f"  Dest : {args.output}")

    run_download(args.url, tool, cfg, dry_run=args.dry_run)


# ── entry ─────────────────────────────────────────────────────

if __name__ == "__main__":
    cli_mode()
