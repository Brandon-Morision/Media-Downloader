/**
 * content.js — Media Downloader Content Script (v0.3.0)
 *
 * Features:
 * - Complete Shadow DOM isolation (immune to webpage CSS resets & conflicts)
 * - v0.3.0 Dark Glassmorphic Theme with Emerald Mint accents
 * - Early injection (document_start)
 * - Hooks window.fetch + XMLHttpRequest to sniff media streams
 * - Detects HLS (.m3u8), DASH (.mpd), MP4, WebM, audio, and video streams
 * - Enhanced RedGifs and 1flex.org stream sniffing
 * - Scans <video>/<audio>/<source> tags and Resource Timing API
 * - Interactive Floating Action Button (FAB) + Streams Drawer
 * - One-click "Send Page URL" and stream extraction to desktop app
 */

(() => {
  if (window.__MDL_CONTENT_SCRIPT_INITIALIZED__) return;
  window.__MDL_CONTENT_SCRIPT_INITIALIZED__ = true;

  // ── Configuration ────────────────────────────────────────────────────────
  const MAX_STREAMS = 20;
  const MEDIA_EXT = /\.(m3u8|mpd|mp4|webm|m4v|m4a|mp3|ogg|flac|wav|ts|m4s|mov|mkv)(\?|$)/i;
  const MEDIA_MIME = /^(video\/|audio\/|application\/vnd\.apple\.mpegurl|application\/dash\+xml|application\/x-mpegURL)/i;
  const ONEFLEX_DOMAIN = /1flex\.org/i;
  const REDGIFS_DOMAIN = /redgifs\.com/i;

  // ── State ─────────────────────────────────────────────────────────────────
  const streams = new Map(); // cleanUrl -> { url, type, size, label, ts }
  let panelOpen = false;
  let shadowRoot = null;
  let toastTimer = null;
  let fabEl = null;
  let panelEl = null;

  // ── Helpers ───────────────────────────────────────────────────────────────
  function isInteresting(url, contentType = "") {
    if (!url || typeof url !== "string" || !url.startsWith("http")) return false;
    if (url.includes("blob:") || url.includes("data:")) return false;

    // Skip non-media assets
    if (/\.(js|css|woff2?|ttf|png|jpe?g|gif|svg|ico|webp|json)(\?|$)/i.test(url)) return false;

    if (MEDIA_EXT.test(url)) return true;
    if (contentType && MEDIA_MIME.test(contentType)) return true;

    // Common streaming / CDN patterns
    if (/\/(playlist|manifest|master|index|chunklist|seg-|segment).*\.(m3u8|mpd)/i.test(url)) return true;
    if (/\/video\/|\/media\/|\/stream\/|\/hls\/|\/dash\//i.test(url) && (MEDIA_EXT.test(url) || url.includes(".m3u8"))) return true;

    // 1flex.org specific
    if (ONEFLEX_DOMAIN.test(url) && (url.includes("stream") || url.includes("cdn") || url.includes("hls"))) return true;

    // RedGifs specific
    if (REDGIFS_DOMAIN.test(url) && (url.includes("media") || url.includes(".mp4"))) return true;

    return false;
  }

  function guessLabel(url, contentType = "") {
    try {
      const u = new URL(url);
      const path = u.pathname.toLowerCase();
      if (path.endsWith(".m3u8") || contentType.includes("mpegurl")) {
        if (ONEFLEX_DOMAIN.test(url)) return "1flex HLS";
        return "HLS";
      }
      if (path.endsWith(".mpd") || contentType.includes("dash")) return "DASH";
      if (path.endsWith(".mp4")) {
        if (REDGIFS_DOMAIN.test(url)) return "RedGifs MP4";
        return "MP4";
      }
      if (path.endsWith(".webm")) return "WebM";
      if (path.endsWith(".m4a") || path.endsWith(".mp3") || path.endsWith(".flac") || path.endsWith(".wav")) return "Audio";
      if (path.endsWith(".ts") || path.endsWith(".m4s")) return "Segment";
    } catch {}
    return "Stream";
  }

  function addStream(url, contentType = "", size = null) {
    if (!isInteresting(url, contentType)) return;

    // Drop URL fragment, retain query tokens
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

    // Evict oldest if exceeding limit
    if (streams.size > MAX_STREAMS) {
      const oldest = [...streams.entries()].sort((a, b) => a[1].ts - b[1].ts)[0][0];
      streams.delete(oldest);
    }

    renderStreamsList();
  }

  // ── Network Sniffing ──────────────────────────────────────────────────────
  function hookNetwork() {
    // Intercept window.fetch
    const origFetch = window.fetch;
    window.fetch = async function (...args) {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url;
      const res = await origFetch.apply(this, args);
      try {
        const ct = res.headers?.get?.("content-type") || "";
        addStream(url, ct);

        // Scan response text on 1flex.org
        if (ONEFLEX_DOMAIN.test(url) || ONEFLEX_DOMAIN.test(location.href)) {
          if (ct && (ct.includes("text/") || ct.includes("json") || ct.includes("javascript"))) {
            try {
              const clone = res.clone();
              const text = await clone.text();
              const m3u8Matches = text.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/gi);
              if (m3u8Matches) {
                m3u8Matches.forEach((m) => addStream(m, "application/x-mpegURL"));
              }
            } catch {}
          }
        }
      } catch {}
      return res;
    };

    // Intercept XMLHttpRequest
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      this._mdl_url = url;
      return origOpen.call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.send = function (...args) {
      this.addEventListener("load", () => {
        try {
          const ct = this.getResponseHeader("content-type") || "";
          addStream(this._mdl_url, ct);

          if (ONEFLEX_DOMAIN.test(this._mdl_url) || ONEFLEX_DOMAIN.test(location.href)) {
            try {
              const text = this.responseText;
              if (text) {
                const m3u8Matches = text.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/gi);
                if (m3u8Matches) {
                  m3u8Matches.forEach((m) => addStream(m, "application/x-mpegURL"));
                }
              }
            } catch {}
          }
        } catch {}
      });
      return origSend.apply(this, args);
    };
  }

  // ── DOM & Performance Scanning ────────────────────────────────────────────
  function scanExistingMedia() {
    // Check DOM tags
    document.querySelectorAll("video, audio, source").forEach((el) => {
      const src = el.currentSrc || el.src || el.getAttribute("src");
      if (src) addStream(src);
    });

    // Check performance timing entries
    try {
      performance.getEntriesByType("resource").forEach((e) => {
        addStream(e.name, e.initiatorType === "video" ? "video/" : "");
      });
    } catch {}

    // Special site scanners
    if (ONEFLEX_DOMAIN.test(location.href)) {
      scanOneFlexPage();
    }
    if (REDGIFS_DOMAIN.test(location.href)) {
      scanRedGifsPage();
    }
  }

  function scanOneFlexPage() {
    try {
      document.querySelectorAll("script").forEach((script) => {
        const content = script.textContent || script.innerHTML;
        if (content) {
          const m3u8Matches = content.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/gi);
          if (m3u8Matches) {
            m3u8Matches.forEach((m) => addStream(m, "application/x-mpegURL"));
          }
        }
      });

      const pageSource = document.documentElement.outerHTML;
      const patterns = [
        /https?:\/\/[^\/\s"']+\/stream\d+\/[^\/\s"']+\/[^\/\s"']+\/\d+\/index\.m3u8/gi,
        /https?:\/\/[^\/\s"']+\/hls\/[^\/\s"']+\/index\.m3u8/gi,
      ];
      patterns.forEach((pattern) => {
        const matches = pageSource.match(pattern);
        if (matches) {
          matches.forEach((m) => addStream(m, "application/x-mpegURL"));
        }
      });
    } catch {}
  }

  function scanRedGifsPage() {
    try {
      document.querySelectorAll("video source, video").forEach((el) => {
        const src = el.src || el.currentSrc || el.getAttribute("src");
        if (src && src.includes(".mp4")) {
          addStream(src, "video/mp4");
        }
      });
    } catch {}
  }

  function observeDOM() {
    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          if (node.matches?.("video, audio, source")) {
            const src = node.currentSrc || node.src || node.getAttribute("src");
            if (src) addStream(src);
          }
          node.querySelectorAll?.("video, audio, source").forEach((el) => {
            const src = el.currentSrc || el.src || el.getAttribute("src");
            if (src) addStream(src);
          });
        });
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  // ── Shadow DOM UI Construction ───────────────────────────────────────────
  function createUI() {
    if (document.getElementById("__mdl_host__")) return;

    const host = document.createElement("div");
    host.id = "__mdl_host__";
    host.style.all = "initial";
    host.style.position = "relative";
    host.style.zIndex = "2147483647";

    shadowRoot = host.attachShadow({ mode: "open" });

    shadowRoot.innerHTML = `
      <style>
        :host {
          all: initial;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #f1f5f9;
          font-size: 13px;
          line-height: 1.4;
          box-sizing: border-box;
        }
        *, *::before, *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        /* ── Floating Action Button (FAB) ── */
        .mdl-fab {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 2147483646;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px 8px 10px;
          background: #111520;
          border: 1px solid #232b3d;
          border-radius: 9999px;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);
          cursor: grab;
          color: #f8fafc;
          font-size: 12.5px;
          font-weight: 700;
          letter-spacing: -0.01em;
          user-select: none;
          touch-action: none;
          transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.18s, border-color 0.18s;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .mdl-fab:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 36px rgba(0, 0, 0, 0.75), 0 0 18px rgba(0, 229, 153, 0.25);
          border-color: rgba(0, 229, 153, 0.4);
        }
        .mdl-fab:active {
          transform: translateY(0);
        }
        .mdl-fab.dragging {
          cursor: grabbing !important;
          transition: none !important;
          opacity: 0.95;
          transform: scale(1.03) !important;
          box-shadow: 0 16px 45px rgba(0, 0, 0, 0.85), 0 0 24px rgba(0, 229, 153, 0.35);
          border-color: rgba(0, 229, 153, 0.55);
        }
        .mdl-drag-handle {
          color: #4b5563;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          transition: color 0.15s ease;
          cursor: grab;
        }
        .mdl-fab:hover .mdl-drag-handle,
        .mdl-fab.dragging .mdl-drag-handle {
          color: #00e599;
        }
        .mdl-fab-icon {
          width: 24px;
          height: 24px;
          background: linear-gradient(135deg, #00e599 0%, #00b377 100%);
          border-radius: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #06090e;
          box-shadow: 0 2px 6px rgba(0, 229, 153, 0.3);
          flex-shrink: 0;
        }
        .mdl-badge {
          font-size: 11px;
          font-weight: 800;
          padding: 1px 7px;
          border-radius: 999px;
          background: rgba(0, 229, 153, 0.16);
          color: #00e599;
          border: 1px solid rgba(0, 229, 153, 0.3);
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          min-width: 18px;
          text-align: center;
        }

        /* ── Streams Panel Drawer ── */
        .mdl-panel {
          position: fixed;
          bottom: 76px;
          right: 24px;
          z-index: 2147483646;
          width: 350px;
          max-height: 440px;
          overflow: hidden;
          background: #10131d;
          border: 1px solid #232b3d;
          border-radius: 14px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.05);
          display: none;
          flex-direction: column;
          color: #f1f5f9;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          animation: mdlSlideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .mdl-panel.open {
          display: flex;
        }
        @keyframes mdlSlideUp {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .mdl-panel-head {
          padding: 12px 14px;
          border-bottom: 1px solid #1c2333;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #141824;
        }
        .mdl-head-title {
          font-weight: 700;
          font-size: 13px;
          color: #f8fafc;
          display: flex;
          align-items: center;
          gap: 7px;
        }
        .mdl-head-actions {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .mdl-icon-btn, .mdl-close-btn {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          background: transparent;
          border: none;
          color: #94a3b8;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .mdl-close-btn {
          font-size: 16px;
        }
        .mdl-icon-btn:hover, .mdl-close-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #f1f5f9;
        }

        .mdl-panel-body {
          overflow-y: auto;
          flex: 1;
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .mdl-panel-body::-webkit-scrollbar {
          width: 5px;
        }
        .mdl-panel-body::-webkit-scrollbar-thumb {
          background: #232b3d;
          border-radius: 99px;
        }

        .mdl-item {
          display: flex;
          flex-direction: column;
          gap: 5px;
          padding: 9px 11px;
          border-radius: 9px;
          background: #151a27;
          border: 1px solid #21293b;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .mdl-item:hover {
          background: #1c2333;
          border-color: rgba(0, 229, 153, 0.4);
          transform: translateY(-1px);
        }
        .mdl-item-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .mdl-tag {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 4px;
          font-family: ui-monospace, monospace;
          letter-spacing: 0.02em;
        }
        .mdl-tag.hls { background: rgba(0, 229, 153, 0.14); color: #00e599; border: 1px solid rgba(0, 229, 153, 0.3); }
        .mdl-tag.dash { background: rgba(56, 189, 248, 0.14); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); }
        .mdl-tag.mp4 { background: rgba(168, 85, 247, 0.14); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); }
        .mdl-tag.audio { background: rgba(245, 158, 11, 0.14); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
        .mdl-tag.stream { background: rgba(244, 63, 94, 0.14); color: #fb7185; border: 1px solid rgba(244, 63, 94, 0.3); }

        .mdl-url {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 11px;
          color: #94a3b8;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .mdl-send-page {
          margin: 10px;
          padding: 10px;
          border-radius: 9px;
          background: linear-gradient(135deg, #00e599 0%, #00b377 100%);
          color: #05070a;
          font-weight: 700;
          font-size: 12.5px;
          text-align: center;
          cursor: pointer;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 0.15s ease;
          box-shadow: 0 4px 12px rgba(0, 229, 153, 0.2);
        }
        .mdl-send-page:hover {
          background: linear-gradient(135deg, #0fe8a0 0%, #00c482 100%);
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(0, 229, 153, 0.32);
        }
        .mdl-send-page:active {
          transform: translateY(0);
        }

        .mdl-empty {
          padding: 28px 16px;
          text-align: center;
          color: #64748b;
          font-size: 12px;
          line-height: 1.5;
        }

        /* ── Isolated Toast Notification ── */
        .mdl-toast {
          position: fixed;
          bottom: 24px;
          left: 50%;
          z-index: 2147483647;
          transform: translateX(-50%) translateY(14px);
          background: #151926;
          border: 1px solid #2a3449;
          border-radius: 11px;
          padding: 10px 18px;
          font-size: 13px;
          font-weight: 600;
          color: #f8fafc;
          box-shadow: 0 14px 40px rgba(0, 0, 0, 0.7);
          opacity: 0;
          pointer-events: none;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          align-items: center;
          gap: 9px;
          white-space: nowrap;
          max-width: 400px;
        }
        .mdl-toast.show {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
        .mdl-toast.success {
          border-color: rgba(0, 229, 153, 0.4);
        }
        .mdl-toast.error {
          border-color: rgba(244, 63, 94, 0.4);
        }
      </style>

      <!-- FAB Widget (Movable) -->
      <div class="mdl-fab" id="mdl-fab" title="Media Downloader (Click to view, drag to move, double-click to reset)">
        <div class="mdl-drag-handle" title="Drag to move anywhere">
          <svg width="6" height="12" viewBox="0 0 6 12" fill="none">
            <circle cx="1.5" cy="2" r="1.1" fill="currentColor"/>
            <circle cx="4.5" cy="2" r="1.1" fill="currentColor"/>
            <circle cx="1.5" cy="6" r="1.1" fill="currentColor"/>
            <circle cx="4.5" cy="6" r="1.1" fill="currentColor"/>
            <circle cx="1.5" cy="10" r="1.1" fill="currentColor"/>
            <circle cx="4.5" cy="10" r="1.1" fill="currentColor"/>
          </svg>
        </div>
        <div class="mdl-fab-icon">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 2v8M4 7l4 4 4-4"/>
            <rect x="2.5" y="13" width="11" height="1.5" rx=".75" fill="currentColor" stroke="none"/>
          </svg>
        </div>
        <span>Media Downloader</span>
        <span class="mdl-badge" id="mdl-badge">0</span>
      </div>

      <!-- Streams Drawer -->
      <div class="mdl-panel" id="mdl-panel">
        <div class="mdl-panel-head">
          <div class="mdl-head-title">
            <span>Detected Streams</span>
            <span class="mdl-badge" id="mdl-head-badge">0</span>
          </div>
          <div class="mdl-head-actions">
            <button class="mdl-icon-btn" id="mdl-reset-pos-btn" title="Reset button position to default corner">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 4v5h5M15 12V7h-5"/>
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 9"/>
              </svg>
            </button>
            <button class="mdl-close-btn" id="mdl-close-btn" title="Close">✕</button>
          </div>
        </div>
        <div class="mdl-panel-body" id="mdl-panel-body">
          <div class="mdl-empty">Play a video or stream to sniff direct media links…</div>
        </div>
        <button class="mdl-send-page" id="mdl-send-page">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 2v8M4 7l4 4 4-4"/>
            <rect x="2.5" y="13" width="11" height="1.5" rx=".75" fill="currentColor" stroke="none"/>
          </svg>
          <span>Send Page URL to Downloader</span>
        </button>
      </div>

      <!-- Toast Feedback -->
      <div class="mdl-toast" id="mdl-toast"></div>
    `;

    document.documentElement.appendChild(host);

    fabEl = shadowRoot.getElementById("mdl-fab");
    panelEl = shadowRoot.getElementById("mdl-panel");
    const closeBtn = shadowRoot.getElementById("mdl-close-btn");
    const resetPosBtn = shadowRoot.getElementById("mdl-reset-pos-btn");
    const sendPageBtn = shadowRoot.getElementById("mdl-send-page");

    // ── Drag & Drop Movable FAB Implementation ──
    let isDragging = false;
    let startPointerX = 0;
    let startPointerY = 0;
    let startFabX = 0;
    let startFabY = 0;
    let dragThresholdPassed = false;

    fabEl.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return; // Only primary click
      const rect = fabEl.getBoundingClientRect();
      startPointerX = e.clientX;
      startPointerY = e.clientY;
      startFabX = rect.left;
      startFabY = rect.top;
      isDragging = true;
      dragThresholdPassed = false;
      try {
        fabEl.setPointerCapture(e.pointerId);
      } catch {}
    });

    fabEl.addEventListener("pointermove", (e) => {
      if (!isDragging) return;

      const dx = e.clientX - startPointerX;
      const dy = e.clientY - startPointerY;

      if (!dragThresholdPassed) {
        if (Math.hypot(dx, dy) > 5) {
          dragThresholdPassed = true;
          fabEl.classList.add("dragging");
        } else {
          return;
        }
      }

      const rect = fabEl.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const pad = 8;
      const winW = window.innerWidth;
      const winH = window.innerHeight;

      let newX = startFabX + dx;
      let newY = startFabY + dy;

      newX = Math.max(pad, Math.min(newX, winW - w - pad));
      newY = Math.max(pad, Math.min(newY, winH - h - pad));

      fabEl.style.left = `${Math.round(newX)}px`;
      fabEl.style.top = `${Math.round(newY)}px`;
      fabEl.style.right = "auto";
      fabEl.style.bottom = "auto";

      if (panelOpen) {
        updatePanelPosition();
      }
    });

    function endPointerDrag(e) {
      if (!isDragging) return;
      isDragging = false;
      try {
        fabEl.releasePointerCapture(e.pointerId);
      } catch {}

      fabEl.classList.remove("dragging");

      if (dragThresholdPassed) {
        const rect = fabEl.getBoundingClientRect();
        saveFabPosition(rect.left, rect.top, rect.width, rect.height);
        setTimeout(() => {
          dragThresholdPassed = false;
        }, 80);
      }
    }

    fabEl.addEventListener("pointerup", endPointerDrag);
    fabEl.addEventListener("pointercancel", endPointerDrag);

    // Click toggles streams drawer (ignored if dragging occurred)
    fabEl.addEventListener("click", () => {
      if (dragThresholdPassed) return;
      panelOpen = !panelOpen;
      panelEl.classList.toggle("open", panelOpen);
      if (panelOpen) {
        updatePanelPosition();
      }
    });

    // Double-click resets button to default bottom-right position
    fabEl.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      resetFabPosition();
    });

    if (resetPosBtn) {
      resetPosBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        resetFabPosition();
      });
    }

    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      panelOpen = false;
      panelEl.classList.remove("open");
    });

    sendPageBtn.addEventListener("click", () => {
      sendToApp(location.href, document.title);
    });

    // Restore saved position
    loadAndApplyPosition();
    window.addEventListener("resize", () => {
      loadAndApplyPosition();
    });
  }

  // ── Position Persistence & Adaptive Placement ────────────────────────────
  function saveFabPosition(x, y, w, h) {
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    const distFromLeft = Math.max(8, x);
    const distFromRight = Math.max(8, winW - (x + w));
    const distFromTop = Math.max(8, y);
    const distFromBottom = Math.max(8, winH - (y + h));

    const preferRight = distFromRight <= distFromLeft;
    const preferBottom = distFromBottom <= distFromTop;

    const posData = {
      preferRight,
      preferBottom,
      offsetX: Math.round(preferRight ? distFromRight : distFromLeft),
      offsetY: Math.round(preferBottom ? distFromBottom : distFromTop),
    };

    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        chrome.storage.local.set({ mdl_fab_pos: posData });
      } else {
        localStorage.setItem("__mdl_fab_pos__", JSON.stringify(posData));
      }
    } catch {}
  }

  function applyFabPosition(posData) {
    if (!fabEl) return;
    const pad = 10;
    const rect = fabEl.getBoundingClientRect();
    const w = rect.width || 160;
    const h = rect.height || 42;
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    let x, y;
    if (!posData) {
      x = winW - w - 24;
      y = winH - h - 24;
    } else {
      if (posData.preferRight) {
        x = winW - w - (posData.offsetX || 24);
      } else {
        x = posData.offsetX || 24;
      }

      if (posData.preferBottom) {
        y = winH - h - (posData.offsetY || 24);
      } else {
        y = posData.offsetY || 24;
      }
    }

    x = Math.max(pad, Math.min(x, winW - w - pad));
    y = Math.max(pad, Math.min(y, winH - h - pad));

    fabEl.style.left = `${Math.round(x)}px`;
    fabEl.style.top = `${Math.round(y)}px`;
    fabEl.style.right = "auto";
    fabEl.style.bottom = "auto";

    if (panelOpen) {
      updatePanelPosition();
    }
  }

  function loadAndApplyPosition() {
    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        chrome.storage.local.get("mdl_fab_pos", (res) => {
          applyFabPosition(res?.mdl_fab_pos || null);
        });
        return;
      }
      const raw = localStorage.getItem("__mdl_fab_pos__");
      applyFabPosition(raw ? JSON.parse(raw) : null);
    } catch {
      applyFabPosition(null);
    }
  }

  function resetFabPosition() {
    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        chrome.storage.local.remove("mdl_fab_pos");
      } else {
        localStorage.removeItem("__mdl_fab_pos__");
      }
    } catch {}
    applyFabPosition(null);
    showToast("Position reset to corner ✓", true);
  }

  function updatePanelPosition() {
    if (!panelEl || !fabEl) return;
    const fabRect = fabEl.getBoundingClientRect();
    const panelW = 350;
    const pad = 12;
    const gap = 10;
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    // Vertical alignment:
    if (fabRect.top > winH * 0.5) {
      // FAB is in lower half -> Panel opens ABOVE
      const bottomDist = winH - fabRect.top + gap;
      panelEl.style.bottom = `${Math.round(bottomDist)}px`;
      panelEl.style.top = "auto";
      panelEl.style.maxHeight = `${Math.max(200, Math.min(460, fabRect.top - pad * 2))}px`;
    } else {
      // FAB is in upper half -> Panel opens BELOW
      const topDist = fabRect.bottom + gap;
      panelEl.style.top = `${Math.round(topDist)}px`;
      panelEl.style.bottom = "auto";
      panelEl.style.maxHeight = `${Math.max(200, Math.min(460, winH - topDist - pad))}px`;
    }

    // Horizontal alignment:
    if (fabRect.left + fabRect.width / 2 > winW / 2) {
      // Right side
      let rightDist = winW - fabRect.right;
      if (winW - rightDist - panelW < pad) {
        rightDist = winW - panelW - pad;
      }
      rightDist = Math.max(pad, rightDist);
      panelEl.style.right = `${Math.round(rightDist)}px`;
      panelEl.style.left = "auto";
    } else {
      // Left side
      let leftDist = fabRect.left;
      if (leftDist + panelW > winW - pad) {
        leftDist = winW - panelW - pad;
      }
      leftDist = Math.max(pad, leftDist);
      panelEl.style.left = `${Math.round(leftDist)}px`;
      panelEl.style.right = "auto";
    }
  }

  function getTagClass(label) {
    const l = (label || "").toLowerCase();
    if (l.includes("hls")) return "hls";
    if (l.includes("dash")) return "dash";
    if (l.includes("mp4") || l.includes("webm")) return "mp4";
    if (l.includes("audio")) return "audio";
    return "stream";
  }

  function renderStreamsList() {
    if (!shadowRoot) return;
    const body = shadowRoot.getElementById("mdl-panel-body");
    const badge = shadowRoot.getElementById("mdl-badge");
    const headBadge = shadowRoot.getElementById("mdl-head-badge");
    if (!body || !badge) return;

    const list = [...streams.values()].sort((a, b) => b.ts - a.ts);
    badge.textContent = list.length;
    if (headBadge) headBadge.textContent = list.length;

    if (!list.length) {
      body.innerHTML = `<div class="mdl-empty">Play a video or stream to sniff direct media links…</div>`;
      return;
    }

    body.innerHTML = list
      .map((s) => {
        const display = s.url.replace(/^https?:\/\/(www\.)?/, "");
        const shortUrl = display.length > 55 ? display.slice(0, 55) + "…" : display;
        const tagClass = getTagClass(s.label);

        return `
          <div class="mdl-item" data-url="${escapeHtml(s.url)}" title="Click to send stream directly to Media Downloader">
            <div class="mdl-item-top">
              <span class="mdl-tag ${tagClass}">${escapeHtml(s.label)}</span>
              <span style="font-size:10px;color:#64748b">${s.size ? formatSize(s.size) : ""}</span>
            </div>
            <div class="mdl-url">${escapeHtml(shortUrl)}</div>
          </div>
        `;
      })
      .join("");

    body.querySelectorAll(".mdl-item").forEach((el) => {
      el.addEventListener("click", () => {
        const url = el.getAttribute("data-url");
        sendToApp(url, document.title + " (stream)");
      });
    });

    if (panelOpen) {
      updatePanelPosition();
    }
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatSize(n) {
    if (n > 1e9) return (n / 1e9).toFixed(1) + " GB";
    if (n > 1e6) return (n / 1e6).toFixed(1) + " MB";
    if (n > 1e3) return (n / 1e3).toFixed(0) + " KB";
    return n + " B";
  }

  // ── Toast Feedback ────────────────────────────────────────────────────────
  function showToast(message, ok = true) {
    if (!shadowRoot) return;
    const toast = shadowRoot.getElementById("mdl-toast");
    if (!toast) return;

    const icon = ok ? "✓" : "✕";
    const iconColor = ok ? "#00e599" : "#f43f5e";
    toast.className = `mdl-toast ${ok ? "success" : "error"} show`;
    toast.innerHTML = `
      <span style="color:${iconColor};font-weight:800;font-size:14px;">${icon}</span>
      <span>${escapeHtml(message)}</span>
    `;

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2800);
  }

  // ── Communication with Desktop App ─────────────────────────────────────────
  async function sendToApp(url, title) {
    try {
      const res = await chrome.runtime.sendMessage({
        type: "SEND_URL",
        url,
        title: title || document.title,
      });

      if (res?.ok) {
        showToast("Sent to Media Downloader ✓", true);
      } else {
        showToast("App not running — open it first", false);
      }
    } catch {
      showToast("App not running — open it first", false);
    }
  }

  // ── Initialization ────────────────────────────────────────────────────────
  function boot() {
    hookNetwork();
    createUI();

    // Scan initially after brief delay
    setTimeout(() => {
      scanExistingMedia();
      observeDOM();
      loadAndApplyPosition();
    }, 600);

    // Periodically re-scan early on for late-initialized players
    let scans = 0;
    const iv = setInterval(() => {
      scanExistingMedia();
      if (++scans > 8) clearInterval(iv);
    }, 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
