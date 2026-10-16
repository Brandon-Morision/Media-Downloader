# NovaDrop Android — Confirmed Defect Register

> **Document Status:** Authoritative Defect Log  
> **Last Updated:** Current Session  

---

| ID | File Path | Line | Severity | Tag | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **DEF-001** | `app/src/main/java/com/novadrop/android/service/DownloadForegroundService.kt` | 54 | High | `[Verified in code]` | Async DB read before `startForeground()` risks `ForegroundServiceDidNotStartInTimeException` on Android 12+. |
| **DEF-002** | `app/src/main/java/com/novadrop/android/service/DownloadForegroundService.kt` | 123 | High | `[Verified in code]` | Late `activeJobCoroutines[jobId] = job` assignment causes race condition leaving stale map entries and hanging service. |
| **DEF-003** | `app/src/main/java/com/novadrop/android/service/DownloadForegroundService.kt` | 62 | High | `[Verified in code]` | Capturing static `domainJob` at launch overwrites UI-triggered `PAUSED`/`CANCELLED` states back to `RUNNING` on progress ticks. |
| **DEF-004** | `app/src/main/java/com/novadrop/android/data/local/NovaDropDatabase.kt` | 33 | High | `[Verified in code]` | Room uses `fallbackToDestructiveMigration()`; schema updates silently wipe user download records. |
| **DEF-005** | `app/src/main/java/com/novadrop/android/engine/native/NativeExtractorEngine.kt` | 472 | High | `[Verified in code]` | Adaptive video streams filtered to MP4 containers only, excluding 1440p/4K VP9/AV1 streams. |
| **DEF-006** | `app/src/main/java/com/novadrop/android/engine/native/NativeExtractorEngine.kt` | 185 | Medium | `[Verified in code]` | HTTP response body leaked on non-2xx response in Reddit metadata extraction. |
| **DEF-007** | `app/src/main/java/com/novadrop/android/engine/native/NativeExtractorEngine.kt` | 246 | Medium | `[Verified in code]` | HTTP response body leaked on non-2xx response in generic HTML metadata extraction. |
| **DEF-008** | `app/src/main/java/com/novadrop/android/engine/native/NativeExtractorEngine.kt` | 652 | Medium | `[Verified in code]` | HTTP response body leaked on non-2xx response in stream download loop. |
| **DEF-009** | `app/src/main/java/com/novadrop/android/engine/native/NativeExtractorEngine.kt` | 667 | Medium | `[Verified in code]` | Pause executes `wait()` inside socket read loop with HTTP TCP connection held open indefinitely. |
| **DEF-010** | `app/src/main/java/com/novadrop/android/engine/native/NativeExtractorEngine.kt` | 693 | Medium | `[Verified in code]` | Download failures delete partial files; engine has no HTTP `Range` request header support to resume downloads. |
| **DEF-011** | `app/src/main/java/com/novadrop/android/engine/native/NativeExtractorEngine.kt` | 600 | Medium | `[Verified in code]` | Direct media extension determined by `selectedFormat` ("mp3"), writing MP4 container bytes into `.mp3` files. |
| **DEF-012** | `app/src/main/java/com/novadrop/android/engine/native/NativeExtractorEngine.kt` | 823 | Medium | `[Verified in code]` | Reddit video `fallback_url` is video-only (`DASH_720.mp4`), producing silent videos without audio muxing. |
| **DEF-013** | `app/src/main/java/com/novadrop/android/engine/native/NativeExtractorEngine.kt` | 162 | Low | `[Verified in code]` | `playlistCount = 10` hardcoded in YouTube extraction. |
| **DEF-014** | `app/src/main/java/com/novadrop/android/engine/native/NativeExtractorEngine.kt` | 302 | Low | `[Verified in code]` | `durationFormatted = "Video"` and `viewCountFormatted = "YouTube"` hardcoded in YouTube search results. |
| **DEF-015** | `app/src/main/java/com/novadrop/android/engine/native/NativeExtractorEngine.kt` | 45 | Low | `[Verified in code]` | `engineVersion = "2026.10.14"` hardcoded as literal string. |
| **DEF-016** | `app/src/main/java/com/novadrop/android/core/util/Formatters.kt` | 46 | Low | `[Verified in code]` | `Formatters.detectTool` is cosmetic string matching ("yt-dlp"/"gallery-dl") without underlying engine routing. |
| **DEF-017** | `app/src/main/java/com/novadrop/android/engine/native/NativeExtractorEngine.kt` | 280 | Medium | `[Verified in code]` | YouTube search regex-scrapes HTML instead of invoking `NewPipeExtractor`'s `YouTubeSearchExtractor`. |
| **DEF-018** | `app/src/main/java/com/novadrop/android/engine/native/NativeExtractorEngine.kt` | 342 | Medium | `[Verified in code]` | `inspectPlaylist` reads only first page of `relatedItems` without calling `getMoreItems()` pagination. |
| **DEF-019** | `app/src/main/java/com/novadrop/android/playback/MediaPlaybackService.kt` | 24 | High | `[Verified in code]` | `onDestroy()` calls `player.release()` on singleton `ExoPlayer`, causing crash on subsequent play attempts. |
| **DEF-020** | `app/src/main/res/xml/file_paths.xml` | 3 | High | `[Verified in code]` | Overly broad FileProvider configuration exposes entire internal and external storage roots (`path="."`). |
| **DEF-021** | `app/src/main/AndroidManifest.xml` | 21 | Medium | `[Verified in code]` | Missing `android:dataExtractionRules` and `android:fullBackupContent` rules while `allowBackup="true"`. |
| **DEF-022** | `app/src/main/java/com/novadrop/android/engine/native/NativeExtractorEngine.kt` | 530 | Medium | `[Verified in code]` | Temporary video/audio tracks for adaptive muxing are written directly into public downloads directory. |
| **DEF-023** | `app/src/main/java/com/novadrop/android/ui/MainActivity.kt` | 364 | High | `[Verified in code]` | Playlist inspector enqueues 500 items simultaneously without concurrency throttling or worker queues. |
| **DEF-024** | `app/src/main/java/com/novadrop/android/ui/ShareReceiverActivity.kt` | 36 | Low | `[Verified in code]` | Share-intent URL extraction regex `(https?://[\w\-\.\?\&\=\%\#\/\~]+)` truncates URLs containing `+`, `,`, `;`, `@`, `(`, `)`. |
