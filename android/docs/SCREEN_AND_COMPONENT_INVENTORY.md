# NovaDrop Android — Screen, Component & Resource Inventory

> **Document Purpose:** Practical engineering reference for all user-facing screens, composable components, overlay sheets, routes, state dependencies, design tokens, and Android resource definitions.

---

## 1. User-Facing Screen Inventory

### 1.1 Home Screen
- **Route:** `Screen.Home.route` (`"home"`)
- **Primary Kotlin File:** [HomeScreen.kt](../app/src/main/java/com/novadrop/android/ui/home/HomeScreen.kt)
- **Primary Purpose:** Dashboard serving as the initial landing screen. Provides quick URL extraction input, queue metric summaries, supported source platform badges, and recent downloads.
- **Main UI Components:**
  - Header Title ("NovaDrop Suite")
  - Quick Media Extraction Card with text field & Analyze/Download buttons
  - Metrics Row Cards (Active Queue count, Downloaded count)
  - Supported Sources LazyRow Chips (YouTube, Reddit, Twitter/X, Instagram, Pixiv, Twitch, 1flex)
  - Recent Downloads LazyColumn list with play button trigger
- **Data Dependencies:** `downloads: List<DownloadJob>`
- **Interactions:**
  - Enter URL -> Click "Analyze" -> Navigates to `Screen.Explore` with initial URL.
  - Enter URL -> Click "Download" -> Enqueues quick job via `app.downloadRepository.enqueueJob` -> Navigates to `Screen.Downloader`.
  - Click Active Queue card -> Navigates to `Screen.Downloader`.
  - Click Downloaded card / item -> Triggers `onPlayJob(job)`.
- **States:**
  - *Empty State:* Displayed when `completedList` is empty ("No downloads yet...").
  - *Success State:* Displays recent completed downloads with thumbnail, title, format badge, and size.

---

### 1.2 Downloader Screen
- **Route:** `Screen.Downloader.route` (`"downloader"`)
- **Primary Kotlin File:** [DownloaderScreen.kt](../app/src/main/java/com/novadrop/android/ui/downloader/DownloaderScreen.kt)
- **Primary Purpose:** Live queue management center for monitoring active, paused, completed, scheduled, failed, and cancelled downloads.
- **Main UI Components:**
  - Queue Header with task count & "Clear finished" action button
  - Search/Filter text field
  - Filter Chips LazyRow (All, Active, Completed, Scheduled, Failed, Cancelled)
  - Task List (`LazyColumn`) rendered via `DownloadJobCard`
  - Countdown row (`ScheduledCountdownRow`) for rate-limited scheduled tasks
- **Data Dependencies:** `downloads: List<DownloadJob>`
- **Interactions:**
  - Search/Filter queue by title or URL.
  - Pause active job -> calls `onPauseJob(id)`.
  - Resume paused job -> calls `onResumeJob(id)`.
  - Cancel job -> calls `onCancelJob(id)`.
  - Retry failed job -> calls `onRetryJob(id)`.
  - Delete job -> calls `onDeleteJob(id)`.
  - Clear finished -> calls `onClearFinished()`.
  - Play completed job -> calls `onPlayJob(job)`.
- **States:**
  - *Loading / Active State:* Shows `LinearProgressIndicator`, progress %, speed formatted (MB/s), and ETA.
  - *Scheduled State:* Shows rate limit countdown timer with "Auto-resumes at HH:mm:ss" and "Resume now" option.
  - *Failed State:* Shows error message in red (`StatusError`).
  - *Empty Filter State:* Shows placeholder icon when no items match current filter.

---

### 1.3 Explore & Search Screen
- **Route:** `Screen.Explore.route` (`"explore"`)
- **Primary Kotlin File:** [ExploreScreen.kt](../app/src/main/java/com/novadrop/android/ui/explore/ExploreScreen.kt)
- **Primary Purpose:** Media extraction sandbox and search discovery. Analyzes pasted links to display stream resolution presets or performs live YouTube searches.
- **Main UI Components:**
  - Header Title ("Explore & Search")
  - Input field with paste/clear icon buttons
  - Recent Searches input chips with deletion
  - Analyzed Media Card Preview (thumbnail, title, uploader, format preset buttons)
  - Playlist Inspection trigger button
  - Search Results list cards
  - Format Selection Bottom Sheet (`ModalBottomSheet`)
- **Data Dependencies:** `recentSearches: List<String>`, `initialExploreUrl: String`
- **Interactions:**
  - Enter URL & click "Analyze Link" -> invokes `app.extractorEngine.extractMetadata(url)`.
  - Enter search term & click "Search" -> invokes `app.extractorEngine.search(query)`.
  - Click search result card -> opens format selection bottom sheet.
  - Click format preset -> calls `onStartDownload(url, title, format)`.
  - Click "Inspect Playlist Tracks" -> inspects playlist entries and enqueues all items.
- **States:**
  - *Analyzing / Searching State:* Shows `CircularProgressIndicator` on button.
  - *Metadata Success State:* Displays card preview with format buttons.
  - *Error State:* Displays error banner in `errorContainer` color.

---

### 1.4 Media Library Screen
- **Route:** `Screen.Library.route` (`"library"`)
- **Primary Kotlin File:** [LibraryScreen.kt](../app/src/main/java/com/novadrop/android/ui/library/LibraryScreen.kt)
- **Primary Purpose:** Local catalog manager for browsing and sharing downloaded media files.
- **Main UI Components:**
  - Header Title with Grid/List layout toggle button
  - Search text field
  - Category Filter Chips (All Media, Videos, Music, Images)
  - Grid View (`LazyVerticalGrid`) or List View (`LazyColumn`)
  - Share intent trigger (`shareMediaFile`) via Android [FileProvider](class://androidx.core.content.FileProvider)
- **Data Dependencies:** `downloads: List<DownloadJob>`
- **Interactions:**
  - Filter library by media category or search term.
  - Toggle between 2-column grid view and single-row list view.
  - Click media card -> triggers `onPlayJob(job)`.
  - Click share icon -> launches system `Intent.ACTION_SEND` chooser.
  - Click delete icon -> calls `onDeleteJob(id)`.
- **States:**
  - *Empty State:* Shows `FolderOpen` icon when no files match category/search.
  - *Populated State:* Displays media cards with thumbnails, file sizes, and multi-file badges.

---

### 1.5 Settings Screen
- **Route:** `Screen.Settings.route` (`"settings"`)
- **Primary Kotlin File:** [SettingsScreen.kt](../app/src/main/java/com/novadrop/android/ui/settings/SettingsScreen.kt)
- **Primary Purpose:** App configuration hub managing themes, formats, player lifecycle, storage directories, and scheduler settings.
- **Main UI Components:**
  - Accordion Sections (`SettingsAccordionCard`):
    1. *Downloads & Formats:* Default format radio buttons & queue finish actions.
    2. *Storage & Scoped Media:* Public storage path breakdown.
    3. *Appearance & Theming:* Accent palette circles (Ocean, Emerald, Violet, Amber, Rose) & Dark Mode switch.
    4. *Notifications:* Notification toggle switch.
    5. *Player Behavior (v0.5.2):* Fullscreen exit options for audio & video (Ask, Mini-player, Exit).
    6. *Engines & Tools:* Active engine version status box.
    7. *Rate Limit & Night-Owl:* Off-peak scheduler switch.
    8. *About & Legal:* Version info & Terms of Use dialog trigger.
- **Data Dependencies:** `preferences: UserPreferences`
- **Interactions:**
  - Expand/collapse accordion cards.
  - Radio button selection triggers repository updates (`setThemeAccent`, `setDefaultFormat`, `setExitPlayerVideo`, etc.).
  - Toggle switches update DataStore preferences.

---

## 2. Overlay & Secondary Components Inventory

### 2.1 Player Overlay & Mini-Player Sheet
- **Primary Kotlin File:** [PlayerSheet.kt](../app/src/main/java/com/novadrop/android/ui/player/PlayerSheet.kt)
- **Primary Composable:** `PlayerOverlay`
- **Primary Purpose:** Global media player surface providing mini-player bottom bar and fullscreen media playback.
- **Components:**
  - *Exit Confirmation Dialog:* Asks "Continue watching?" when exiting video playback.
  - *Mini-Player Bar:* Fixed bottom surface displaying progress line, title, play/pause button, expand button, and close button.
  - *Fullscreen Surface:* AndroidView hosting Media3 `PlayerView` (or vinyl disc artwork for audio files), seek bar, position timer, transport controls (Rewind 10s, Play/Pause, Forward 30s), and playback speed buttons (0.75x..2.0x).
- **Data Dependencies:** `PlaybackManager` singleton StateFlows (`isPlaying`, `currentTitle`, `currentPositionMs`, `durationMs`, `isAudioOnly`, `isPlayerActive`, `isMiniPlayer`).

---

## 3. Reusable UI Components Inventory

| Component Composable | File | Responsibilities |
| :--- | :--- | :--- |
| `DownloadJobCard` | `DownloaderScreen.kt` | Card item representing a download job with thumbnail, progress bar, speed, ETA, and action buttons. |
| `ScheduledCountdownRow` | `DownloaderScreen.kt` | Highlighted warning box with live countdown timer for rate-limited tasks. |
| `SettingsAccordionCard` | `SettingsScreen.kt` | Expandable/collapsible setting section card with icon, title, subtitle, and divider. |
| `LibraryGridCard` | `LibraryScreen.kt` | Grid cell card for media files with thumbnail, file count badge, size, and share/delete buttons. |
| `LibraryListRow` | `LibraryScreen.kt` | Horizontal list item for media files with thumbnail, file metadata, share, and delete buttons. |
| `PlayerOverlay` | `PlayerSheet.kt` | Global playback overlay handling mini-player and fullscreen video/audio playback. |

---

## 4. Design Tokens & Theme Resources

### 4.1 Color System (`Color.kt`)
- `BgDark` = `#090A0F`
- `SurfaceDark` = `#121520`
- `SurfaceCard` = `#1A1E2E`
- `SurfaceBorder` = `#242A40`
- `OceanBlue` = `#38BDF8` / `OceanBlueDark` = `#0284C7`
- `EmeraldMint` = `#00E599` / `EmeraldMintDark` = `#059669`
- `VioletGlow` = `#7C6DFA` / `VioletGlowDark` = `#6D28D9`
- `SolarAmber` = `#F59E0B` / `SolarAmberDark` = `#D97706`
- `CrimsonRose` = `#F43F5E` / `CrimsonRoseDark` = `#E11D48`
- `StatusSuccess` = `#10B981`
- `StatusWarning` = `#F59E0B`
- `StatusError` = `#EF4444`

### 4.2 XML Resources
- **Strings (`res/values/strings.xml`):**
  - `app_name` = `"NovaDrop"`
  - `download_channel_name` = `"Media Downloads"`
  - `playback_channel_name` = `"Media Playback"`
- **Colors (`res/values/colors.xml`):**
  - Defines `purple_500`, `teal_200`, `black`, `white`, `ic_launcher_background`.
- **File Provider (`res/xml/file_paths.xml`):**
  - Configures `<external-files-path>` and `<external-path>` for sharing files via `FileProvider`.
