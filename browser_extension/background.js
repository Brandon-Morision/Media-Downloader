/**
 * background.js — Media Downloader extension service worker (v0.3.0)
 *
 * Responsibilities:
 *  1. Pair with the desktop app on first install (fetch token from /token)
 *  2. Receive messages from content.js and popup.js
 *  3. Context menus: right-click pages, links, audio, video, or images to download
 *  4. POST URLs to the desktop app's local bridge server (localhost:6789)
 */

const BRIDGE_PORT = 6789;
const BRIDGE_BASE = `http://127.0.0.1:${BRIDGE_PORT}`;

// ── token management ──────────────────────────────────────────────────────────

async function getToken() {
  try {
    const result = await chrome.storage.local.get("bridge_token");
    return result.bridge_token || null;
  } catch {
    return null;
  }
}

async function fetchAndStoreToken() {
  try {
    const res = await fetch(`${BRIDGE_BASE}/token`, { method: "GET" });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.token) {
      await chrome.storage.local.set({ bridge_token: data.token });
      return data.token;
    }
  } catch {
    // App not running
  }
  return null;
}

async function ensureToken() {
  let token = await getToken();
  if (!token) token = await fetchAndStoreToken();
  return token;
}

async function repairIfNeeded() {
  await fetchAndStoreToken();
}

// ── badge notifications ───────────────────────────────────────────────────────

function flashBadge(text, color) {
  try {
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color });
    setTimeout(() => {
      chrome.action.setBadgeText({ text: "" });
    }, 2500);
  } catch {}
}

// ── send URL to desktop app ───────────────────────────────────────────────────

async function sendUrl(url, title) {
  if (!url) return { ok: false, error: "Empty URL" };

  let token = await ensureToken();
  if (!token) {
    token = await fetchAndStoreToken();
    if (!token) return { ok: false, error: "Media Downloader is not running" };
  }

  const payload = { url, title: title || "" };

  try {
    let res = await fetch(`${BRIDGE_BASE}/add-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Token": token,
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 403) {
      // App restarted → new token
      token = await fetchAndStoreToken();
      if (!token) return { ok: false, error: "Media Downloader is not running" };
      res = await fetch(`${BRIDGE_BASE}/add-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Token": token,
        },
        body: JSON.stringify(payload),
      });
    }

    const ok = res.ok;
    if (ok) {
      flashBadge("✓", "#00e599");
    } else {
      flashBadge("✕", "#f43f5e");
    }
    return { ok };
  } catch {
    flashBadge("✕", "#f43f5e");
    return { ok: false, error: "Media Downloader is not running" };
  }
}

// ── check if app is running ───────────────────────────────────────────────────

async function checkAppRunning() {
  try {
    const res = await fetch(`${BRIDGE_BASE}/token`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

// ── context menus ─────────────────────────────────────────────────────────────

function setupContextMenus() {
  if (!chrome.contextMenus) return;
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "mdl-send-page",
      title: "Send page to Media Downloader",
      contexts: ["page"],
    });

    chrome.contextMenus.create({
      id: "mdl-send-link",
      title: "Download link with Media Downloader",
      contexts: ["link"],
    });

    chrome.contextMenus.create({
      id: "mdl-send-media",
      title: "Download media with Media Downloader",
      contexts: ["video", "audio", "image"],
    });
  });
}

chrome.contextMenus?.onClicked.addListener(async (info, tab) => {
  let targetUrl = "";
  if (info.menuItemId === "mdl-send-link" && info.linkUrl) {
    targetUrl = info.linkUrl;
  } else if (info.menuItemId === "mdl-send-media" && info.srcUrl) {
    targetUrl = info.srcUrl;
  } else if (info.pageUrl) {
    targetUrl = info.pageUrl;
  }

  if (targetUrl) {
    await sendUrl(targetUrl, tab?.title || "");
  }
});

// ── message handler (from content.js and popup.js) ───────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "SEND_URL") {
    sendUrl(msg.url, msg.title || "").then(sendResponse);
    return true; // keep channel open for async response
  }

  if (msg.type === "CHECK_APP") {
    checkAppRunning().then((running) => {
      if (running) repairIfNeeded(); // refresh token silently
      sendResponse({ running });
    });
    return true;
  }

  if (msg.type === "GET_TOKEN") {
    getToken().then((token) => sendResponse({ token }));
    return true;
  }
});

// On install/update, initialize context menus & attempt pairing
chrome.runtime.onInstalled.addListener(() => {
  setupContextMenus();
  fetchAndStoreToken();
});

chrome.runtime.onStartup.addListener(() => {
  setupContextMenus();
});
