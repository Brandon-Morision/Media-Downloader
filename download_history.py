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
import threading
import uuid

_LOCK = threading.Lock()

# Cap on stored entries so the file can't grow forever across years of use.
_MAX_ENTRIES = 2000


def _history_dir() -> str:
    base = os.path.join(os.path.expanduser("~"), ".media_downloader")
    os.makedirs(base, exist_ok=True)
    return base


def _history_path() -> str:
    return os.path.join(_history_dir(), "history.json")


def _load() -> list:
    path = _history_path()
    if not os.path.isfile(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except Exception:
        # Corrupt/partial file — don't crash the app over history, just
        # start fresh rather than blocking downloads.
        return []


def _save(entries: list) -> None:
    path = _history_path()
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(entries, f, indent=2)
    os.replace(tmp, path)  # atomic on both Windows and POSIX


def add_entry(entry: dict) -> str:
    """Insert a new history entry (newest first). Returns its id."""
    entry_id = entry.get("id") or str(uuid.uuid4())
    entry["id"] = entry_id
    with _LOCK:
        entries = _load()
        entries.insert(0, entry)
        if len(entries) > _MAX_ENTRIES:
            entries = entries[:_MAX_ENTRIES]
        _save(entries)
    return entry_id


def list_entries() -> list:
    with _LOCK:
        return _load()


def delete_entry(entry_id: str) -> bool:
    with _LOCK:
        entries = _load()
        filtered = [e for e in entries if e.get("id") != entry_id]
        changed = len(filtered) != len(entries)
        if changed:
            _save(filtered)
        return changed


def clear_all() -> int:
    with _LOCK:
        entries = _load()
        _save([])
        return len(entries)
