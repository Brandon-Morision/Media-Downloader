# Media Downloader v0.3.5 — Release Notes

**Release Date:** September 2026  
**Tag:** `v0.3.5`  
**Target Platform:** Windows 10 / Windows 11 (64-bit)

---

## 🎨 The UI Polish, Windows 11 Fluidity & Responsive Layout Release

Media Downloader `v0.3.5` focuses on design elegance, responsive layout scaling on large displays, Windows 11 fluid transition animations, independent scroll architectures, and streamlined branding.

---

## 🌟 Highlights & Key Features

### 1. Windows 11 Media Player Fluid Transitions
* **WinUI3 EntranceThemeTransition**:
  * Navigation between **Home**, **Downloader**, **Library**, and **Settings** now utilizes a fluid dissolve transition inspired by the Windows 11 Media Player.
  * Combines simultaneous opacity fade (`0 → 1`), subtle micro-scaling (`0.97 → 1`), and transient micro-blur (`4px → 0px`) over a fast, spring-tuned cubic-bezier curve (`cubic-bezier(0.16, 1, 0.3, 1)`).
  * Tab switching across download categories and library filters features a lightweight spring scale-fade for instant feedback.

### 2. Streamlined Window Architecture & Clean Professional Look
* **Chromeless Clean Design**:
  * Removed the redundant top header/title bar to maximize vertical space and eliminate duplicated controls.
  * All status indicators, engine versions, and theme options remain conveniently accessible inside the **Settings** view.
* **Unified Branding**:
  * Standardized the application title to **MediaDownloader** across the entire UI, navigation rail, and settings dashboard.

### 3. Independent Scrolling & Sticky Header Architecture
* **Downloader View**:
  * The search/URL input, active downloads queue, filter controls, and the "History & Finished Downloads" header remain sticky and intact at the top.
  * The historical list of finished downloads scrolls independently underneath without pushing top controls out of view.
* **Library View**:
  * The library header, search bar, and category filter tabs (**All**, **Videos**, **Music**, **Images**) stay pinned at the top while the media grid scrolls smoothly beneath.

### 4. Adaptive Responsive Scaling for Large & Ultrawide Displays
* **Dynamic Grid & Container Scaling**:
  * Removed restrictive `max-w` caps across **Home**, **Downloader**, and **Library** views.
  * Content now fills and distributes naturally across modern high-resolution screens (1080p, 1440p, 4K, and ultrawide monitors).
* **Responsive Navigation Rail**:
  * Sidebar scales dynamically across breakpoints (`w-52` on standard laptops up to `w-64` on expansive monitors).
* **Multi-Breakpoint Library Grid**:
  * Media card grid dynamically adjusts from 2 columns up to 6 columns based on window dimensions.

### 5. Expanded Home Screen Recent Downloads
* **Two Full Rows of Recent Downloads**:
  * Doubled the Recent Downloads showcase from 4 to **8 items**, structured in an evenly balanced 4-column layout (`grid-cols-2 md:grid-cols-4`).
  * Enriched fallback media previews ensure clean visual balance even on clean installs before download history accumulates.

### 6. Engineering & System Updates
* **Cross-Platform Console Compatibility**:
  * Enhanced `update_version.py` with automatic UTF-8 stream re-configuration to prevent Windows CP1252 encoding crashes.
* **Dynamic Versioning**:
  * Settings view and navigation rail dynamically reflect active backend versioning with fallback to `v0.3.5`.
* **Synchronized Ecosystem**:
  * Synchronized version bump to `v0.3.5` across Python backend (`version.py`), application manifest (`manifest.json`), installer setup script (`installer.iss`), and frontend client bundle.

---

## 📦 File Verification & Checksums
* **Application Core:** `app.py`
* **Version:** `0.3.5`
* **Frontend Bundle:** `frontend/dist/`
