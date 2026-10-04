import React, { useState, useEffect } from 'react';
import {
  Search, Compass, Download, Play, Clock, Eye, Trash2, Sparkles,
  ExternalLink, Film, Music, X, Check, ShieldCheck, ArrowRight
} from 'lucide-react';
import { fmtViews, fmtDuration } from '../../lib/formatters';
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
  searchResults,
  isSearching,
  searchError,
  onSearch,
  onAddDownload,
  onOpenPlayer,
  onSwitchToDownloader,
  onShowToast,
}) {
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(12);
  const [recentSearches, setRecentSearches] = useState([]);
  
  // Format Picker Dialog state
  const [selectedItem, setSelectedItem] = useState(null);
  const [chosenPreset, setChosenPreset] = useState('video-best');
  const [sponsorblock, setSponsorblock] = useState(false);

  useEffect(() => {
    loadRecentSearches();
  }, []);

  const loadRecentSearches = async () => {
    try {
      const res = await api.listSearches();
      if (res?.ok && res.queries) {
        setRecentSearches(res.queries.slice(0, 8));
      }
    } catch {}
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim(), limit);
      api.saveSearch(query.trim()).then(loadRecentSearches);
    }
  };

  const handleChipClick = (q) => {
    setQuery(q);
    onSearch(q, limit);
  };

  const handleClearSearches = async () => {
    await api.clearSearches();
    setRecentSearches([]);
  };

  const handleOpenFormatModal = (item) => {
    setSelectedItem(item);
    setChosenPreset('video-best');
  };

  const handleConfirmDownload = (andSwitch = false) => {
    if (!selectedItem) return;
    const preset = FORMAT_PRESETS.find((p) => p.id === chosenPreset) || FORMAT_PRESETS[0];
    
    onAddDownload(selectedItem.url, {
      format: preset.format,
      quality: preset.quality,
      sponsorblock,
      title: selectedItem.title,
    });

    if (onShowToast) {
      onShowToast(`Queued "${selectedItem.title.slice(0, 32)}…" as ${preset.label}`);
    }

    setSelectedItem(null);

    if (andSwitch && onSwitchToDownloader) {
      onSwitchToDownloader();
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto px-6 py-5 gap-5">
      {/* ── Search Bar & Recent Searches Card ── */}
      <div className="glass-panel-elevated rounded-2xl p-5 border border-border-highlight/40 flex flex-col gap-3">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="relative flex-1 flex items-center">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search YouTube videos, tracks, podcasts, creators…"
              className="w-full h-11 pl-10 pr-24 rounded-xl bg-surface-1 border border-border-subtle text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-brand-acc focus:ring-1 focus:ring-brand-acc transition-all"
            />
          </div>

          {/* Limit selector */}
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="h-11 px-3 rounded-xl bg-surface-2 border border-border-subtle text-slate-300 text-xs focus:outline-none focus:border-brand-acc cursor-pointer"
          >
            <option value={12}>12 Results</option>
            <option value={20}>20 Results</option>
            <option value={30}>30 Results</option>
          </select>

          <button
            type="submit"
            disabled={!query.trim() || isSearching}
            className="h-11 px-5 rounded-xl bg-brand-acc hover:opacity-90 disabled:opacity-40 text-white font-semibold text-sm flex items-center gap-2 shadow-glow transition-all shrink-0"
          >
            <Compass className="w-4 h-4" />
            <span>{isSearching ? 'Searching…' : 'Explore'}</span>
          </button>
        </form>

        {/* Recent Searches row */}
        {recentSearches.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border-subtle/40 text-xs">
            <span className="text-slate-500 text-[11px] mr-1">Recent:</span>
            {recentSearches.map((item, idx) => {
              const qText = typeof item === 'string' ? item : item.query || '';
              return (
                <button
                  key={idx}
                  onClick={() => handleChipClick(qText)}
                  className="px-2.5 py-1 rounded-lg bg-surface-2 hover:bg-surface-3 text-slate-300 hover:text-white border border-border-subtle text-[11px] transition-colors"
                >
                  {qText}
                </button>
              );
            })}
            <button
              onClick={handleClearSearches}
              className="text-slate-500 hover:text-rose-400 text-[11px] ml-auto"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* ── Search Results / Skeletons ── */}
      {isSearching ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-pulse">
          {Array.from({ length: limit }).map((_, i) => (
            <div key={i} className="glass-panel rounded-2xl overflow-hidden p-3 flex flex-col gap-2">
              <div className="w-full aspect-video bg-surface-3 rounded-xl" />
              <div className="h-4 bg-surface-3 rounded w-3/4" />
              <div className="h-3 bg-surface-3 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : searchError ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <Compass className="w-10 h-10 opacity-30 text-rose-400" />
          <span className="text-sm">{searchError}</span>
        </div>
      ) : searchResults && searchResults.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {searchResults.map((item) => (
            <div
              key={item.id}
              className="glass-panel rounded-2xl overflow-hidden border border-border-subtle hover:border-brand-border flex flex-col transition-all duration-200 hover:-translate-y-1 hover:shadow-xl group"
            >
              {/* Thumbnail with duration overlay */}
              <div className="w-full aspect-video bg-black relative overflow-hidden">
                <img
                  src={item.thumbnail}
                  alt={item.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                {item.duration && (
                  <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-white text-[10px] font-mono font-medium">
                    {fmtDuration(item.duration)}
                  </span>
                )}
              </div>

              {/* Video metadata */}
              <div className="p-3.5 flex flex-col gap-2 flex-1">
                <h4
                  className="text-xs font-semibold text-slate-100 line-clamp-2 leading-relaxed"
                  title={item.title}
                >
                  {item.title}
                </h4>

                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-auto">
                  <span className="truncate max-w-[140px] text-slate-300">{item.channel}</span>
                  {item.views && <span>{fmtViews(item.views)}</span>}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="px-3.5 pb-3 pt-1 flex items-center gap-2 border-t border-border-subtle/40">
                <button
                  onClick={() => handleOpenFormatModal(item)}
                  className="flex-1 h-8 rounded-xl bg-brand-acc text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-glow hover:opacity-90 transition-opacity"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>

                <button
                  onClick={() => api.openUrlExternal(item.url)}
                  className="h-8 px-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-slate-300 hover:text-white border border-border-subtle text-xs transition-colors"
                  title="Open in browser"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center py-24 text-slate-500 gap-3">
          <Compass className="w-12 h-12 opacity-20 text-brand-acc" />
          <div className="text-center">
            <h4 className="text-sm font-semibold text-slate-300">Discover &amp; Download Media</h4>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              Search any video or music track above to inspect details and choose video or audio formats before downloading.
            </p>
          </div>
        </div>
      )}

      {/* ── Format & Quality Selection Modal ── */}
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
                onClick={() => setSelectedItem(null)}
                className="px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleConfirmDownload(false)}
                className="px-4 py-2 rounded-xl bg-surface-3 hover:bg-surface-4 text-slate-200 border border-border-subtle text-xs font-medium transition-colors"
              >
                Add to Queue
              </button>
              <button
                onClick={() => handleConfirmDownload(true)}
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
