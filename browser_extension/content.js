/**
 * content.js — Media Downloader content script (v1.2)
 *
 * - Early injection (document_start)
 * - Hooks fetch + XMLHttpRequest
 * - Scans <video>/<audio>/<source> and Performance entries
 * - Enhanced 1flex.org support with specialized m3u8 extraction
 * - Shows an expandable floating panel with:
 *     • "Send page URL" (original behaviour)
 *     • List of sniffed media streams (m3u8, mp4, webm, etc.)
 */

(() => {
  // ─── config ──────────────────────────────────────────────────────────────
  const MAX_STREAMS = 12;
  const MEDIA_EXT = /\.(m3u8|mpd|mp4|webm|m4v|m4a|mp3|ts|m4s|mov|mkv|flac|wav)(\?|$)/i;
  const MEDIA_MIME = /^(video\/|audio\/|application\/vnd\.apple\.mpegurl|application\/dash\+xml|application\/x-mpegURL)/i;
  const ONEFLEX_DOMAIN = /1flex\.org/i;

  // ─── state ───────────────────────────────────────────────────────────────
  const streams = new Map(); // url → { url, type, size, label, ts }
  let panelOpen = false;
  let fabEl = null;
  let panelEl = null;

  // ─── helpers ─────────────────────────────────────────────────────────────
  function isInteresting(url, contentType = "") {
    if (!url || !url.startsWith("http")) return false;
    if (url.includes("blob:") || url.includes("data:")) return false;
    // skip common non-media noise
    if (/\.(js|css|woff2?|ttf|png|jpe?g|gif|svg|ico|webp|json)(\?|$)/i.test(url)) return false;
    if (MEDIA_EXT.test(url)) return true;
    if (contentType && MEDIA_MIME.test(contentType)) return true;
    // common CDN / streaming patterns
    if (/\/(playlist|manifest|master|index|chunklist|seg-|segment).*\.(m3u8|mpd)/i.test(url)) return true;
    if (/\/video\/|\/media\/|\/stream\/|\/hls\/|\/dash\//i.test(url) && MEDIA_EXT.test(url)) return true;
    // 1flex.org specific: be more aggressive with CDN patterns
    if (ONEFLEX_DOMAIN.test(url) && (url.includes("stream") || url.includes("cdn") || url.includes("hls"))) return true;
    return false;
  }

  function guessLabel(url, contentType = "") {
    try {
      const u = new URL(url);
      const path = u.pathname.toLowerCase();
      if (path.endsWith(".m3u8") || contentType.includes("mpegurl")) {
        // Check if it's a 1flex.org stream
        if (ONEFLEX_DOMAIN.test(url) || url.includes("cdn") || url.includes("stream")) {
          return "1flex Stream";
        }
        return "HLS";
      }
      if (path.endsWith(".mpd") || contentType.includes("dash")) return "DASH";
      if (path.endsWith(".mp4")) return "MP4";
      if (path.endsWith(".webm")) return "WebM";
      if (path.endsWith(".m4a") || path.endsWith(".mp3")) return "Audio";
      if (path.endsWith(".ts") || path.endsWith(".m4s")) return "Segment";
    } catch {}
    return "Media";
  }

  function addStream(url, contentType = "", size = null) {
    if (!isInteresting(url, contentType)) return;
    // normalise – drop fragment, keep query (tokens often live there)
    const clean = url.split("#")[0];
    if (streams.has(clean)) return;

    const entry = {
      url: clean,
      type: contentType || "",
      size,
      label: guessLabel(clean, contentType),
      ts: Date.now(),
    };
    streams.set(clean, entry);

    // keep only the newest ones
    if (streams.size > MAX_STREAMS) {
      const oldest = [...streams.entries()].sort((a, b) => a[1].ts - b[1].ts)[0][0];
      streams.delete(oldest);
    }
    renderPanel();
  }

  // ─── network hooks ──────────────────────────────────────────────────────
  function hookNetwork() {
    // fetch
    const origFetch = window.fetch;
    window.fetch = async function (...args) {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url;
      const res = await origFetch.apply(this, args);
      try {
        const ct = res.headers?.get?.("content-type") || "";
        addStream(url, ct);
        // 1flex.org specific: check response body for m3u8 URLs (only for text responses)
        if (ONEFLEX_DOMAIN.test(url) || ONEFLEX_DOMAIN.test(location.href)) {
          console.log("[Media Downloader] Fetch request to:", url, "Content-Type:", ct);
          if (ct && (ct.includes("text/") || ct.includes("json") || ct.includes("javascript"))) {
            try {
              const clone = res.clone();
              const text = await clone.text();
              const m3u8Matches = text.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/gi);
              if (m3u8Matches) {
                console.log("[Media Downloader] Found m3u8 URLs in fetch response:", m3u8Matches);
                m3u8Matches.forEach(m3u8Url => {
                  addStream(m3u8Url, "application/x-mpegURL");
                });
              }
            } catch (e) {
              // Response cloning failed, ignore
            }
          }
        }
      } catch {}
      return res;
    };

    // XMLHttpRequest
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      this._mdl_url = url;
      if (ONEFLEX_DOMAIN.test(url) || ONEFLEX_DOMAIN.test(location.href)) {
        console.log("[Media Downloader] XHR request to:", url);
      }
      return origOpen.call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.send = function (...args) {
      this.addEventListener("load", () => {
        try {
          const ct = this.getResponseHeader("content-type") || "";
          addStream(this._mdl_url, ct);
          // 1flex.org specific: check response body for m3u8 URLs
          if (ONEFLEX_DOMAIN.test(this._mdl_url) || ONEFLEX_DOMAIN.test(location.href)) {
            try {
              const responseText = this.responseText;
              if (responseText) {
                const m3u8Matches = responseText.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/gi);
                if (m3u8Matches) {
                  console.log("[Media Downloader] Found m3u8 URLs in XHR response:", m3u8Matches);
                  m3u8Matches.forEach(m3u8Url => {
                    addStream(m3u8Url, "application/x-mpegURL");
                  });
                }
              }
            } catch (e) {
              // Response might not be accessible, ignore errors
            }
          }
        } catch {}
      });
      return origSend.apply(this, args);
    };
  }

  // ─── DOM / Performance scanning ──────────────────────────────────────────
  function scanExistingMedia() {
    document.querySelectorAll("video, audio, source").forEach(el => {
      const src = el.currentSrc || el.src || el.getAttribute("src");
      if (src) addStream(src);
    });

    // already loaded resources
    try {
      performance.getEntriesByType("resource").forEach(e => {
        addStream(e.name, e.initiatorType === "video" ? "video/" : "");
      });
    } catch {}

    // 1flex.org specific: scan page source for m3u8 URLs
    if (ONEFLEX_DOMAIN.test(location.href)) {
      scanOneFlexPage();
    }
  }

  // Specialized scanner for 1flex.org to extract m3u8 manifest URLs
  function scanOneFlexPage() {
    try {
      console.log("[Media Downloader] Scanning 1flex.org page for m3u8 URLs...");

      // Scan all script tags for m3u8 URLs
      document.querySelectorAll("script").forEach(script => {
        const content = script.textContent || script.innerHTML;
        if (content) {
          const m3u8Matches = content.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/gi);
          if (m3u8Matches) {
            console.log("[Media Downloader] Found m3u8 URLs in script tags:", m3u8Matches);
            m3u8Matches.forEach(url => {
              addStream(url, "application/x-mpegURL");
            });
          }
        }
      });

      // Scan inline scripts and data attributes
      const pageSource = document.documentElement.outerHTML;
      const sourceMatches = pageSource.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/gi);
      if (sourceMatches) {
        console.log("[Media Downloader] Found m3u8 URLs in page source:", sourceMatches);
        sourceMatches.forEach(url => {
          addStream(url, "application/x-mpegURL");
        });
      } else {
        console.log("[Media Downloader] No m3u8 URLs found in page source");
      }

      // Look for common 1flex.org patterns in URLs
      const patterns = [
        /https?:\/\/[^\/\s"']+\/stream\d+\/[^\/\s"']+\/[^\/\s"']+\/\d+\/index\.m3u8/gi,
        /https?:\/\/[^\/\s"']+\/hls\/[^\/\s"']+\/index\.m3u8/gi,
      ];

      patterns.forEach(pattern => {
        const matches = pageSource.match(pattern);
        if (matches) {
          console.log("[Media Downloader] Found pattern matches:", matches);
          matches.forEach(url => {
            addStream(url, "application/x-mpegURL");
          });
        }
      });

      // Additional: Look for video elements and their src attributes
      document.querySelectorAll("video").forEach(video => {
        const src = video.src || video.currentSrc;
        if (src) {
          console.log("[Media Downloader] Found video element with src:", src);
          addStream(src, "video/mp4");
        }
      });

      console.log("[Media Downloader] Total streams detected:", streams.size);
    } catch (e) {
      console.error("[Media Downloader] 1flex.org scan error:", e);
    }
  }

  // keep watching for dynamically added media elements
  function observeDOM() {
    const obs = new MutationObserver(muts => {
      for (const m of muts) {
        m.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          if (node.matches?.("video, audio, source")) {
            const src = node.currentSrc || node.src || node.getAttribute("src");
            if (src) addStream(src);
          }
          node.querySelectorAll?.("video, audio, source").forEach(el => {
            const src = el.currentSrc || el.src || el.getAttribute("src");
            if (src) addStream(src);
          });
        });
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  // ─── UI ──────────────────────────────────────────────────────────────────
  function createUI() {
    if (document.getElementById("__mdl_root__")) return;

    const root = document.createElement("div");
    root.id = "__mdl_root__";
    root.innerHTML = `
      <style>
        #__mdl_root__ { all: initial; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        #__mdl_fab__ {
          position: fixed; bottom: 24px; right: 24px; z-index: 2147483646;
          display: flex; align-items: center; gap: 8px;
          padding: 10px 16px 10px 12px;
          background: #18181d; border: 1px solid #2c2c38; border-radius: 99px;
          box-shadow: 0 4px 24px rgba(0,0,0,.55); cursor: pointer;
          color: #eaeaf2; font-size: 13px; font-weight: 600; user-select: none;
          transition: transform .15s, box-shadow .15s, border-color .15s;
        }
        #__mdl_fab__:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,0,0,.65); border-color: #7c6dfa66; }
        #__mdl_badge__ {
          font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 99px;
          background: rgba(124,109,250,.18); color: #7c6dfa; font-family: monospace;
          min-width: 18px; text-align: center;
        }
        #__mdl_panel__ {
          position: fixed; bottom: 78px; right: 24px; z-index: 2147483646;
          width: 340px; max-height: 420px; overflow: hidden;
          background: #18181d; border: 1px solid #2c2c38; border-radius: 13px;
          box-shadow: 0 12px 40px rgba(0,0,0,.6);
          display: none; flex-direction: column;
          color: #eaeaf2; font-size: 12px;
        }
        #__mdl_panel__.open { display: flex; }
        #__mdl_panel_head__ {
          padding: 12px 14px; border-bottom: 1px solid #2c2c38;
          display: flex; align-items: center; justify-content: space-between;
          font-weight: 600; font-size: 13px;
        }
        #__mdl_panel_body__ { overflow-y: auto; flex: 1; padding: 8px; }
        .mdl-item {
          display: flex; flex-direction: column; gap: 4px;
          padding: 9px 10px; border-radius: 9px; margin-bottom: 6px;
          background: #111115; border: 1px solid #2c2c38;
          cursor: pointer; transition: border-color .12s, background .12s;
        }
        .mdl-item:hover { border-color: #7c6dfa66; background: #1f1f26; }
        .mdl-item-top { display: flex; align-items: center; gap: 8px; }
        .mdl-label {
          font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px;
          background: rgba(124,109,250,.15); color: #7c6dfa; font-family: monospace;
        }
        .mdl-url {
          font-family: "JetBrains Mono", Consolas, monospace; font-size: 11px;
          color: #8a8a9e; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .mdl-send-page {
          margin: 8px; padding: 10px; border-radius: 9px;
          background: #7c6dfa; color: white; font-weight: 600; font-size: 12.5px;
          text-align: center; cursor: pointer; border: none;
          transition: opacity .15s;
        }
        .mdl-send-page:hover { opacity: .9; }
        .mdl-empty { padding: 20px; text-align: center; color: #44445a; font-size: 12px; }
        .mdl-close { cursor: pointer; opacity: .6; font-size: 16px; padding: 2px 6px; }
        .mdl-close:hover { opacity: 1; }

        /* Toast — matches the desktop app's own .toast component exactly
           (same colors/shape/motion), so feedback looks the same whether
           it comes from the page or the app itself. Used for every send
           action (the page button AND individual detected-stream items),
           which previously only ever updated the "Send page URL" button's
           text — meaning clicking a stream item gave no visible feedback
           on the item you actually clicked. */
        #__mdl_toast__ {
          position: fixed; bottom: 24px; left: 50%; z-index: 2147483647;
          transform: translateX(-50%) translateY(8px);
          background: #1f1f26; border: 1px solid #3a3a48; border-radius: 10px;
          padding: 9px 16px; font-size: 13px; color: #eaeaf2;
          box-shadow: 0 10px 34px rgba(0,0,0,.55);
          opacity: 0; pointer-events: none; transition: opacity .2s, transform .2s;
          display: flex; align-items: center; gap: 8px; white-space: nowrap; max-width: 360px;
        }
        #__mdl_toast__.show { opacity: 1; transform: translateX(-50%) translateY(0); }
      </style>

      <div id="__mdl_fab__">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect width="16" height="16" rx="4" fill="#7c6dfa"/>
          <path d="M8 3v7M5 7l3 3 3-3" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          <rect x="3" y="11.5" width="10" height="1.2" rx=".6" fill="white"/>
        </svg>
        <span>Downloader</span>
        <span id="__mdl_badge__">0</span>
      </div>

      <div id="__mdl_panel__">
        <div id="__mdl_panel_head__">
          <span>Detected streams</span>
          <span class="mdl-close" id="__mdl_close__">×</span>
        </div>
        <div id="__mdl_panel_body__">
          <div class="mdl-empty">Play a video to detect streams…</div>
        </div>
        <button class="mdl-send-page" id="__mdl_send_page__">Send page URL</button>
      </div>

      <div id="__mdl_toast__"></div>
    `;
    document.documentElement.appendChild(root);

    fabEl = document.getElementById("__mdl_fab__");
    panelEl = document.getElementById("__mdl_panel__");

    fabEl.addEventListener("click", () => {
      panelOpen = !panelOpen;
      panelEl.classList.toggle("open", panelOpen);
    });
    document.getElementById("__mdl_close__").addEventListener("click", e => {
      e.stopPropagation();
      panelOpen = false;
      panelEl.classList.remove("open");
    });
    document.getElementById("__mdl_send_page__").addEventListener("click", () => {
      sendToApp(location.href, document.title);
    });
  }

  function renderPanel() {
    if (!panelEl) return;
    const body = document.getElementById("__mdl_panel_body__");
    const badge = document.getElementById("__mdl_badge__");
    const list = [...streams.values()].sort((a, b) => b.ts - a.ts);

    badge.textContent = list.length;

    if (!list.length) {
      body.innerHTML = `<div class="mdl-empty">Play a video to detect streams…</div>`;
      return;
    }

    body.innerHTML = list.map(s => {
      const short = s.url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 55);
      return `
        <div class="mdl-item" data-url="${escapeHtml(s.url)}">
          <div class="mdl-item-top">
            <span class="mdl-label">${escapeHtml(s.label)}</span>
            <span style="font-size:10px;color:#44445a">${s.size ? formatSize(s.size) : ""}</span>
          </div>
          <div class="mdl-url" title="${escapeHtml(s.url)}">${escapeHtml(short)}${s.url.length > 55 ? "…" : ""}</div>
        </div>`;
    }).join("");

    body.querySelectorAll(".mdl-item").forEach(el => {
      el.addEventListener("click", () => {
        const url = el.getAttribute("data-url");
        sendToApp(url, document.title + " (stream)");
      });
    });
  }

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
              .replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function formatSize(n) {
    if (n > 1e9) return (n / 1e9).toFixed(1) + " GB";
    if (n > 1e6) return (n / 1e6).toFixed(1) + " MB";
    if (n > 1e3) return (n / 1e3).toFixed(0) + " KB";
    return n + " B";
  }

  // ─── send to desktop app ─────────────────────────────────────────────────
  let toastHideTimer = null;
  function showToast(message, ok = true) {
    const toast = document.getElementById("__mdl_toast__");
    if (!toast) return;
    const icon = ok ? "✓" : "✕";
    const iconColor = ok ? "#3ecf8e" : "#f26d6d";
    toast.innerHTML =
      `<span style="color:${iconColor};font-weight:700;">${icon}</span>` +
      `<span>${escapeHtml(message)}</span>`;
    toast.classList.add("show");
    clearTimeout(toastHideTimer);
    toastHideTimer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  async function sendToApp(url, title) {
    try {
      const res = await chrome.runtime.sendMessage({
        type: "SEND_URL",
        url,
        title: title || document.title,
      });
      showToast(
        res?.ok ? "Sent to Media Downloader" : "App not running — open it first",
        !!res?.ok
      );
    } catch {
      showToast("App not running — open it first", false);
    }
  }

  // ─── boot ────────────────────────────────────────────────────────────────
  function boot() {
    hookNetwork();
    createUI();
    // slight delay so the page has a chance to start loading media
    setTimeout(() => {
      scanExistingMedia();
      observeDOM();
    }, 600);

    // also re-scan periodically for a short time (many players load late)
    let scans = 0;
    const iv = setInterval(() => {
      scanExistingMedia();
      if (++scans > 8) clearInterval(iv);
    }, 1500);
  }

  if (document.documentElement) {
    boot();
  } else {
    window.addEventListener("DOMContentLoaded", boot);
  }
})();

