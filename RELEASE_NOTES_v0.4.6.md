# NovaDrop v0.4.6 — Release Notes

**Release Date:** October 2026  
**Tag:** `v0.4.6`  
**Target Platform:** Windows 10 / Windows 11 (64-bit)

---

## 🚀 Fluent Image Viewer Overhaul, Engine Optimization Suite & Comprehensive Terms of Use

NovaDrop `v0.4.6` is a major feature release delivering a ground-up redesign of the in-app photo and gallery viewer inspired by Windows 11 Photos, significant performance optimizations to download concurrency and buffer pipelines, fixes for pause/resume process suspend operations, a refined Updates & Engines Management suite, and formal in-app integration of the NovaDrop Terms of Use and Software License.

---

## 🌟 Highlights & Key Features

### 1. Windows 11 Fluent Image & Gallery Viewer (`GalleryModal.jsx`)
* **State-of-the-Art Aesthetic & Layout**:
  * Designed to match modern Windows 11 Fluent desktop aesthetics with deep dark acrylic surfaces, frosted backdrop blurs, and crisp micro-borders.
* **Top Header & Window Controls**:
  * **Back Navigation**: Quick return with an illuminated cyan active indicator bar underneath.
  * **Header Title & Subtitle**: Real-time filename alongside full photo count, file size, and extension format (e.g. `1 Photo · 142 KB · JPG`).
  * **Favorite / Heart Toggle**: Interactive button with glowing rose active state and persistent local storage saving.
  * **Details Toggle `(i)`**: Quick toggle button to open or collapse the right metadata inspector.
  * **More Options Dropdown `(...)`**: Instant actions for *Copy file path*, *Open in default app*, and *Open containing folder*.
  * **Window Shell Controls**: Integrated Minimize (`−`), Maximize/Restore (`□`), and Close (`✕`) buttons.
* **Vertical Left Filmstrip**:
  * Displays a photo counter badge (`1 / 1`) and a vertical thumbnail list of all album photos.
  * Active thumbnail features a vibrant glowing cyan border (`ring-2 ring-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.5)]`).
* **Interactive Canvas & Pan/Zoom Engine**:
  * **Pan & Zoom**: Smooth mouse wheel zooming (0.25× to 5×), keyboard shortcuts (`+` / `−`, `0`), and drag-to-pan when zoomed in.
  * **Rotation**: 90° clockwise rotation (`R` shortcut or toolbar).
  * **Natural Resolution Sniffer**: Automatically detects exact image dimensions (`naturalWidth × naturalHeight`) immediately upon image load.
  * **Floating Bottom Pill**: Frosted glass badge indicating the active image filename.
  * **Floating Center Toolbar**: Translucent frosted pill featuring Zoom Out, Zoom In, 1:1 Reset, Fit to View, Rotate 90°, and Fullscreen mode.
* **Collapsible Details & Comments Sidebar**:
  * **Details Tab**:
    * Mini preview card with square thumbnail, filename, and format/size badges.
    * Metadata attributes grid: *Dimensions* (`4032 × 3024`), *Size* (`142 KB`), *Type* (`JPG`), *Date modified* (`Aug 14, 2025 5:32 PM`), and *Location* (`Nairobi, Kenya` / device origin).
    * Windows 11 style **Open folder** button with folder icon and chevron (`>`).
  * **Comments Tab**:
    * Clean note-taking and tagging system per image, persisted in local storage with timestamps.

---

### 2. Download Speed Optimizations & Pause/Resume Enhancements
* **Concurrency & Buffer Saturation**:
  * Tuned yt-dlp multi-connection parameters and fragment concurrency for higher bandwidth saturation on gigabit networks.
  * Increased socket buffer sizes and streaming chunks for faster multi-gigabyte video and playlist captures.
* **Pause & Resume Process Suspend Reliability**:
  * Resolved race conditions in OS-level process suspension (`psutil.Process.suspend()` / `resume()`) in `media_downloader.py`.
  * Ensured accurate UI state synchronization across pause, resume, and cancellation events.

---

### 3. Updates & Engines Suite Redesign (`SettingsView.jsx`)
* **Fixed "Checking..." State Bug**:
  * Eliminated stale checking states in the engine cards, ensuring installed versions (`yt-dlp`, `gallery-dl`, `ffmpeg`) reflect accurately immediately upon loading.
* **Real-Time Engine Sync & Auto-Update Notifications**:
  * Integrated background listener for engine update tasks with clear progress indicators and success confirmation badges.
  * Direct GitHub links and release tracking for all underlying extraction engines.

---

### 4. Terms of Use & Software License Integration
* **Comprehensive Legal Framework (`TERMS_OF_USE.md`)**:
  * Outlines permitted personal use, user copyright compliance, third-party platform terms adherence, and disclaimers regarding external network transfers and local bridge usage.
* **Installer & In-App Accessibility**:
  * Bundled directly into the Windows Inno Setup installer wizard (`build_assets/license.txt` and `installer.iss`).
  * Accessible at any time inside the app via **Settings → About NovaDrop → Terms of Use & License** in a dedicated interactive dialog.

---

## 🛠️ Verification & Build Details
* **Frontend Bundle**: Compiled via Vite with zero warnings (`dist/assets/index-BDT_Y7ii.js`, `dist/assets/index-AfDrk89M.css`).
* **Python Desktop Wrapper**: Tested on Python 3.14 (64-bit) with PyWebView on Windows 11.
* **PyInstaller Executable**: Built and packaged into `dist/NovaDrop/NovaDrop.exe`.
