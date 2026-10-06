# NovaDrop v0.4.3 — Release Notes

**Release Date:** October 2026  
**Tag:** `v0.4.3`  
**Target Platform:** Windows 10 / Windows 11 (64-bit)

---

## 🚀 Windows 11 Native Integration Suite, Media Player Overhaul & Compact Navigation Rail

NovaDrop `v0.4.3` bridges the desktop experience directly into Windows 11's core OS subsystems. This milestone release delivers native System Media Transport Controls (SMTC) for hardware keys and volume flyouts, live Taskbar progress tracking (`ITaskbarList3`), interactive Windows 10/11 Rich Toast Notifications, active download sleep prevention, Fluent DWM window backdrops, a ground-up redesign of the full-screen media player inspired by Windows 11 Media Player, and a responsive collapsible navigation rail.

---

## 🌟 Highlights & Key Features

### 1. Windows 11 System Media Transport Controls (SMTC)
* **Global Hardware & Shell Integration**:
  * Connected playback directly to the Windows 11 System Media Transport Controls subsystem via `navigator.mediaSession`.
  * Fully supports keyboard hardware media keys (`Play`, `Pause`, `Previous Track`, `Next Track`, `Stop`, `Seek Backward`, `Seek Forward`).
  * Live integration with the Windows 11 Volume Flyout, Action Center (`Win + A`), and Lock Screen playback card.
  * Real-time metadata synchronization (`title`, `artist`, `album`, album artwork thumbnail) and live scrubber position state (`duration`, `position`, `playbackRate`).

### 2. Windows Taskbar Progress Bar (`taskbar_manager.py`)
* **Live Shell Progress Tracking via Pure Python COM**:
  * Implemented direct COM interface calls to `ITaskbarList3` (`SetProgressValue` & `SetProgressState`) with zero external dependencies.
  * Dynamically updates the NovaDrop taskbar icon with color-coded states:
    * **Normal (Green)**: Real-time download progress percentage.
    * **Paused (Yellow)**: Visual paused indicator when downloads are held.
    * **Error (Red)**: Alert state on download failures with automatic 3.5s reset timer.
    * **No Progress**: Automatically clears the taskbar bar when queues finish or the app closes.

### 3. Windows 10 & 11 Interactive Rich Toast Notifications (`toast_manager.py`)
* **Native WinRT Toast Dispatch**:
  * Emits rich, interactive Windows 10/11 toast notifications upon download completion or failure via WinRT.
  * Embeds application branding and local media thumbnail artwork directly into the toast card.
  * **Interactive Action Buttons**:
    * **Open File**: Instantly opens the downloaded file with the default media handler.
    * **Open Folder**: Immediately navigates Windows File Explorer directly to the destination folder using native protocol URI activation.
  * Configurable user toggle under **Settings → Notifications** with an interactive **"Send Test Toast"** action button.

### 4. Sleep & Standby Prevention (`sleep_manager.py`)
* **Uninterrupted Downloads via `SetThreadExecutionState`**:
  * Hooks Windows power management using `ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_AWAYMODE_REQUIRED` via `kernel32.dll`.
  * Prevents Windows from entering sleep or suspending network adapters in the middle of long video, playlist, or gallery extractions.
  * Automatically releases the power assertion and restores the default Windows power policy as soon as all active jobs complete.
  * User-controllable toggle in **Settings → General Preferences**.

### 5. Fluent DWM Window Chrome & Mica Backdrop (`window_effects.py`)
* **Native Desktop Window Manager (DWM) Styling**:
  * **Immersive Dark Mode (`DWMWA_USE_IMMERSIVE_DARK_MODE` = 20)**: Eliminates glaring white titlebars and system borders on Windows 10 (20H1+) and Windows 11.
  * **Custom Caption Bar Color (`DWMWA_CAPTION_COLOR` = 35)**: Seamlessly matches the window frame to NovaDrop's dark backdrop (`#090a0f`).
  * **Rounded Window Corners (`DWMWA_WINDOW_CORNER_PREFERENCE` = 33)**: Enables high-DPI Windows 11 rounded window geometry (`DWMWCP_ROUND`).
  * **Mica System Backdrop (`DWMWA_SYSTEMBACKDROP_TYPE` = 38)**: Configured for Windows 11 builds (22H2+).

### 6. Windows 11 Media Player Full-Screen Redesign (`GlobalMediaPlayer.jsx`)
* **Aesthetic & Functional Overhaul**:
  * **Top Bar**: Minimalist navigation featuring a circular Back arrow button (`←`), Media Player branding badge, and automatic idle fadeout.
  * **Full-Width Monospace Scrub Bar**: Precision scrubber spanning edge-to-edge with `HH:MM:SS` timestamps (`00:00:05` / `00:03:52`) matching Windows 11 Media Player.
  * **Centered Playback Cluster**:
    * **Rewind 10s**: Custom counter-clockwise 10-second skip icon.
    * **Fast Forward 30s**: Custom clockwise 30-second skip icon.
    * **Shuffle & Repeat**: Sleek accent toggles.
    * **Signature Play/Pause Ring**: Circular dark charcoal button with a 2.5px active accent ring border and glow.
  * **Right Utility Tools**:
    * **Mini Player (PIP)**: Dedicated Windows 11 picture-in-picture icon.
    * **Volume Slider**: Speaker button with smooth expandable horizontal slider on hover.
    * **Queue Drawer**: Slide-out drawer on the right side of the screen displaying album/playlist queues with track numbers and durations.
    * **Playback Speed Menu (`•••`)**: Fluent context menu supporting `0.5x`, `0.75x`, `1.0x`, `1.25x`, `1.5x`, and `2.0x`.
  * **Smooth Auto-Hide**: Controls seamlessly fade out after 3.2 seconds of mouse inactivity during video playback and return on mouse movement or pause.

### 7. Compact Collapsible Navigation Rail (`NavigationRail.jsx`)
* **Responsive Windows 11 Sidebar**:
  * Automatically collapses to icon-only mode when the window width drops below `860px` or when toggled via the hamburger `Menu` button.
  * Refined 14px icon geometry (`w-3.5 h-3.5`, `strokeWidth={1.85}`) within `w-9 h-9` buttons matching Windows 11 Media Player rail proportions.
  * Left-docked vertical active indicator pill (`w-[3px] h-3.5 rounded-r-full`) and pinned bottom Settings gear.

---

## 📦 File Summary
* **New Modules:** `taskbar_manager.py`, `toast_manager.py`, `sleep_manager.py`, `window_effects.py`
* **Core Application:** `app.py`, `version.py`, `media_downloader.py`, `updater.py`
* **Frontend Components:** `GlobalMediaPlayer.jsx`, `NavigationRail.jsx`, `SettingsView.jsx`, `App.jsx`, `api.js`
* **Installer & Manifests:** `installer.iss`, `manifest.json`, `browser_extension/manifest.json`, `package.json`
* **Bundle:** `frontend/dist/`
