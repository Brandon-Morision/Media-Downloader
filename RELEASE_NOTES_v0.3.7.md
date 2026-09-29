# Media Downloader v0.3.7 — Release Notes

**Release Date:** September 2026  
**Tag:** `v0.3.7`  
**Target Platform:** Windows 10 / Windows 11 (64-bit)

---

## 🚀 Engine Suites, Intelligent Media Routing & Modernized Card Experience

Media Downloader `v0.3.7` introduces individual background update management for extraction engines, canonical folder auto-sorting (`Videos`, `Music`, `Images`), recursive media library discovery across the entire storage directory, accurate bulk album categorization, and a modernized border-to-border card design.

---

## 🌟 Highlights & Key Features

### 1. Independent Engine Updates & Management Suite
* **Per-Engine Update & Check Architecture**:
  * Added individual check and update routines for **yt-dlp**, **gallery-dl**, and **FFmpeg** in `updater.py` and bridge APIs.
  * Extractor engines can now be checked, downloaded, or updated independently without requiring full application updates or restarts.
  * Redesigned Settings accordion: the "Updates & Engine Suite" starts collapsed by default for a clean layout, while allowing one-click update actions with live progress bars and error reporting per engine.

### 2. Automatic Canonical Subfolder Media Routing
* **Intelligent Media Sorting**:
  * All downloaded media is automatically categorized and placed into dedicated subfolders under the Media directory:
    * `Videos/`: Video streams and playlists (`.mp4`, `.mkv`, `.webm`, `.avi`, etc.)
    * `Music/`: Audio tracks, songs, and albums (`.mp3`, `.m4a`, `.flac`, `.wav`, `.aac`, etc.)
    * `Images/`: Photo galleries, artwork, and individual images (`.jpg`, `.png`, `.webp`, `.gif`, etc.)
  * Subfolder structure is automatically validated and initialized on startup.
  * Direct downloads and gallery-dl extractors place assets directly into their corresponding target category folder.

### 3. Comprehensive Disk Media Library Scanner & History Merging
* **Live Disk Scanning & Discovery**:
  * Library view now actively indexes all supported media files present across `Videos/`, `Music/`, and `Images/` subfolders on disk (`scan_media_library`).
  * Files downloaded outside the current session, preserved after history clearance, or manually moved into folders are instantly populated into the Library.
  * History metadata is seamlessly unified with disk records to preserve thumbnail previews, source URLs, download timestamps, and file statistics.

### 4. Bulk Music & Album Classification Fix
* **Accurate Audio vs Video Categorization**:
  * Fixed an issue where audio tracks downloaded in bulk or as albums (e.g. YouTube Music / Soundcloud playlists) were falsely classified under Videos.
  * Multi-file download archives and directory results analyze child file extensions (`.m4a`, `.mp3`, `.flac`, etc.) to guarantee classification under `music`.

### 5. Modernized Border-to-Border Card Experience
* **Full-Bleed Visual Styling**:
  * Redesigned media cards across both **Home** (Recent Downloads) and **Library**:
    * Thumbnails now stretch flush edge-to-edge across the top, left, and right borders.
    * Increased visual presence with expanded aspect ratios (`aspect-[16/11]` to `aspect-[4/3]`).
    * Deep bottom gradient blend seamlessly fuses thumbnails into the card body.
    * Crisp typography, category badges, play overlays, and refined hover zooms provide a modern Windows 11 Fluent aesthetic.

### 6. Synchronized Ecosystem & Versioning
* Synchronized version bump to `v0.3.7` across:
  * Python backend (`version.py`, `app.py`)
  * Application manifest (`manifest.json`)
  * Windows Inno Setup installer (`installer.iss`)
  * Frontend interface and API client (`api.js`, `SettingsView.jsx`, `NavigationRail.jsx`, `index.html`)

---

## 📦 File Verification & Checksums
* **Application Core:** `app.py`, `media_downloader.py`, `updater.py`
* **Version:** `0.3.7`
* **Frontend Bundle:** `frontend/dist/`
