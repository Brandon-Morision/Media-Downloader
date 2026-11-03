# NovaDrop Android: Cookie-Authenticated Extraction Manual Test Checklist

## 1. Overview & Security Architecture

NovaDrop Personal flavor integrates authentication cookie support (`cookies.txt` in Netscape format) to enable downloading from platforms requiring account sessions (X / Twitter, Instagram, Pixiv).

### Security Commitments
- **App-Private Storage**: The file is stored exclusively at `/data/user/0/com.novadrop.android.personal.debug/files/cookies/cookies.txt`.
- **POSIX Mode 600**: The file is created with owner-read and owner-write permissions only (`-rw-------`). No other application or non-root UID on Android can read it.
- **Zero-Logging Guarantee**: Cookie keys, tokens, sessions, and file content are strictly excluded from Logcat, crashes, Room entities, and telemetry.
- **Immediate Revocation**: Users can delete the active cookies file at any time with a single tap in Settings.

---

## 2. Browser Cookie Export Instructions

To test authenticated downloading with your own accounts without sharing credentials:

1. **Install a Netscape Cookies Exporter**:
   - Recommended extension: *Get cookies.txt LOCALLY* (Open Source, available on Chrome Web Store and Firefox Add-ons).
   - Alternatively, export via curl-compatible developer tools in your browser.
2. **Log In to the Target Platforms**:
   - Log in to your personal accounts on [x.com](https://x.com), [instagram.com](https://www.instagram.com), and [pixiv.net](https://www.pixiv.net).
3. **Export Netscape `cookies.txt`**:
   - Open the extension while on the logged-in tab.
   - Select **Export** or **Download**.
   - Save the file as `cookies.txt`.
4. **Transfer `cookies.txt` to the Phone**:
   - Transfer via USB: `adb -s <SERIAL> push cookies.txt /sdcard/Download/`
   - Or send via local cloud/email and save to the device's internal `Downloads` directory.

---

## 3. Importing `cookies.txt` in NovaDrop

1. Launch NovaDrop on the device.
2. Tap the **Settings** icon on the bottom navigation bar.
3. Scroll down and tap **Media Engines & Authentication** to expand the card.
4. Locate the **Authentication Cookies (cookies.txt)** section:
   - Initial status must display: `No cookies imported`.
5. Tap **Import cookies.txt**:
   - The Android Storage Access Framework (SAF) system document picker opens.
   - Navigate to `Downloads` (or your chosen storage location) and select `cookies.txt`.
6. Confirm the UI state updates:
   - Status badge changes to: `Cookies Active (<size> bytes)`.
   - The **Delete** button appears next to the **Replace** button.

---

## 4. Sentinel Verification (Logcat Leak Check)

To empirically verify that NovaDrop never logs your private cookie values:

1. **Insert a Sentinel Token**:
   Before importing, open `cookies.txt` in a text editor and add a dummy line with a unique sentinel value:
   ```text
   .example.com	TRUE	/	TRUE	1893456000	sentinel_canary	NOVA_SENTINEL_SECRET_CANARY_98765
   ```
2. **Import the modified `cookies.txt`** through Settings as described in Section 3.
3. **Run Extraction Tests** on the target URLs.
4. **Inspect Device Logcat**:
   Execute the following command on your host terminal:
   ```bash
   adb -s <SERIAL> logcat -d | grep "NOVA_SENTINEL_SECRET_CANARY_98765"
   ```
5. **Expected Result**:
   The output must be completely **empty** (zero lines returned).

---

## 5. Per-Site Test Execution Matrix

Fill in the test results for your manual test pass using your imported cookies:

| Site | Recommended Test URL | Engine Selected | Expected Outcome | Actual Outcome (PASS / FAIL) | Output File Name | Media & Codec Verified |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **X (Twitter)** | Public Media Post: `https://x.com/NASA/status/1852000000000000000` | yt-dlp (personal) | Full video/image download via cookie session | [ ] PASS<br>[ ] FAIL | `NASA_*.mp4` | [ ] H.264 / AAC playable |
| **Instagram** | Public Post / Reel: `https://www.instagram.com/p/DB123456789/` | yt-dlp / gallery-dl | Video stream extracted, 1080x1920 MP4 saved | [ ] PASS<br>[ ] FAIL | `instagram_*.mp4` | [ ] H.264 / AAC playable |
| **Pixiv** | Artwork Post: `https://www.pixiv.net/en/artworks/12345678` | gallery-dl (personal) | Full-resolution image or ugoira downloaded | [ ] PASS<br>[ ] FAIL | `pixiv_*.png` | [ ] PNG/JPG valid header |

---

## 6. Cookie Deletion & Permission Verification Flow

1. Return to **Settings** -> **Media Engines & Authentication**.
2. Tap the red **Delete** button under **Authentication Cookies**.
3. Verify the UI updates:
   - Badge reverts immediately to: `No cookies imported`.
   - The button reverts to: `Import cookies.txt`.
4. Verify file deletion in app-private storage:
   ```bash
   adb -s <SERIAL> shell "run-as com.novadrop.android.personal.debug ls -l files/cookies/cookies.txt"
   ```
   *Expected Output*: `ls: files/cookies/cookies.txt: No such file or directory`.
5. Verify router fallback after deletion:
   Attempt an extraction of an authentication-required URL (e.g. Instagram reel):
   *Expected Outcome*: Rejection with message `"login required, import cookies.txt in Settings"`.

