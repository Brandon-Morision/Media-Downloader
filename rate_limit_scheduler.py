"""
rate_limit_scheduler.py
-----------------------
Intelligent rate limit detection and automatic scheduler for NovaDrop.
Detects gallery-dl and yt-dlp rate limits (e.g. Tumblr, Twitter/X, Instagram,
Pixiv, Reddit, 429 Too Many Requests), extracts reset timestamps, and schedules
downloads to automatically resume when limits reset with user notifications.
"""

import os
import sys
import re
import json
import time
import threading
from datetime import datetime, timedelta
from logger import get_logger

logger = get_logger(__name__)

# File persistence path for scheduled jobs
_DATA_DIR = os.path.join(os.path.expanduser("~"), ".novadrop")
_SCHEDULE_FILE = os.path.join(_DATA_DIR, "scheduled_jobs.json")


def parse_rate_limit(error_text: str):
    """
    Analyzes an error message from gallery-dl or yt-dlp to detect rate limits.
    Returns dict with target_timestamp, reset_time_str, and seconds_remaining,
    or None if the error is not a rate limit.
    """
    if not error_text:
        return None

    text = str(error_text).strip()
    now = datetime.now()
    now_ts = time.time()
    target_ts = None
    reset_str = None

    # 1. Date + Time: "reset at 2026-10-07 20:05:01" or "reset at 2026/10/07 20:05:01"
    match_dt = re.search(r'reset\s+(?:will\s+reset\s+)?at\s+(\d{4}[-/]\d{2}[-/]\d{2}\s+\d{1,2}:\d{2}(?::\d{2})?)', text, re.I)
    if match_dt:
        dt_str = match_dt.group(1).replace("/", "-")
        fmt = "%Y-%m-%d %H:%M:%S" if dt_str.count(":") == 2 else "%Y-%m-%d %H:%M"
        try:
            target_dt = datetime.strptime(dt_str, fmt)
            target_ts = target_dt.timestamp() + 15
            reset_str = target_dt.strftime("%H:%M:%S")
        except Exception:
            pass

    # 2. Time only: "Rate limit will reset at 20:05:01", "reset at 20:05:01", "reset at 8:05 PM"
    if not target_ts:
        match_time = re.search(r'(?:rate\s+limit.*?reset\s+(?:will\s+reset\s+)?at|reset\s+at|resets?\s+at)\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]m)?)', text, re.I)
        if not match_time:
            match_time = re.search(r'at\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]m)?)', text, re.I)

        if match_time:
            t_str = match_time.group(1).strip()
            try:
                # Handle AM/PM if present
                if "am" in t_str.lower() or "pm" in t_str.lower():
                    clean_t = t_str.upper()
                    t_fmt = "%I:%M:%S %p" if clean_t.count(":") == 2 else "%I:%M %p"
                    parsed_t = datetime.strptime(clean_t, t_fmt).time()
                    target_h, target_m, target_s = parsed_t.hour, parsed_t.minute, parsed_t.second
                else:
                    parts = [int(p) for p in t_str.split(":")]
                    target_h = parts[0]
                    target_m = parts[1]
                    target_s = parts[2] if len(parts) > 2 else 0

                target_dt = now.replace(hour=target_h, minute=target_m, second=target_s, microsecond=0)
                # If target time is earlier than now, it resets tomorrow
                if target_dt <= now:
                    target_dt += timedelta(days=1)

                # Add 15 second grace period
                target_ts = target_dt.timestamp() + 15
                reset_str = target_dt.strftime("%H:%M:%S")
            except Exception as e:
                logger.debug(f"Failed to parse time string '{t_str}': {e}")

    # 3. Relative intervals: "reset in 15 minutes", "retry after 300 seconds", "sleeping for 1 hour"
    if not target_ts:
        match_rel = re.search(r'(?:reset\s+in|retry\s+after|sleep(?:ing)?\s+for|wait\s+for)\s+(\d+)\s*(s(?:ec)?|m(?:in)?|h(?:our)?|seconds?|minutes?|hours?)', text, re.I)
        if match_rel:
            val = int(match_rel.group(1))
            unit = match_rel.group(2).lower()
            if unit.startswith('s'):
                secs = val
            elif unit.startswith('m'):
                secs = val * 60
            elif unit.startswith('h'):
                secs = val * 3600
            else:
                secs = val * 60

            target_ts = now_ts + secs + 15
            target_dt = datetime.fromtimestamp(target_ts)
            reset_str = target_dt.strftime("%H:%M:%S")

    # 4. Generic 429 Too Many Requests / Rate limit error without explicit time
    if not target_ts:
        is_rate_limited = (
            "rate limit" in text.lower()
            or "too many requests" in text.lower()
            or "429" in text
            or "exit code 4" in text.lower()
        )
        if is_rate_limited:
            # Default to 15 minutes
            secs = 15 * 60
            target_ts = now_ts + secs + 15
            target_dt = datetime.fromtimestamp(target_ts)
            reset_str = target_dt.strftime("%H:%M:%S")

    if target_ts:
        secs_remaining = max(0, int(target_ts - now_ts))
        return {
            "target_timestamp": target_ts,
            "reset_time_str": reset_str or datetime.fromtimestamp(target_ts).strftime("%H:%M:%S"),
            "seconds_remaining": secs_remaining,
            "error_text": text,
        }

    return None


class RateLimitScheduler:
    def __init__(self):
        self._jobs = {}
        self._lock = threading.Lock()
        self._on_notify_cb = None
        self._on_start_cb = None
        self._running = False
        self._thread = None
        self._load_from_disk()

    def set_callbacks(self, on_notify=None, on_start=None):
        """Set event callbacks for scheduler triggers."""
        self._on_notify_cb = on_notify
        self._on_start_cb = on_start

    def start(self):
        """Start the background scheduler thread."""
        if not self._running:
            self._running = True
            self._thread = threading.Thread(target=self._run_loop, daemon=True, name="RateLimitScheduler")
            self._thread.start()
            logger.info("RateLimitScheduler background thread started")

    def stop(self):
        self._running = False

    def schedule(self, job_id: str, url: str, cfg: dict, tool: str, reset_info: dict, title: str = None, history_id: str = None):
        """Schedule a job to automatically resume when rate limit resets."""
        with self._lock:
            target_ts = reset_info["target_timestamp"]
            reset_str = reset_info["reset_time_str"]
            job_data = {
                "job_id": job_id,
                "url": url,
                "cfg": cfg or {},
                "tool": tool or "",
                "title": title or url,
                "history_id": history_id,
                "target_timestamp": target_ts,
                "reset_time_str": reset_str,
                "scheduled_at": time.time(),
                "pre_notified": False,
                "error": reset_info.get("error_text", ""),
            }
            self._jobs[job_id] = job_data
            self._save_to_disk()

        logger.info(f"Scheduled rate-limited job {job_id} ({url}) to restart at {reset_str} (in {reset_info['seconds_remaining']}s)")
        return job_data

    def cancel(self, job_id: str):
        """Cancel a scheduled job."""
        with self._lock:
            if job_id in self._jobs:
                removed = self._jobs.pop(job_id)
                self._save_to_disk()
                logger.info(f"Cancelled scheduled job {job_id}")
                return True
        return False

    def get_job(self, job_id: str):
        with self._lock:
            return self._jobs.get(job_id)

    def list_jobs(self):
        """Return all scheduled jobs with updated seconds_remaining."""
        now = time.time()
        with self._lock:
            out = []
            for jid, item in self._jobs.items():
                copy = dict(item)
                copy["seconds_remaining"] = max(0, int(copy["target_timestamp"] - now))
                out.append(copy)
            return out

    def _save_to_disk(self):
        """Persist scheduled jobs so app restarts preserve the schedule."""
        try:
            os.makedirs(_DATA_DIR, exist_ok=True)
            with open(_SCHEDULE_FILE, "w", encoding="utf-8") as f:
                json.dump(self._jobs, f, indent=2)
        except Exception as e:
            logger.debug(f"Failed to save scheduled jobs to disk: {e}")

    def _load_from_disk(self):
        """Load pending scheduled jobs from disk."""
        if os.path.isfile(_SCHEDULE_FILE):
            try:
                with open(_SCHEDULE_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    now = time.time()
                    # Filter out jobs that expired more than 1 hour ago
                    valid = {}
                    for jid, job in data.items():
                        if job.get("target_timestamp", 0) > now - 3600:
                            valid[jid] = job
                    self._jobs = valid
                logger.info(f"Loaded {len(self._jobs)} scheduled rate-limited jobs from disk")
            except Exception as e:
                logger.debug(f"Failed to load scheduled jobs from disk: {e}")

    def _run_loop(self):
        """Worker loop checking for pre-notifications and job start times."""
        while self._running:
            try:
                now = time.time()
                ready_to_start = []
                need_pre_notify = []

                with self._lock:
                    for jid, job in list(self._jobs.items()):
                        target_ts = job.get("target_timestamp", 0)
                        diff = target_ts - now

                        # 1. Pre-notification: 60 seconds or less before starting
                        if diff <= 60 and not job.get("pre_notified"):
                            job["pre_notified"] = True
                            need_pre_notify.append(dict(job))

                        # 2. Time to start: diff <= 0
                        if diff <= 0:
                            ready_to_start.append(dict(job))
                            del self._jobs[jid]

                    if ready_to_start or need_pre_notify:
                        self._save_to_disk()

                # Process pre-notifications (outside lock)
                for job in need_pre_notify:
                    if self._on_notify_cb:
                        try:
                            self._on_notify_cb(job)
                        except Exception as e:
                            logger.error(f"Error in scheduler on_notify callback: {e}")

                # Process job starts (outside lock)
                for job in ready_to_start:
                    if self._on_start_cb:
                        try:
                            self._on_start_cb(job)
                        except Exception as e:
                            logger.error(f"Error in scheduler on_start callback: {e}")

            except Exception as e:
                logger.debug(f"Error in scheduler loop: {e}")

            time.sleep(3)


scheduler = RateLimitScheduler()
