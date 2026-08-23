#!/usr/bin/env python3
"""
search_history.py
------------------
Tiny persisted list of recent search queries, used to power autocomplete
suggestions in the search box. Deliberately simple — no metadata, just a
de-duplicated, most-recent-first list of strings, capped in length.

Stored under the user's home directory (same reasoning as
download_history.py — the app's install location may be read-only).
"""

import json
import os
import threading

_LOCK = threading.Lock()
_MAX_QUERIES = 30


def _path() -> str:
    base = os.path.join(os.path.expanduser("~"), ".media_downloader")
    os.makedirs(base, exist_ok=True)
    return os.path.join(base, "search_history.json")


def _load() -> list:
    path = _path()
    if not os.path.isfile(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except Exception:
        return []


def _save(items: list) -> None:
    path = _path()
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(items, f, indent=2)
    os.replace(tmp, path)


def add_query(query: str) -> None:
    """Insert a query at the front, de-duplicated case-insensitively."""
    query = (query or "").strip()
    if not query:
        return
    with _LOCK:
        items = _load()
        items = [q for q in items if q.lower() != query.lower()]
        items.insert(0, query)
        _save(items[:_MAX_QUERIES])


def list_queries() -> list:
    with _LOCK:
        return _load()
