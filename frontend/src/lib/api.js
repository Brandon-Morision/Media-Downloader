/**
 * PyWebView API Client Bridge
 * Wraps window.pywebview.api calls with error handling and browser dev fallbacks.
 */

export const isDesktopApp = () => Boolean(window.pywebview?.api);

export async function waitForApi(timeoutMs = 10000) {
  if (window.pywebview?.api) return window.pywebview.api;
  return new Promise((resolve) => {
    let resolved = false;
    let intervalId = null;
    let timerId = null;

    const finish = (val) => {
      if (!resolved) {
        resolved = true;
        if (intervalId) clearInterval(intervalId);
        if (timerId) clearTimeout(timerId);
        resolve(val);
      }
    };

    intervalId = setInterval(() => {
      if (window.pywebview?.api) {
        finish(window.pywebview.api);
      }
    }, 50);

    timerId = setTimeout(() => {
      finish(window.pywebview?.api || null);
    }, timeoutMs);

    window.addEventListener(
      "pywebviewready",
      () => {
        finish(window.pywebview?.api || null);
      },
      { once: true }
    );
  });
}

export const api = {
  // Downloads
  async startDownload(url, cfg, toolOverride = null) {
    if (!isDesktopApp()) {
      await waitForApi(3000);
    }
    if (!isDesktopApp()) {
      console.log("[Dev Mock] startDownload:", url, cfg);
      return { ok: true, started: true, job_id: "mock-" + Date.now() };
    }
    const fn = window.pywebview?.api?.start_download_async || window.pywebview?.api?.start_download;
    if (typeof fn === 'function') {
      return fn(url, cfg, toolOverride || "");
    }
    throw new Error("Download API method not found on window.pywebview.api");
  },

  async pauseDownload(jobId) {
    if (!isDesktopApp()) return { ok: true };
    return window.pywebview.api.pause_download(jobId);
  },

  async resumeDownload(jobId) {
    if (!isDesktopApp()) return { ok: true };
    return window.pywebview.api.resume_download(jobId);
  },

  async cancelDownload(jobId) {
    if (!isDesktopApp()) return { ok: true };
    return window.pywebview.api.cancel_download(jobId);
  },

  // Windows Taskbar Progress (ITaskbarList3)
  async setTaskbarProgress(percent, state = 'normal') {
    if (!isDesktopApp()) return { ok: true };
    return window.pywebview.api?.set_taskbar_progress?.(percent, state);
  },

  async clearTaskbarProgress() {
    if (!isDesktopApp()) return { ok: true };
    return window.pywebview.api?.clear_taskbar_progress?.();
  },

  // Windows 10/11 Native Rich Interactive Toast Notifications
  async showNativeToast(title, message, imagePath = null, actions = null) {
    if (!isDesktopApp()) return { ok: true };
    return window.pywebview.api?.show_native_toast?.(title, message, imagePath, actions);
  },

  async setNativeToastEnabled(enabled) {
    if (!isDesktopApp()) return { ok: true };
    return window.pywebview.api?.set_native_toast_enabled?.(enabled);
  },

  // Windows Sleep Prevention
  async setSleepPrevention(prevent) {
    if (!isDesktopApp()) return { ok: true };
    return window.pywebview.api?.set_sleep_prevention?.(prevent);
  },

  // Windows 11 DWM Window Backdrop & Styling
  async applyWindowBackdrop(backdrop = 'mica') {
    if (!isDesktopApp()) return { ok: true };
    return window.pywebview.api?.apply_window_backdrop?.(backdrop);
  },

  // Rate Limit Auto-Scheduler
  async getScheduledDownloads() {
    if (!isDesktopApp()) return { ok: true, jobs: [] };
    return window.pywebview.api?.get_scheduled_downloads?.() || { ok: true, jobs: [] };
  },

  async cancelScheduledDownload(jobId) {
    if (!isDesktopApp()) return { ok: true };
    return window.pywebview.api?.cancel_scheduled_download?.(jobId);
  },

  async startScheduledDownloadNow(jobId) {
    if (!isDesktopApp()) return { ok: true };
    return window.pywebview.api?.start_scheduled_download_now?.(jobId);
  },

  // History
  async listHistory() {
    await waitForApi(6000);
    if (!isDesktopApp()) {
      return {
        ok: true,
        entries: [
          {
            id: "mock-1",
            url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            filename: "Never Gonna Give You Up.mp4",
            tool: "yt-dlp",
            status: "done",
            size_bytes: 48500000,
            finished_at: (Date.now() - 3600000) / 1000,
            files: [{ name: "Never Gonna Give You Up.mp4", path: "C:\\Downloads\\Never Gonna Give You Up.mp4" }],
          },
          {
            id: "mock-2",
            url: "https://danbooru.donmai.us/posts/123",
            filename: "Anime Illustration Set",
            tool: "gallery-dl",
            status: "done",
            size_bytes: 12400000,
            finished_at: (Date.now() - 86400000) / 1000,
            files: [
              { name: "01.png", path: "C:\\Downloads\\01.png" },
              { name: "02.png", path: "C:\\Downloads\\02.png" },
            ],
          },
        ],
      };
    }
    return window.pywebview.api.list_history();
  },

  async deleteHistoryEntry(entryId) {
    if (!isDesktopApp()) return { ok: true };
    return window.pywebview.api.delete_history_entry(entryId);
  },

  async clearHistory() {
    if (!isDesktopApp()) return { ok: true, cleared: 0 };
    return window.pywebview.api.clear_history();
  },

  async scanMediaLibrary(rootDir = "") {
    await waitForApi(6000);
    if (!isDesktopApp()) {
      return this.listHistory();
    }
    const fn = window.pywebview?.api?.scan_media_library;
    if (typeof fn === 'function') {
      return fn(rootDir);
    }
    return this.listHistory();
  },

  // Search & Playlists & Link Preview
  async previewLink(url, requestId = "prev-" + Date.now()) {
    if (!isDesktopApp()) {
      return { ok: true, started: true, requestId };
    }
    return window.pywebview.api.preview_link(url, requestId);
  },

  async inspectPlaylist(url, requestId = "req-" + Date.now()) {
    if (!isDesktopApp()) {
      return { ok: true, started: true, requestId };
    }
    return window.pywebview.api.inspect_playlist(url, requestId);
  },

  async search(query, limit = 12) {
    if (!isDesktopApp()) {
      return { ok: true, searching: true };
    }
    return window.pywebview.api.search(query, limit);
  },

  async listSearches() {
    if (!isDesktopApp()) return { ok: true, queries: [] };
    return window.pywebview.api.list_searches();
  },

  async saveSearch(query) {
    if (!isDesktopApp()) return { ok: true };
    return window.pywebview.api.save_search(query);
  },

  async deleteSearch(queryId) {
    if (!isDesktopApp()) return { ok: true };
    return window.pywebview.api.delete_search(queryId);
  },

  async clearSearches() {
    if (!isDesktopApp()) return { ok: true };
    return window.pywebview.api.clear_searches();
  },

  // System & Files
  async getDefaultOutputDir() {
    if (!isDesktopApp()) return "~/Downloads/media";
    try {
      return (await window.pywebview.api.get_default_output_dir?.()) || "~/Downloads/media";
    } catch {
      return "~/Downloads/media";
    }
  },

  async pickFolder() {
    if (!isDesktopApp()) return "C:\\Users\\Mock\\Downloads";
    return window.pywebview.api.pick_folder();
  },

  async openOutputFolder(path) {
    if (!isDesktopApp()) {
      alert("Opening folder: " + path);
      return { ok: true };
    }
    return window.pywebview.api.open_output_folder(path);
  },

  async openExtensionFolder() {
    if (!isDesktopApp()) {
      alert("Opening extension folder");
      return { ok: true };
    }
    return window.pywebview.api.open_extension_folder();
  },

  async openFile(path) {
    if (!isDesktopApp()) {
      alert("Opening file: " + path);
      return { ok: true };
    }
    return window.pywebview.api.open_file(path);
  },

  async openUrlExternal(url) {
    if (!isDesktopApp()) {
      window.open(url, "_blank");
      return { ok: true };
    }
    return window.pywebview.api.open_url_external(url);
  },

  // Media Player Streams
  async getMediaUrl(path) {
    if (!isDesktopApp()) return { ok: false, error: "Not in desktop app" };
    return window.pywebview.api.get_media_url(path);
  },

  async getMediaUrls(paths) {
    if (!isDesktopApp()) return { ok: false, error: "Not in desktop app" };
    return window.pywebview.api.get_media_urls(paths);
  },

  async getCoverArtUrl(path) {
    if (!isDesktopApp()) {
      await waitForApi(6000);
    }
    if (!isDesktopApp()) return { ok: false };
    try {
      return (await window.pywebview.api.get_cover_art_url?.(path)) || { ok: false };
    } catch {
      return { ok: false };
    }
  },

  async getVideoThumbnailUrl(path) {
    if (!isDesktopApp()) {
      await waitForApi(6000);
    }
    if (!isDesktopApp()) return { ok: false };
    try {
      return (await window.pywebview.api.get_video_thumbnail_url?.(path)) || { ok: false };
    } catch {
      return { ok: false };
    }
  },

  async getItemThumbnailUrl(path, outputDir = "") {
    if (!isDesktopApp()) {
      await waitForApi(6000);
    }
    if (!isDesktopApp()) return { ok: false };
    try {
      return (await window.pywebview.api.get_item_thumbnail_url?.(path, outputDir)) || { ok: false };
    } catch {
      return { ok: false };
    }
  },

  // Tools & Versioning
  async getInstalledVersions() {
    if (!isDesktopApp()) {
      return {
        "yt-dlp": "2026.08.20 (mock)",
        "gallery-dl": "1.32.16 (mock)",
        ffmpeg: "9.0.2 (mock)",
        app: "0.4.6",
      };
    }
    try {
      const fn = window.pywebview.api.get_system_versions || window.pywebview.api.get_installed_versions;
      if (fn) {
        const res = await fn();
        return {
          "yt-dlp": res?.['yt-dlp']?.version || res?.['yt-dlp'] || 'Not detected',
          "gallery-dl": res?.['gallery-dl']?.version || res?.['gallery-dl'] || 'Not detected',
          ffmpeg: res?.ffmpeg?.version || res?.ffmpeg || 'Not detected',
          app: res?.app?.version || res?.app || '0.4.6',
          raw: res,
        };
      }
    } catch (err) {
      console.warn('Error fetching installed versions:', err);
    }
    return { "yt-dlp": "Not detected", "gallery-dl": "Not detected", ffmpeg: "Not detected", app: "0.4.6" };
  },

  async getYtdlpVersion() {
    const v = await this.getInstalledVersions();
    return v['yt-dlp'];
  },

  async getGalleryDlVersion() {
    const v = await this.getInstalledVersions();
    return v['gallery-dl'];
  },

  async getFfmpegVersion() {
    const v = await this.getInstalledVersions();
    return v['ffmpeg'];
  },

  async getAppVersion() {
    const v = await this.getInstalledVersions();
    return v['app'];
  },

  async checkUpdates() {
    if (!isDesktopApp()) return { ok: true, checking: true, mock: true };
    return window.pywebview.api.check_updates_async();
  },
  async checkForUpdates() {
    return this.checkUpdates();
  },

  async checkEngineUpdate(toolName) {
    if (!isDesktopApp()) return { ok: true, checking: true, mock: true };
    const fn = window.pywebview.api.check_engine_update_async;
    return fn ? fn(toolName) : { ok: false, error: 'Not supported' };
  },
  async checkSingleToolUpdate(toolName) {
    return this.checkEngineUpdate(toolName);
  },

  async checkAppUpdate() {
    if (!isDesktopApp()) return { ok: true, checking: true, mock: true };
    const fn = window.pywebview.api.check_app_update_async;
    return fn ? fn() : { ok: false, error: 'Not supported' };
  },

  async updateTool(toolName) {
    if (!isDesktopApp()) return { ok: true, output: "Mock update complete" };
    const fn = window.pywebview.api.update_engine_async || window.pywebview.api.update_tool;
    return fn ? fn(toolName) : { ok: false, error: 'Not supported' };
  },
  async updateSingleTool(toolName) {
    return this.updateTool(toolName);
  },

  async downloadAppUpdate(assetUrl, assetName = '') {
    if (!isDesktopApp()) return { ok: true, downloading: true };
    return window.pywebview.api.download_app_update_async(assetUrl, assetName);
  },

  async applyAppUpdate(installerPath, silent = false) {
    if (!isDesktopApp()) return { ok: true };
    return window.pywebview.api.apply_app_update(installerPath, silent);
  },
  async installAppUpdate(installerPath, silent = false) {
    return this.applyAppUpdate(installerPath, silent);
  },

  async autoUpdateAll(autoDownloadApp = true) {
    if (!isDesktopApp()) return { ok: true, started: true };
    const fn = window.pywebview.api.auto_update_all_async;
    return fn ? fn(autoDownloadApp) : { ok: false, error: 'Not supported' };
  },
  async autoUpdateAllEngines(autoDownloadApp = true) {
    return this.autoUpdateAll(autoDownloadApp);
  },

  // Night-Owl & Shutdown
  async executeCompletionAction(action, waitSec = 30) {
    if (!isDesktopApp()) return { ok: true, action };
    return window.pywebview.api.execute_completion_action(action, waitSec);
  },

  async cancelShutdown() {
    if (!isDesktopApp()) return { ok: true };
    return window.pywebview.api.cancel_shutdown();
  },

  async closeApp() {
    if (!isDesktopApp()) return { ok: true };
    return window.pywebview.api.close_app();
  },

  // Playlist parsing
  async parsePlaylist(url) {
    if (!isDesktopApp()) return { ok: false, error: "Only available in desktop app" };
    return window.pywebview.api.parse_playlist(url);
  },
};
