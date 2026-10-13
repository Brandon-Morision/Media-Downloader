# NovaDrop v0.5.0 — Release Notes

**Release Date:** October 2026  
**Tag:** `v0.5.0`  
**Target Platform:** Windows 10 / Windows 11 (64-bit)

---

## 🚀 Explore Screen Overhaul, Dedicated Downloads Architecture & Security Hardening

NovaDrop `v0.5.0` is a milestone release introducing a dedicated Explore workspace with integrated stream inspection and search, a streamlined Downloads queue manager, critical security hardening against DNS rebinding and origin spoofing, download history salvaging and resilience, and early false-positive download error resolution.

---

## 🌟 Highlights & Key Features

### 1. Explore Screen Overhaul & Stream Quality Inspector (`ExploreView.jsx`)
* **Unified Explore & Inspection Hub**:
  * Moved YouTube live search results and query history exclusively into the Explore screen, eliminating duplicate result displays across screens.
  * Migrated the link inspection card and quality analysis engine (`api.previewLink`) into Explore.
  * Sticky, persistent top search bar supporting both natural text searches and media URL pasting with automatic URL detection.
* **Rich Link Analysis & Stream Quality Inspector**:
  * **Video & Audio Streams (`yt-dlp`)**: Displays video thumbnail with play overlay, duration, views, description, video/audio format tabs, and dynamic stream quality selector (1080p, 720p, 480p, 360p, or 320kbps MP3 audio) with size estimations.
  * **Albums & Galleries (`gallery-dl`)**: Displays gallery cover, detected item counts, customizable download limits (10, 25, 50, 100, or All items), and dedicated batch extraction CTA.
* **Seamless Cross-View Workflow**:
  * Pasting media links from the Home screen automatically routes to Explore for inspection and stream tuning before queuing.
  * Starting a download from Explore queues the job and smoothly transitions to the Downloads view.

---

### 2. Streamlined Downloads Queue & History (`DownloaderView.jsx`)
* **Pure Downloads & Queue Focus**:
  * Freed from URL analysis panels and clutter to focus purely on active, scheduled, and completed downloads.
* **Sticky Filter & Status Header**:
  * Persistent, anchored top header with status filter pills: **All**, **Active**, **Completed**, **Failed**, **Cancelled**, and **Scheduled** with live counters.
  * Integrated queue search input to immediately filter downloads by title or URL without page jumping.
* **Seamless Design**:
  * Removed harsh separator lines and dividers for a modern, fluid visual flow matching Windows 11 design principles.

---

### 3. Core Functionality & Bridge Security Hardening
* **DNS Rebinding Protection & Host Authority Parsing**:
  * Replaced manual Host header splitting in the local companion bridge with robust RFC-compliant authority parsing (`urllib.parse.urlsplit`), strictly enforcing loopback interfaces and port validation.
* **Strict Browser Extension Origin Validation**:
  * Validates incoming bridge origins against the verified extension ID and localhost, blocking untrusted web origins and preventing authorization token theft.
* **History File Salvage & Quarantine**:
  * Resilient error recovery in `download_history.py`: automatically restores from `.bak` backup upon detecting corrupted JSON.
  * Quarantines corrupted files to `.corrupt.<timestamp>` to prevent silent data loss while maintaining clean runtime operation.
* **Safe Windows 11 Toast Delivery**:
  * Rebuilt PowerShell toast notification delivery in `toast_manager.py` using stdin script execution and Base64-encoded strings, eliminating script injection risks.

---

### 4. Download Engine & Scheduling Fixes
* **Resolved Early False-Positive 'Failed' State**:
  * Fixed an issue where initial handshakes or format probing on certain audio and stream downloads (such as `.m4a` files) caused jobs to be prematurely marked as failed before successfully completing.
* **Night-Owl Rate-Limit Scheduler Resilience**:
  * Scheduled downloads cleanly track countdown timers, target reset timestamps, and auto-resume triggers.
* **Download Cleanup Error Resolution**:
  * Fixed `UnboundLocalError` edge cases during download cancellation and post-processing file cleanup.

---

## 🛠️ Verification & Build Details
* **Frontend Bundle**: Compiled via Vite (`v8.3.1`) into `dist/` with production asset optimization.
* **Automated Test Suites**:
  * `test_download_history_suite.py`: 100% pass (backup recovery, corruption quarantine, atomic writes).
  * `test_bridge_security_exec.py`: 100% pass (origin rejection, host authority, token validation).
* **Python Desktop Runtime**: Tested on Python 3.14 (64-bit) with PyWebView on Windows 11.
