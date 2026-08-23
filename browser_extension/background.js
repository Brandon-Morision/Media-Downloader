/**
 * background.js — Media Downloader extension service worker
 *
 * Responsibilities:
 *  1. Pair with the desktop app on first install (fetch token from /token)
 *  2. Receive messages from content.js and popup.js
 *  3. POST URLs to the desktop app's local bridge server
 */

const BRIDGE_PORT = 6789;
const BRIDGE_BASE = `http://127.0.0.1:${BRIDGE_PORT}`;

// ── token management ──────────────────────────────────────────────────────────

async function getToken() {
  const result = await chrome.storage.local.get("bridge_token");
  return result.bridge_token || null;
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

// Re-pair whenever the app restarts (new token each launch)
async function repairIfNeeded() {
  await fetchAndStoreToken();
}

// ── send URL to desktop app ───────────────────────────────────────────────────

async function sendUrl(url, title) {
  let token = await ensureToken();
  if (!token) {
    token = await fetchAndStoreToken();
    if (!token) return { ok: false, error: "App not running" };
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
      // app restarted → new token
      token = await fetchAndStoreToken();
      if (!token) return { ok: false, error: "App not running" };
      res = await fetch(`${BRIDGE_BASE}/add-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Token": token,
        },
        body: JSON.stringify(payload),
      });
    }

    return { ok: res.ok };
  } catch {
    return { ok: false, error: "App not running" };
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

// ── message handler (from content.js and popup.js) ───────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "SEND_URL") {
    sendUrl(msg.url, msg.title || "").then(sendResponse);
    return true; // keep channel open for async response
  }

  if (msg.type === "CHECK_APP") {
    checkAppRunning().then(running => {
      if (running) repairIfNeeded(); // refresh token silently
      sendResponse({ running });
    });
    return true;
  }

  if (msg.type === "GET_TOKEN") {
    getToken().then(token => sendResponse({ token }));
    return true;
  }
});

// On install/update, try to pair immediately
chrome.runtime.onInstalled.addListener(() => {
  fetchAndStoreToken();
});
