import React, { useState, useEffect } from 'react';
import {
  Download, Play, Pause, X, RotateCcw, Folder, Image,
  ChevronDown, ChevronUp, Trash2, Search, CheckCircle2,
  AlertCircle, AlertTriangle, XCircle, Clock, Link as LinkIcon, Sparkles, ListMusic,
  Film, Music, MoreVertical, Check, ExternalLink, Layers, ListVideo
} from 'lucide-react';
import {
  fmtBytes, fmtDate, fmtViews, fmtDuration, toolLabel,
  playableFilesFor, galleryFilesFor, isLikelyUrl, normalizeUrl, detectTool,
  friendlyError, getBundleInfo,
} from '../../lib/formatters';
import { api } from '../../lib/api';
import MediaThumbnail from '../common/MediaThumbnail';

export default function DownloaderView({
  downloads,
  onAddDownload,
  onCancelDownload,
  onPauseDownload,
  onResumeDownload,
  onDeleteDownload,
  onRetryDownload,
  onClearFinished,
  onClearWaiting,
  onOpenPlayer,
  onOpenGallery,
  onOpenNightOwlModal,
  onInspectPlaylist,
  onMoveItemUp,
  onMoveItemDown,
  onTogglePauseQueue,
  isQueuePaused,
  nightOwlEnabled,
  defaultFormat,
  initialAnalyzeUrl = '',
  onClearInitialAnalyzeUrl,
  searchResults = [],
  isSearching = false,
  searchError = '',
  onSearch,
  onClearSearch,
  onShowToast,
  onRefreshHistory,
}) {
  const [urlInput, setUrlInput] = useState(initialAnalyzeUrl || '');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedData, setAnalyzedData] = useState(null);
  const [analyzeError, setAnalyzeError] = useState('');

  // YouTube / video quick format picker state
  const [ytDownloadFormat, setYtDownloadFormat] = useState(() => (defaultFormat && defaultFormat !== 'auto') ? defaultFormat : 'mp4');

  // Dual search mode state
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [resultFormats, setResultFormats] = useState({});
  const [queuedIds, setQueuedIds] = useState(new Set());

  // Analysis options state (Screen 2)
  const [selectedFormatType, setSelectedFormatType] = useState('video'); // video | audio | image
  const [selectedQualityId, setSelectedQualityId] = useState('1080p');
  const [galleryLimit, setGalleryLimit] = useState(0);

  // Queue state (Screen 3)
  const [queueTab, setQueueTab] = useState('all'); // all | active | completed
  const [searchQuery, setSearchQuery] = useState('');

  // Register push listener for link preview
  useEffect(() => {
    window.onLinkPreview = (reqId, res) => {
      setIsAnalyzing(false);
      if (res?.ok) {
        setAnalyzedData(res);
        setAnalyzeError('');
        // Select top quality if available
        if (res.available_qualities && res.available_qualities.length > 0) {
          const videoQ = res.available_qualities.find((q) => q.type === 'video');
          if (videoQ) setSelectedQualityId(videoQ.id);
        }
      } else {
        setAnalyzeError(res?.error || res?.reason || 'Could not fetch metadata for this link');
      }
    };

    return () => {
      delete window.onLinkPreview;
    };
  }, []);

  // Trigger analysis or search if initialAnalyzeUrl is passed from Home
  useEffect(() => {
    if (initialAnalyzeUrl) {
      const text = initialAnalyzeUrl.trim();
      setUrlInput(text);
      if (isLikelyUrl(text)) {
        handleAnalyze(normalizeUrl(text));
      } else {
        handleSearchSubmit(text);
      }
      if (onClearInitialAnalyzeUrl) onClearInitialAnalyzeUrl();
    }
  }, [initialAnalyzeUrl]);

  const handleAnalyze = async (targetUrl) => {
    const link = (targetUrl || urlInput).trim();
    if (!link) return;
    if (onClearSearch) onClearSearch();
    setActiveSearchQuery('');
    setIsAnalyzing(true);
    setAnalyzeError('');
    setAnalyzedData(null);

    try {
      await api.previewLink(link);
    } catch (e) {
      setIsAnalyzing(false);
      setAnalyzeError(e.message || 'Failed to inspect link');
    }
  };

  const handleSearchSubmit = (targetQuery) => {
    const q = (targetQuery || urlInput).trim();
    if (!q) return;
    setAnalyzedData(null);
    setAnalyzeError('');
    setActiveSearchQuery(q);
    if (onSearch) {
      onSearch(q, 12);
    }
    api.saveSearch(q).catch(() => {});
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const text = urlInput.trim();
    if (!text) return;
    if (isLikelyUrl(text)) {
      const norm = normalizeUrl(text);
      const tool = detectTool(norm);
      if (tool === 'yt-dlp') {
        onAddDownload(norm, { tool, format: ytDownloadFormat });
      } else {
        onAddDownload(norm, { tool });
      }
      setUrlInput('');
      setAnalyzedData(null);
      setAnalyzeError('');
      setQueueTab('active');
      const fmtLabel = tool === 'yt-dlp' ? ` [${ytDownloadFormat.toUpperCase()}]` : '';
      if (onShowToast) onShowToast(`Queued ${toolLabel(tool)} download${fmtLabel} (${tool})`);
    } else {
      handleSearchSubmit(text);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setUrlInput(text.trim());
        return;
      }
    } catch {}
    try {
      const clipRes = await api.readClipboard();
      if (clipRes?.ok && clipRes.text) {
        setUrlInput(clipRes.text.trim());
      }
    } catch {}
  };

  const handleDirectDownload = (overrideUrl, overrideTool) => {
    const text = (overrideUrl || urlInput).trim();
    if (!text) return;
    const norm = normalizeUrl(text);
    const tool = overrideTool || detectTool(norm);
    if (tool === 'yt-dlp') {
      onAddDownload(norm, { tool, format: ytDownloadFormat });
    } else {
      onAddDownload(norm, { tool });
    }
    setUrlInput('');
    setAnalyzedData(null);
    setAnalyzeError('');
    setQueueTab('active');
    const fmtLabel = tool === 'yt-dlp' ? ` [${ytDownloadFormat.toUpperCase()}]` : '';
    if (onShowToast) onShowToast(`Queued ${toolLabel(tool)} download${fmtLabel} (${tool})`);
  };

  const handleDownloadSearchResult = (item, chosenFormat) => {
    const fmt = chosenFormat || resultFormats[item.id] || 'mp4';
    let format = fmt;
    let quality = 'best';
    onAddDownload(item.url, {
      tool: 'yt-dlp',
      format,
      quality,
      title: item.title,
    });
    setQueuedIds((prev) => new Set([...prev, item.id]));
    if (onShowToast) {
      onShowToast(`Queued "${item.title.slice(0, 30)}…" as ${fmt.toUpperCase()}`);
    }
  };

  const handleClearSearchResults = () => {
    if (onClearSearch) onClearSearch();
    setActiveSearchQuery('');
  };

  const handleStartDownloadFromAnalysis = () => {
    const rawUrl = analyzedData?.url || urlInput.trim();
    if (!rawUrl) return;
    const norm = normalizeUrl(rawUrl);
    const tool = analyzedData?.tool || detectTool(norm);

    if (tool === 'gallery-dl' || analyzedData?.type === 'gallery') {
      onAddDownload(norm, {
        tool: 'gallery-dl',
        title: analyzedData?.title || undefined,
        limit: galleryLimit > 0 ? galleryLimit : undefined,
      });
    } else {
      let formatOption = selectedQualityId || 'mp4';
      let qualityOption = selectedQualityId ? selectedQualityId.replace('p', '') : 'best';

      if (selectedFormatType === 'audio') {
        formatOption = 'mp3';
        qualityOption = 'best';
      }

      onAddDownload(norm, {
        tool: 'yt-dlp',
        format: formatOption,
        quality: qualityOption,
        title: analyzedData?.title || undefined,
      });
    }

    // Reset analysis panel
    setAnalyzedData(null);
    setUrlInput('');
    setQueueTab('active');
    if (onShowToast) onShowToast(`Queued ${toolLabel(tool)} download (${tool})`);
  };

  // Filter queue items by state
  const activeDownloads = downloads.filter((item) => ['pending', 'running', 'paused'].includes(item.state));
  const completedDownloads = downloads.filter((item) => item.state === 'done');
  const failedDownloads = downloads.filter((item) => item.state === 'error');
  const cancelledDownloads = downloads.filter((item) => item.state === 'cancelled');
  const historyDownloads = downloads.filter((item) => ['done', 'cancelled', 'error'].includes(item.state));

  const currentSectionDownloads = (() => {
    let list = [];
    if (queueTab === 'all') list = historyDownloads;
    else if (queueTab === 'completed') list = completedDownloads;
    else if (queueTab === 'failed') list = failedDownloads;
    else if (queueTab === 'cancelled') list = cancelledDownloads;
    else return [];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return list.filter((item) => {
        const name = (item.filename || '').toLowerCase();
        const url = (item.url || '').toLowerCase();
        return name.includes(q) || url.includes(q);
      });
    }
    return list;
  })();

  const handleClearSection = () => {
    if (queueTab === 'failed') {
      failedDownloads.forEach((i) => onDeleteDownload(i.id));
      if (onShowToast) onShowToast('Cleared failed downloads');
    } else if (queueTab === 'cancelled') {
      cancelledDownloads.forEach((i) => onDeleteDownload(i.id));
      if (onShowToast) onShowToast('Cleared cancelled downloads');
    } else if (queueTab === 'completed') {
      completedDownloads.forEach((i) => onDeleteDownload(i.id));
      if (onShowToast) onShowToast('Cleared completed downloads');
    } else {
      if (onClearFinished) onClearFinished();
    }
  };

  // Default quality options for Screen 2 mock / fallback if live list is empty
  const qualityOptions = (analyzedData?.available_qualities && analyzedData.available_qualities.length > 0)
    ? analyzedData.available_qualities.filter((q) => q.type === selectedFormatType)
    : [
        { id: '1080p', label: '1080p (Full HD)', ext: 'MP4', size_bytes: 25800000, type: 'video' },
        { id: '720p', label: '720p (HD)', ext: 'MP4', size_bytes: 14900000, type: 'video' },
        { id: '480p', label: '480p (SD)', ext: 'MP4', size_bytes: 8500000, type: 'video' },
        { id: '360p', label: '360p', ext: 'MP4', size_bytes: 5800000, type: 'video' },
      ];

  return (
    <div className="flex-1 flex flex-col min-h-0 select-none">
      {/* ── STICKY TOP AREA: search bar + inline panels ── */}
      <div className="shrink-0 px-6 pt-6 pb-0 flex flex-col gap-6 w-full">
        <form
          onSubmit={handleFormSubmit}
          className="flex items-center gap-2 bg-surface-2/90 border border-border-subtle hover:border-border rounded-xl p-1.5 pl-3.5 shadow-md focus-within:border-brand-acc focus-within:shadow-glow transition-all"
        >
          {isLikelyUrl(urlInput) ? (
            detectTool(urlInput) === 'gallery-dl' ? (
              <Image className="w-4 h-4 text-brand-acc shrink-0 pointer-events-none" />
            ) : (
              <Film className="w-4 h-4 text-pink-400 shrink-0 pointer-events-none" />
            )
          ) : (
            <Search className="w-4 h-4 text-slate-400 shrink-0 pointer-events-none" />
          )}

          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Paste link to download, or type anything to search YouTube…"
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none pr-2"
          />

          <button
            type="button"
            onClick={handlePaste}
            className="px-3 py-1.5 rounded-lg bg-surface-3 hover:bg-surface-4 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
          >
            Paste
          </button>

          {isLikelyUrl(urlInput) ? (
            <>
              {/* Optional Inspect button */}
              <button
                type="button"
                onClick={() => handleAnalyze(normalizeUrl(urlInput))}
                disabled={isAnalyzing}
                title="Inspect stream qualities, resolutions, or gallery items before downloading"
                className="px-3 py-1.5 rounded-lg bg-surface-3 hover:bg-surface-4 text-xs font-semibold text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 disabled:opacity-40"
              >
                {isAnalyzing ? (
                  <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-brand-acc" />
                )}
                <span className="hidden md:inline">Inspect</span>
              </button>

              {/* Primary Instant Download button */}
              <button
                type="submit"
                disabled={!urlInput.trim() || isAnalyzing}
                className="px-5 py-2 rounded-lg font-bold text-xs tracking-wide shadow-glow transition-all active:scale-95 shrink-0 flex items-center gap-1.5 bg-brand-acc text-slate-950 hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Download directly"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </button>
            </>
          ) : (
            /* Search Button */
            <button
              type="submit"
              disabled={!urlInput.trim() || isSearching}
              className="px-5 py-2 rounded-lg font-bold text-xs tracking-wide shadow-glow transition-all active:scale-95 shrink-0 flex items-center gap-1.5 bg-sky-500 text-slate-950 hover:bg-sky-400 shadow-sky-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSearching ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Searching…</span>
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>Search</span>
                </>
              )}
            </button>
          )}
        </form>

        {/* Analysis Warning / Error Banner with Download Anyway Option */}
        {analyzeError && (
          <div className="text-xs bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-rose-300 animate-fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Inspection note: {friendlyError(analyzeError)}</span>
            </div>
            {isLikelyUrl(urlInput) && (
              <button
                type="button"
                onClick={() => handleDirectDownload()}
                className="px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-semibold text-xs border border-rose-500/40 transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download anyway with {detectTool(urlInput)}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Scrollable area: search results, analysis panels, and downloads queue */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <div className="px-6 pb-6 pt-4 flex flex-col gap-6 w-full">

      {/* ── YOUTUBE SEARCH RESULTS SECTION ── */}
      {(isSearching || searchResults.length > 0 || searchError) && !analyzedData && !isAnalyzing && (
        <div className="bg-surface-1 border border-border-subtle hover:border-border rounded-2xl p-5 shadow-2xl flex flex-col gap-4 relative overflow-hidden animate-fade-in shrink-0 min-h-fit">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-sky-500/15 text-sky-400 flex items-center justify-center border border-sky-500/30">
                <Search className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <span>YouTube Results</span>
                  {activeSearchQuery && (
                    <span className="text-slate-400 font-normal">for "{activeSearchQuery}"</span>
                  )}
                </h2>
              </div>
              {searchResults.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-3 text-slate-300 border border-border-subtle">
                  {searchResults.length} videos
                </span>
              )}
            </div>

            <button
              onClick={handleClearSearchResults}
              className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs"
              title="Close search results"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Close</span>
            </button>
          </div>

          {/* Loading Skeletons */}
          {isSearching && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 py-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-surface-2/60 border border-border-subtle rounded-xl p-3 flex flex-col gap-3 animate-pulse">
                  <div className="aspect-video bg-surface-3 rounded-lg" />
                  <div className="h-4 bg-surface-3 rounded w-5/6" />
                  <div className="h-3 bg-surface-3 rounded w-1/2" />
                  <div className="h-8 bg-surface-3 rounded mt-2" />
                </div>
              ))}
            </div>
          )}

          {/* Search Error / Empty State */}
          {!isSearching && searchError && (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-center text-slate-400">
              <AlertCircle className="w-8 h-8 text-amber-400/80" />
              <p className="text-sm font-medium text-slate-300">{searchError}</p>
              <p className="text-xs text-slate-500">Try searching with a different term or keyword</p>
            </div>
          )}

          {/* Results Grid */}
          {!isSearching && searchResults.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {searchResults.map((r, idx) => {
                const currentFmt = resultFormats[r.id] || 'mp4';
                const isAdded = queuedIds.has(r.id);

                return (
                  <div
                    key={r.id || idx}
                    className="bg-surface-2/80 hover:bg-surface-2 border border-border-subtle hover:border-brand-border/70 rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-all flex flex-col group"
                  >
                    {/* 16:9 Thumbnail */}
                    <div className="relative aspect-video w-full bg-surface-3 overflow-hidden">
                      <img
                        src={r.thumbnail}
                        alt={r.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                        onError={(e) => {
                          if (r.id && !e.currentTarget.dataset.retried) {
                            e.currentTarget.dataset.retried = 'true';
                            e.currentTarget.src = `https://i.ytimg.com/vi/${r.id}/hqdefault.jpg`;
                          } else {
                            e.currentTarget.style.display = 'none';
                          }
                        }}
                      />
                      {r.duration ? (
                        <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/85 backdrop-blur-sm text-[10px] font-mono font-medium text-slate-200 shadow">
                          {fmtDuration(r.duration)}
                        </span>
                      ) : null}

                      {/* Inspect Streams hover overlay */}
                      <button
                        type="button"
                        onClick={() => handleAnalyze(r.url)}
                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-xs text-white font-medium backdrop-blur-[1px]"
                        title="Inspect all available resolutions & qualities"
                      >
                        <div className="px-3 py-1.5 rounded-lg bg-surface-1/90 border border-white/20 flex items-center gap-1.5 shadow-md hover:bg-surface-1">
                          <Sparkles className="w-3.5 h-3.5 text-brand-acc" />
                          <span>Inspect Streams</span>
                        </div>
                      </button>
                    </div>

                    {/* Metadata & Controls */}
                    <div className="p-3 flex-1 flex flex-col justify-between gap-3">
                      <div>
                        <h3
                          className="text-xs font-semibold text-slate-100 line-clamp-2 leading-snug group-hover:text-brand-acc transition-colors cursor-pointer"
                          title={r.title}
                          onClick={() => handleAnalyze(r.url)}
                        >
                          {r.title}
                        </h3>
                        <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                          <span className="truncate max-w-[140px]" title={r.channel}>
                            {r.channel || 'YouTube'}
                          </span>
                          {r.views ? <span>{fmtViews(r.views)}</span> : null}
                        </div>
                      </div>

                      {/* Format Selector & Download Button */}
                      <div className="pt-2 border-t border-border-subtle/70 flex items-center gap-2">
                        <select
                          value={currentFmt}
                          onChange={(e) =>
                            setResultFormats((prev) => ({ ...prev, [r.id]: e.target.value }))
                          }
                          className="flex-1 min-w-0 bg-surface-3 hover:bg-surface-4 border border-border-subtle text-slate-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand-acc transition-colors cursor-pointer"
                          title="Choose format (Video or Audio)"
                        >
                          <option value="mp4">🎬 Video · MP4</option>
                          <option value="mp3">🎵 Audio · MP3</option>
                          <option value="m4a">🎧 Audio · M4A</option>
                          <option value="best">✨ Best Quality</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => handleDownloadSearchResult(r)}
                          disabled={isAdded}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                            isAdded
                              ? 'bg-brand-dim text-brand-acc border border-brand-border cursor-default'
                              : 'bg-brand-acc hover:opacity-95 text-slate-950 shadow-sm active:scale-95'
                          }`}
                          title={isAdded ? 'Added to download queue' : 'Download in selected format'}
                        >
                          {isAdded ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Added</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-3.5 h-3.5" />
                              <span>Download</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => api.openUrlExternal(r.url)}
                          className="p-1.5 rounded-lg bg-surface-3 hover:bg-surface-4 text-slate-400 hover:text-white border border-border-subtle transition-colors shrink-0"
                          title="Open video on YouTube in browser"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── SCREEN 2: LINK ANALYSIS CARD (When active or analyzedData exists) ── */}
      {(analyzedData || isAnalyzing) && (
        <div className="bg-surface-1 border border-brand-border/60 rounded-2xl p-5 shadow-2xl flex flex-col gap-5 relative overflow-hidden animate-fade-in shrink-0 min-h-fit">
          <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-acc" />
              <span>
                {analyzedData?.tool === 'gallery-dl' || analyzedData?.type === 'gallery'
                  ? 'Gallery & Album Inspector'
                  : 'Stream Quality Inspector'}
              </span>
            </h2>
            <button
              onClick={() => {
                setAnalyzedData(null);
                setAnalyzeError('');
              }}
              className="text-slate-400 hover:text-rose-400 p-1 rounded-lg transition-colors"
              title="Close Analysis"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {isAnalyzing ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <div className="w-8 h-8 border-2 border-brand-acc border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-mono">
                {detectTool(urlInput) === 'gallery-dl'
                  ? 'Inspecting gallery details with gallery-dl…'
                  : 'Extracting stream qualities & metadata with yt-dlp…'}
              </p>
            </div>
          ) : (analyzedData?.tool === 'gallery-dl' || analyzedData?.type === 'gallery') ? (
            /* ── GALLERY INSPECTOR CARD ── */
            <>
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <div className="relative aspect-video w-full sm:w-56 rounded-xl overflow-hidden bg-surface-3 shrink-0 flex items-center justify-center group shadow-md border border-border-subtle">
                  {analyzedData.thumbnail ? (
                    <img
                      src={analyzedData.thumbnail}
                      alt={analyzedData.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 text-slate-500">
                      <Image className="w-10 h-10 text-brand-acc" />
                      <span className="text-[11px] font-medium text-slate-400">Gallery Media</span>
                    </div>
                  )}
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold bg-brand-acc text-slate-950 uppercase tracking-wider">
                    gallery-dl
                  </div>
                </div>

                <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                  <h3 className="text-base font-bold text-slate-100 tracking-tight leading-snug line-clamp-2">
                    {analyzedData.title || 'Media Collection'}
                  </h3>

                  <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                    <span className="text-brand-acc font-semibold">Images, GIFs &amp; Videos</span>
                    <span>•</span>
                    <span>{analyzedData.count ? `${analyzedData.count} items detected` : 'Batch download'}</span>
                  </p>

                  <div className="p-3 bg-surface-2/70 border border-border-subtle rounded-xl text-xs text-slate-300 leading-relaxed mt-2 flex flex-col gap-1">
                    <p className="text-slate-300">
                      This link is automatically processed by <strong>gallery-dl</strong>. All original full-resolution media items will be downloaded directly to your media directory.
                    </p>
                  </div>

                  {/* Limit Option */}
                  <div className="flex items-center gap-3 mt-3">
                    <span className="text-xs font-semibold text-slate-300">Download Limit:</span>
                    <select
                      value={galleryLimit}
                      onChange={(e) => setGalleryLimit(Number(e.target.value))}
                      className="bg-surface-3 hover:bg-surface-4 border border-border-subtle text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-brand-acc transition-colors cursor-pointer"
                    >
                      <option value={0}>All items (Default)</option>
                      <option value={10}>First 10 items</option>
                      <option value={25}>First 25 items</option>
                      <option value={50}>First 50 items</option>
                      <option value={100}>First 100 items</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Download Gallery Button */}
              <button
                type="button"
                onClick={handleStartDownloadFromAnalysis}
                className="w-full h-12 rounded-xl bg-brand-acc hover:opacity-95 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-glow transition-transform active:scale-[0.99] mt-2"
              >
                <Download className="w-4 h-4" />
                <span>Download Gallery with gallery-dl</span>
              </button>
            </>
          ) : (
            /* ── VIDEO / YT-DLP INSPECTOR CARD ── */
            <>
              {/* Media Preview Header Row */}
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                {/* 16:9 Thumbnail with center Play Overlay */}
                <div className="relative aspect-video w-full sm:w-56 rounded-xl overflow-hidden bg-surface-3 shrink-0 flex items-center justify-center group shadow-md">
                  {analyzedData.thumbnail ? (
                    <img
                      src={analyzedData.thumbnail}
                      alt={analyzedData.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Film className="w-10 h-10 text-slate-500" />
                  )}
                  {/* Play Overlay */}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-brand-acc text-slate-950 flex items-center justify-center shadow-glow">
                      <Play className="w-5 h-5 ml-0.5 fill-current" />
                    </div>
                  </div>
                </div>

                {/* Metadata Column */}
                <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-bold text-slate-100 tracking-tight leading-snug line-clamp-2">
                      {analyzedData.title || 'Untitled Stream'}
                    </h3>
                  </div>

                  <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                    <span>{analyzedData.channel || 'Media'}</span>
                    {analyzedData.duration && (
                      <>
                        <span>•</span>
                        <span>{Math.floor(analyzedData.duration / 60)}:{String(analyzedData.duration % 60).padStart(2, '0')}</span>
                      </>
                    )}
                    {analyzedData.views && (
                      <>
                        <span>•</span>
                        <span>{analyzedData.views > 1000000 ? `${(analyzedData.views / 1000000).toFixed(1)}M views` : `${analyzedData.views} views`}</span>
                      </>
                    )}
                  </p>

                  {analyzedData.description && (
                    <p className="text-xs text-slate-400/90 line-clamp-2 leading-relaxed mt-1">
                      {analyzedData.description}
                    </p>
                  )}

                  {/* Quality Badges */}
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="px-2 py-0.5 rounded-md bg-surface-3 text-slate-300 text-[10px] font-mono font-semibold border border-white/5">
                      1080p
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-surface-3 text-slate-300 text-[10px] font-mono font-semibold border border-white/5">
                      HD
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-surface-3 text-slate-300 text-[10px] font-mono font-semibold border border-white/5">
                      CC
                    </span>
                  </div>
                </div>
              </div>

              {/* Format Switcher Tabs: Video, Audio */}
              <div className="flex flex-col gap-2 pt-2">
                <span className="text-xs font-bold text-slate-300">Download as</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedFormatType('video')}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                      selectedFormatType === 'video'
                        ? 'bg-brand-acc text-slate-950 shadow-glow font-bold'
                        : 'bg-surface-2 text-slate-300 border border-border-subtle hover:bg-surface-3'
                    }`}
                  >
                    <Film className="w-3.5 h-3.5" />
                    <span>Video</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedFormatType('audio')}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                      selectedFormatType === 'audio'
                        ? 'bg-brand-acc text-slate-950 shadow-glow font-bold'
                        : 'bg-surface-2 text-slate-300 border border-border-subtle hover:bg-surface-3'
                    }`}
                  >
                    <Music className="w-3.5 h-3.5" />
                    <span>Audio</span>
                  </button>
                </div>
              </div>

              {/* Video / Audio Quality Radio List */}
              <div className="flex flex-col gap-2 pt-1">
                <span className="text-xs font-bold text-slate-300">
                  {selectedFormatType === 'audio' ? 'Audio Quality' : 'Video Quality'}
                </span>

                <div className="flex flex-col gap-2">
                  {qualityOptions.map((opt) => {
                    const isSelected = selectedQualityId === opt.id;
                    return (
                      <div
                        key={opt.id}
                        onClick={() => setSelectedQualityId(opt.id)}
                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all duration-150 ${
                          isSelected
                            ? 'bg-brand-dim border-brand-border shadow-sm'
                            : 'bg-surface-2 border-border-subtle hover:border-white/20 hover:bg-surface-3'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Radio indicator */}
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                              isSelected
                                ? 'border-brand-acc bg-brand-acc'
                                : 'border-slate-500 bg-transparent'
                            }`}
                          >
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                          </div>

                          <span className="text-xs font-semibold text-slate-200">
                            {opt.label || opt.id}
                          </span>
                        </div>

                        <div className="text-xs font-mono text-slate-400">
                          <span>{opt.ext || 'MP4'}</span>
                          {opt.size_bytes && <span> · {fmtBytes(opt.size_bytes)}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Big Emerald Download CTA Button */}
              <button
                type="button"
                onClick={handleStartDownloadFromAnalysis}
                className="w-full h-12 rounded-xl bg-brand-acc hover:opacity-95 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-glow transition-transform active:scale-[0.99] mt-2"
              >
                <Download className="w-4 h-4" />
                <span>
                  Download {selectedFormatType === 'audio' ? 'Audio (MP3)' : `${selectedQualityId} Video`}
                </span>
              </button>
            </>
          )}
        </div>
      )}


      {/* ── SCREEN 3: DOWNLOADS QUEUE (Active & Completed Tabs) ── */}
      <div className="flex flex-col gap-5 shrink-0">
        {/* Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-extrabold text-slate-100 tracking-tight">Downloads</h2>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 bg-surface-2 border border-border-subtle p-1 rounded-xl overflow-x-auto">
              <button
                onClick={() => setQueueTab('all')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  queueTab === 'all'
                    ? 'bg-brand-acc text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>All</span>
                {downloads.length > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    queueTab === 'all' ? 'bg-slate-950 text-brand-acc font-bold' : 'bg-surface-3 text-slate-300'
                  }`}>
                    {downloads.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setQueueTab('active')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  queueTab === 'active'
                    ? 'bg-brand-acc text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>Active</span>
                {activeDownloads.length > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    queueTab === 'active' ? 'bg-slate-950 text-brand-acc font-bold' : 'bg-surface-3 text-slate-300'
                  }`}>
                    {activeDownloads.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setQueueTab('completed')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  queueTab === 'completed'
                    ? 'bg-brand-acc text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>Completed</span>
                {completedDownloads.length > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    queueTab === 'completed' ? 'bg-slate-950 text-brand-acc font-bold' : 'bg-surface-3 text-slate-300'
                  }`}>
                    {completedDownloads.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setQueueTab('failed')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  queueTab === 'failed'
                    ? 'bg-rose-500 text-white shadow-sm font-bold'
                    : 'text-slate-400 hover:text-rose-400'
                }`}
              >
                <span>Failed</span>
                {failedDownloads.length > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    queueTab === 'failed' ? 'bg-black/40 text-white font-bold' : 'bg-rose-500/20 text-rose-400'
                  }`}>
                    {failedDownloads.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setQueueTab('cancelled')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  queueTab === 'cancelled'
                    ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                    : 'text-slate-400 hover:text-amber-400'
                }`}
              >
                <span>Cancelled</span>
                {cancelledDownloads.length > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    queueTab === 'cancelled' ? 'bg-slate-950 text-amber-400 font-bold' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {cancelledDownloads.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Right Action: Sync History & Clear Current Tab */}
          <div className="flex items-center gap-2">
            {onRefreshHistory && (
              <button
                type="button"
                onClick={onRefreshHistory}
                className="px-2.5 py-1 rounded-lg bg-surface-2 hover:bg-surface-3 text-slate-400 hover:text-brand-acc border border-border-subtle transition-colors flex items-center gap-1.5 text-xs font-semibold"
                title="Refresh download history from disk"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sync History</span>
              </button>
            )}

            {((queueTab !== 'active' && currentSectionDownloads.length > 0) || (queueTab === 'active' && activeDownloads.length > 0)) && (
              <button
                onClick={queueTab === 'active' ? onClearWaiting : handleClearSection}
                className="text-xs font-semibold text-slate-400 hover:text-rose-400 transition-colors"
              >
                {queueTab === 'active' ? 'Clear Waiting' :
                 queueTab === 'failed' ? 'Clear Failed' :
                 queueTab === 'cancelled' ? 'Clear Cancelled' :
                 queueTab === 'completed' ? 'Clear Completed' :
                 'Clear All'}
              </button>
            )}
          </div>
        </div>

        {/* Animated content area — re-mounts on tab change */}
        <div key={queueTab} className="flex flex-col gap-5 animate-tab-enter">

        {/* ── 1. ACTIVE DOWNLOADS SECTION ── */}
        {(queueTab === 'all' || queueTab === 'active') && activeDownloads.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Active Downloads
            </h3>

            <div className="flex flex-col gap-3">
              {activeDownloads.map((item) => {
                const pct = typeof item.progressPercent === 'number'
                  ? item.progressPercent
                  : (parseFloat(item.progressPercent) || 0);

                const isPaused = item.state === 'paused';
                const isMusic = (item.filename || '').endsWith('.mp3') || (item.filename || '').endsWith('.m4a');
                const isGallery = item.tool === 'gallery-dl' || (!item.limit && item.itemsDone > 0);
                const isIndeterminate = isGallery && (!item.limit || item.limit <= 0);

                return (
                  <div
                    key={item.id}
                    className="bg-surface-1 border border-border-subtle rounded-2xl p-4 flex flex-col gap-3 shadow-md hover:border-border transition-all"
                  >
                    <div className="flex items-center gap-3">
                      {/* Thumbnail or Music Icon */}
                      <div className="w-12 h-12 rounded-xl bg-surface-3 shrink-0 overflow-hidden flex items-center justify-center relative shadow-sm">
                        <MediaThumbnail
                          item={item}
                          className="w-full h-full object-cover"
                          iconClassName="w-5 h-5"
                        />
                        {(item.itemsDone > 1 || (item.files && item.files.length > 1)) && (
                          <div className="absolute bottom-0.5 right-0.5 px-1 py-0.2 rounded bg-black/85 backdrop-blur-xs text-[9px] font-bold text-white flex items-center gap-0.5 border border-white/10 shadow-sm">
                            <Layers className="w-2.5 h-2.5 text-brand-acc" />
                            <span>{item.itemsDone || item.files.length}</span>
                          </div>
                        )}
                      </div>

                      {/* Title & Specs */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-bold text-slate-100 truncate">
                            {item.filename || item.url}
                          </h4>
                          {item.url && (
                            <button
                              type="button"
                              onClick={() => api.openUrlExternal(item.url)}
                              className="text-slate-500 hover:text-brand-acc transition-colors p-0.5 shrink-0"
                              title="Open source link in browser"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">
                          {item.downloadedBytes
                            ? fmtBytes(item.downloadedBytes)
                            : item.sizeBytes
                              ? fmtBytes(item.sizeBytes)
                              : item.itemsDone > 0
                                ? `${item.itemsDone} file${item.itemsDone === 1 ? '' : 's'} downloaded`
                                : item.tool === 'gallery-dl'
                                  ? 'Gallery extractor running…'
                                  : 'Extracting stream…'}
                        </p>
                      </div>

                      {/* Pause & Cancel Controls */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isPaused ? (
                          <button
                            onClick={() => onResumeDownload(item.id)}
                            className="p-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-brand-acc transition-colors"
                            title="Resume"
                          >
                            <Play className="w-4 h-4 fill-current" />
                          </button>
                        ) : (
                          <button
                            onClick={() => onPauseDownload(item.jobId)}
                            className="p-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-slate-300 hover:text-white transition-colors"
                            title="Pause"
                          >
                            <Pause className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          onClick={() => onCancelDownload(item.id)}
                          className="p-2 rounded-xl bg-surface-2 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Emerald Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-surface-3 overflow-hidden">
                      {isIndeterminate ? (
                        <div className="h-full w-full bg-gradient-to-r from-brand-dim via-brand-acc to-brand-dim animate-pulse rounded-full" />
                      ) : (
                        <div
                          className="h-full bg-brand-acc transition-all duration-300 rounded-full"
                          style={{ width: `${Math.max(1, Math.min(100, pct))}%` }}
                        />
                      )}
                    </div>

                    {/* Progress Metrics */}
                    <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                      {isIndeterminate ? (
                        <>
                          <span className="text-brand-acc font-medium">
                            {item.itemsDone > 0
                              ? `${item.itemsDone} item${item.itemsDone === 1 ? '' : 's'} downloaded${item.downloadedBytes ? ` · ${fmtBytes(item.downloadedBytes)}` : ''}`
                              : 'Downloading media…'}
                          </span>
                          <span>{item.speedStr || 'Active'}</span>
                        </>
                      ) : (
                        <>
                          <span>{pct > 0 ? `${pct.toFixed(0)}% · ` : ''}{item.speedStr || (pct > 0 ? 'Downloading…' : 'Connecting…')}</span>
                          <span>{item.etaStr ? `${item.etaStr} left` : (item.downloadedBytes && item.totalBytes ? `${fmtBytes(item.downloadedBytes)} / ${fmtBytes(item.totalBytes)}` : '')}</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state when on Active tab and no active downloads */}
        {queueTab === 'active' && activeDownloads.length === 0 && (
          <div className="py-12 border border-dashed border-border-subtle rounded-2xl flex flex-col items-center justify-center text-slate-500 gap-2">
            <Download className="w-8 h-8 opacity-40 text-brand-acc" />
            <p className="text-xs font-medium">No active downloads in progress</p>
          </div>
        )}

        {/* ── 2. COMPLETED / FAILED / CANCELLED / HISTORY DOWNLOADS SECTION ── */}
        {queueTab !== 'active' && (
          <div className="flex flex-col gap-3 mt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {queueTab === 'all' && 'History & Finished Downloads'}
                {queueTab === 'completed' && 'Completed Downloads'}
                {queueTab === 'failed' && 'Failed Downloads'}
                {queueTab === 'cancelled' && 'Cancelled Downloads'}
              </h3>
            </div>

            {currentSectionDownloads.length === 0 ? (
              <div className="py-12 border border-dashed border-border-subtle rounded-2xl flex flex-col items-center justify-center text-slate-500 gap-2">
                {queueTab === 'failed' ? (
                  <>
                    <AlertTriangle className="w-8 h-8 opacity-40 text-rose-400" />
                    <p className="text-xs font-medium">No failed downloads</p>
                  </>
                ) : queueTab === 'cancelled' ? (
                  <>
                    <XCircle className="w-8 h-8 opacity-40 text-amber-400" />
                    <p className="text-xs font-medium">No cancelled downloads</p>
                  </>
                ) : (
                  <>
                    <Download className="w-8 h-8 opacity-40" />
                    <p className="text-xs font-medium">
                      {queueTab === 'completed' ? 'No completed downloads yet' : 'No downloads in history yet'}
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {currentSectionDownloads.map((item) => {
                  const firstFile = item.files?.[0];
                  const filePath = typeof firstFile === 'string' ? firstFile : firstFile?.path || '';
                  const isDone = item.state === 'done';
                  const isCancelled = item.state === 'cancelled';
                  const isError = item.state === 'error';
                  const hasFiles = item.files && item.files.length > 0;
                  const playable = playableFilesFor(item);
                  const galleries = galleryFilesFor(item);
                  const hasPlayable = playable.length > 0;
                  const hasGallery = galleries.length > 0;
                  const bundleInfo = getBundleInfo(item);

                  return (
                    <div
                      key={item.id}
                      className="bg-surface-1 border border-border-subtle hover:border-border rounded-2xl p-3 px-4 flex items-center justify-between gap-4 transition-all hover:bg-surface-2 group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        {/* Thumbnail / Icon */}
                        <div className="w-11 h-11 rounded-xl bg-surface-3 shrink-0 overflow-hidden flex items-center justify-center relative shadow-sm">
                          <MediaThumbnail
                            item={item}
                            className="w-full h-full object-cover"
                            iconClassName="w-4 h-4"
                          />
                          {bundleInfo.count > 1 && (
                            <div className="absolute bottom-0.5 right-0.5 px-1 py-0.2 rounded bg-black/85 backdrop-blur-xs text-[9px] font-bold text-white flex items-center gap-0.5 border border-white/10 shadow-sm">
                              {bundleInfo.isImageBundle ? (
                                <Layers className="w-2.5 h-2.5 text-brand-acc" />
                              ) : bundleInfo.isVideoBundle ? (
                                <ListVideo className="w-2.5 h-2.5 text-sky-400" />
                              ) : bundleInfo.isAudioBundle ? (
                                <ListMusic className="w-2.5 h-2.5 text-purple-400" />
                              ) : (
                                <Layers className="w-2.5 h-2.5 text-amber-400" />
                              )}
                              <span>{bundleInfo.count}</span>
                            </div>
                          )}
                        </div>

                        {/* Title & Info */}
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-semibold text-slate-100 truncate group-hover:text-brand-acc transition-colors">
                            {item.filename || item.url}
                          </span>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-0.5">
                            {isDone && (
                              <>
                                <span>{fmtBytes(item.sizeBytes || item.downloadedBytes)}</span>
                                <span>•</span>
                                <span className="text-brand-acc font-medium">
                                  Completed {item.finishedAt ? fmtDate(item.finishedAt) : ''}
                                </span>
                                {bundleInfo.count > 1 && (
                                  <>
                                    <span>•</span>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-surface-3 text-slate-200 border border-white/10">
                                      {bundleInfo.isImageBundle ? (
                                        <Layers className="w-3 h-3 text-brand-acc" />
                                      ) : bundleInfo.isVideoBundle ? (
                                        <ListVideo className="w-3 h-3 text-sky-400" />
                                      ) : bundleInfo.isAudioBundle ? (
                                        <ListMusic className="w-3 h-3 text-purple-400" />
                                      ) : (
                                        <Layers className="w-3 h-3 text-amber-400" />
                                      )}
                                      {bundleInfo.count} {bundleInfo.isImageBundle ? 'photos' : bundleInfo.isVideoBundle ? 'videos' : bundleInfo.isAudioBundle ? 'tracks' : 'items'}
                                    </span>
                                  </>
                                )}
                              </>
                            )}
                            {isCancelled && (
                              <>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                  Cancelled
                                </span>
                                {hasFiles && (
                                  <>
                                    <span>•</span>
                                    <span className="text-slate-300 font-medium">
                                      {item.files.length} file{item.files.length === 1 ? '' : 's'} saved ({fmtBytes(item.sizeBytes || item.downloadedBytes)})
                                    </span>
                                  </>
                                )}
                                <span>•</span>
                                <span>{item.finishedAt ? fmtDate(item.finishedAt) : ''}</span>
                              </>
                            )}
                            {isError && (
                              <>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                  Failed
                                </span>
                                <span>•</span>
                                <span className="text-rose-300/90 font-medium truncate max-w-[280px]" title={item.error}>
                                  {friendlyError(item.error)}
                                </span>
                                {hasFiles && (
                                  <>
                                    <span>•</span>
                                    <span className="text-slate-300 font-medium">
                                      {item.files.length} file{item.files.length === 1 ? '' : 's'} saved
                                    </span>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions: Retry/Redownload, Play/Gallery, Open Folder, Open Link, Delete */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Retry / Redownload button */}
                        <button
                          onClick={() => onRetryDownload(item.id)}
                          className="p-2 rounded-xl bg-surface-2 hover:bg-brand-dim text-slate-300 hover:text-brand-acc transition-colors flex items-center gap-1 text-xs font-medium"
                          title={isDone ? "Redownload media" : "Retry download"}
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span className="hidden sm:inline">{isDone ? "Redownload" : "Retry"}</span>
                        </button>

                        {/* Play / Gallery button if files exist */}
                        {hasPlayable ? (
                          <button
                            onClick={() => onOpenPlayer(playable, item.filename)}
                            className="p-2 rounded-xl bg-surface-2 hover:bg-brand-dim text-brand-acc transition-colors"
                            title="Play downloaded media"
                          >
                            <Play className="w-4 h-4 fill-current" />
                          </button>
                        ) : hasGallery ? (
                          <button
                            onClick={() => onOpenGallery(item)}
                            className="p-2 rounded-xl bg-surface-2 hover:bg-brand-dim text-brand-acc transition-colors"
                            title="View gallery images"
                          >
                            <Image className="w-4 h-4" />
                          </button>
                        ) : filePath ? (
                          <button
                            onClick={() => api.openFile(filePath)}
                            className="p-2 rounded-xl bg-surface-2 hover:bg-brand-dim text-slate-300 hover:text-brand-acc transition-colors"
                            title="Open file"
                          >
                            <Play className="w-4 h-4 fill-current" />
                          </button>
                        ) : null}

                        {/* Folder button */}
                        <button
                          onClick={() => {
                            const target = filePath || item.outputDir || item.output_dir;
                            if (target) {
                              api.openOutputFolder(target);
                            }
                          }}
                          className="p-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-slate-400 hover:text-white transition-colors"
                          title="Open containing folder"
                        >
                          <Folder className="w-4 h-4" />
                        </button>

                        {/* Open source link in browser */}
                        {item.url && (
                          <button
                            type="button"
                            onClick={() => api.openUrlExternal(item.url)}
                            className="p-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-slate-400 hover:text-white transition-colors"
                            title="Open download link in browser"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        )}

                        {/* Delete button */}
                        <button
                          onClick={() => onDeleteDownload(item.id)}
                          className="p-2 rounded-xl bg-surface-2 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                          title="Remove from history"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        </div>{/* end keyed tab-enter wrapper */}
      </div>{/* end Screen 3 */}
      </div>{/* end scrollable inner */}
      </div>{/* end overflow-y-auto */}
    </div>
  );
}
