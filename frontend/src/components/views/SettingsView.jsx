import React, { useState, useEffect } from 'react';
import {
  Folder, Palette, Sliders, Wrench, RefreshCw, Check,
  DownloadCloud, ArrowUpCircle, ExternalLink, ShieldCheck, Box,
  ChevronRight, Bell, HardDrive, Info, Sparkles, Puzzle
} from 'lucide-react';
import { api, waitForApi } from '../../lib/api';

const ACCENT_THEMES = [
  { id: 'violet', label: 'Violet Glow', color: '#7c6dfa' },
  { id: 'emerald', label: 'Emerald Mint', color: '#00e599' },
  { id: 'ocean', label: 'Ocean Blue', color: '#38bdf8' },
  { id: 'amber', label: 'Solar Amber', color: '#f59e0b' },
  { id: 'rose', label: 'Crimson Rose', color: '#f43f5e' },
];

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
  const [activeSection, setActiveSection] = useState(null); // 'downloads' | 'notifications' | 'appearance' | 'storage' | 'about'
  const [versions, setVersions] = useState({
    'yt-dlp': 'Checking…',
    'gallery-dl': 'Checking…',
    ffmpeg: 'Checking…',
    app: '0.3.0',
  });
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [updatingTool, setUpdatingTool] = useState(null);
  const [updateResults, setUpdateResults] = useState(null);

  useEffect(() => {
    loadVersions();

    window.onUpdateCheckComplete = (res) => {
      setIsCheckingUpdates(false);
      if (res?.ok) {
        setUpdateResults(res);
        if (res.any_update) {
          onShowToast('New updates available!');
        } else {
          onShowToast('MediaDown engines are up to date');
        }
      } else {
        onShowToast(res?.error || 'Failed to check for updates', false);
      }
    };

    window.onEngineUpdateComplete = (res) => {
      setUpdatingTool(null);
      if (res?.ok) {
        onShowToast(`${res.tool || 'Engine'} updated successfully!`);
        loadVersions();
      } else {
        onShowToast(res?.error || `Update failed for ${res?.tool || 'engine'}`, false);
      }
    };

    return () => {
      delete window.onUpdateCheckComplete;
      delete window.onEngineUpdateComplete;
    };
  }, [onShowToast]);

  const loadVersions = async () => {
    try {
      await waitForApi();
      const res = await api.getInstalledVersions();
      if (res) {
        setVersions({
          'yt-dlp': res['yt-dlp'] || 'Installed',
          'gallery-dl': res['gallery-dl'] || 'Installed',
          ffmpeg: res.ffmpeg || 'Installed',
          app: res.app || '0.3.0',
        });
      }
    } catch {
      setVersions({
        'yt-dlp': 'Installed',
        'gallery-dl': 'Installed',
        ffmpeg: 'Installed',
        app: '0.3.0',
      });
    }
  };

  const handlePickFolder = async () => {
    try {
      const folder = await api.pickFolder();
      if (folder) {
        setOutputDir(folder);
        localStorage.setItem('md_output_folder', folder);
        onShowToast('Download location updated');
      }
    } catch {}
  };

  const handleCheckUpdates = async () => {
    setIsCheckingUpdates(true);
    try {
      await api.checkUpdates();
    } catch (e) {
      setIsCheckingUpdates(false);
      onShowToast(`Update check error: ${e.message}`, false);
    }
  };

  const toggleSection = (id) => {
    setActiveSection((prev) => (prev === id ? null : id));
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto px-6 py-6 gap-6 max-w-2xl mx-auto w-full select-none">
      <h1 className="text-xl font-extrabold text-slate-100 tracking-tight">Settings</h1>

      {/* ── TOP USER / BRAND PROFILE BANNER (Screen 6) ── */}
      <div className="bg-surface-1 border border-border-subtle rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-3 shadow-md">
        <div className="w-16 h-16 rounded-full bg-brand-dim border-2 border-brand-acc text-brand-acc font-extrabold text-2xl flex items-center justify-center shadow-glow">
          M
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-100 tracking-tight">MediaDown</h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Version 0.3.0</p>
        </div>
      </div>

      {/* ── GROUPED SETTINGS ROWS (Screen 6) ── */}
      <div className="flex flex-col gap-3">
        {/* Row 1: Download Settings */}
        <div className="bg-surface-1 border border-border-subtle rounded-2xl overflow-hidden shadow-sm">
          <div
            onClick={() => toggleSection('downloads')}
            className="p-4.5 flex items-center justify-between cursor-pointer hover:bg-surface-2 transition-colors"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-surface-3 flex items-center justify-center text-slate-300">
                <Folder className="w-4 h-4 text-brand-acc" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-100">Download Settings</span>
                <span className="text-xs text-slate-400">Quality, format, location</span>
              </div>
            </div>
            <ChevronRight
              className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                activeSection === 'downloads' ? 'rotate-90 text-brand-acc' : ''
              }`}
            />
          </div>

          {activeSection === 'downloads' && (
            <div className="p-4 pt-1 border-t border-border-subtle/60 flex flex-col gap-4 text-xs">
              {/* Output Directory */}
              <div className="flex flex-col gap-1.5">
                <span className="text-slate-400 font-medium">Download Location</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={outputDir || '~/Downloads/media'}
                    className="flex-1 h-9 px-3 rounded-xl bg-surface-2 border border-border-subtle text-slate-200 font-mono text-xs focus:outline-none"
                  />
                  <button
                    onClick={handlePickFolder}
                    className="h-9 px-4 rounded-xl bg-surface-3 hover:bg-surface-4 text-slate-200 font-semibold transition-colors"
                  >
                    Browse
                  </button>
                </div>
              </div>

              {/* Default Format */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400 font-medium">Default Format</span>
                <select
                  value={defaultFormat}
                  onChange={(e) => setDefaultFormat(e.target.value)}
                  className="h-8 px-3 rounded-lg bg-surface-2 border border-border-subtle text-slate-200 text-xs focus:outline-none focus:border-brand-acc cursor-pointer"
                >
                  <option value="auto">Auto (Best Match)</option>
                  <option value="video">Best Video (MP4)</option>
                  <option value="mp3">Audio (MP3 320k)</option>
                  <option value="m4a">Audio (M4A AAC)</option>
                </select>
              </div>

              {/* Clipboard Autostart */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400 font-medium">Auto-detect clipboard media links</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clipAutostart}
                    onChange={(e) => setClipAutostart(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-surface-3 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-acc" />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Row 2: Notifications */}
        <div className="bg-surface-1 border border-border-subtle rounded-2xl overflow-hidden shadow-sm">
          <div
            onClick={() => toggleSection('notifications')}
            className="p-4.5 flex items-center justify-between cursor-pointer hover:bg-surface-2 transition-colors"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-surface-3 flex items-center justify-center text-slate-300">
                <Bell className="w-4 h-4 text-brand-acc" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-100">Notifications</span>
                <span className="text-xs text-slate-400">Download complete, errors</span>
              </div>
            </div>
            <ChevronRight
              className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                activeSection === 'notifications' ? 'rotate-90 text-brand-acc' : ''
              }`}
            />
          </div>

          {activeSection === 'notifications' && (
            <div className="p-4 pt-1 border-t border-border-subtle/60 flex flex-col gap-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Show desktop notification when complete</span>
                <span className="text-brand-acc font-semibold">Enabled</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Show clipboard prompt toasts</span>
                <span className="text-brand-acc font-semibold">Enabled</span>
              </div>
            </div>
          )}
        </div>

        {/* Row 3: Appearance */}
        <div className="bg-surface-1 border border-border-subtle rounded-2xl overflow-hidden shadow-sm">
          <div
            onClick={() => toggleSection('appearance')}
            className="p-4.5 flex items-center justify-between cursor-pointer hover:bg-surface-2 transition-colors"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-surface-3 flex items-center justify-center text-slate-300">
                <Palette className="w-4 h-4 text-brand-acc" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-100">Appearance</span>
                <span className="text-xs text-slate-400">Dark mode, accent color</span>
              </div>
            </div>
            <ChevronRight
              className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                activeSection === 'appearance' ? 'rotate-90 text-brand-acc' : ''
              }`}
            />
          </div>

          {activeSection === 'appearance' && (
            <div className="p-4 pt-1 border-t border-border-subtle/60 flex flex-col gap-3 text-xs">
              <span className="text-slate-400 font-medium">Accent Color</span>
              <div className="flex items-center gap-3">
                {ACCENT_THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => setThemeAccent(theme.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                      themeAccent === theme.id
                        ? 'bg-surface-3 text-white border-white/40 shadow-sm'
                        : 'bg-surface-2 text-slate-400 border-border-subtle hover:text-white'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: theme.color }}
                    />
                    <span>{theme.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Row 4: Storage */}
        <div className="bg-surface-1 border border-border-subtle rounded-2xl overflow-hidden shadow-sm">
          <div
            onClick={() => toggleSection('storage')}
            className="p-4.5 flex items-center justify-between cursor-pointer hover:bg-surface-2 transition-colors"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-surface-3 flex items-center justify-center text-slate-300">
                <HardDrive className="w-4 h-4 text-brand-acc" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-100">Storage</span>
                <span className="text-xs text-slate-400 font-mono">Used: 4.2 GB · Available: 51.8 GB</span>
              </div>
            </div>
            <ChevronRight
              className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                activeSection === 'storage' ? 'rotate-90 text-brand-acc' : ''
              }`}
            />
          </div>

          {activeSection === 'storage' && (
            <div className="p-4 pt-1 border-t border-border-subtle/60 flex flex-col gap-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Download Directory</span>
                <button
                  onClick={() => api.openOutputFolder(outputDir)}
                  className="text-brand-acc hover:underline"
                >
                  Open in Explorer
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Clear Download History</span>
                <button
                  onClick={async () => {
                    await api.clearHistory();
                    onShowToast('History cleared');
                  }}
                  className="text-rose-400 hover:underline"
                >
                  Clear History
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Row 5: Browser Extension */}
        <div className="bg-surface-1 border border-border-subtle rounded-2xl overflow-hidden shadow-sm">
          <div
            onClick={() => toggleSection('extension')}
            className="p-4.5 flex items-center justify-between cursor-pointer hover:bg-surface-2 transition-colors"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-surface-3 flex items-center justify-center text-slate-300">
                <Puzzle className="w-4 h-4 text-brand-acc" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-100">Browser Extension</span>
                <span className="text-xs text-slate-400">Chrome, Edge, Brave pairing & stream sniffer</span>
              </div>
            </div>
            <ChevronRight
              className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                activeSection === 'extension' ? 'rotate-90 text-brand-acc' : ''
              }`}
            />
          </div>

          {activeSection === 'extension' && (
            <div className="p-4 pt-1 border-t border-border-subtle/60 flex flex-col gap-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Bridge Server</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-brand-acc bg-brand-dim border border-brand-border font-semibold font-mono text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-acc animate-pulse" />
                  Active · 127.0.0.1:6789
                </span>
              </div>

              <div className="p-3 rounded-xl bg-surface-2 border border-border-subtle flex flex-col gap-2">
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
                  className="px-3 py-1.5 rounded-xl bg-brand-acc hover:opacity-95 text-slate-950 font-bold text-xs shadow-glow flex items-center gap-1.5 transition-all"
                >
                  <Folder className="w-3.5 h-3.5" />
                  <span>Open Extension Folder</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Row 6: About & Engines */}
        <div className="bg-surface-1 border border-border-subtle rounded-2xl overflow-hidden shadow-sm">
          <div
            onClick={() => toggleSection('about')}
            className="p-4.5 flex items-center justify-between cursor-pointer hover:bg-surface-2 transition-colors"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-surface-3 flex items-center justify-center text-slate-300">
                <Info className="w-4 h-4 text-brand-acc" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-100">About</span>
                <span className="text-xs text-slate-400">Engines, check updates, licenses</span>
              </div>
            </div>
            <ChevronRight
              className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                activeSection === 'about' ? 'rotate-90 text-brand-acc' : ''
              }`}
            />
          </div>

          {activeSection === 'about' && (
            <div className="p-4 pt-1 border-t border-border-subtle/60 flex flex-col gap-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Media Downloader</span>
                <span className="font-mono text-brand-acc font-semibold">v0.3.0</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">yt-dlp Engine</span>
                <span className="font-mono text-slate-200">{versions['yt-dlp']}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">gallery-dl Engine</span>
                <span className="font-mono text-slate-200">{versions['gallery-dl']}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">ffmpeg</span>
                <span className="font-mono text-slate-200">{versions.ffmpeg}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-border-subtle/40">
                <span className="text-slate-400">Project Repository</span>
                <button
                  type="button"
                  onClick={() => api.openUrlExternal('https://github.com/Brandon-Morision/Media-Downloader')}
                  className="text-brand-acc hover:text-brand-acc flex items-center gap-1 font-medium transition-colors"
                  title="Open GitHub repository in browser"
                >
                  <span>GitHub</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleCheckUpdates}
                  disabled={isCheckingUpdates}
                  className="px-3.5 py-1.5 rounded-xl bg-brand-acc hover:opacity-95 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-glow flex items-center gap-1.5 transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdates ? 'animate-spin' : ''}`} />
                  <span>{isCheckingUpdates ? 'Checking…' : 'Check for Updates'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
