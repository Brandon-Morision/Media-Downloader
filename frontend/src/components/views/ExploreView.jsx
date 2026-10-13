import React, { useState, useEffect } from 'react';
import {
  Search, Compass, Download, Play, Clock, Sparkles, AlertCircle,
  ExternalLink, Film, Music, X, Check, ShieldCheck, ArrowRight,
  Image, Layers
} from 'lucide-react';
import {
  fmtViews, fmtDuration, fmtBytes,
  isLikelyUrl, normalizeUrl, detectTool, toolLabel
} from '../../lib/formatters';
import { api } from '../../lib/api';

const FORMAT_PRESETS = [
  { id: 'video-best', type: 'video', format: 'best', quality: 'best', label: 'Best Video', sub: 'Highest resolution available (MP4)', icon: Film },
  { id: 'video-1080', type: 'video', format: '1080p', quality: '1080', label: '1080p HD', sub: 'Standard Full HD (MP4)', icon: Film },
  { id: 'audio-mp3', type: 'audio', format: 'mp3', quality: 'best', label: 'MP3 Audio', sub: '320kbps High Quality Audio', icon: Music },
  { id: 'audio-m4a', type: 'audio', format: 'm4a', quality: 'best', label: 'M4A Audio', sub: 'Fast Apple AAC Audio stream', icon: Music },
  { id: 'audio-flac', type: 'audio', format: 'flac', quality: 'best', label: 'Lossless FLAC', sub: 'Studio quality lossless compression', icon: Music },
  { id: 'auto', type: 'auto', format: 'auto', quality: 'best', label: 'Auto (Best)', sub: 'Default extractor resolution', icon: Sparkles },
];

export default function ExploreView({
  searchResults = [],
  isSearching = false,
  searchError = '',
  onSearch,
  onClearSearch,
  initialSearchQuery = '',
  onClearInitialSearchQuery,
  initialAnalyzeUrl = '',
  onClearInitialAnalyzeUrl,
  onAddDownload,
  onOpenPlayer,
  onSwitchToDownloader,
  onShowToast,
}) {
  const [query, setQuery] = useState(initialSearchQuery || initialAnalyzeUrl || '');
  const [activeSearchQuery, setActiveSearchQuery] = useState(initialSearchQuery || '');
  const [limit, setLimit] = useState(12);
  const [recentSearches, setRecentSearches] = useState([]);

  // Link analysis state (for pasted media links)
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedData, setAnalyzedData] = useState(null);
  const [analyzeError, setAnalyzeError] = useState('');
  const [selectedFormatType, setSelectedFormatType] = useState('video'); // video | audio | image
  const [selectedQualityId, setSelectedQualityId] = useState('1080p');
  const [galleryLimit, setGalleryLimit] = useState(0);

  // Result card inline state
  const [resultFormats, setResultFormats] = useState({});
  const [queuedIds, setQueuedIds] = useState(new Set());

  // Detailed Format Picker Dialog state (Inspect Streams)
  const [selectedItem, setSelectedItem] = useState(null);
  const [chosenPreset, setChosenPreset] = useState('video-best');
  const [sponsorblock, setSponsorblock] = useState(false);

  // Register push listener for link preview
  useEffect(() => {
    window.onLinkPreview = (reqId, res) => {
      setIsAnalyzing(false);
      if (res?.ok) {
        setAnalyzedData(res);
        setAnalyzeError('');
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

  useEffect(() => {
    loadRecentSearches();
  }, []);

  // Handle query passed from HomeView
  useEffect(() => {
    if (initialSearchQuery) {
      setQuery(initialSearchQuery);
      setActiveSearchQuery(initialSearchQuery);
      if (onClearInitialSearchQuery) onClearInitialSearchQuery();
    }
  }, [initialSearchQuery, onClearInitialSearchQuery]);

  // Handle URL passed from HomeView for inspection
  useEffect(() => {
    if (initialAnalyzeUrl) {
      const text = initialAnalyzeUrl.trim();
      if (text) {
        setQuery(text);
        if (isLikelyUrl(text)) {
          handleAnalyze(normalizeUrl(text));
        } else {
          executeSearch(text);
        }
      }
      if (onClearInitialAnalyzeUrl) onClearInitialAnalyzeUrl();
    }
  }, [initialAnalyzeUrl, onClearInitialAnalyzeUrl]);

  const loadRecentSearches = async () => {
    try {
      const res = await api.listSearches();
      if (res?.ok && res.queries) {
        setRecentSearches(res.queries.slice(0, 8));
      }
    } catch {}
  };

  const handleAnalyze = async (targetUrl) => {
    const link = (targetUrl || query).trim();
    if (!link) return;
    const norm = normalizeUrl(link);
    setIsAnalyzing(true);
    setAnalyzeError('');
    setAnalyzedData(null);
    if (onClearSearch) onClearSearch();
    setActiveSearchQuery('');

    try {
      await api.previewLink(norm);
    } catch (e) {
      setIsAnalyzing(false);
      setAnalyzeError(e.message || 'Failed to inspect link');
    }
  };

  const handlePaste = async () => {
    let text = '';
    try {
      text = await navigator.clipboard.readText();
    } catch {}
    if (!text || !text.trim()) {
      try {
        const clipRes = await api.readClipboard();
        if (clipRes?.ok && clipRes.text) {
          text = clipRes.text;
        }
      } catch {}
    }
    if (text && text.trim()) {
      const trimmed = text.trim();
      setQuery(trimmed);
      if (isLikelyUrl(trimmed)) {
        handleAnalyze(normalizeUrl(trimmed));
      }
    }
  };

  const executeSearch = (targetQuery) => {
    const q = (targetQuery || query).trim();
    if (!q) return;
    if (isLikelyUrl(q)) {
      handleAnalyze(normalizeUrl(q));
      return;
    }
    setAnalyzedData(null);
    setAnalyzeError('');
    setActiveSearchQuery(q);
    if (onSearch) {
      onSearch(q, limit);
    }
    api.saveSearch(q).then(loadRecentSearches).catch(() => {});
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    executeSearch(query);
  };

  const handleChipClick = (q) => {
    setQuery(q);
    executeSearch(q);
  };

  const handleClearSearches = async () => {
    await api.clearSearches();
    setRecentSearches([]);
  };

  const handleClearResults = () => {
    if (onClearSearch) onClearSearch();
    setActiveSearchQuery('');
    setQuery('');
  };

  const handleStartDownloadFromAnalysis = () => {
    const rawUrl = analyzedData?.url || query.trim();
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

    setAnalyzedData(null);
    setQuery('');
    if (onShowToast) onShowToast(`Queued ${toolLabel(tool)} download (${tool})`);
    if (onSwitchToDownloader) onSwitchToDownloader();
  };

  const qualityOptions = (analyzedData?.available_qualities && analyzedData.available_qualities.length > 0)
    ? analyzedData.available_qualities.filter((q) => q.type === selectedFormatType)
    : selectedFormatType === 'audio'
      ? [
          { id: '320k', label: '320 kbps (Best)', ext: 'MP3' },
          { id: '256k', label: '256 kbps', ext: 'MP3' },
          { id: '192k', label: '192 kbps', ext: 'MP3' },
          { id: '128k', label: '128 kbps', ext: 'MP3' },
        ]
      : [
          { id: '1080p', label: '1080p (Full HD)', ext: 'MP4' },
          { id: '720p', label: '720p (HD)', ext: 'MP4' },
          { id: '480p', label: '480p (SD)', ext: 'MP4' },
          { id: '360p', label: '360p', ext: 'MP4' },
        ];

  const handleDownloadResult = (item, chosenFormat) => {
    const fmt = chosenFormat || resultFormats[item.id] || 'mp4';
    onAddDownload(item.url, {
      tool: 'yt-dlp',
      format: fmt,
      quality: 'best',
      title: item.title,
    });
    setQueuedIds((prev) => new Set([...prev, item.id]));
    if (onShowToast) {
      onShowToast(`Queued "${item.title.slice(0, 30)}…" as ${fmt.toUpperCase()}`);
    }
  };

  const handleOpenFormatModal = (item) => {
    setSelectedItem(item);
    setChosenPreset('video-best');
  };

  const handleConfirmDownloadModal = (andSwitch = false) => {
    if (!selectedItem) return;
    const preset = FORMAT_PRESETS.find((p) => p.id === chosenPreset) || FORMAT_PRESETS[0];

    onAddDownload(selectedItem.url, {
      tool: 'yt-dlp',
      format: preset.format,
      quality: preset.quality,
      sponsorblock,
      title: selectedItem.title,
    });

    setQueuedIds((prev) => new Set([...prev, selectedItem.id]));

    if (onShowToast) {
      onShowToast(`Queued "${selectedItem.title.slice(0, 32)}…" as ${preset.label}`);
    }

    setSelectedItem(null);

    if (andSwitch && onSwitchToDownloader) {
      onSwitchToDownloader();
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 select-none">
      {/* ── PERSISTENT STICKY TOP SEARCH BAR ── */}
      <div className="sticky top-0 z-20 shrink-0 px-6 pt-6 pb-2 bg-surface-0 flex flex-col gap-3 w-full">
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 bg-surface-2/90 border border-border-subtle hover:border-border rounded-xl p-1.5 pl-3.5 shadow-md focus-within:border-brand-acc focus-within:shadow-glow transition-all"
        >
          <Search className="w-4 h-4 text-sky-400 shrink-0 pointer-events-none" />

          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search YouTube videos, tracks, podcasts, creators…"
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none pr-2"
          />

          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
              title="Clear input"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={handlePaste}
            className="px-3 py-1.5 rounded-lg bg-surface-3 hover:bg-surface-4 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
          >
            Paste
          </button>

          {/* Result limit selector */}
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="bg-surface-3 hover:bg-surface-4 border border-border-subtle text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-brand-acc transition-colors cursor-pointer hidden sm:block"
            title="Max results to fetch"
          >
            <option value={12}>12 Results</option>
            <option value={20}>20 Results</option>
            <option value={30}>30 Results</option>
          </select>

          {/* Search Button */}
          <button
            type="submit"
            disabled={!query.trim() || isSearching}
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
        </form>

        {/* Recent Searches row */}
        {recentSearches.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
            <span className="text-slate-500 text-[11px] mr-1">Recent:</span>
            {recentSearches.map((item, idx) => {
              const qText = typeof item === 'string' ? item : item.query || '';
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleChipClick(qText)}
                  className="px-2.5 py-0.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-slate-300 hover:text-white border border-border-subtle text-[11px] transition-colors"
                >
                  {qText}
                </button>
              );
            })}
            <button
              type="button"
              onClick={handleClearSearches}
              className="text-slate-500 hover:text-rose-400 text-[11px] ml-auto transition-colors"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* ── SCROLLABLE RESULTS AREA ── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto px-6 pb-6 pt-2 gap-6">
        {/* ── LINK ANALYSIS ERROR ALERT ── */}
        {analyzeError && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex items-center justify-between gap-3 text-rose-300 text-xs shadow-md shrink-0">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{analyzeError}</span>
            </div>
            <button
              type="button"
              onClick={() => setAnalyzeError('')}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── LINK ANALYSIS CARD (For pasted URLs) ── */}
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
                type="button"
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
                  {detectTool(query) === 'gallery-dl'
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

        {/* ── YOUTUBE SEARCH RESULTS SECTION ── */}
        {(isSearching || (searchResults && searchResults.length > 0) || searchError) && (
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
                {searchResults && searchResults.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-3 text-slate-300 border border-border-subtle">
                    {searchResults.length} videos
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleClearResults}
                className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs"
                title="Close search results"
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">Close</span>
              </button>
            </div>

            {/* Loading Skeletons */}
            {isSearching && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 py-2">
                {[...Array(limit || 8)].map((_, i) => (
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
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-center text-slate-400">
                <AlertCircle className="w-8 h-8 text-amber-400/80" />
                <p className="text-sm font-medium text-slate-300">{searchError}</p>
                <p className="text-xs text-slate-500">Try searching with a different term or keyword</p>
              </div>
            )}

            {/* Results Grid */}
            {!isSearching && searchResults && searchResults.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                          onClick={() => handleOpenFormatModal(r)}
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
                            onClick={() => handleOpenFormatModal(r)}
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
                            onClick={() => handleDownloadResult(r, currentFmt)}
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

        {/* Empty / Discovery Hero */}
        {!(analyzedData || isAnalyzing || analyzeError || isSearching || (searchResults && searchResults.length > 0) || searchError) && (
          <div className="flex-1 flex flex-col items-center justify-center py-24 text-slate-500 gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shadow-lg">
              <Compass className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-200">Discover &amp; Download Media</h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Search any YouTube video, track, podcast, or creator above, or paste any media URL to inspect details and choose formats before downloading.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Advanced Format & Quality Selection Modal ── */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-1 rounded-2xl border border-border-highlight/50 shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-4 bg-surface-2 border-b border-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-brand-dim text-brand-acc flex items-center justify-center shrink-0">
                  <Download className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">Choose Download Format</h3>
                  <p className="text-[11px] text-slate-400 truncate max-w-xs">{selectedItem.title}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-surface-3 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video preview strip */}
            <div className="p-4 bg-surface-0/60 border-b border-border-subtle/50 flex items-center gap-3">
              <img
                src={selectedItem.thumbnail}
                alt=""
                className="w-20 aspect-video rounded-lg object-cover border border-border-subtle shrink-0"
              />
              <div className="flex flex-col min-w-0">
                <div className="text-xs font-semibold text-slate-200 line-clamp-1">{selectedItem.title}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{selectedItem.channel}</div>
              </div>
            </div>

            {/* Presets List */}
            <div className="p-4 flex flex-col gap-2 max-h-[300px] overflow-y-auto">
              {FORMAT_PRESETS.map((p) => {
                const IconComponent = p.icon;
                const isSelected = chosenPreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setChosenPreset(p.id)}
                    className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                      isSelected
                        ? 'bg-surface-3 border-brand-border shadow-glow ring-1 ring-brand-acc text-white'
                        : 'bg-surface-2 border-border-subtle hover:bg-surface-3/50 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-brand-acc text-white' : 'bg-surface-1 text-slate-400'
                      }`}>
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold">{p.label}</span>
                        <span className="text-[10.5px] text-slate-400 truncate">{p.sub}</span>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-brand-acc shrink-0" />}
                  </button>
                );
              })}

              {/* SponsorBlock Option */}
              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-2 border border-border-subtle/60 cursor-pointer text-xs text-slate-300 hover:text-white mt-1">
                <input
                  type="checkbox"
                  checked={sponsorblock}
                  onChange={(e) => setSponsorblock(e.target.checked)}
                  className="rounded bg-surface-1 border-border-subtle text-brand-acc focus:ring-0 cursor-pointer"
                />
                <ShieldCheck className={`w-4 h-4 ${sponsorblock ? 'text-brand-acc' : 'text-slate-500'}`} />
                <span className="text-[11.5px]">Remove sponsor segments &amp; intros (SponsorBlock)</span>
              </label>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-surface-2 border-t border-border-subtle flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDownloadModal(false)}
                className="px-4 py-2 rounded-xl bg-surface-3 hover:bg-surface-4 text-slate-200 border border-border-subtle text-xs font-medium transition-colors"
              >
                Add to Queue
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDownloadModal(true)}
                className="px-4 py-2 rounded-xl bg-brand-acc hover:opacity-90 text-white text-xs font-semibold shadow-glow flex items-center gap-1.5 transition-all"
              >
                <span>Download &amp; View</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
