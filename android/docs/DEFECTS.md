# NovaDrop Android — Confirmed Defect Register

> **Document Status:** Authoritative Defect Register  
> **Last Updated:** Current Session  

---

| ID | File Path | Line | Severity | Tag | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **DEF-001** | `android/app/src/main/java/com/novadrop/android/service/DownloadForegroundService.kt` | 60 | High | `[Verified in code]` | Async DB read before `startForeground()` risks `ForegroundServiceDidNotStartInTimeException` on Android 12+. |
| **DEF-002** | `android/app/src/main/java/com/novadrop/android/service/DownloadForegroundService.kt` | 141 | High | `[Verified in code]` | Late `activeJobCoroutines[jobId] = job` assignment causes race condition leaving stale map entries and hanging service. |
| **DEF-003** | `android/app/src/main/java/com/novadrop/android/service/DownloadForegroundService.kt` | 68 | High | `[Verified in code]` | Capturing static `domainJob` at launch overwrites UI-triggered `PAUSED`/`CANCELLED` states back to `RUNNING` on progress ticks. |
| **DEF-004** | `android/app/src/main/java/com/novadrop/android/data/local/NovaDropDatabase.kt` | 35 | High | `[Verified in code]` | Room uses `fallbackToDestructiveMigration()` with `exportSchema=false`; schema updates silently wipe user download records. |
| **DEF-005** | `android/app/src/main/java/com/novadrop/android/engine/native/NativeExtractorEngine.kt` | 120 | High | `[Verified in code]` | Adaptive video streams filtered to MP4 containers only, excluding 1440p/4K VP9/AV1 streams from user selection. |
| **DEF-006** | `android/app/src/main/java/com/novadrop/android/engine/native/NativeExtractorEngine.kt` | 185 | Medium | `[Verified in code]` | HTTP response body leaked on non-2xx response in Reddit metadata extraction. |
| **DEF-007** | `android/app/src/main/java/com/novadrop/android/engine/native/NativeExtractorEngine.kt` | 246 | Medium | `[Verified in code]` | HTTP response body leaked on non-2xx response in generic HTML metadata extraction. |
| **DEF-008** | `android/app/src/main/java/com/novadrop/android/engine/native/NativeExtractorEngine.kt` | 687 | Medium | `[Verified in code]` | HTTP response body leaked on non-2xx response in stream download loop. |
| **DEF-009** | `android/app/src/main/java/com/novadrop/android/engine/native/NativeExtractorEngine.kt` | 704 | Medium | `[Verified in code]` | Pause executes `wait()` inside socket read loop with HTTP TCP connection held open indefinitely. |
| **DEF-010** | `android/app/src/main/java/com/novadrop/android/engine/native/NativeExtractorEngine.kt` | 730 | Medium | `[Verified in code]` | Download failures delete partial files; engine has no HTTP `Range` request header support to resume downloads. |
| **DEF-011** | `android/app/src/main/java/com/novadrop/android/engine/native/NativeExtractorEngine.kt` | 635 | Medium | `[Verified in code]` | Direct media extension determined by `selectedFormat` ("mp3"), writing MP4 container bytes into `.mp3` files. |
| **DEF-012** | `android/app/src/main/java/com/novadrop/android/engine/native/NativeExtractorEngine.kt` | 860 | Medium | `[Verified in code]` | Reddit video `fallback_url` is video-only (`DASH_720.mp4`), producing silent videos without audio muxing. |
| **DEF-013** | `android/app/src/main/java/com/novadrop/android/engine/native/NativeExtractorEngine.kt` | 162 | Low | `[Verified in code]` | `playlistCount = 10` hardcoded in YouTube extraction. |
| **DEF-014** | `android/app/src/main/java/com/novadrop/android/engine/native/NativeExtractorEngine.kt` | 302 | Low | `[Verified in code]` | `durationFormatted = "Video"` and `viewCountFormatted = "YouTube"` hardcoded in YouTube search results. |
| **DEF-015** | `android/app/src/main/java/com/novadrop/android/engine/native/NativeExtractorEngine.kt` | 45 | Low | `[Verified in code]` | `engineVersion = "2026.10.14"` hardcoded as literal string. |
| **DEF-016** | `android/app/src/main/java/com/novadrop/android/core/util/Formatters.kt` | 50 | Low | `[Verified in code]` | `Formatters.detectTool` is cosmetic string matching ("yt-dlp"/"gallery-dl") without underlying engine routing. |
| **DEF-017** | `android/app/src/main/java/com/novadrop/android/engine/native/NativeExtractorEngine.kt` | 280 | Medium | `[Verified in code]` | YouTube search regex-scrapes HTML instead of invoking `NewPipeExtractor`'s `YouTubeSearchExtractor`. |
| **DEF-018** | `android/app/src/main/java/com/novadrop/android/engine/native/NativeExtractorEngine.kt` | 342 | Medium | `[Verified in code]` | `inspectPlaylist` reads only first page of `relatedItems` without calling `getMoreItems()` pagination. |
| **DEF-019** | `android/app/src/main/java/com/novadrop/android/playback/MediaPlaybackService.kt` | 23 | High | `[Verified in code]` | `onDestroy()` calls `player.release()` on singleton `ExoPlayer`, causing crash on subsequent play attempts. |
| **DEF-020** | `android/app/src/main/res/xml/file_paths.xml` | 3 | High | `[Verified in code]` | Overly broad FileProvider configuration exposes entire internal and external storage roots (`path="."`). |
| **DEF-021** | `android/app/src/main/AndroidManifest.xml` | 21 | Medium | `[Verified in code]` | Missing `android:dataExtractionRules` and `android:fullBackupContent` rules while `allowBackup="true"`. |
| **DEF-022** | `android/app/src/main/java/com/novadrop/android/engine/native/NativeExtractorEngine.kt` | 561 | Medium | `[Verified in code]` | Temporary video/audio tracks for adaptive muxing are written directly into public downloads directory. |
| **DEF-023** | `android/app/src/main/java/com/novadrop/android/ui/MainActivity.kt` | 371 | High | `[Verified in code]` | Playlist inspector enqueues 500 items simultaneously without concurrency throttling or worker queues. |
| **DEF-024** | `android/app/src/main/java/com/novadrop/android/ui/ShareReceiverActivity.kt` | 37 | Low | `[Verified in code]` | Share-intent URL extraction regex truncates valid URLs containing `+`, `,`, `;`, `@`, `(`, `)`. |
| **DEF-025** | `android/app/src/main/java/com/novadrop/android/engine/native/NativeExtractorEngine.kt` | 795 | High | `[Verified in code]` | Scoped storage write failure on API 29+: writing via `FileOutputStream` directly to public Downloads fails without MediaStore export. |
| **DEF-026** | `android/app/src/main/java/com/novadrop/android/engine/native/NativeExtractorEngine.kt` | 338 | Low | `[Verified in code]` | Search fallback appends hardcoded Rickroll result (`id = "dQw4w9WgXcQ"`). |
| **DEF-027** | `android/app/src/main/java/com/novadrop/android/engine/native/NativeExtractorEngine.kt` | 400 | Low | `[Verified in code]` | Non-YouTube playlist inspection returns dummy 8-track placeholder playlist ("Album Playlist"). |
| **DEF-028** | `android/app/src/main/java/com/novadrop/android/engine/native/NativeExtractorEngine.kt` | 695 | Low | `[Verified in code]` | Download stream content-length fallback defaults to hardcoded `35_000_000L` (35 MB). |
| **DEF-029** | `android/app/src/main/java/com/novadrop/android/service/DownloadForegroundService.kt` | 23 | High | `[Verified in code]` | Missing `onTimeout()` callback implementation for `dataSync` foreground service on Android 15 / API 35 (`targetSdk 35`). |
| **DEF-030** | `android/app/src/main/java/com/novadrop/android/service/DownloadForegroundService.kt` | 31 | Medium | `[Verified in code]` | WakeLock acquired in `onCreate` for static 2 hours even when no transfers are active. |
| **DEF-031** | `android/app/src/main/java/com/novadrop/android/service/DownloadForegroundService.kt` | 53 | Medium | `[Verified in code]` | `START_NOT_STICKY` with in-memory map tracking leaves active tasks permanently stuck in `RUNNING` state after process death. |
| **DEF-032** | `android/app/src/main/java/com/novadrop/android/data/local/dao/DownloadJobDao.kt` | 15 | High | `[Verified in code]` | `getAllJobsFlow()` re-emits and JSON-parses every table row on every 1-second progress update, causing CPU/GC lag. |
| **DEF-033** | `android/app/src/main/AndroidManifest.xml` | 33 | Low | `[Verified in code]` | `android:usesCleartextTraffic="true"` configured application-wide without Network Security Config domain controls. |
