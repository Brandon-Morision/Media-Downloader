import React, { useState, useEffect } from 'react';
import {
  Folder, Palette, Sliders, Wrench, RefreshCw, Check,
  DownloadCloud, ArrowUpCircle, ExternalLink, ShieldCheck, Box,
  ChevronRight, ChevronDown, Bell, HardDrive, Info, Sparkles, Puzzle,
  Cpu, ArrowDownCircle, CheckCircle2, AlertTriangle, Zap, Download,
  Volume2
} from 'lucide-react';
import { api, waitForApi } from '../../lib/api';
import novadropBanner from '../../assets/novadrop-banner.png';
import novadropIcon from '../../assets/novadrop-icon.png';

const ACCENT_THEMES = [
  { id: 'violet', label: 'Violet Glow', color: '#7c6dfa' },
  { id: 'emerald', label: 'Emerald Mint', color: '#00e599' },
  { id: 'ocean', label: 'Ocean Blue', color: '#38bdf8' },
  { id: 'amber', label: 'Solar Amber', color: '#f59e0b' },
  { id: 'rose', label: 'Crimson Rose', color: '#f43f5e' },
];

const ENGINE_METADATA = [
  {
    id: 'yt-dlp',
    name: 'yt-dlp Engine',
    desc: 'High-speed video & audio extractor (YouTube, Twitch, Vimeo, 1000+ sites)',
    tag: 'Video & Audio',
    color: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
  },
  {
    id: 'gallery-dl',
    name: 'gallery-dl Engine',
    desc: 'Image board, multi-post manga, and art gallery scraper',
    tag: 'Image Boards & Galleries',
    color: 'border-sky-500/30 text-sky-400 bg-sky-500/10',
  },
  {
    id: 'ffmpeg',
    name: 'FFmpeg Engine',
    desc: 'Media remuxing, audio conversion (MP3/M4A), stream merging & cover art',
    tag: 'Core Media Muxer',
    color: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
  },
];

/**
 * Universal accessible toggle switch with Windows 11 style On/Off label.
 * Uses native HTML button with role="switch" and guaranteed Tailwind classes
 * for instant, rock-solid visibility across all window sizes and platforms.
 */
function ToggleSwitch({ checked, onChange, disabled = false, ariaLabel, showStateLabel = true }) {
  return (
    <div className="flex items-center gap-3 shrink-0">
      {showStateLabel && (
        <span className={`text-xs font-semibold select-none transition-colors ${checked ? 'text-slate-200' : 'text-slate-400'}`}>
          {checked ? 'On' : 'Off'}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full transition-colors relative p-0.5 shrink-0 focus:outline-none focus:ring-2 focus:ring-brand-acc focus:ring-offset-2 focus:ring-offset-surface-1 cursor-pointer select-none ${
          checked ? 'bg-brand-acc shadow-glow' : 'bg-surface-3 hover:bg-surface-4 border border-border-subtle'
        } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
      >
        <div
          className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

function formatPathDisplay(p) {
  if (!p) return '~/Downloads/media';
  const parts = p.replace(/\\/g, '/').split('/');
  return parts.slice(-2).join('/');
}

export default function SettingsView({
  themeAccent,
  setThemeAccent,
  outputDir,
  setOutputDir,
  defaultFormat,
  setDefaultFormat,
  onFinishAction,
  setOnFinishAction,
  clipAutostart,
  setClipAutostart,
  onShowToast,
}) {
  const [activeSection, setActiveSection] = useState(null);
  const [versions, setVersions] = useState({
    'yt-dlp': 'Checking…',
    'gallery-dl': 'Checking…',
    ffmpeg: 'Checking…',
    app: '0.4.0',
  });

  const [isCheckingAll, setIsCheckingAll] = useState(false);
  const [isAutoUpdatingAll, setIsAutoUpdatingAll] = useState(false);
  const [autoUpdateStatusMsg, setAutoUpdateStatusMsg] = useState('');

  // Independent tool states: checking, updating, info, progress, error
  const [engineStates, setEngineStates] = useState({
    'yt-dlp': { checking: false, updating: false, info: null, progress: null, error: null },
    'gallery-dl': { checking: false, updating: false, info: null, progress: null, error: null },
    ffmpeg: { checking: false, updating: false, info: null, progress: null, error: null },
  });

  // App update state
  const [appState, setAppState] = useState({
    checking: false,
    downloading: false,
    info: null,
    progress: null,
    installerPath: null,
    error: null,
  });

  // Automation toggles
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(() => localStorage.getItem('md_auto_update') !== 'false');
  const [autoDownloadEngines, setAutoDownloadEngines] = useState(() => localStorage.getItem('md_auto_download_engines') !== 'false');

  // Notification & Power toggles
  const [notifyOnComplete, setNotifyOnComplete] = useState(() => localStorage.getItem('md_notify_complete') !== 'false');
  const [notifyClipboardToast, setNotifyClipboardToast] = useState(() => localStorage.getItem('md_notify_clipboard') !== 'false');
  const [notifyOnError, setNotifyOnError] = useState(() => localStorage.getItem('md_notify_error') !== 'false');
  const [soundOnComplete, setSoundOnComplete] = useState(() => localStorage.getItem('md_sound_complete') === 'true');
  const [preventSleep, setPreventSleep] = useState(() => localStorage.getItem('md_prevent_sleep') !== 'false');

  useEffect(() => {
    loadVersions();

    // 1. Full check complete handler
    window.onUpdateCheckComplete = (res) => {
      setIsCheckingAll(false);
      if (res?.ok) {
        if (res.app) {
          setAppState((prev) => ({
            ...prev,
            checking: false,
            info: res.app,
          }));
        }
        if (res.tools) {
          setEngineStates((prev) => {
            const next = { ...prev };
            for (const [tool, tinfo] of Object.entries(res.tools)) {
              if (next[tool]) {
                next[tool] = { ...next[tool], checking: false, info: tinfo };
              }
            }
            return next;
          });
        }
        if (res.any_update) {
          onShowToast('New updates found!');
        } else {
          onShowToast('All engines and app are up to date');
        }
      } else {
        onShowToast(res?.error || 'Failed to check updates', false);
      }
    };

    // 2. Single tool check complete
    window.onSingleToolCheckComplete = (res) => {
      const tool = res?.tool;
      if (tool && engineStates[tool]) {
        setEngineStates((prev) => ({
          ...prev,
          [tool]: {
            ...prev[tool],
            checking: false,
            info: res.info,
            error: res.ok ? null : res.error,
          },
        }));
        if (res.ok && res.info?.update_available) {
          onShowToast(`Update available for ${tool}: ${res.info.latest_version}`);
        } else if (res.ok) {
          onShowToast(`${tool} is already up to date`);
        } else {
          onShowToast(res.error || `Failed to check ${tool}`, false);
        }
      }
    };

    // 3. Single app check complete
    window.onAppCheckComplete = (res) => {
      setAppState((prev) => ({
        ...prev,
        checking: false,
        info: res.ok ? res.info : null,
        error: res.ok ? null : res.error,
      }));
      if (res.ok && res.info?.update_available) {
        onShowToast(`NovaDrop v${res.info.latest_version} available!`);
      } else if (res.ok) {
        onShowToast('NovaDrop is up to date');
      } else {
        onShowToast(res.error || 'Failed to check app update', false);
      }
    };

    // 4. Single tool update progress
    window.onSingleToolProgress = (data) => {
      const tool = data?.tool;
      if (tool && engineStates[tool]) {
        setEngineStates((prev) => ({
          ...prev,
          [tool]: {
            ...prev[tool],
            updating: true,
            progress: data,
          },
        }));
      }
    };

    // 5. Single tool update complete
    window.onSingleToolUpdateComplete = (res) => {
      const tool = res?.tool;
      if (tool && engineStates[tool]) {
        setEngineStates((prev) => ({
          ...prev,
          [tool]: {
            ...prev[tool],
            updating: false,
            progress: null,
            error: res.ok ? null : res.error,
            info: res.ok ? { ...prev[tool].info, update_available: false } : prev[tool].info,
          },
        }));
        if (res.ok) {
          onShowToast(`${tool} updated successfully to ${res.version}!`);
          loadVersions();
        } else {
          onShowToast(`Failed to update ${tool}: ${res.error}`, false);
        }
      }
    };

    // 6. App download progress
    window.onAppDownloadProgress = (data) => {
      setAppState((prev) => ({
        ...prev,
        downloading: true,
        progress: data,
      }));
    };

    // 7. App download complete
    window.onAppDownloadComplete = (res) => {
      setAppState((prev) => ({
        ...prev,
        downloading: false,
        progress: null,
        installerPath: res.ok ? res.installer_path : null,
        error: res.ok ? null : res.error,
      }));
      if (res.ok) {
        onShowToast('Installer downloaded! Click "Install & Relaunch".');
      } else {
        onShowToast(`Installer download failed: ${res.error}`, false);
      }
    };

    // 8. Auto-updater batch step notification
    window.onAutoUpdateStep = (msg) => {
      setAutoUpdateStatusMsg(msg);
    };

    // Auto-check on mount if enabled
    if (localStorage.getItem('md_auto_update') !== 'false') {
      setTimeout(() => {
        handleCheckAllUpdatesSilently();
      }, 1500);
    }

    return () => {
      window.onUpdateCheckComplete = null;
      window.onSingleToolCheckComplete = null;
      window.onAppCheckComplete = null;
      window.onSingleToolProgress = null;
      window.onSingleToolUpdateComplete = null;
      window.onAppDownloadProgress = null;
      window.onAppDownloadComplete = null;
      window.onAutoUpdateStep = null;
    };
  }, []);

  const loadVersions = async () => {
    try {
      await waitForApi();
      const [yv, gv, fv] = await Promise.all([
        api.getYtdlpVersion(),
        api.getGalleryDlVersion(),
        api.getFfmpegVersion(),
      ]);
      setVersions({
        'yt-dlp': yv || 'Not detected',
        'gallery-dl': gv || 'Not detected',
        ffmpeg: fv || 'Not detected',
        app: '0.4.0',
      });
    } catch {
      // Fallback
    }
  };

  const handlePickFolder = async () => {
    try {
      const folder = await api.chooseFolder(outputDir);
      if (folder) {
        setOutputDir(folder);
        localStorage.setItem('md_output_dir', folder);
        onShowToast('Download directory updated');
      }
    } catch (e) {
      onShowToast(`Failed to pick folder: ${e.message}`, false);
    }
  };

  const handleCheckAllUpdatesSilently = async () => {
    try {
      await waitForApi();
      setIsCheckingAll(true);
      await api.checkForUpdates();
    } catch {
      setIsCheckingAll(false);
    }
  };

  const handleCheckAllUpdates = async () => {
    try {
      await waitForApi();
      setIsCheckingAll(true);
      onShowToast('Checking all extractor engines and application updates…');
      await api.checkForUpdates();
    } catch (e) {
      setIsCheckingAll(false);
      onShowToast(`Update check failed: ${e.message}`, false);
    }
  };

  const handleCheckSingleEngine = async (tool) => {
    try {
      await waitForApi();
      setEngineStates((prev) => ({
        ...prev,
        [tool]: { ...prev[tool], checking: true, error: null },
      }));
      await api.checkSingleToolUpdate(tool);
    } catch (e) {
      setEngineStates((prev) => ({
        ...prev,
        [tool]: { ...prev[tool], checking: false, error: e.message },
      }));
      onShowToast(`Failed to check ${tool}: ${e.message}`, false);
    }
  };

  const handleUpdateSingleEngine = async (tool) => {
    try {
      await waitForApi();
      setEngineStates((prev) => ({
        ...prev,
        [tool]: { ...prev[tool], updating: true, error: null },
      }));
      onShowToast(`Starting update for ${tool}…`);
      await api.updateSingleTool(tool);
    } catch (e) {
      setEngineStates((prev) => ({
        ...prev,
        [tool]: { ...prev[tool], updating: false, error: e.message },
      }));
      onShowToast(`Failed to update ${tool}: ${e.message}`, false);
    }
  };

  const handleCheckApp = async () => {
    try {
      await waitForApi();
      setAppState((prev) => ({ ...prev, checking: true, error: null }));
      onShowToast('Checking for NovaDrop app updates…');
      await api.checkAppUpdate();
    } catch (e) {
      setAppState((prev) => ({ ...prev, checking: false, error: e.message }));
      onShowToast(`Failed to check app: ${e.message}`, false);
    }
  };

  const handleDownloadApp = async () => {
    try {
      await waitForApi();
      const downloadUrl = appState.info?.asset_url || appState.info?.download_url;
      const assetName = appState.info?.asset_name || 'MediaDownloader_Setup.exe';
      const htmlUrl = appState.info?.html_url || 'https://github.com/Brandon-Morision/Media-Downloader/releases';

      if (!downloadUrl || appState.info?.has_direct_installer === false) {
        onShowToast('Opening latest release on GitHub…');
        await api.openUrlExternal(htmlUrl);
        return;
      }
      setAppState((prev) => ({ ...prev, downloading: true, error: null }));
      onShowToast('Downloading application update…');
      await api.downloadAppUpdate(downloadUrl, assetName);
    } catch (e) {
      setAppState((prev) => ({ ...prev, downloading: false, error: e.message }));
      onShowToast(`Download failed: ${e.message}`, false);
    }
  };

  const handleInstallApp = async () => {
    if (!appState.installerPath) return;
    try {
      onShowToast('Launching installer and closing current session…');
      const fn = api.installAppUpdate || api.applyAppUpdate;
      await fn.call(api, appState.installerPath);
    } catch (e) {
      onShowToast(`Launch failed: ${e.message}`, false);
    }
  };

  const handleAutoUpdateAll = async () => {
    try {
      await waitForApi();
      setIsAutoUpdatingAll(true);
      setAutoUpdateStatusMsg('Scanning for engine updates…');
      onShowToast('Automated updater running in background…');
      await api.autoUpdateAllEngines();
    } catch (e) {
      setIsAutoUpdatingAll(false);
      onShowToast(`Auto-update failed: ${e.message}`, false);
    }
  };

  const toggleSection = (id) => {
    setActiveSection((prev) => (prev === id ? null : id));
  };

  const anyUpdateAvailable =
    Boolean(appState.info?.update_available) ||
    Object.values(engineStates).some((s) => s.info?.update_available);

  const currentAccentObj = ACCENT_THEMES.find((t) => t.id === themeAccent) || ACCENT_THEMES[0];

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto px-6 md:px-8 lg:px-12 py-6 md:py-8 gap-7 w-full select-none">
      <h1 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">Settings</h1>

      {/* ── TOP USER / BRAND PROFILE BANNER ── */}
      <div className="bg-surface-1/90 backdrop-blur-md border border-border-subtle hover:border-white/10 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-5 shadow-sm transition-all w-full">
        <div className="flex items-center gap-4 text-left w-full sm:w-auto">
          <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/10 bg-black flex items-center justify-center shadow-glow shrink-0">
            <img
              src={novadropBanner}
              alt="NovaDrop"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-100 tracking-tight flex items-center">
              Nova<span className="text-sky-400">Drop</span>
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Version {versions.app || '0.4.3'} · High Performance Media Extraction Suite
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-brand-dim text-brand-acc border border-brand-border">
            <span className="w-2 h-2 rounded-full bg-brand-acc animate-pulse" />
            System Ready
          </span>
        </div>
      </div>

      {/* ── SECTION 1: DOWNLOADS & STORAGE (WINDOWS 11 STYLE CATEGORIZATION) ── */}
      <div className="flex flex-col gap-2.5 w-full">
        <span className="text-xs font-bold text-slate-400/90 uppercase tracking-wider pl-1 select-none">
          Downloads & Storage
        </span>
        <div className="flex flex-col gap-3">
          {/* Row 1: Download Settings */}
          <div className="flex flex-col w-full">
            <div
              onClick={() => toggleSection('downloads')}
              className="px-5 py-4 min-h-[68px] sm:min-h-[72px] flex items-center justify-between cursor-pointer hover:bg-surface-2/60 transition-colors select-none gap-4 rounded-2xl bg-surface-1/90 backdrop-blur-md border border-border-subtle hover:border-white/10 shadow-sm"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-surface-2/90 border border-border-subtle/70 flex items-center justify-center text-slate-300 shrink-0 shadow-sm">
                  <Folder className="w-5 h-5 text-brand-acc" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[15px] font-semibold text-slate-100 tracking-tight leading-snug">
                    Download Settings
                  </span>
                  <span className="text-xs text-slate-400 font-normal leading-normal mt-0.5 truncate">
                    Quality, default format, directory location
                  </span>
                </div>
              </div>

              {/* Win11 Right-side info indicator & Chevron */}
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-slate-400 font-medium hidden sm:inline-block max-w-[220px] truncate font-mono">
                  {formatPathDisplay(outputDir)}
                </span>
                <ChevronDown
                  className={`w-4.5 h-4.5 text-slate-400 transition-transform duration-200 ${
                    activeSection === 'downloads' ? 'rotate-180 text-brand-acc' : ''
                  }`}
                />
              </div>
            </div>

            {activeSection === 'downloads' && (
              <div className="mt-1.5 p-6 rounded-2xl bg-surface-1/90 backdrop-blur-md border border-border-subtle shadow-md flex flex-col gap-4 text-xs animate-fade-in">
                {/* Output Directory */}
                <div className="flex flex-col gap-2">
                  <span className="text-slate-300 font-medium text-xs">Download Location</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={outputDir || '~/Downloads/media'}
                      className="flex-1 h-10 px-3.5 rounded-xl bg-surface-2 border border-border-subtle text-slate-200 font-mono text-xs focus:outline-none"
                    />
                    <button
                      onClick={handlePickFolder}
                      className="h-10 px-4 rounded-xl bg-surface-3 hover:bg-surface-4 text-slate-200 font-semibold transition-colors shrink-0 border border-border-subtle/50"
                    >
                      Browse
                    </button>
                  </div>
                </div>

                {/* Default Format */}
                <div className="flex items-center justify-between gap-4 py-2 border-t border-border-subtle/40">
                  <div className="flex flex-col">
                    <span className="text-slate-200 font-medium text-xs">Default Download Format</span>
                    <span className="text-slate-400 text-[11px]">Preferred quality preset for incoming downloads</span>
                  </div>
                  <select
                    value={defaultFormat}
                    onChange={(e) => setDefaultFormat(e.target.value)}
                    className="h-9 px-3 rounded-xl bg-surface-2 border border-border-subtle text-slate-200 text-xs focus:outline-none focus:border-brand-acc cursor-pointer shrink-0 font-medium"
                  >
                    <option value="auto">Auto (Best Match)</option>
                    <option value="video">Best Video (MP4)</option>
                    <option value="mp3">Audio (MP3 320k)</option>
                    <option value="m4a">Audio (M4A AAC)</option>
                  </select>
                </div>

                {/* Clipboard Autostart */}
                <div className="flex items-center justify-between gap-4 py-2 border-t border-border-subtle/40">
                  <div className="flex flex-col">
                    <span className="text-slate-200 font-medium text-xs">Auto-detect clipboard media links</span>
                    <span className="text-slate-400 text-[11px]">Prompt automatically when a video or audio link is copied</span>
                  </div>
                  <ToggleSwitch
                    checked={clipAutostart}
                    ariaLabel="Auto-detect clipboard media links"
                    onChange={(val) => {
                      setClipAutostart(val);
                      localStorage.setItem('md_clip_autostart', String(val));
                      onShowToast(val ? 'Clipboard auto-detect enabled' : 'Clipboard auto-detect disabled');
                    }}
                  />
                </div>

                {/* Windows Sleep Prevention */}
                <div className="flex items-center justify-between gap-4 py-2 border-t border-border-subtle/40">
                  <div className="flex flex-col">
                    <span className="text-slate-200 font-medium text-xs">Prevent PC sleep during active downloads</span>
                    <span className="text-slate-400 text-[11px]">Keep Windows awake so large video or gallery downloads aren't interrupted</span>
                  </div>
                  <ToggleSwitch
                    checked={preventSleep}
                    ariaLabel="Prevent PC sleep during active downloads"
                    onChange={(val) => {
                      setPreventSleep(val);
                      localStorage.setItem('md_prevent_sleep', String(val));
                      api.setSleepPrevention(val);
                      onShowToast(val ? 'Windows sleep prevention enabled' : 'Sleep prevention disabled');
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Row 2: Storage & History */}
          <div className="flex flex-col w-full">
            <div
              onClick={() => toggleSection('storage')}
              className="px-5 py-4 min-h-[68px] sm:min-h-[72px] flex items-center justify-between cursor-pointer hover:bg-surface-2/60 transition-colors select-none gap-4 rounded-2xl bg-surface-1/90 backdrop-blur-md border border-border-subtle hover:border-white/10 shadow-sm"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-surface-2/90 border border-border-subtle/70 flex items-center justify-center text-slate-300 shrink-0 shadow-sm">
                  <HardDrive className="w-5 h-5 text-brand-acc" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[15px] font-semibold text-slate-100 tracking-tight leading-snug">
                    Storage & History
                  </span>
                  <span className="text-xs text-slate-400 font-normal leading-normal mt-0.5 truncate">
                    Download folder & history management
                  </span>
                </div>
              </div>

              {/* Win11 Right-side quick action & Chevron */}
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    api.openOutputFolder(outputDir);
                  }}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-slate-200 text-xs font-semibold border border-border-subtle transition-colors"
                >
                  <Folder className="w-3.5 h-3.5 text-brand-acc" />
                  <span>Open Folder</span>
                </button>
                <ChevronDown
                  className={`w-4.5 h-4.5 text-slate-400 transition-transform duration-200 ${
                    activeSection === 'storage' ? 'rotate-180 text-brand-acc' : ''
                  }`}
                />
              </div>
            </div>

            {activeSection === 'storage' && (
              <div className="mt-1.5 p-6 rounded-2xl bg-surface-1/90 backdrop-blur-md border border-border-subtle shadow-md flex flex-col gap-4 text-xs animate-fade-in">
                <div className="flex items-center justify-between py-1">
                  <div className="flex flex-col">
                    <span className="text-slate-200 font-medium text-xs">Download Directory</span>
                    <span className="text-slate-400 text-[11px]">Open active output location in Windows Explorer</span>
                  </div>
                  <button
                    onClick={() => api.openOutputFolder(outputDir)}
                    className="px-3.5 py-1.5 rounded-xl bg-surface-3 hover:bg-surface-4 text-brand-acc font-semibold border border-brand-border transition-colors flex items-center gap-1.5"
                  >
                    <Folder className="w-3.5 h-3.5" />
                    <span>Open in Explorer</span>
                  </button>
                </div>
                <div className="flex items-center justify-between py-2 border-t border-border-subtle/40">
                  <div className="flex flex-col">
                    <span className="text-slate-200 font-medium text-xs">Clear Download History</span>
                    <span className="text-slate-400 text-[11px]">Remove finished download history entries (leaves files intact)</span>
                  </div>
                  <button
                    onClick={async () => {
                      await api.clearHistory();
                      onShowToast('History cleared');
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-semibold border border-rose-500/30 transition-colors"
                  >
                    Clear History
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── SECTION 2: PERSONALISATION (WINDOWS 11 STYLE) ── */}
      <div className="flex flex-col gap-2.5 w-full">
        <span className="text-xs font-bold text-slate-400/90 uppercase tracking-wider pl-1 select-none">
          Personalisation
        </span>
        <div className="flex flex-col gap-3">
          {/* Row 3: Appearance & Accent */}
          <div className="flex flex-col w-full">
            <div
              onClick={() => toggleSection('appearance')}
              className="px-5 py-4 min-h-[68px] sm:min-h-[72px] flex items-center justify-between cursor-pointer hover:bg-surface-2/60 transition-colors select-none gap-4 rounded-2xl bg-surface-1/90 backdrop-blur-md border border-border-subtle hover:border-white/10 shadow-sm"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-surface-2/90 border border-border-subtle/70 flex items-center justify-center text-slate-300 shrink-0 shadow-sm">
                  <Palette className="w-5 h-5 text-brand-acc" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[15px] font-semibold text-slate-100 tracking-tight leading-snug">
                    Appearance & Theme
                  </span>
                  <span className="text-xs text-slate-400 font-normal leading-normal mt-0.5 truncate">
                    Curated dark-mode accent styles
                  </span>
                </div>
              </div>

              {/* Win11 Right-side current selection badge & Chevron */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-surface-2 border border-border-subtle text-xs text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: currentAccentObj.color }} />
                  <span>{currentAccentObj.label}</span>
                </div>
                <ChevronDown
                  className={`w-4.5 h-4.5 text-slate-400 transition-transform duration-200 ${
                    activeSection === 'appearance' ? 'rotate-180 text-brand-acc' : ''
                  }`}
                />
              </div>
            </div>

            {activeSection === 'appearance' && (
              <div className="mt-1.5 p-6 rounded-2xl bg-surface-1/90 backdrop-blur-md border border-border-subtle shadow-md flex flex-col gap-4 text-xs animate-fade-in">
                <span className="text-slate-400 font-medium">Select Accent Theme</span>
                {/* Windows 11 style radio options grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {ACCENT_THEMES.map((theme) => {
                    const isSelected = themeAccent === theme.id;
                    return (
                      <button
                        key={theme.id}
                        onClick={() => setThemeAccent(theme.id)}
                        className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-medium transition-all ${
                          isSelected
                            ? 'bg-surface-3/90 text-white border-brand-acc/50 ring-1 ring-brand-acc/30 shadow-sm'
                            : 'bg-surface-2/60 text-slate-300 border-border-subtle hover:bg-surface-2 hover:border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="w-4 h-4 rounded-full shrink-0 shadow-sm"
                            style={{ backgroundColor: theme.color }}
                          />
                          <span className="font-semibold text-slate-100">{theme.label}</span>
                        </div>
                        {/* Windows 11 radio indicator */}
                        <div
                          className={`w-4.5 h-4.5 rounded-full border flex items-center justify-center transition-colors ${
                            isSelected ? 'border-brand-acc bg-brand-dim' : 'border-slate-500/60 bg-transparent'
                          }`}
                        >
                          {isSelected && <div className="w-2 h-2 rounded-full bg-brand-acc" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Row 4: Notifications & Alerts */}
          <div className="flex flex-col w-full">
            <div
              onClick={() => toggleSection('notifications')}
              className="px-5 py-4 min-h-[68px] sm:min-h-[72px] flex items-center justify-between cursor-pointer hover:bg-surface-2/60 transition-colors select-none gap-4 rounded-2xl bg-surface-1/90 backdrop-blur-md border border-border-subtle hover:border-white/10 shadow-sm"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-surface-2/90 border border-border-subtle/70 flex items-center justify-center text-slate-300 shrink-0 shadow-sm">
                  <Bell className="w-5 h-5 text-brand-acc" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[15px] font-semibold text-slate-100 tracking-tight leading-snug">
                    Notifications & Alerts
                  </span>
                  <span className="text-xs text-slate-400 font-normal leading-normal mt-0.5 truncate">
                    Completion toasts, clipboard prompts, audio cues
                  </span>
                </div>
              </div>

              {/* Win11 Right-side badge & Chevron */}
              <div className="flex items-center gap-3 shrink-0">
                <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-surface-2 text-slate-300 border border-border-subtle">
                  {[notifyOnComplete, notifyClipboardToast, notifyOnError, soundOnComplete].filter(Boolean).length} Enabled
                </span>
                <ChevronDown
                  className={`w-4.5 h-4.5 text-slate-400 transition-transform duration-200 ${
                    activeSection === 'notifications' ? 'rotate-180 text-brand-acc' : ''
                  }`}
                />
              </div>
            </div>

            {activeSection === 'notifications' && (
              <div className="mt-1.5 p-6 rounded-2xl bg-surface-1/90 backdrop-blur-md border border-border-subtle shadow-md flex flex-col gap-4 text-xs animate-fade-in">
                {/* Toggle 1: Desktop Notification on Completion */}
                <div className="flex items-center justify-between gap-4 py-1">
                  <div className="flex flex-col">
                    <span className="text-slate-200 font-medium text-xs">Show desktop notification when complete</span>
                    <span className="text-slate-400 text-[11px]">Send Windows notification when downloads finish</span>
                  </div>
                  <ToggleSwitch
                    checked={notifyOnComplete}
                    ariaLabel="Show desktop notification when complete"
                    onChange={(val) => {
                      setNotifyOnComplete(val);
                      localStorage.setItem('md_notify_complete', String(val));
                      api.setNativeToastEnabled(val);
                      onShowToast(val ? 'Windows 11 notifications enabled' : 'Notifications disabled');
                    }}
                  />
                </div>

                {/* Toggle 2: Clipboard Prompt Toasts */}
                <div className="flex items-center justify-between gap-4 py-2 border-t border-border-subtle/40">
                  <div className="flex flex-col">
                    <span className="text-slate-200 font-medium text-xs">Show clipboard prompt toasts</span>
                    <span className="text-slate-400 text-[11px]">Display quick download toast when media link is copied</span>
                  </div>
                  <ToggleSwitch
                    checked={notifyClipboardToast}
                    ariaLabel="Show clipboard prompt toasts"
                    onChange={(val) => {
                      setNotifyClipboardToast(val);
                      localStorage.setItem('md_notify_clipboard', String(val));
                      onShowToast(val ? 'Clipboard toasts enabled' : 'Clipboard toasts disabled');
                    }}
                  />
                </div>

                {/* Toggle 3: Error & Failure Alerts */}
                <div className="flex items-center justify-between gap-4 py-2 border-t border-border-subtle/40">
                  <div className="flex flex-col">
                    <span className="text-slate-200 font-medium text-xs">Show error & interruption alerts</span>
                    <span className="text-slate-400 text-[11px]">Notify immediately when download fails or network disconnects</span>
                  </div>
                  <ToggleSwitch
                    checked={notifyOnError}
                    ariaLabel="Show error & interruption alerts"
                    onChange={(val) => {
                      setNotifyOnError(val);
                      localStorage.setItem('md_notify_error', String(val));
                      onShowToast(val ? 'Error alerts enabled' : 'Error alerts disabled');
                    }}
                  />
                </div>

                {/* Toggle 4: Audio Cue / Sound on Complete */}
                <div className="flex items-center justify-between gap-4 py-2 border-t border-border-subtle/40">
                  <div className="flex flex-col">
                    <span className="text-slate-200 font-medium text-xs">Play subtle audio cue on completion</span>
                    <span className="text-slate-400 text-[11px]">Plays a soft chime when a download queue completes</span>
                  </div>
                  <ToggleSwitch
                    checked={soundOnComplete}
                    ariaLabel="Play subtle audio cue on completion"
                    onChange={(val) => {
                      setSoundOnComplete(val);
                      localStorage.setItem('md_sound_complete', String(val));
                      onShowToast(val ? 'Completion audio enabled' : 'Completion audio disabled');
                    }}
                  />
                </div>

                {/* Windows 11 Native Toast Test Action */}
                <div className="flex items-center justify-between gap-4 pt-3 border-t border-border-subtle/40">
                  <div className="flex flex-col">
                    <span className="text-slate-200 font-medium text-xs">Test Native Windows Notification</span>
                    <span className="text-slate-400 text-[11px]">Trigger a sample Windows 11 rich toast with action buttons</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const sampleUri = outputDir ? `file:///${outputDir.replace(/\\/g, '/')}` : '';
                      api.showNativeToast(
                        'NovaDrop • Sample Download Complete',
                        'sample_video.mp4 (48.5 MB)\nReady to play',
                        null,
                        sampleUri ? [{ content: 'Open Folder', arguments: sampleUri, type: 'protocol' }] : []
                      );
                      onShowToast('Windows notification sent');
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-surface-3 hover:bg-surface-4 text-slate-200 hover:text-white font-semibold text-xs border border-border-subtle transition-all shrink-0"
                  >
                    Send Test Toast
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── SECTION 3: EXTRACTOR ENGINES & UPDATES (WINDOWS 11 STYLE) ── */}
      <div className="flex flex-col gap-2.5 w-full">
        <span className="text-xs font-bold text-slate-400/90 uppercase tracking-wider pl-1 select-none">
          Extractor Engines & Updates
        </span>
        <div className="flex flex-col gap-3">
          {/* Row 5: Updates & Extractor Engines Suite */}
          <div className="flex flex-col w-full">
            <div
              onClick={() => toggleSection('updates')}
              className="px-5 py-4 min-h-[68px] sm:min-h-[72px] flex items-center justify-between cursor-pointer hover:bg-surface-2/60 transition-colors select-none gap-4 rounded-2xl bg-surface-1/90 backdrop-blur-md border border-border-subtle hover:border-white/10 shadow-sm"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-surface-2/90 border border-border-subtle/70 flex items-center justify-center text-slate-300 shrink-0 shadow-sm">
                  <DownloadCloud className="w-5 h-5 text-brand-acc" />
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-semibold text-slate-100 tracking-tight leading-snug">
                      Updates & Engines Suite
                    </span>
                    {anyUpdateAvailable && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
                        Update Available
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 font-normal leading-normal mt-0.5 truncate">
                    Independent engine updates & auto-updater (yt-dlp, gallery-dl, FFmpeg)
                  </span>
                </div>
              </div>

              {/* Win11 Right-side status badge & Chevron */}
              <div className="flex items-center gap-3 shrink-0">
                {anyUpdateAvailable ? (
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    <ArrowUpCircle className="w-3.5 h-3.5" />
                    Update Available
                  </span>
                ) : (
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Check className="w-3.5 h-3.5" />
                    All Engines Ready
                  </span>
                )}
                <ChevronDown
                  className={`w-4.5 h-4.5 text-slate-400 transition-transform duration-200 ${
                    activeSection === 'updates' ? 'rotate-180 text-brand-acc' : ''
                  }`}
                />
              </div>
            </div>

            {activeSection === 'updates' && (
              <div className="mt-1.5 p-6 rounded-2xl bg-surface-1/90 backdrop-blur-md border border-border-subtle shadow-md flex flex-col gap-5 text-xs animate-fade-in">
                {/* Header Action Bar */}
                <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-border-subtle/40">
                  <div className="flex flex-col">
                    <span className="text-slate-200 font-semibold text-xs">Centralized Update Management</span>
                    <span className="text-slate-400 text-[11px]">
                      Engines and core application can check & update independently
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCheckAllUpdates}
                      disabled={isCheckingAll || isAutoUpdatingAll}
                      className="px-3.5 py-1.5 rounded-xl bg-surface-3 hover:bg-surface-4 disabled:opacity-50 text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition-all border border-border-subtle"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isCheckingAll ? 'animate-spin text-brand-acc' : ''}`} />
                      <span>{isCheckingAll ? 'Checking All…' : 'Check All'}</span>
                    </button>
                    <button
                      onClick={handleAutoUpdateAll}
                      disabled={isAutoUpdatingAll || isCheckingAll}
                      className="px-3.5 py-1.5 rounded-xl bg-brand-acc hover:opacity-95 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-glow flex items-center gap-1.5 transition-all"
                    >
                      <Zap className={`w-3.5 h-3.5 ${isAutoUpdatingAll ? 'animate-bounce' : ''}`} />
                      <span>{isAutoUpdatingAll ? 'Auto-Updating…' : 'Auto-Update All'}</span>
                    </button>
                  </div>
                </div>

                {/* Auto Update Status Banner */}
                {isAutoUpdatingAll && autoUpdateStatusMsg && (
                  <div className="p-3.5 rounded-xl bg-brand-dim border border-brand-border flex items-center gap-2.5 text-xs text-brand-acc font-medium animate-pulse">
                    <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                    <span>{autoUpdateStatusMsg}</span>
                  </div>
                )}

                {/* Top Subgrid: Automation Settings + App Update Card */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full">
                  {/* 1. Automation Preferences (TOGGLE SWITCHES) */}
                  <div className="p-4 rounded-xl bg-surface-2/80 border border-border-subtle flex flex-col justify-between gap-3">
                    <div className="flex flex-col gap-3">
                      <span className="text-slate-300 font-semibold text-[11px] uppercase tracking-wider block">
                        Automated Updates
                      </span>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-col">
                          <span className="text-slate-200 font-medium text-xs">Auto-update engines in background</span>
                          <span className="text-slate-400 text-[11px]">Automatically install extractor engine patches</span>
                        </div>
                        <ToggleSwitch
                          checked={autoDownloadEngines}
                          ariaLabel="Auto-update engines in background"
                          onChange={(val) => {
                            setAutoDownloadEngines(val);
                            localStorage.setItem('md_auto_download_engines', String(val));
                            onShowToast(val ? 'Engine auto-update enabled' : 'Engine auto-update disabled');
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-2 border-t border-border-subtle/30">
                        <div className="flex flex-col">
                          <span className="text-slate-200 font-medium text-xs">Check for updates on launch</span>
                          <span className="text-slate-400 text-[11px]">Scan upstream repositories on startup</span>
                        </div>
                        <ToggleSwitch
                          checked={autoUpdateEnabled}
                          ariaLabel="Check for updates on launch"
                          onChange={(val) => {
                            setAutoUpdateEnabled(val);
                            localStorage.setItem('md_auto_update', String(val));
                            onShowToast(val ? 'Startup update checks enabled' : 'Startup update checks disabled');
                          }}
                        />
                      </div>
                    </div>
                    <div className="pt-2 border-t border-border-subtle/40 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Applies to: yt-dlp, gallery-dl & FFmpeg</span>
                      <span className="text-brand-acc font-medium">Zero UAC required</span>
                    </div>
                  </div>

                  {/* 2. NovaDrop Desktop App Card */}
                  <div className="p-4 rounded-xl bg-surface-2/80 border border-border-subtle flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg overflow-hidden border border-white/10 bg-black flex items-center justify-center shadow-sm shrink-0">
                            <img src={novadropIcon} alt="NovaDrop" className="w-full h-full object-contain" />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-100 text-xs">NovaDrop Desktop App</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-surface-3 text-slate-300 border border-border-subtle">
                              v{versions.app || '0.4.0'}
                            </span>
                          </div>
                        </div>

                        {/* App Status Pill */}
                        <div className="flex items-center gap-2">
                          {appState.downloading ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1.5 animate-pulse">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              Downloading…
                            </span>
                          ) : appState.installerPath ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3 h-3" />
                              Ready to Install
                            </span>
                          ) : appState.info?.update_available ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
                              <ArrowUpCircle className="w-3 h-3" />
                              v{appState.info.latest_version} Available
                            </span>
                          ) : appState.info ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                              <Check className="w-3 h-3" />
                              Up to date
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-400">
                        {appState.info?.latest_version
                          ? `Latest upstream: v${appState.info.latest_version}`
                          : 'Native Windows desktop wrapper and core runtime'}
                      </p>
                    </div>

                    {/* Progress bar for App */}
                    {appState.downloading && appState.progress && (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                          <span>Downloading installer…</span>
                          <span>{appState.progress.percent}% · {appState.progress.speed}</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-surface-3 overflow-hidden">
                          <div
                            className="h-full bg-brand-acc rounded-full transition-all duration-200"
                            style={{ width: `${appState.progress.percent}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* App Action Buttons */}
                    <div className="flex items-center justify-between pt-2 border-t border-border-subtle/40">
                      <span className="text-[11px] text-slate-400">
                        {appState.installerPath ? 'Ready to install' : 'Check GitHub releases'}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleCheckApp}
                          disabled={appState.checking || appState.downloading}
                          className="px-3 py-1.5 rounded-xl bg-surface-3 hover:bg-surface-4 disabled:opacity-50 text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition-all"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${appState.checking ? 'animate-spin text-brand-acc' : ''}`} />
                          <span>{appState.checking ? 'Checking…' : 'Check'}</span>
                        </button>

                        {appState.installerPath ? (
                          <button
                            onClick={handleInstallApp}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-glow transition-all"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            <span>Install & Relaunch</span>
                          </button>
                        ) : appState.info?.update_available ? (
                          (appState.info?.has_direct_installer !== false && (appState.info?.asset_url || appState.info?.download_url)) ? (
                            <button
                              onClick={handleDownloadApp}
                              disabled={appState.downloading}
                              className="px-3 py-1.5 rounded-xl bg-brand-acc hover:opacity-95 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-glow transition-all"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Download Update</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                const url = appState.info?.html_url || 'https://github.com/Brandon-Morision/Media-Downloader/releases';
                                onShowToast('Opening release page…');
                                api.openUrlExternal(url);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-surface-3 hover:bg-surface-4 text-brand-acc font-semibold text-xs flex items-center gap-1.5 border border-brand-acc/30 transition-all"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>View on GitHub</span>
                            </button>
                          )
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Individual Extractor Engines Suite (DYNAMIC RESPONSIVE GRID) */}
                <div className="flex flex-col gap-3 w-full">
                  <span className="text-slate-300 font-semibold text-[11px] uppercase tracking-wider">
                    Independent Extractor Engines (3-Column Responsive Grid)
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 w-full">
                    {ENGINE_METADATA.map((engine) => {
                      const state = engineStates[engine.id] || {};
                      const currentVer = versions[engine.id];
                      const hasUpdate = state.info?.update_available;
                      const latestVer = state.info?.latest_version;

                      return (
                        <div
                          key={engine.id}
                          className="p-4 rounded-xl bg-surface-2/80 border border-border-subtle flex flex-col justify-between gap-3 hover:border-white/10 transition-all"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-surface-3 flex items-center justify-center text-slate-300">
                                  <Cpu className="w-4 h-4 text-brand-acc" />
                                </div>
                                <span className="font-bold text-slate-100 text-xs">{engine.name}</span>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${engine.color}`}>
                                {engine.tag}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-400 min-h-[32px]">{engine.desc}</p>
                          </div>

                          {/* Status & Version Box */}
                          <div className="bg-surface-3/50 p-2.5 rounded-lg border border-border-subtle/50 flex flex-col gap-1.5">
                            <div className="flex items-center justify-between text-xs font-mono">
                              <span className="text-slate-400 text-[10px]">Installed:</span>
                              <span className="text-slate-200 font-semibold text-[11px]">{currentVer || 'Installed'}</span>
                            </div>

                            <div className="flex items-center justify-between text-xs font-mono">
                              <span className="text-slate-400 text-[10px]">Latest:</span>
                              <span className="text-brand-acc font-semibold text-[11px]">
                                {latestVer ? `v${latestVer}` : 'Checking…'}
                              </span>
                            </div>

                            {/* Status Pill */}
                            <div className="pt-1">
                              {state.updating ? (
                                <span className="w-full px-2 py-1 rounded-md text-[10px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center gap-1.5 animate-pulse">
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  Updating Engine…
                                </span>
                              ) : hasUpdate ? (
                                <span className="w-full px-2 py-1 rounded-md text-[10px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center gap-1.5">
                                  <ArrowUpCircle className="w-3 h-3" />
                                  Update Available
                                </span>
                              ) : state.info ? (
                                <span className="w-full px-2 py-1 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center gap-1.5">
                                  <Check className="w-3 h-3" />
                                  Engine Up to Date
                                </span>
                              ) : null}
                            </div>
                          </div>

                          {/* Download Progress Bar */}
                          {state.updating && state.progress && (
                            <div className="flex flex-col gap-1.5">
                              <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                                <span>Downloading {engine.name}…</span>
                                <span>{state.progress.percent}% · {state.progress.speed}</span>
                              </div>
                              <div className="w-full h-1.5 rounded-full bg-surface-3 overflow-hidden">
                                <div
                                  className="h-full bg-brand-acc rounded-full transition-all duration-200"
                                  style={{ width: `${state.progress.percent}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Error Banner */}
                          {state.error && (
                            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px]">
                              {state.error}
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex items-center justify-between pt-1 gap-2">
                            <button
                              onClick={() => handleCheckSingleEngine(engine.id)}
                              disabled={state.checking || state.updating}
                              className="flex-1 px-3 py-1.5 rounded-xl bg-surface-3 hover:bg-surface-4 disabled:opacity-50 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${state.checking ? 'animate-spin text-brand-acc' : ''}`} />
                              <span>{state.checking ? 'Checking…' : 'Check'}</span>
                            </button>

                            {hasUpdate && (
                              <button
                                onClick={() => handleUpdateSingleEngine(engine.id)}
                                disabled={state.updating}
                                className="flex-1 px-3 py-1.5 rounded-xl bg-brand-acc hover:opacity-95 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-glow transition-all"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Update</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── SECTION 4: INTEGRATIONS & SYSTEM (WINDOWS 11 STYLE) ── */}
      <div className="flex flex-col gap-2.5 w-full">
        <span className="text-xs font-bold text-slate-400/90 uppercase tracking-wider pl-1 select-none">
          Integrations & System
        </span>
        <div className="flex flex-col gap-3">
          {/* Row 6: Browser Extension */}
          <div className="flex flex-col w-full">
            <div
              onClick={() => toggleSection('extension')}
              className="px-5 py-4 min-h-[68px] sm:min-h-[72px] flex items-center justify-between cursor-pointer hover:bg-surface-2/60 transition-colors select-none gap-4 rounded-2xl bg-surface-1/90 backdrop-blur-md border border-border-subtle hover:border-white/10 shadow-sm"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-surface-2/90 border border-border-subtle/70 flex items-center justify-center text-slate-300 shrink-0 shadow-sm">
                  <Puzzle className="w-5 h-5 text-brand-acc" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[15px] font-semibold text-slate-100 tracking-tight leading-snug">
                    Browser Extension
                  </span>
                  <span className="text-xs text-slate-400 font-normal leading-normal mt-0.5 truncate">
                    Chrome, Edge, Brave pairing & stream sniffer
                  </span>
                </div>
              </div>

              {/* Win11 Right-side badge & Chevron */}
              <div className="flex items-center gap-3 shrink-0">
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-brand-acc bg-brand-dim border border-brand-border font-semibold font-mono text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-acc animate-pulse" />
                  Port 6789
                </span>
                <ChevronDown
                  className={`w-4.5 h-4.5 text-slate-400 transition-transform duration-200 ${
                    activeSection === 'extension' ? 'rotate-180 text-brand-acc' : ''
                  }`}
                />
              </div>
            </div>

            {activeSection === 'extension' && (
              <div className="mt-1.5 p-6 rounded-2xl bg-surface-1/90 backdrop-blur-md border border-border-subtle shadow-md flex flex-col gap-4 text-xs animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Bridge Server</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-brand-acc bg-brand-dim border border-brand-border font-semibold font-mono text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-acc animate-pulse" />
                    Active · 127.0.0.1:6789
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-2 border border-border-subtle flex flex-col gap-2">
                  <span className="text-slate-300 font-semibold">How to Install (Chrome, Edge, Brave):</span>
                  <ol className="list-decimal list-inside text-slate-400 space-y-1 pl-1">
                    <li>Open <code className="text-slate-200 bg-surface-3 px-1.5 py-0.5 rounded font-mono text-[11px]">chrome://extensions</code> or <code className="text-slate-200 bg-surface-3 px-1.5 py-0.5 rounded font-mono text-[11px]">edge://extensions</code></li>
                    <li>Enable <strong className="text-slate-200">Developer mode</strong> in the top-right corner</li>
                    <li>Click <strong className="text-slate-200">Load unpacked</strong> and select the extension directory</li>
                  </ol>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-400">Extension Directory</span>
                  <button
                    onClick={async () => {
                      try {
                        await api.openExtensionFolder();
                        onShowToast('Opened browser_extension folder');
                      } catch (e) {
                        onShowToast(`Failed to open folder: ${e.message}`, false);
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-brand-acc hover:opacity-95 text-slate-950 font-bold text-xs shadow-glow flex items-center gap-1.5 transition-all"
                  >
                    <Folder className="w-3.5 h-3.5" />
                    <span>Open Extension Folder</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Row 7: About NovaDrop (Quick Share Style Sub-card) */}
          <div className="flex flex-col w-full">
            <div
              onClick={() => toggleSection('about')}
              className="px-5 py-4 min-h-[68px] sm:min-h-[72px] flex items-center justify-between cursor-pointer hover:bg-surface-2/60 transition-colors select-none gap-4 rounded-2xl bg-surface-1/90 backdrop-blur-md border border-border-subtle hover:border-white/10 shadow-sm"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-surface-2/90 border border-border-subtle/70 flex items-center justify-center text-slate-300 shrink-0 shadow-sm">
                  <Info className="w-5 h-5 text-brand-acc" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[15px] font-semibold text-slate-100 tracking-tight leading-snug">
                    About NovaDrop
                  </span>
                  <span className="text-xs text-slate-400 font-normal leading-normal mt-0.5 truncate">
                    Project details, open-source repository & license
                  </span>
                </div>
              </div>

              {/* Win11 Right-side badge & Chevron */}
              <div className="flex items-center gap-3 shrink-0">
                <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-surface-2 text-slate-300 border border-border-subtle">
                  v{versions.app || '0.4.0'}
                </span>
                <ChevronDown
                  className={`w-4.5 h-4.5 text-slate-400 transition-transform duration-200 ${
                    activeSection === 'about' ? 'rotate-180 text-brand-acc' : ''
                  }`}
                />
              </div>
            </div>

            {activeSection === 'about' && (
              <div className="mt-1.5 px-6 py-5 rounded-2xl bg-surface-1/90 backdrop-blur-md border border-border-subtle shadow-md flex flex-col gap-3.5 text-xs sm:text-[13px] animate-fade-in select-text">
                <div className="flex flex-col gap-1 text-slate-300 leading-relaxed">
                  <span>Copyright 2024–2026 Brandon Morision. All rights reserved.</span>
                  <button
                    type="button"
                    onClick={() => api.openUrlExternal('https://github.com/Brandon-Morision/Media-Downloader')}
                    className="text-brand-acc hover:underline cursor-pointer text-left font-normal transition-colors w-fit"
                  >
                    NovaDrop is made possible by open source software.
                  </button>
                </div>

                <div className="pt-1.5">
                  <button
                    type="button"
                    onClick={() => api.openUrlExternal('https://github.com/Brandon-Morision/Media-Downloader#license')}
                    className="text-brand-acc hover:underline cursor-pointer text-left font-normal transition-colors w-fit"
                  >
                    Terms of Service
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
