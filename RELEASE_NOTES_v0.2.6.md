# Media Downloader v0.2.6 — Release Notes

**Release Date:** September 2026  
**Tag:** `v0.2.6`  
**Target Platform:** Windows 10 / Windows 11 (64-bit)

---

## 🌟 Highlights

### 1. Dual-Tier Auto-Update System
Keep your application and download engines always up to date without reinstalling:
* **Extractor Engine Updates (`yt-dlp` & `gallery-dl`)**:
  * Check and download the latest extractor binaries directly from upstream releases (GitHub for `yt-dlp`, Codeberg for `gallery-dl`).
  * Stored in `~/.media_downloader/tools/`, prioritizing the updated engines over bundled files with **zero Windows Administrator / UAC elevation prompts**.
  * Never get blocked by site changes (YouTube, Instagram, Reddit, Twitter/X) again.
* **Core Application Updater**:
  * Check for new Media Downloader desktop releases automatically or manually.
  * Preview full release notes right from within the app.
  * Download the installer with real-time speed and progress bars, then seamlessly hand off to Inno Setup for a silent upgrade and automatic restart.
* **Modern "About & Updates" Modal & Notification Badge**:
  * Dedicated modal accessible via the topbar `About` button.
  * Displays installed engine versions vs. upstream latest versions.
  * Pulsing notification dot in the topbar lights up when updates are detected.

---

### 2. Enhanced Gallery & Media Player Experience
* **Built-in Media Player**:
  * Stream audio and video directly through a secure local bridge server (`127.0.0.1:6789`) with full HTTP Range request support for smooth seeking.
  * Persistent **mini-player** in the bottom-right corner keeps playing media while you navigate the rest of the application.
  * Automatic embedded cover art extraction for MP3/M4A audio files using bundled FFmpeg.
* **High-Performance Gallery & Lightbox**:
  * Redesigned gallery grid with optimized spacing, responsive thumbnail sizing, and pagination support for large albums (200+ items).
  * Full-size image & video Lightbox with keyboard arrow navigation (`←` / `→`), fullscreen mode (`⛶`), and representative video-frame previews.

---

### 3. Precision Download & Progress Engine
* **Byte-Level Progress Tracking**:
  * Real-time metrics tracking actual bytes downloaded, total file size, download speed, and estimated time remaining (ETA).
  * Indeterminate activity indicators for unbounded gallery scrapes, preventing premature "100%" progress bar anomalies.
* **Single Smart Input Box**:
  * Automatically detects whether pasted text is a download URL or a YouTube search query.
  * Proactive authentication hints for platforms requiring logins (X/Twitter, Instagram, Pixiv, Reddit).
  * Built-in search autocomplete and history tracking.

---

### 4. Security & Hardening
* **Defense-in-Depth Local File Protection**:
  * Bounded known-media-path registry ensures the local streaming server only serves files produced by this app, preventing arbitrary local file disclosure.
* **Hardened Subprocess Executions**:
  * PowerShell notifications and clipboard monitoring utilize base64 encoded scripts (`-EncodedCommand`) to eliminate command injection vulnerabilities.
* **Secure Credential Handling**:
  * Authentication passwords are staged securely via temporary `.netrc` files with immediate cleanup, never exposed as plaintext command-line arguments.
* **Centralized Rotating Logs**:
  * Thread-safe logging to `~/.media_downloader/logs/media_downloader.log` with automatic 10 MB rotation (up to 5 backups).

---

## 📦 What's Included

* `MediaDownloader Setup.exe`: Full Windows installer (packaged with PyInstaller 6 + Inno Setup 7).
* `browser_extension/`: Chromium-compatible extension for 1-click downloads from Chrome, Edge, and Brave.
* Bundled Tool Binaries: `yt-dlp.exe`, `gallery-dl.exe`, `ffmpeg.exe`, `ffprobe.exe`.

---

## 🚀 Installation & Upgrade Instructions

1. **New Users**:
   * Download and run `MediaDownloader Setup.exe`.
   * Follow the installation wizard.
2. **Existing Users**:
   * Open Media Downloader.
   * Click **About** in the top right corner.
   * Click **Check for Updates** and select **Download & Install**, or run the setup executable directly.
