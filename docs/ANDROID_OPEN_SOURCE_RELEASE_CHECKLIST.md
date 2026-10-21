# NovaDrop Android — Open-Source Release Readiness Checklist & Audit

**Target Version:** 0.5.2 (Version Code: 50200)  
**Package ID:** `com.novadrop.android` (Debug: `com.novadrop.android.debug`)  
**Audit Scope:** Legal, licensing, architectural compliance, security, privacy, distribution channel readiness, and independent reproducibility.  
**Auditor:** Senior Android Engineer & Release Lead  
**Date:** October 15, 2026  

---

## 1. Legal & Licensing Audit

### A. Copyleft Compliance (NewPipeExtractor GPL-3.0)
- [x] **Upstream Dependency Verified:** NovaDrop links with `com.github.TeamNewPipe:NewPipeExtractor:v0.26.5`, which is licensed under the **GNU General Public License v3.0 (GPL-3.0)**.
- [x] **Combined Work Determination:** Because NovaDrop compiles and directly links with NewPipeExtractor in-process via Java/Kotlin bindings, the resulting binary constitutes a combined work under GPL-3.0 Section 5.
- [x] **Project License Declaration:** NovaDrop Android is licensed under **GPL-3.0** (or later).
- [x] **Complete Corresponding Source Availability:** All application source code, build scripts (`build.gradle.kts`, `settings.gradle.kts`), Gradle wrapper configurations, and custom utility classes are made publicly available without proprietary binary blobs.
- [x] **No Commercial Tying:** The application does not impose additional downstream restrictions, DRM, or proprietary locks violating GPL-3.0 Section 10.

### B. Third-Party Notices & Attribution
- [x] **Third-Party Inventory:** Comprehensive dependency catalog created in [`docs/THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
- [x] **Upstream Notices Preserved:** License texts for GPL-3.0, Apache-2.0, MIT, BSD 3-Clause, and MPL-2.0 documented in full.
- [x] **Attribution Requirements Met:** Notice requirements for Apache-2.0 and MIT dependencies (OkHttp, Coil, AndroidX, jsoup) satisfied.

### C. Trademark & Branding Boundaries
- [x] **No Upstream Trademark Infringement:** NovaDrop Android does not brand itself as "NewPipe", "NewPipe Downloader", or "Official YouTube Downloader".
- [x] **Disclaimer of Affiliation:** Prominent notices declare independence from Google LLC, YouTube, and TeamNewPipe.

---

## 2. Privacy, Permissions & Security Audit

### A. Android Manifest Permissions Review

| Permission | Protection Level | Necessity & Usage in NovaDrop | Assessment |
| :--- | :--- | :--- | :--- |
| `android.permission.INTERNET` | Normal | Required for resolving stream metadata and streaming media bytes. | **PASS** — Strictly required. |
| `android.permission.ACCESS_NETWORK_STATE` | Normal | Used by OkHttp and NetworkMonitor to check connectivity before queueing jobs. | **PASS** — Standard practice. |
| `android.permission.FOREGROUND_SERVICE` | Normal | Required to maintain active downloads when user leaves the application. | **PASS** — Required for Android 9+. |
| `android.permission.FOREGROUND_SERVICE_DATA_SYNC` | Normal | Targeted foreground service type declared in accordance with Android 14+ (API 34/35) requirements. | **PASS** — Android 14/15 compliant. |
| `android.permission.POST_NOTIFICATIONS` | Dangerous (Runtime) | Requested at runtime on Android 13+ (API 33+) to show download progress notifications. | **PASS** — Clean runtime prompt. |
| `android.permission.WAKE_LOCK` | Normal | Held during active media muxing and write operations to prevent CPU sleep. Released on finish. | **PASS** — Managed cleanly in Service. |

### B. Storage & Scoped Storage Compliance
- [x] **No Legacy External Storage Request:** NovaDrop does not request `READ_EXTERNAL_STORAGE` or `WRITE_EXTERNAL_STORAGE` on API 29+.
- [x] **Standard Public Storage Directories:** Saves media directly to standard user-accessible directories using `Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)/NovaDrop/{Videos, Music, Images}`.
- [x] **MediaScanner Registration:** Finished files trigger `MediaScannerConnection.scanFile()` so that downloaded tracks immediately appear in user gallery and music player apps without requiring storage permissions.

### C. Network Security & Cryptographic Integrity
- [x] **Cleartext Traffic Policy:** Cleartext HTTP traffic is disabled by default (`android:usesCleartextTraffic="false"`). All media extraction and streaming uses HTTPS.
- [x] **TLS & Trust Managers:** No custom insecure `TrustManager`, permissive `HostnameVerifier`, or disabled certificate validation exists in production code.
- [x] **Sanitization of Logs:** URLs containing sensitive tokens, cookies, or signed CDN query parameters are stripped before writing to logcat.

### D. Component Export & IPC Hardening
- [x] **Activities Hardened:** `MainActivity` has `android:exported="true"` solely because it is the `MAIN`/`LAUNCHER` activity.
- [x] **Services Hardened:** `DownloadForegroundService` is declared with `android:exported="false"`, preventing external applications from spoofing or injecting download commands.
- [x] **PendingIntent Flags:** All notification pending intents explicitly use `PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT`.

---

## 3. Distribution Channel Strategy & Analysis

### Channel 1: F-Droid (Recommended Primary Channel)
- **Feasibility:** **High**. F-Droid specializes in free and open-source software built from source.
- **Licensing Fit:** GPL-3.0 compliance aligns with F-Droid requirements.
- **Anti-Features Declared:** F-Droid requires tagging with:
  - `UpstreamNonFree` (NewPipeExtractor interfaces with proprietary YouTube APIs).
  - `NonFreeNet` (accesses YouTube / Reddit servers that do not meet FSF libre network services criteria).
- **Build Requirements:** F-Droid builds all applications from tag sources in isolated Docker environments using their own Gradle build server. NovaDrop's clean Gradle wrapper and zero proprietary binaries satisfy F-Droid inclusion policies.

### Channel 2: GitHub Releases & IzzyOnDroid (Recommended Direct Channels)
- **Feasibility:** **Immediate**.
- **Delivery:** Publish signed release APKs (`app-release.apk`) directly to GitHub repository releases with SHA-256 checksums.
- **IzzyOnDroid Integration:** IzzyOnDroid repo directly tracks GitHub Releases of open-source Android apps and provides automated client updates via the F-Droid app.

### Channel 3: Google Play Store (Not Recommended / Prohibited)
- **Feasibility:** **Prohibited by Store Policy**.
- **Blocker:** Google Play Developer Distribution Agreement (Section 4.9) and YouTube Terms of Service strictly forbid applications that download or rip media from YouTube without express authorization. Submission risks automated developer account termination.

---

## 4. Open-Source Documentation & Contributor Readiness

### A. Build Prerequisites & Instructions
- **JDK:** Java 21 (Eclipse Adoptium Temurin 21 recommended).
- **Android SDK:** `compileSdk = 35`, `targetSdk = 35`, `minSdk = 26`, build-tools `35.0.0`.
- **Command to Build Debug APK:**
  ```powershell
  cd android
  .\gradlew.bat assembleDebug --no-daemon
  ```
- **Command to Run Automated Tests:**
  ```powershell
  cd android
  .\gradlew.bat testDebugUnitTest --no-daemon
  ```

### B. Upstream Service Maintenance & Disclaimer
- [x] **Service Volatility Notice:** YouTube InnerTube APIs and streaming endpoints change frequently. Extraction failures may occur when upstream protocols change.
- [x] **Extractor Updates:** Users and contributors are informed that updating NewPipeExtractor or applying extractor updates is a normal part of application maintenance.

### C. User Responsibility Notice
- [x] **Legal Notice:** NovaDrop Android is designed for downloading public domain, Creative Commons, and user-authorized media. Users are solely responsible for ensuring their usage complies with local copyright laws, intellectual property rights, and terms of service.

---

## 5. Engineering Release Gate Checklist

| Release Gate | Verification Requirement | Status | Verification Reference |
| :--- | :--- | :--- | :--- |
| **G1: Build Integrity** | Clean build from source without local developer environment dependencies. | **PASS** | `assembleDebug` completed cleanly. |
| **G2: Automated Unit Tests** | All unit, integration, and parser tests pass (minimum 61 tests). | **PASS** | 61/61 tests passing (100% success rate). |
| **G3: Real Device Extraction** | Live InnerTube URL extraction succeeds inside the Android environment. | **PASS** | Verified on `emulator-5554` with direct DNS resolution. |
| **G4: Real Media Download** | Full progressive and adaptive media files downloaded to public storage. | **PARTIAL / NOT TESTED** | Progressive 360p (629KB MP4) downloaded and verified on disk in Phase 2.2. Adaptive streaming download/muxing to public storage was **NOT TESTED** on device in Phase 2.2 (isolated synthetic muxing verified later in Phase 3.0 Gate 2.4 via `MediaMuxerUtilInstrumentedTest`). |
| **G5: Real Playback** | Media3 ExoPlayer decodes and renders downloaded video and audio with seeking. | **PASS** | Full playback & seeking verified in UI. |
| **G6: License Compliance** | GPL-3.0 compatibility, notices, and source availability prepared. | **PASS** | `THIRD_PARTY_NOTICES.md` generated. |
| **G7: Physical Device Gate** | Tested on real physical Android hardware. | **BLOCKED (ENV)** | No physical device attached to test rig. Manual test checklist provided. |
| **G8: Durable Range Resume** | HTTP 206 byte-range resume across process death. | **DEFERRED (ARCH)** | Deferred to Phase 3 with full design blueprint to safeguard current stable pipeline. |

> [!CAUTION]
> **Phase 3.0 Audit Correction:**
> Gate G4 was previously labeled unqualified `PASS` in Phase 2.2. However, audit during Phase 3.0 revealed that while progressive 360p download was empirically verified on device, adaptive stream downloading and muxing to public storage had **never** been executed on device during Phase 2.2 (`NOT TESTED`). Furthermore, release readiness claims were premature as release APKs were not signed or tested under R8 minification until Phase 3.0.


---

## 6. Manual Physical Device Verification Protocol (For Field Testers)

Because no physical Android device was connected to the host environment, field testers must execute this standard verification protocol on a real hardware device before general public binary distribution:

1. **Device Preparation:**
   - Any physical Android phone or tablet running Android 8.0 (API 26) through Android 15 (API 35).
   - Developer Options > USB Debugging enabled.
2. **Installation:**
   ```bash
   adb install -r android/app/build/outputs/apk/debug/app-debug.apk
   ```
3. **Test Step 1 — Application Launch:**
   - Launch NovaDrop from the app drawer.
   - Verify splash screen dismisses and Explore screen loads.
   - Verify no crash occurs during NewPipe initialization.
4. **Test Step 2 — Live URL Extraction:**
   - Connect device to a real Wi-Fi network or cellular data.
   - Paste `https://youtu.be/jNQXAC9IVRw` into the URL box and tap "Analyze Link".
   - Confirm title ("Me at the zoo"), thumbnail, and format presets populate.
5. **Test Step 3 — Progressive Video Download:**
   - Select `360p MP4 (Standard)` and tap "Download".
   - Confirm notification appears in notification tray with active progress bar.
   - Confirm file completes and moves to COMPLETED state.
6. **Test Step 4 — Media Storage Inspection:**
   - Open device Files app > Downloads > NovaDrop > Videos.
   - Confirm `Me at the zoo.mp4` exists (~629 KB).
7. **Test Step 5 — In-App Playback & Seeking:**
   - Return to NovaDrop Download Queue, tap "Play".
   - Verify audio is audible from device speakers and video renders smoothly.
   - Drag playback slider or tap -10s / +10s to verify hardware decoder seeking.
8. **Test Step 6 — Collision & Cleanup Check:**
   - Download the same video again. Confirm `Me at the zoo (1).mp4` is created without overwriting the first file.
   - Start a download and immediately tap Cancel. Confirm no leftover partial `.tmp` or `.mp4` file remains in Downloads.
