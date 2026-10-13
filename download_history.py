#!/usr/bin/env python3
"""
download_history.py
--------------------
Persistent download-history store for the desktop UI.

Records one entry per finished queue item (done / error / cancelled):
source URL, tool used, output directory, the file(s) produced, total
size, and timestamps. Backed by a single JSON file.

Deliberately stored under the user's home directory rather than next to
the app/exe — the install location (e.g. Program Files) may be
read-only, same reasoning as why _stage_netrc_credentials and other
writes in media_downloader.py avoid the app directory.
"""

import json
import os
import shutil
import threading
import time
import uuid
from logger import get_logger

logger = get_logger(__name__)

_LOCK = threading.Lock()

# Cap on stored entries so the file can't grow forever across years of use.
_MAX_ENTRIES = 2000


def _history_dir() -> str:
    base = os.path.join(os.path.expanduser("~"), ".media_downloader")
    os.makedirs(base, exist_ok=True)
    return base


def _history_path() -> str:
    return os.path.join(_history_dir(), "history.json")


def _backup_path() -> str:
    return os.path.join(_history_dir(), "history.json.bak")


_LAST_CORRUPT_QUARANTINE = None
_LAST_STATUS = "healthy"  # "healthy", "recovered_from_backup", "corrupt_unrecoverable"


def get_status() -> dict:
    """Return health status of history storage, including any quarantine file path."""
    with _LOCK:
        return {
            "status": _LAST_STATUS,
            "corrupt_quarantine": _LAST_CORRUPT_QUARANTINE,
            "backup_exists": os.path.isfile(_backup_path()),
        }


def _try_read_json_list(filepath: str) -> list:
    """Read and validate that a file contains a JSON list. Returns None if invalid or missing."""
    if not os.path.isfile(filepath):
        return None
    try:
        if os.path.getsize(filepath) == 0:
            return []
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, list):
            return data
        logger.warning(f"History file {filepath} is not a JSON list (got {type(data).__name__})")
        return None
    except Exception as e:
        logger.warning(f"Failed to read/parse history JSON from {filepath}: {e}")
        return None


def _load() -> list:
    global _LAST_STATUS, _LAST_CORRUPT_QUARANTINE
    path = _history_path()
    if not os.path.isfile(path):
        return []

    # 1. Try loading primary history file
    try:
        if os.path.getsize(path) == 0:
            return []
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, list):
            _LAST_STATUS = "healthy"
            return data
        logger.error(f"History file {path} contains invalid root type: {type(data).__name__}")
    except PermissionError as e:
        logger.error(f"Cannot read history file {path} (permission denied): {e}")
        raise
    except Exception as e:
        logger.error(f"Corrupt or unreadable history file {path}: {e}")

    # Primary file exists and is non-empty, but failed to load or validate.
    # 2. Preserve corrupt file before any recovery or write attempt
    timestamp_str = time.strftime("%Y%m%d_%H%M%S")
    corrupt_backup = f"{path}.corrupt.{timestamp_str}_{uuid.uuid4().hex[:8]}"
    _LAST_CORRUPT_QUARANTINE = corrupt_backup
    try:
        shutil.copy2(path, corrupt_backup)
        logger.warning(f"Preserved corrupt history file to {corrupt_backup}")
    except Exception as copy_err:
        logger.error(f"Failed to preserve corrupt history file: {copy_err}")

    # 3. Attempt recovery from backup (.bak)
    bak = _backup_path()
    bak_data = _try_read_json_list(bak)
    if bak_data is not None:
        _LAST_STATUS = "recovered_from_backup"
        logger.info(f"Successfully recovered {len(bak_data)} history entries from backup {bak}")
        try:
            _save(bak_data)
        except Exception as save_err:
            logger.error(f"Failed to restore recovered backup to primary: {save_err}")
        return bak_data

    # Corrupt file safely preserved, but no usable backup exists
    _LAST_STATUS = "corrupt_unrecoverable"
    logger.warning("History file is corrupt and no usable backup exists; preserved to quarantine.")
    return []


def _save(entries: list) -> None:
    if not isinstance(entries, list):
        raise ValueError(f"entries must be a list, got {type(entries).__name__}")

    path = _history_path()
    bak = _backup_path()
    tmp = path + f".tmp.{os.getpid()}"

    # 1. Write to temporary file with flush and sync
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(entries, f, indent=2)
            f.flush()
            os.fsync(f.fileno())
    except Exception as e:
        if os.path.isfile(tmp):
            try:
                os.remove(tmp)
            except OSError:
                pass
        logger.error(f"Failed to write history tmp file {tmp}: {e}")
        raise

    # 2. Update backup file only if primary is currently a valid history file (prevents backup poisoning)
    if os.path.isfile(path) and os.path.getsize(path) > 0:
        if _try_read_json_list(path) is not None:
            try:
                shutil.copy2(path, bak)
            except Exception as e:
                logger.debug(f"Failed to create history backup {bak}: {e}")

    # 3. Atomic replacement
    try:
        os.replace(tmp, path)
    except Exception as e:
        if os.path.isfile(tmp):
            try:
                os.remove(tmp)
            except OSError:
                pass
        logger.error(f"Failed to atomically replace history file {path}: {e}")
        raise


def add_entry(entry: dict) -> str:
    """Insert a new history entry (newest first). Returns its id."""
    entry_id = entry.get("id") or str(uuid.uuid4())
    entry["id"] = entry_id
    with _LOCK:
        try:
            entries = _load()
        except PermissionError:
            logger.error("Skipping add_entry because history file is unreadable.")
            return entry_id
        entries.insert(0, entry)
        if len(entries) > _MAX_ENTRIES:
            entries = entries[:_MAX_ENTRIES]
        _save(entries)
    return entry_id


def update_entry(entry_id: str, updates: dict) -> bool:
    """Update fields on an existing history entry by ID. Returns True if found."""
    if not entry_id:
        return False
    with _LOCK:
        try:
            entries = _load()
        except PermissionError:
            logger.error("Skipping update_entry because history file is unreadable.")
            return False
        for e in entries:
            if e.get("id") == entry_id:
                e.update(updates)
                _save(entries)
                return True
        return False


def get_entry(entry_id: str) -> dict:
    """Retrieve a single history entry by ID, or None if not found."""
    if not entry_id:
        return None
    with _LOCK:
        try:
            entries = _load()
        except PermissionError:
            logger.error("Skipping get_entry because history file is unreadable.")
            return None
        for e in entries:
            if e.get("id") == entry_id:
                return dict(e)
        return None


def list_entries() -> list:
    with _LOCK:
        try:
            return _load()
        except PermissionError:
            logger.error("Skipping list_entries because history file is unreadable.")
            return []


def delete_entry(entry_id: str) -> bool:
    with _LOCK:
        try:
            entries = _load()
        except PermissionError:
            logger.error("Skipping delete_entry because history file is unreadable.")
            return False
        filtered = [e for e in entries if e.get("id") != entry_id]
        changed = len(filtered) != len(entries)
        if changed:
            _save(filtered)
        return changed


def clear_all() -> int:
    with _LOCK:
        try:
            entries = _load()
        except PermissionError:
            logger.error("Skipping clear_all because history file is unreadable.")
            return 0
        _save([])
        return len(entries)


def list_quarantines() -> list:
    """Return list of quarantined corrupt history file paths, sorted newest first."""
    hdir = _history_dir()
    if not os.path.isdir(hdir):
        return []
    quarantines = []
    for fn in os.listdir(hdir):
        if fn.startswith("history.json.corrupt."):
            quarantines.append(os.path.join(hdir, fn))
    quarantines.sort(key=lambda p: os.path.getmtime(p) if os.path.exists(p) else 0, reverse=True)
    return quarantines


def salvage_corrupt_history(target_file: str = None) -> dict:
    """Attempt best-effort salvage of entries from a quarantined corrupt history file."""
    with _LOCK:
        if not target_file:
            quarantines = list_quarantines()
            if not quarantines:
                return {"ok": False, "error": "No quarantined history files found to salvage."}
            target_file = quarantines[0]

        if target_file:
            norm_target = os.path.normcase(os.path.abspath(target_file))
            norm_dir = os.path.normcase(os.path.abspath(_history_dir()))
            fn = os.path.basename(target_file)
            if not norm_target.startswith(norm_dir) or not fn.startswith("history.json.corrupt."):
                return {"ok": False, "error": "Invalid quarantine file: must be a quarantined history file."}

        if not os.path.isfile(target_file):
            return {"ok": False, "error": f"Quarantine file does not exist: {target_file}"}

        salvaged_entries = []
        try:
            with open(target_file, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()

            # Attempt 1: Full JSON parse
            try:
                parsed = json.loads(content)
                if isinstance(parsed, list):
                    salvaged_entries = [item for item in parsed if isinstance(item, dict)]
            except Exception:
                pass

            # Attempt 2: If full JSON parse failed, extract valid JSON objects via regex
            if not salvaged_entries:
                import re
                object_candidates = re.findall(r"\{[^{}]*\}", content)
                for cand in object_candidates:
                    try:
                        item = json.loads(cand)
                        if isinstance(item, dict) and ("url" in item or "id" in item or "filename" in item):
                            salvaged_entries.append(item)
                    except Exception:
                        continue

            if not salvaged_entries:
                return {"ok": False, "error": "No recoverable entries found in quarantined file."}

            current_entries = []
            try:
                current_entries = _load()
            except Exception:
                current_entries = []

            existing_ids = {e.get("id") for e in current_entries if isinstance(e, dict) and e.get("id")}
            added = 0
            for item in salvaged_entries:
                if not item.get("id"):
                    item["id"] = f"salvaged-{uuid.uuid4().hex[:8]}"
                if item["id"] not in existing_ids:
                    current_entries.append(item)
                    existing_ids.add(item["id"])
                    added += 1

            if added > 0:
                _save(current_entries)
                logger.info(f"Salvaged and restored {added} entries from {target_file}")

            return {
                "ok": True,
                "salvaged_count": len(salvaged_entries),
                "added_count": added,
                "source_file": target_file,
            }
        except Exception as e:
            logger.error(f"Failed to salvage history from {target_file}: {e}")
            return {"ok": False, "error": str(e)}

