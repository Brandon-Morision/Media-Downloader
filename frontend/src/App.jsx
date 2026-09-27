import React, { useState, useEffect, useCallback, useRef } from 'react';
import NavigationRail from './components/NavigationRail';

import HomeView from './components/views/HomeView';
import DownloaderView from './components/views/DownloaderView';
import ExploreView from './components/views/ExploreView';
import LibraryView from './components/views/LibraryView';
import SettingsView from './components/views/SettingsView';
import GlobalMediaPlayer from './components/player/GlobalMediaPlayer';
import VideoDownloadModal from './components/modals/VideoDownloadModal';
import GalleryModal from './components/modals/GalleryModal';
import PlaylistInspectorModal from './components/modals/PlaylistInspectorModal';
import NightOwlModal from './components/modals/NightOwlModal';
import ShutdownWarningModal from './components/modals/ShutdownWarningModal';
import { Toast, ClipboardToast } from './components/toasts/Toast';
import { api, waitForApi } from './lib/api';
import { detectTool } from './lib/formatters';

export default function App() {
  const [currentView, setCurrentView] = useState(() => localStorage.getItem('md_current_view') || 'home');
  const [themeAccent, setThemeAccent] = useState(() => localStorage.getItem('md_theme_accent') || 'violet');
  const [outputDir, setOutputDir] = useState(() => localStorage.getItem('md_output_folder') || '~/Downloads/media');
  const [defaultFormat, setDefaultFormat] = useState(() => localStorage.getItem('md_default_format') || 'auto');
  const [onFinishAction, setOnFinishAction] = useState(() => localStorage.getItem('md_on_finish') || 'nothing');
  const [clipAutostart, setClipAutostart] = useState(() => localStorage.getItem('md_clip_autostart') === 'true');
  const [initialAnalyzeUrl, setInitialAnalyzeUrl] = useState('');

  const [downloads, setDownloads] = useState([]);
  const [activeJobId, setActiveJobId] = useState(null);

  // Modals state
  const [playerModal, setPlayerModal] = useState({ isOpen: false, files: [], title: '' });
  const [galleryModal, setGalleryModal] = useState({ isOpen: false, item: null });
  const [playlistModal, setPlaylistModal] = useState({ isOpen: false, data: null, isLoading: false, error: '' });
  const [isQueuePaused, setIsQueuePaused] = useState(false);
  const [nightOwlModalOpen, setNightOwlModalOpen] = useState(false);
  const [nightOwlSettings, setNightOwlSettings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('md_night_owl') || '{}');
    } catch {
      return { enabled: false, startTime: '02:00', endTime: '06:00', dayRateLimit: '500' };
    }
  });
  const [shutdownModal, setShutdownModal] = useState({ isOpen: false, remainingSeconds: 30 });

  // Notifications
  const [toast, setToast] = useState({ message: '', isSuccess: true });
  const [clipboardUrl, setClipboardUrl] = useState(null);

  // Search Explore state
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Keep ref to avoid stale closures in pywebview event callbacks
  const downloadsRef = useRef(downloads);
  downloadsRef.current = downloads;
  const onFinishActionRef = useRef(onFinishAction);
  onFinishActionRef.current = onFinishAction;

  // Apply theme data attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeAccent);
    localStorage.setItem('md_theme_accent', themeAccent);
  }, [themeAccent]);

  // Save preferences changes
  useEffect(() => {
    localStorage.setItem('md_default_format', defaultFormat);
  }, [defaultFormat]);

  useEffect(() => {
    localStorage.setItem('md_on_finish', onFinishAction);
  }, [onFinishAction]);

  useEffect(() => {
    localStorage.setItem('md_clip_autostart', String(clipAutostart));
  }, [clipAutostart]);

  useEffect(() => {
    localStorage.setItem('md_current_view', currentView);
  }, [currentView]);

  const handleAnalyzeUrl = useCallback((url) => {
    setInitialAnalyzeUrl(url);
    setCurrentView('downloader');
  }, []);

  const showToast = useCallback((message, isSuccess = true) => {
    setToast({ message, isSuccess });
  }, []);

  // ── Load history from backend ──
  const loadHistory = useCallback(async () => {
    try {
      await waitForApi(10000);
      const historyRes = await api.listHistory();
      if (historyRes?.ok && Array.isArray(historyRes.entries)) {
        const seeded = historyRes.entries.map((entry) => ({
          id: entry.id,
          historyId: entry.id,
          url: entry.url,
          tool: entry.tool || 'gallery-dl',
          state: entry.status === 'done' ? 'done' : entry.status === 'cancelled' ? 'cancelled' : 'error',
          jobId: null,
          outputDir: entry.output_dir,
          itemsDone: entry.files?.length || 0,
          files: entry.files || [],
          filename: entry.filename || '',
          sizeBytes: entry.size_bytes || 0,
          thumbnail: entry.thumbnail || '',
          error: entry.error || '',
          finishedAt: (entry.finished_at || 0) * 1000,
        }));

        setDownloads((prev) => {
          const active = prev.filter((p) => ['pending', 'running', 'paused'].includes(p.state));
          const activeIds = new Set(active.map((a) => a.id));
          const nonActiveSeeded = seeded.filter((s) => !activeIds.has(s.id));
          return [...active, ...nonActiveSeeded];
        });
      }
    } catch (err) {
      console.error('Failed to load initial history:', err);
    }
  }, []);

  // ── Load initial data on mount & pywebview ready ──
  useEffect(() => {
    loadHistory();

    const onReady = () => {
      loadHistory();
    };
    window.addEventListener('pywebviewready', onReady);

    // Initial check for default output dir
    async function initOutputDir() {
      const savedOut = localStorage.getItem('md_output_folder');
      if (!savedOut) {
        try {
          const defaultOut = await api.getDefaultOutputDir();
          if (defaultOut) {
            setOutputDir(defaultOut);
            localStorage.setItem('md_output_folder', defaultOut);
          }
        } catch (e) {}
      }
    }
    initOutputDir();

    return () => {
      window.removeEventListener('pywebviewready', onReady);
    };
  }, [loadHistory]);

  // Re-sync history whenever switching to library or downloader
  useEffect(() => {
    if (currentView === 'library' || currentView === 'downloader') {
      loadHistory();
    }
  }, [currentView, loadHistory]);

  // ── Register PyWebView Python push event hooks ──
  useEffect(() => {
    window.onDownloadProgress = (jobId, dataOrPercent, speedArg, etaArg, fileArg) => {
      let percent = 0;
      let speedStr = speedArg || '';
      let etaStr = etaArg || '';
      let fileName = fileArg || '';
      let itemsDone = 0;
      let limit = 0;
      let downloadedBytes = null;
      let totalBytes = null;

      if (dataOrPercent && typeof dataOrPercent === 'object') {
        const rawPct = dataOrPercent.percent;
        percent = typeof rawPct === 'number' ? rawPct : (parseFloat(rawPct) || 0);
        speedStr = dataOrPercent.speed || speedStr;
        etaStr = dataOrPercent.eta || etaStr;
        fileName = dataOrPercent.current_file || fileName;
        itemsDone = dataOrPercent.items_done || 0;
        limit = dataOrPercent.limit || 0;
        downloadedBytes = dataOrPercent.downloaded_bytes ?? null;
        totalBytes = dataOrPercent.total_bytes ?? null;
      } else if (typeof dataOrPercent === 'number') {
        percent = dataOrPercent;
      } else if (typeof dataOrPercent === 'string') {
        percent = parseFloat(dataOrPercent) || 0;
      }

      if (isNaN(percent) || percent == null) {
        percent = 0;
      }

      setDownloads((prev) =>
        prev.map((item) => {
          if (item.jobId === jobId) {
            return {
              ...item,
              state: 'running',
              progressPercent: percent,
              speedStr: speedStr || item.speedStr,
              etaStr: etaStr || item.etaStr,
              filename: fileName || item.filename,
              itemsDone: itemsDone || item.itemsDone,
              limit: limit || item.limit,
              downloadedBytes: downloadedBytes ?? item.downloadedBytes,
              totalBytes: totalBytes ?? item.totalBytes,
            };
          }
          return item;
        })
      );
    };

    window.onDownloadDone = (jobId, ok, error, outputDir, files, historyId, thumbUrl) => {
      setDownloads((prev) =>
        prev.map((item) => {
          if (item.jobId === jobId) {
            const hasFiles = files && files.length > 0;
            return {
              ...item,
              state: ok ? 'done' : (error === 'Cancelled by user.' || item.state === 'cancelled') ? 'cancelled' : 'error',
              error: ok ? '' : error,
              progressPercent: ok ? 100 : item.progressPercent,
              outputDir: outputDir || item.outputDir,
              files: hasFiles ? files : item.files,
              filename: (hasFiles && files.length === 1 && files[0]?.name)
                ? files[0].name
                : (hasFiles && files.length > 1 && (!item.filename || item.filename === item.url))
                  ? `${files.length} files`
                  : item.filename,
              historyId: historyId || item.historyId,
              thumbnail: thumbUrl || item.thumbnail || '',
              finishedAt: Date.now(),
            };
          }
          return item;
        })
      );

      // Check if queue has any more running items
      setTimeout(() => {
        const remainingRunning = downloadsRef.current.filter(
          (i) => i.jobId !== jobId && i.state === 'running'
        );
        if (remainingRunning.length === 0) {
          handleQueueFinished();
        }
      }, 500);
    };

    window.onClipboardUrlDetected = (url, title) => {
      if (clipAutostart) {
        handleAddDownload(url, { format: defaultFormat });
        showToast('Auto-download started from clipboard');
      } else {
        setClipboardUrl(url);
      }
    };

    window.onSearchResults = (results, query) => {
      setIsSearching(false);
      setSearchResults(results || []);
      setSearchError(results?.length ? '' : `No results found for "${query}"`);
    };

    window.onSearchError = (msg) => {
      setIsSearching(false);
      setSearchError(msg || 'Search failed');
    };

    window.onPlaylistPreview = (reqId, res) => {
      if (res?.ok) {
        setPlaylistModal((prev) => ({ ...prev, isLoading: false, data: res, error: '' }));
      } else {
        setPlaylistModal((prev) => ({ ...prev, isLoading: false, error: res?.error || 'Failed to inspect playlist' }));
      }
    };

    window.onBrowserUrl = (url, title) => {
      setCurrentView('downloader');
      handleAddDownload(url, { format: defaultFormat, title: title || undefined });
      showToast(`Link received from browser: ${title || url}`);
    };

    return () => {
      delete window.onDownloadProgress;
      delete window.onDownloadDone;
      delete window.onClipboardUrlDetected;
      delete window.onSearchResults;
      delete window.onSearchError;
      delete window.onPlaylistPreview;
      delete window.onBrowserUrl;
    };
  }, [clipAutostart, defaultFormat, showToast]);

  const handleSearch = async (query, limit = 12) => {
    setIsSearching(true);
    setSearchError('');
    try {
      await api.search(query, limit);
    } catch (e) {
      setIsSearching(false);
      setSearchError(e.message || 'Search request failed');
    }
  };

  // ── Queue Completion Handlers ──
  const handleQueueFinished = async () => {
    const action = onFinishActionRef.current;
    if (action === 'chime') {
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play();
      } catch {}
    } else if (action === 'folder') {
      if (outputDir) api.openOutputFolder(outputDir);
    } else if (action === 'quit') {
      api.closeApp();
    } else if (action === 'shutdown') {
      setShutdownModal({ isOpen: true, remainingSeconds: 30 });
      api.executeCompletionAction('shutdown', 30);
    }
  };

  // ── Download Actions ──
  const handleAddDownload = async (url, options = {}) => {
    const newId = 'dl-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
    const detectedTool = options.tool || detectTool(url);
    const newItem = {
      id: newId,
      url,
      filename: options.title || '',
      tool: detectedTool,
      state: 'pending',
      cfg: { ...options, output: outputDir || '~/Downloads/media' },
      progressPercent: 0,
      sizeBytes: 0,
      startedAt: Date.now(),
      files: [],
    };

    setDownloads((prev) => [newItem, ...prev]);

    // Send to backend
    try {
      const res = await api.startDownload(url, newItem.cfg, detectedTool);
      if (res?.ok && res.job_id) {
        setDownloads((prev) =>
          prev.map((i) => (i.id === newId ? { ...i, jobId: res.job_id, state: 'running' } : i))
        );
        setActiveJobId(res.job_id);
      } else {
        setDownloads((prev) =>
          prev.map((i) => (i.id === newId ? { ...i, state: 'error', error: res?.error || 'Failed to start' } : i))
        );
      }
    } catch (e) {
      setDownloads((prev) =>
        prev.map((i) => (i.id === newId ? { ...i, state: 'error', error: e.message } : i))
      );
    }
  };

  const handleCancelDownload = async (id) => {
    const item = downloads.find((i) => i.id === id);
    if (!item) return;
    if (item.jobId) {
      await api.cancelDownload(item.jobId);
    }
    setDownloads((prev) =>
      prev.map((i) => (i.id === id ? { ...i, state: 'cancelled' } : i))
    );
    showToast('Download cancelled');
  };

  const handlePauseDownload = async (jobId) => {
    await api.pauseDownload(jobId);
    setDownloads((prev) =>
      prev.map((i) => (i.jobId === jobId ? { ...i, state: 'paused' } : i))
    );
  };

  const handleResumeDownload = async (jobId) => {
    await api.resumeDownload(jobId);
    setDownloads((prev) =>
      prev.map((i) => (i.jobId === jobId ? { ...i, state: 'running' } : i))
    );
  };

  const handleDeleteDownload = async (id) => {
    const item = downloads.find((i) => i.id === id);
    if (item?.historyId) {
      await api.deleteHistoryEntry(item.historyId);
    }
    setDownloads((prev) => prev.filter((i) => i.id !== id));
    showToast('Removed from list');
  };

  const handleRetryDownload = (id) => {
    const item = downloads.find((i) => i.id === id);
    if (item) {
      handleAddDownload(item.url, item.cfg);
    }
  };

  const handleClearFinished = async () => {
    setDownloads((prev) => prev.filter((i) => !['done', 'error', 'cancelled'].includes(i.state)));
    await api.clearHistory();
    showToast('Cleared finished downloads');
  };

  const handleClearWaiting = () => {
    setDownloads((prev) => prev.filter((i) => i.state !== 'pending'));
    showToast('Cleared waiting queue');
  };

  const handleInspectPlaylist = async (url) => {
    setPlaylistModal({ isOpen: true, data: null, isLoading: true, error: '' });
    try {
      await api.inspectPlaylist(url);
    } catch (e) {
      setPlaylistModal({ isOpen: true, data: null, isLoading: false, error: e.message || 'Inspection failed' });
    }
  };

  const handleDownloadPlaylistSelected = ({ tracks, playlistUrl, mode, format }) => {
    if (mode === 'bundle') {
      const itemsRange = tracks.map((t) => t.index).join(',');
      handleAddDownload(playlistUrl, { format, playlist_items: itemsRange });
      showToast(`Bundled ${tracks.length} tracks into queue`);
    } else {
      tracks.forEach((track) => {
        handleAddDownload(track.url, { format, title: track.title });
      });
      showToast(`Queued ${tracks.length} playlist tracks`);
    }
  };

  const handleMoveItemUp = (id) => {
    setDownloads((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      if (idx <= 0) return prev;
      const copy = [...prev];
      const temp = copy[idx - 1];
      copy[idx - 1] = copy[idx];
      copy[idx] = temp;
      return copy;
    });
  };

  const handleMoveItemDown = (id) => {
    setDownloads((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const copy = [...prev];
      const temp = copy[idx + 1];
      copy[idx + 1] = copy[idx];
      copy[idx] = temp;
      return copy;
    });
  };

  const handleTogglePauseQueue = () => {
    const next = !isQueuePaused;
    setIsQueuePaused(next);
    if (next) {
      downloads.forEach((i) => {
        if (i.state === 'running' && i.jobId) api.pauseDownload(i.jobId);
      });
      showToast('Queue paused');
    } else {
      downloads.forEach((i) => {
        if (i.state === 'paused' && i.jobId) api.resumeDownload(i.jobId);
      });
      showToast('Queue resumed');
    }
  };

  // Modals openers
  const handleOpenPlayer = (files, title) => {
    const list = Array.isArray(files) ? files : files ? [files] : [];
    setPlayerModal({
      isOpen: true,
      files: list,
      title: title || (list[0]?.name || 'Now playing'),
    });
  };

  const handleOpenGallery = (idOrItem) => {
    if (!idOrItem) return;
    if (typeof idOrItem === 'object' && idOrItem !== null) {
      setGalleryModal({ isOpen: true, item: idOrItem });
      return;
    }
    const item = downloads.find((i) => i.id === idOrItem || i.historyId === idOrItem);
    if (item) setGalleryModal({ isOpen: true, item });
  };

  const handleSaveNightOwlSettings = (settings) => {
    setNightOwlSettings(settings);
    localStorage.setItem('md_night_owl', JSON.stringify(settings));
    showToast(`Night-Owl scheduler ${settings.enabled ? 'activated' : 'deactivated'}`);
  };

  const runningCount = downloads.filter((i) => i.state === 'running').length;
  const doneCount = downloads.filter((i) => i.state === 'done').length;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface-0 text-slate-100 font-sans">
      {/* 1. Left Navigation Rail */}
      <NavigationRail
        currentView={currentView}
        setView={setCurrentView}
        activeCount={runningCount}
        libraryCount={doneCount}
        nightOwlEnabled={nightOwlSettings.enabled}
      />

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Dynamic View Panel */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          <div key={currentView} className="flex-1 flex flex-col min-h-0 animate-view-enter">
          {currentView === 'home' && (
            <HomeView
              onAnalyzeUrl={handleAnalyzeUrl}
              onAddDownload={handleAddDownload}
              onOpenPlayer={handleOpenPlayer}
              onSwitchToLibrary={() => setCurrentView('library')}
              onSwitchToDownloader={() => setCurrentView('downloader')}
              downloads={downloads}
              onShowToast={showToast}
            />
          )}

          {currentView === 'downloader' && (
            <DownloaderView
              downloads={downloads}
              onAddDownload={handleAddDownload}
              onCancelDownload={handleCancelDownload}
              onPauseDownload={handlePauseDownload}
              onResumeDownload={handleResumeDownload}
              onDeleteDownload={handleDeleteDownload}
              onRetryDownload={handleRetryDownload}
              onClearFinished={handleClearFinished}
              onClearWaiting={handleClearWaiting}
              onOpenPlayer={handleOpenPlayer}
              onOpenGallery={handleOpenGallery}
              onOpenNightOwlModal={() => setNightOwlModalOpen(true)}
              onInspectPlaylist={handleInspectPlaylist}
              onMoveItemUp={handleMoveItemUp}
              onMoveItemDown={handleMoveItemDown}
              onTogglePauseQueue={handleTogglePauseQueue}
              isQueuePaused={isQueuePaused}
              onFinishAction={onFinishAction}
              setOnFinishAction={setOnFinishAction}
              nightOwlEnabled={nightOwlSettings.enabled}
              defaultFormat={defaultFormat}
              initialAnalyzeUrl={initialAnalyzeUrl}
              onClearInitialAnalyzeUrl={() => setInitialAnalyzeUrl('')}
              searchResults={searchResults}
              isSearching={isSearching}
              searchError={searchError}
              onSearch={handleSearch}
              onClearSearch={() => {
                setSearchResults([]);
                setSearchError('');
              }}
              onShowToast={showToast}
              onRefreshHistory={loadHistory}
            />
          )}

          {currentView === 'explore' && (
            <ExploreView
              searchResults={searchResults}
              isSearching={isSearching}
              searchError={searchError}
              onSearch={handleSearch}
              onAddDownload={handleAddDownload}
              onOpenPlayer={handleOpenPlayer}
              onSwitchToDownloader={() => setCurrentView('downloader')}
              onShowToast={showToast}
            />
          )}

          {currentView === 'library' && (
            <LibraryView
              downloads={downloads}
              onDeleteDownload={handleDeleteDownload}
              onClearHistory={handleClearFinished}
              onOpenPlayer={handleOpenPlayer}
              onOpenGallery={handleOpenGallery}
              onSwitchToDownloader={() => setCurrentView('downloader')}
              onRefreshHistory={loadHistory}
            />
          )}

          {currentView === 'settings' && (
            <SettingsView
              themeAccent={themeAccent}
              setThemeAccent={setThemeAccent}
              outputDir={outputDir}
              setOutputDir={setOutputDir}
              defaultFormat={defaultFormat}
              setDefaultFormat={setDefaultFormat}
              onFinishAction={onFinishAction}
              setOnFinishAction={setOnFinishAction}
              clipAutostart={clipAutostart}
              setClipAutostart={setClipAutostart}
              onShowToast={showToast}
            />
          )}
          </div>
        </main>
      </div>

      {/* ── Global Media Player (Persistent Audio/Video, Visualizer, Mini Player) ── */}
      <GlobalMediaPlayer
        active={playerModal.isOpen}
        files={playerModal.files}
        title={playerModal.title}
        onClose={() => setPlayerModal({ isOpen: false, files: [], title: '' })}
      />

      {galleryModal.isOpen && (
        <GalleryModal
          isOpen={galleryModal.isOpen}
          onClose={() => setGalleryModal({ isOpen: false, item: null })}
          downloadItem={galleryModal.item}
        />
      )}

      {playlistModal.isOpen && (
        <PlaylistInspectorModal
          isOpen={playlistModal.isOpen}
          onClose={() => setPlaylistModal({ isOpen: false, data: null, isLoading: false, error: '' })}
          playlistData={playlistModal.data}
          isLoading={playlistModal.isLoading}
          error={playlistModal.error}
          onDownloadSelected={handleDownloadPlaylistSelected}
        />
      )}

      {nightOwlModalOpen && (
        <NightOwlModal
          isOpen={nightOwlModalOpen}
          onClose={() => setNightOwlModalOpen(false)}
          nightOwlSettings={nightOwlSettings}
          onSaveSettings={handleSaveNightOwlSettings}
        />
      )}

      {shutdownModal.isOpen && (
        <ShutdownWarningModal
          isOpen={shutdownModal.isOpen}
          onClose={() => setShutdownModal({ isOpen: false, remainingSeconds: 30 })}
          remainingSeconds={shutdownModal.remainingSeconds}
        />
      )}

      {/* Toast Notification */}
      <Toast
        message={toast.message}
        isSuccess={toast.isSuccess}
        onClose={() => setToast({ message: '', isSuccess: true })}
      />

      {/* Clipboard Detector Toast */}
      <ClipboardToast
        detectedUrl={clipboardUrl}
        onStart={(url) => {
          handleAddDownload(url, { format: defaultFormat });
          setClipboardUrl(null);
          showToast('Download started');
        }}
        onDismiss={() => setClipboardUrl(null)}
      />
    </div>
  );
}
