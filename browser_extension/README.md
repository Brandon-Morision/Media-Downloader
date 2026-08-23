# Media Downloader — Browser Extension

Connects Chrome or Edge to the Media Downloader desktop app.
When you visit a supported page (YouTube, Reddit, Tumblr, Pixiv etc.)
a floating button appears — click it to send the URL directly to the
app's download queue without any copy-pasting.

## Installation

### Step 1 — Open extension manager

**Chrome:** go to `chrome://extensions`
**Edge:**   go to `edge://extensions`

### Step 2 — Enable Developer Mode

Toggle **Developer mode** on (top-right corner of the extensions page).

### Step 3 — Load the extension

Click **Load unpacked** and select this `browser_extension/` folder.

The Media Downloader icon will appear in your toolbar.

## How it works

1. Open the **Media Downloader** desktop app first
2. Browse to any supported page in Chrome or Edge
3. A floating **"Send to Downloader"** button appears bottom-right
4. Click it — the URL is sent to the app and added to the queue
5. Alternatively click the extension icon in the toolbar for the popup

## Supported sites

gallery-dl: Reddit, Imgur, Twitter/X, Instagram, Pixiv, Tumblr,
            Flickr, DeviantArt, Pinterest, Cyberdrop, e621, Gelbooru

yt-dlp:     YouTube, Vimeo, TikTok, Twitch, Dailymotion, Bilibili

## Troubleshooting

**"App not running" error**
The desktop app must be open before sending URLs. The extension
connects to it on localhost:6789 — this is only accessible from
your own machine, never from the internet.

**Button doesn't appear**
The page might not be a recognised site. Use the popup instead —
click the extension icon and hit "Send to Downloader" manually.
Any http/https URL can be sent this way.

**Token mismatch after restarting the app**
The app generates a new token every launch. The extension
re-pairs automatically on the next request — just click Send again.
