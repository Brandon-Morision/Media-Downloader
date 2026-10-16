# NovaDrop Android — UI/UX Redesign Strategy & Roadmap

> **Document Purpose:** Strategic, phased execution roadmap for modernizing the NovaDrop Android user interface without breaking underlying media extraction, background service, or database behavior.

---

## 1. Vision & Key UI Objectives

The primary goal of the upcoming UI redesign phase is to elevate NovaDrop into a **world-class, Material 3 Expressive Android application** that feels modern, fluid, accessible, and native.

### Key Objectives
1. **Material 3 Alignment:** Upgrade layouts to leverage modern M3 Expressive design patterns, dynamic color integration, refined elevation cards, and consistent typography scales.
2. **Edge-to-Edge & Safe Insets:** Implement proper window insets (`WindowInsets.systemBars`, `ime`) so UI elements adapt smoothly behind transparent status and navigation bars.
3. **Architectural UI Separation:** Refactor screen logic into dedicated ViewModels exposing immutable `StateFlow<UiState>` data classes to decouple UI rendering from repository/database calls.
4. **Enhanced Accessibility & Motion:** Ensure all clickable elements adhere to the minimum 48dp touch target guideline and apply smooth layout transition animations for expand/collapse cards and mini-player transitions.

---

## 2. Phased Implementation Roadmap

```
[Phase 1: Foundation & Design Tokens] 
                 │
                 ▼
[Phase 2: Navigation & Edge-to-Edge Insets]
                 │
                 ▼
[Phase 3: Screen ViewModels & State Separation]
                 │
                 ▼
[Phase 4: Component Polish & Motion Improvements]
```

---

### Phase 1: Core Design System & Token Standardization

#### Scope & File Targets
- [Color.kt](../app/src/main/java/com/novadrop/android/ui/theme/Color.kt)
- [Theme.kt](../app/src/main/java/com/novadrop/android/ui/theme/Theme.kt)
- `res/values/strings.xml`

#### Planned Changes
1. **String Externalization:** Extract hardcoded strings from screen files (`HomeScreen.kt`, `ExploreScreen.kt`, `DownloaderScreen.kt`, `LibraryScreen.kt`, `SettingsScreen.kt`) into `strings.xml` to support localization and clean maintenance.
2. **Typography Scale:** Define a centralized `Typography.kt` file using Material 3 `Typography` tokens (`titleLarge`, `bodyMedium`, `labelSmall`) rather than hardcoding `fontSize = 14.sp` and `fontWeight` on individual `Text` composables.
3. **Spacing Tokens:** Create a unified `Dimensions` object (e.g., `Spacing.small = 8.dp`, `Spacing.medium = 16.dp`, `Spacing.large = 24.dp`, `CornerRadius.card = 16.dp`).

---

### Phase 2: Navigation, Layout Architecture & Edge-to-Edge Insets

#### Scope & File Targets
- [MainActivity.kt](../app/src/main/java/com/novadrop/android/ui/MainActivity.kt)
- [Navigation.kt](../app/src/main/java/com/novadrop/android/ui/navigation/Navigation.kt)

#### Planned Changes
1. **Edge-to-Edge Enablement:** Call `enableEdgeToEdge()` inside `MainActivity.onCreate()` and configure window background colors.
2. **Insets Handling:** Wrap root scaffold content in `WindowInsets.safeDrawing` or apply `Modifier.windowInsetsPadding(WindowInsets.systemBars)` to bottom navigation bars and top app bars so content does not overlap system bars.
3. **Keyboard Inset Padding:** Apply `WindowInsets.ime` padding to input fields on `HomeScreen` and `ExploreScreen` so text fields pan smoothly above the soft keyboard when focused.

---

### Phase 3: ViewModel Extraction & UI State Decoupling

#### Scope & File Targets
- `ui/home/HomeViewModel.kt` [NEW]
- `ui/downloader/DownloaderViewModel.kt` [NEW]
- `ui/explore/ExploreViewModel.kt` [NEW]
- `ui/library/LibraryViewModel.kt` [NEW]
- `ui/settings/SettingsViewModel.kt` [NEW]

#### Planned Changes
1. **Dedicated ViewModels:** Create standard Android `ViewModel` classes for each screen destination.
2. **UI State Contracts:** Define explicit UI state sealed interfaces/data classes (e.g., `ExploreUiState.Loading`, `ExploreUiState.Success`, `ExploreUiState.Error`).
3. **Decouple Composable Calls:** Eliminate direct coroutine database invocations inside composable files (e.g., `coroutineScope.launch { app.database.searchHistoryDao().insertSearch(...) }`). The composables will simply dispatch intents/events to their ViewModels.

---

### Phase 4: Downloader Queue & Explore Screen Overhaul

#### Scope & File Targets
- [DownloaderScreen.kt](../app/src/main/java/com/novadrop/android/ui/downloader/DownloaderScreen.kt)
- [ExploreScreen.kt](../app/src/main/java/com/novadrop/android/ui/explore/ExploreScreen.kt)

#### Planned Changes
1. **Interactive Download Cards:** Redesign `DownloadJobCard` with animated state transitions between pending, downloading, paused, and completed states using `AnimatedVisibility` and `animateContentSize()`.
2. **Rate Limit Visual Countdown:** Polish `ScheduledCountdownRow` with a visual countdown timer ring and clean action buttons.
3. **Format Selection Sheets:** Modernize the format selection bottom sheet with clear audio vs. video category tabs, filesize estimates, and quality badges.

---

### Phase 5: Player Overlay & Media Library Enhancement

#### Scope & File Targets
- [PlayerSheet.kt](../app/src/main/java/com/novadrop/android/ui/player/PlayerSheet.kt)
- [LibraryScreen.kt](../app/src/main/java/com/novadrop/android/ui/library/LibraryScreen.kt)

#### Planned Changes
1. **Mini-Player Motion:** Implement smooth swipe-to-dismiss gestures and seamless expansion animations using Compose layout transitions.
2. **Library Media Grid:** Enhance media cards with high-resolution thumbnail caching via Coil, multi-file stack indicators, and touch-friendly share/delete menus.

---

## 3. High-Risk Areas & Safety Checklist for Redesign

To ensure visual redesigns do not break existing functionality or introduce regressions, follow this mandatory safety checklist before making changes to major screens:

- [ ] **Preserve Task Identifiers:** Ensure `job.id` strings are unmodified during UI list re-renders so Room database queries and foreground service actions match correctly.
- [ ] **Preserve MediaMuxer Track Types:** Ensure format selection IDs (`video-1080`, `audio-m4a`, `auto`) passed from UI to repository remain consistent with expectations in `NativeExtractorEngine.kt`.
- [ ] **Preserve Playback Service Lifecycle:** Ensure player overlay dismiss actions call `playbackManager.stopAndClose()` to release ExoPlayer resources and unbind `MediaPlaybackService`.
- [ ] **Maintain Unit Test Green Baseline:** Verify that all 61 unit tests (`./gradlew app:testDebugUnitTest`) pass after any UI state or ViewModel refactoring.
