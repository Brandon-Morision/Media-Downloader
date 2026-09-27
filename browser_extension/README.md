# Media Downloader — Browser Companion Extension (v0.3.0)

Seamlessly connects Google Chrome, Microsoft Edge, Brave, and other Chromium browsers directly to the **Media Downloader** desktop application.

### Key Capabilities

- **One-Click Page Forwarding:** Click the floating pill button or the extension popup to send any media page to the download queue.
- **Movable & Draggable In-Page Widget:** Click and drag the floating button anywhere on your screen to prevent stacking on top of websites' native controls or chat widgets. Positions are remembered across pages and browsers.
- **Deep Stream Sniffer:** Automatically extracts HLS (`.m3u8`), DASH (`.mpd`), MP4, WebM, and audio feeds from HTML5 players and background network requests.
- **Right-Click Context Menus:** Right-click any link, video, audio, image, or page and select **"Download with Media Downloader"** to send it instantly.
- **Shadow DOM Isolation:** In-page widgets are isolated inside a closed Shadow Root so host webpage styles and resets never break the extension UI.
- **Site Routing:** Auto-detects whether `gallery-dl` (e.g. RedGifs, Reddit, Pixiv, Tumblr) or `yt-dlp` (e.g. YouTube, Vimeo, TikTok, Twitch) handles the link.

---

## Installation Guide

### Step 1 — Open Extensions Manager
- **Google Chrome / Brave:** Navigate to `chrome://extensions`
- **Microsoft Edge:** Navigate to `edge://extensions`

### Step 2 — Enable Developer Mode
Turn on the **Developer mode** toggle in the top-right corner.

### Step 3 — Load Unpacked
1. Click the **Load unpacked** button in the top toolbar.
2. Select this `browser_extension` folder.
3. The Media Downloader icon will appear in your browser toolbar. Pin it for quick access!

---

## Supported Sites & Engines

- **gallery-dl:** RedGifs, Reddit, Imgur, Twitter / X, Instagram, Pixiv, Tumblr, Flickr, DeviantArt, Pinterest, Cyberdrop, Erome, e621, Gelbooru, Rule34, Danbooru, Kemono, Coomer, ArtStation, and hundreds more.
- **yt-dlp:** YouTube, Vimeo, TikTok, Twitch, Dailymotion, Bilibili, Soundcloud, Bandcamp, Facebook, 1flex.org, and all major video streaming platforms.

---

## Troubleshooting

- **"Media Downloader is not running" error:**
  Ensure the Media Downloader desktop application is open. The extension connects over a secure local bridge (`http://127.0.0.1:6789`) which is only accessible on your local machine.

- **App restarted / Token re-pairing:**
  The desktop app generates a fresh session token on each launch for security. If the app restarts, the extension automatically re-fetches the new token on the next click.
