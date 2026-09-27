# Media Downloader v0.3.0 — Release Notes

**Release Date:** September 2026  
**Tag:** `v0.3.0`  
**Target Platform:** Windows 10 / Windows 11 (64-bit)

---

## 🚀 The Major Overhaul & Modern Architecture Release

Media Downloader `v0.3.0` marks the most comprehensive upgrade in the application's history. This release debuts a modern **React 19 + Tailwind CSS** architecture with an ultra-responsive dark-mode aesthetic, universal media thumbnail extraction, dynamic YouTube quality and format presets, granular queue management, intelligent Windows Explorer integration, interactive playlist inspection, and powerful automation tools.

---

## 🌟 Highlights & Key Features

### 1. Modern React 19 Frontend & Navigation Rail
* **Vertical Navigation Rail**:
  * Seamlessly toggle across 5 dedicated workspaces without interrupting background downloads:
    * **🏠 Home**: Streamlined hero search & paste bar, category shortcuts, and Recent Downloads grid.
    * **📥 Downloader**: Powerful download queue with live metrics, format controls, and status filtering.
    * **📚 Library**: Unified media browser for completed downloads, multi-photo albums, and series bundles.
    * **🧭 Explore**: Real-time media search powered by YouTube scraper integration.
    * **⚙️ Settings**: Preferences dashboard for themes, default directories, formats, and automation settings.
* **Curated Accent Themes**:
  * 5 modern dark-mode accent styles:
    * 🟢 *Emerald Mint*
    * 🟣 *Violet Glow*
    * 🔵 *Ocean Sky*
    * 🟠 *Solar Amber*
    * 🔴 *Crimson Rose*
  * Zero-flicker instant switching persisted across sessions.
* **Robust PyWebView Bridge**:
  * High-performance asynchronous IPC communication with retry lifecycle management (`waitForApi`, `pywebviewready`).
  * Self-contained production bundle included in `frontend/dist/` for out-of-the-box native desktop execution without Node.js runtime dependencies.

---

### 2. Streamlined Home Screen
* **Focused Dashboard Experience**:
  * Cleaned up interface by removing the legacy "Supported Sites" pills row and browsing modal to center focus on download workflows and recent media.
* **Smart URL & Search Bar**:
  * Instant engine detection badge (`yt-dlp` for video/streaming platforms vs. `gallery-dl` for image boards and galleries).
  * Direct 1-click **Paste** from clipboard button.
* **Category Quick-Action Cards**:
  * Fast navigation to **Videos**, **Music**, **Images**, and **Paste Link**.
* **Visual Recent Downloads**:
  * Interactive cards showcasing live media thumbnails, duration badges, bundle item counters, and instant in-app playback triggers.

---

### 3. Universal Media Thumbnail & Bundle Extraction System
* **Automatic First-Media Resolution**:
  * Bulk downloads (multi-photo galleries, audio albums, video bundles) now automatically inspect bundle contents, resolve, and display the thumbnail of the first media item.
* **Persistent Bundle Badges**:
  * Displays distinct glass count badges and media icons across **Recent Downloads**, **Library (Grid & List)**, and **Downloader (Active & Finished)**:
    * `<Layers/> {count} Photos` (Emerald badge)
    * `<ListVideo/> {count} Videos` (Sky badge)
    * `<ListMusic/> {count} Tracks` (Purple badge)
    * `<Layers/> {count} Items` (Amber badge)
* **Expanded Format Support**:
  * Added thumbnail frame extraction for `.m4v` (RedGIFs / Tumblr), `.flv`, `.ts`, and `.wmv` formats, along with audio cover art extraction for `.m4a`, `.mp3`, `.flac`, `.ogg`, and `.opus`.
  * Added fallback to frame 0 (`-ss 0`) for short video clips and animations under 1 second.
* **Dynamic Bridge Token Re-signing**:
  * Local media thumbnails automatically re-sign with the active session's security token on app restart, eliminating `403 Forbidden` broken image errors.

---

### 4. Windows File Explorer "Open Containing Folder" Integration
* **File Selection Fix**:
  * Fixed an issue where clicking the folder icon ("Open containing folder" / "Open in Folder") erroneously launched Windows Media Player due to an `os.startfile()` call.
* **Explorer `/select` Execution**:
  * The folder button now triggers `explorer /select,"<filepath>"`. Windows File Explorer opens directly to the containing directory with the specific media file selected and highlighted.
  * Gracefully falls back to opening the parent folder or default download directory if a file was moved or deleted.

---

### 5. Advanced Downloader Queue & YouTube Format Selection
* **Granular Queue Status Filtering**:
  * Distinct tabs for **All**, **Active**, **Completed**, **Failed**, and **Cancelled** downloads with live counter badges.
* **YouTube Quality & Format Presets**:
  * Format selector dropdown on the download bar: `Auto`, `2160p (4K)`, `1440p (2K)`, `1080p (Full HD)`, `720p (HD)`, `480p (SD)`, `MP3 (320k Audio)`, and `M4A (AAC Audio)`.
  * Quick-chip quality buttons for rapid 1-click selection before queuing.
* **Redownload & Retry**:
  * 1-click **Redownload** button for completed items and **Retry** for failed jobs.
* **Queue Clean-up**:
  * Context-aware **Clear Completed**, **Clear Failed**, and **Clear Cancelled** actions.

---

### 6. Built-in Media Player & Audio Visualizer Upgrades
* **Dynamic Playback Queue**:
  * When playing a single audio track, the queue drawer remains cleanly hidden without phantom or fictitious items.
  * Albums and grouped track downloads automatically populate the interactive playlist queue.
* **Multi-Video Bundle Queue**:
  * Multi-video series and bundles now feature a slide-out queue drawer showing track titles and thumbnails.
* **Fullscreen Distraction-Free Playback**:
  * Fullscreen video playback automatically hides the queue overlay for an unobstructed view.
* **Real-Time Web Audio API Visualizer**:
  * Canvas-rendered frequency spectrum bars and neon waveforms driven by `AudioContext` and `AnalyserNode`.

---

### 7. Interactive Playlist & Album Inspector
* **Non-Blocking Flat-Playlist Extraction**:
  * Inspect YouTube playlists, sound sets, and galleries in 1-2 seconds without downloading via `yt-dlp --flat-playlist -J`.
* **Selection & Batching**:
  * Search tracks by title or channel, select all, deselect all, or enter custom numeric ranges (e.g. `1-10, 15`).
  * Download as individual items or as a unified bundle (`--playlist-items`).

---

### 8. Automation & System Integrations
* **🌙 Night-Owl Download Scheduler**:
  * Schedule queues during off-peak bandwidth hours with relative delays (`+30m`, `+1h`, `+2h`, `+4h`) or exact clock times (`02:00 AM`).
* **Post-Download Automations**:
  * Automatically take system action upon queue completion: **Do nothing**, **Close app**, **Sleep PC**, or **Shut down PC** (with an emergency 60-second cancel dialog).
* **Smart Clipboard Monitor**:
  * Sub-millisecond Win32 clipboard polling via `ctypes` displaying floating Action Toasts (`Quick Download`, `Inspect`, `Dismiss`).
* **Browser Extension Pairing**:
  * Secure pairing with the local bridge server (`127.0.0.1:6789`) with customizable floating action button placement.

---

## 🔒 Security & Performance Fixes
* **Hardened Local Streaming**: Dedicated `_KNOWN_MEDIA_PATHS` FIFO registry and token comparison preventing unauthorized filesystem enumeration.
* **Zero Missing-Tag Warnings**: Complete JSX and HTML validation with 0 syntax errors.
* **Optimized Bundle Size**: React 19 production build under 460 KB total assets.

---

*Thank you for using Media Downloader!*
