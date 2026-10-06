# NovaDrop v0.4.0 — Release Notes

**Release Date:** October 2026  
**Tag:** `v0.4.0`  
**Target Platform:** Windows 10 / Windows 11 (64-bit)

---

## 🚀 NovaDrop Rebranding, Ocean Blue Theme, Windows 11 Settings Cards & Fluent Micro-Animations

NovaDrop `v0.4.0` marks a major evolution of the application. This release introduces a complete brand transformation to **NovaDrop**, adopts a modern **Ocean Blue** default design palette, overhauls the Settings experience with Windows 11 Fluent header cards and distinct sub-card dropdowns, and brings fluid Windows 11 Media Player-style micro-animations and active indicator indicators to the navigation rail.

---

## 🌟 Highlights & Key Features

### 1. Brand Identity Transformation: NovaDrop
* **Rebranded Visual Suite**:
  * Transitioned from generic "Media Downloader" branding to **NovaDrop: High Performance Media Extraction Suite**.
  * Complete asset refresh with high-resolution glossy icons (`icon.ico`, 16x16, 32x32, 48x48, 128x128, 256x256), browser extension manifests, and high-DPI brand banners.
  * Integrated custom Inno Setup Windows installer wizard bitmaps (`wizard.bmp`, `wizard-2x.bmp`, `wizard-small.bmp`, `wizard-small-2x.bmp`) for a polished desktop installation experience.
  * Updated application headers, titlebars, brand watermarks, and metadata across the entire codebase.

### 2. Default Theme Modernization: Ocean Blue
* **Vibrant & Cohesive Color Palette**:
  * Set **Ocean Blue** (`#38bdf8`) as the default accent theme across the application.
  * Fine-tuned luminosity, glassmorphic glow tokens (`--acc-glow`), and border contrast to ensure crisp readability in dark mode.
  * Maintained full backward compatibility with user theme preferences stored in `localStorage` (`Violet Glow`, `Emerald Mint`, `Solar Amber`, `Crimson Rose`).

### 3. Windows 11 Settings Experience with Distinct Sub-Cards
* **Native Header Card Language**:
  * Re-architected all 7 Settings sections into Windows 11 Fluent header cards (`min-h-[68px] sm:min-h-[72px] bg-surface-1/90 backdrop-blur-md border border-border-subtle rounded-2xl`).
  * Each header features dedicated square icon tiles (`w-10 h-10 rounded-xl bg-surface-2`), clear typography hierarchies, right-aligned status indicators/pills, and smooth chevron rotation cues.
* **Distinct Sub-Card Dropdown Bodies**:
  * Expanded settings controls now live in distinct, dedicated sub-cards positioned directly beneath the header card (`mt-1.5 p-6 rounded-2xl bg-surface-1/90 backdrop-blur-md border border-border-subtle shadow-md`).
  * Provides clean visual separation between categories, eliminating cramped accordion walls.

### 4. Windows 11 Media Player Fluent Navigation Micro-Animations
* **Settings Gear Rotation (`animate-fluent-gear`)**:
  * Modeled after native Windows 11 Media Player: clicking or selecting Settings triggers a fluid 360° spin with spring overshoot and settle (`cubic-bezier(0.16, 1, 0.3, 1)`).
  * Always rests in its natural, upright position (`rotate-0`) when idle.
  * Interactive 45° rotational preview on hover.
* **Cohesive Micro-Motions across All Navigation Icons**:
  * **Downloads**: Tactile downward pulse and spring return on selection; subtle downward nudge on hover.
  * **Library**: Subtle collection tilt animation (`-12°` tilt and settle) on selection; gentle shelf tilt on hover.
  * **Home**: Subtle spring pop and lift on selection; upward hover cue.
* **Accessibility Compliance**:
  * Added `@media (prefers-reduced-motion: reduce)` support in CSS to respect Windows accessibility settings.

### 5. Windows 11 Active Indicator Pill & Layout Refinements
* **Mathematically Centered Accent Indicator**:
  * Added the signature Windows 11 Fluent vertical accent pill (`w-1 h-4 bg-brand-acc rounded-full shadow-[0_0_8px_var(--acc-glow)]`) docked to the left edge of active navigation items.
  * Embedded inside a dedicated flex container (`absolute left-1.5 inset-y-0 flex items-center pointer-events-none`) to guarantee 100% vertical centering without conflict from CSS transform animations.
* **Standardized Nav Alignment**:
  * Standardized navigation buttons to `h-10 pl-3.5 pr-3 rounded-xl` with dedicated `w-5 h-5` icon bounding boxes for consistent horizontal baseline alignment across all tabs.

### 6. Updater & Engine Bridge Reliability
* **Asset URL Bridging**:
  * Fixed application updater routine to properly bridge download URLs and asset endpoints.
  * Added fallback browser release navigation when direct update extraction encounters network barriers.

---

## 📦 File Summary & Checksums
* **Application Core:** `app.py`, `media_downloader.py`, `updater.py`, `version.py`
* **Version:** `0.4.0` (Tagged and Released)
* **Frontend Bundle:** `frontend/dist/`
