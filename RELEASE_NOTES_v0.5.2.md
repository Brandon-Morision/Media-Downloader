# NovaDrop v0.5.2 — Release Notes

**Release Date:** October 2026  
**Tag:** `v0.5.2`  
**Target Platform:** Windows 10 / Windows 11 (64-bit)

---

## 🚀 Full-Screen Player Transition Overhaul, Minimized Player Hit-Test Architecture & Configurable Exit Behavior

NovaDrop `v0.5.2` introduces an intelligent media-type-aware transition system when exiting full-screen playback via the Back button or <kbd>Escape</kbd> key, persistent player behavior preferences in Settings, complete playback state preservation, and an architectural overhaul of the floating mini-player to ensure unobstructed app-wide button responsiveness.

---

## 🌟 Highlights & Key Features

### 1. Intelligent Full-Screen Player Back & Escape Transition
* **Media-Type-Aware Lifecycle**:
  * **Audio Files & Songs**: Exiting full-screen via the top-bar Back button or <kbd>Escape</kbd> key now seamlessly transitions playback directly into the floating mini-player. Audio streams continue playing smoothly without interruption, timestamp resetting, or audio stutter.
  * **Video Files**: Pressing Back or <kbd>Escape</kbd> during video playback now displays a Windows 11 Fluent confirmation dialog:
    * **Continue watching?** *"Your video is still playing. Would you like to switch to the mini-player or exit the player?"*
    * **Switch to mini-player**: Continues video playback in the floating picture-in-picture mini-player at the exact current position.
    * **Exit player**: Stops playback and closes the player cleanly.
    * **Cancel**: Dismisses the confirmation dialog and remains in full-screen mode with playback untouched.
    * **Remember my choice**: Automatically saves preference to Settings for subsequent exits.
* **Single Authoritative Playback Session**:
  * Eliminated destructive unmount and recreation cycles. Audio and video elements maintain their underlying hardware stream, buffer, volume, speed, and SMTC metadata across transitions.

---

### 2. Player Behavior Settings & Real-Time Sync (`SettingsView.jsx`)
* **Dedicated "Player Behavior" Section**:
  * Added a new Windows 11-styled configuration section under **When Leaving Fullscreen**:
    * **For audio files and songs**:
      * *Switch to mini-player (recommended)* [Default]
      * *Exit player*
    * **For video files**:
      * *Ask every time (default)* [Default]
      * *Switch to mini-player*
      * *Exit player*
* **Restore Defaults & Real-Time Synchronization**:
  * Integrated a one-click **Restore Defaults** action to quickly revert settings.
  * Custom bi-directional event bus (`md-player-settings-changed`) ensures that remembering choices in the video confirmation dialog instantly updates the Settings UI without page reloads.

---

### 3. Minimized Player Hit-Test & Click-Through Resolution (`GlobalMediaPlayer.jsx` & `MiniPlayer.jsx`)
* **Unobstructed Main Window Navigation**:
  * Resolved an issue where background elements, buttons, and navigation links in the main application were blocked or unresponsive when the media player was minimized.
  * Applied `invisible pointer-events-none opacity-0 -z-50` to the global player container when minimized, ensuring zero pointer event capture outside the floating mini-player.
* **Closed Auxiliary Menus on Minimize**:
  * Playlist queues, speed menus, and confirmation dialogs automatically close when minimizing, preventing orphan overlays.
* **Dedicated Maximize Controls**:
  * Integrated explicit `Maximize2` action buttons in both audio and video mini-players to effortlessly expand back to full-screen view.

---

### 4. Keyboard Listener Isolation & OS Fullscreen Protection
* **Scoped Keyboard Handlers**:
  * Keyboard event listeners for Back and <kbd>Escape</kbd> are strictly guarded when the player is minimized (`if (!active || isMinimized) return;`), preventing accidental capture of application-level shortcuts.
* **Native Fullscreen Guard**:
  * Exiting native OS/browser full-screen (<kbd>F11</kbd> / `requestFullscreen`) safely restores normal window bounds before triggering player exit logic.

---

## 🛠️ Verification & Quality Assurance

* **Automated Test Suite**: 43 test assertions in `scratch/test_fullscreen_player_exit.mjs` verifying all 14 lifecycle scenarios, preference persistence, default values, and keyboard guards.
* **Hit-Test Verification**: Verified in `scratch/verify_minimized_player_fix.py` for clean z-index hierarchy and pointer event isolation.
* **Linting & Compilation**: Passed frontend `oxlint` with 0 errors; built production bundle cleanly via Vite (`vite v8.3.1`).

---

## 📦 Upgrade Instructions

1. Download `NovaDrop-Setup-v0.5.2.exe` from the GitHub Releases page.
2. Run the installer (previous settings, download history, and engine binaries will be preserved automatically).
3. If running from source:
   ```bash
   git pull origin main
   pip install -r requirements.txt
   cd frontend && npm install && npm run build && cd ..
   python app.py
   ```
