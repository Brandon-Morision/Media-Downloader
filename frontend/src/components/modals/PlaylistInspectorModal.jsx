import React, { useState, useEffect } from 'react';
import {
  ListMusic, X, CheckSquare, Square, Check,
  Download, Clock, User, Filter, AlertCircle
} from 'lucide-react';
import { fmtDuration } from '../../lib/formatters';

export default function PlaylistInspectorModal({
  isOpen,
  onClose,
  playlistData,
  isLoading,
  error,
  onDownloadSelected,
}) {
  const entries = playlistData?.entries || [];
  const [selectedIndices, setSelectedIndices] = useState(new Set());
  const [rangeInput, setRangeInput] = useState('');
  const [format, setFormat] = useState('auto');
  const [downloadMode, setDownloadMode] = useState('individual'); // individual | bundle

  // Select all tracks by default when playlist loads
  useEffect(() => {
    if (entries.length > 0) {
      setSelectedIndices(new Set(entries.map((_, i) => i)));
    }
  }, [playlistData]);

  const toggleTrack = (index) => {
    const next = new Set(selectedIndices);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setSelectedIndices(next);
  };

  const selectAll = () => setSelectedIndices(new Set(entries.map((_, i) => i)));
  const deselectAll = () => setSelectedIndices(new Set());
  const invertSelection = () => {
    const next = new Set();
    entries.forEach((_, i) => {
      if (!selectedIndices.has(i)) next.add(i);
    });
    setSelectedIndices(next);
  };

  const applyRange = () => {
    if (!rangeInput.trim()) return;
    const parts = rangeInput.split(',').map((p) => p.trim());
    const next = new Set();

    parts.forEach((part) => {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map((n) => parseInt(n.trim(), 10));
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
            if (i >= 1 && i <= entries.length) next.add(i - 1);
          }
        }
      } else {
        const num = parseInt(part, 10);
        if (!isNaN(num) && num >= 1 && num <= entries.length) {
          next.add(num - 1);
        }
      }
    });

    setSelectedIndices(next);
  };

  const handleDownload = () => {
    const chosenTracks = entries.filter((_, i) => selectedIndices.has(i));
    if (!chosenTracks.length) return;

    onDownloadSelected({
      tracks: chosenTracks,
      playlistUrl: playlistData?.url,
      mode: downloadMode,
      format,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-4xl h-[85vh] bg-surface-1 rounded-2xl border border-border-highlight/50 shadow-2xl flex flex-col overflow-hidden relative">
        {/* Header */}
        <div className="p-4 bg-surface-2 border-b border-border-subtle flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-brand-dim text-brand-acc flex items-center justify-center border border-brand-border shrink-0 shadow-glow">
              <ListMusic className="w-5 h-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <h3 className="text-sm font-bold text-slate-100 truncate" title={playlistData?.title || 'Inspecting Playlist'}>
                {playlistData?.title || 'Inspecting Playlist…'}
              </h3>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                {playlistData?.uploader && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    <span>{playlistData.uploader}</span>
                  </span>
                )}
                <span>·</span>
                <span>{entries.length} items total</span>
              </div>
            </div>
          </div>

          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-surface-3">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar & Selectors */}
        <div className="p-3 bg-surface-1 border-b border-border-subtle flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          {/* Quick Selection Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={selectAll}
              className="px-2.5 py-1 rounded-lg bg-surface-2 hover:bg-surface-3 text-slate-300 border border-border-subtle transition-colors"
            >
              Select All
            </button>
            <button
              onClick={deselectAll}
              className="px-2.5 py-1 rounded-lg bg-surface-2 hover:bg-surface-3 text-slate-300 border border-border-subtle transition-colors"
            >
              Deselect All
            </button>
            <button
              onClick={invertSelection}
              className="px-2.5 py-1 rounded-lg bg-surface-2 hover:bg-surface-3 text-slate-300 border border-border-subtle transition-colors"
            >
              Invert
            </button>
          </div>

          {/* Range Specifier */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px] hidden sm:inline">Range:</span>
            <input
              type="text"
              value={rangeInput}
              onChange={(e) => setRangeInput(e.target.value)}
              placeholder="e.g. 1-5, 8, 12"
              className="h-7 w-28 px-2 rounded-lg bg-surface-2 border border-border-subtle text-slate-200 text-xs focus:outline-none focus:border-brand-acc font-mono"
            />
            <button
              onClick={applyRange}
              className="h-7 px-2.5 rounded-lg bg-surface-3 hover:bg-surface-4 text-slate-200 text-xs transition-colors"
            >
              Apply
            </button>
          </div>

          {/* Selected count pill */}
          <div className="px-2.5 py-1 rounded-full bg-brand-dim text-brand-acc border border-brand-border font-mono font-medium text-[11px]">
            {selectedIndices.size} of {entries.length} selected
          </div>
        </div>

        {/* Track List View */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-1.5 min-h-0">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
              <div className="w-8 h-8 border-2 border-brand-acc border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-mono">Extracting playlist entries via yt-dlp…</span>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-rose-400 gap-3">
              <AlertCircle className="w-8 h-8" />
              <span className="text-xs">{error}</span>
            </div>
          ) : (
            entries.map((track, i) => {
              const isSelected = selectedIndices.has(i);
              return (
                <div
                  key={track.index || i}
                  onClick={() => toggleTrack(i)}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer select-none transition-all ${
                    isSelected
                      ? 'bg-surface-2 border-brand-border shadow-sm'
                      : 'bg-surface-1 border-border-subtle opacity-70 hover:opacity-100 hover:bg-surface-2/60'
                  }`}
                >
                  {/* Checkbox */}
                  <button type="button" className="text-brand-acc shrink-0">
                    {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-slate-500" />}
                  </button>

                  <span className="text-[11px] font-mono text-slate-500 w-6 text-right shrink-0">
                    #{track.index || i + 1}
                  </span>

                  {/* Thumbnail */}
                  {track.thumbnail && (
                    <img
                      src={track.thumbnail}
                      alt=""
                      className="w-14 h-9 rounded-md object-cover bg-black shrink-0"
                    />
                  )}

                  {/* Title and Channel */}
                  <div className="flex-1 min-w-0 flex flex-col">
                    <span className="text-xs font-medium text-slate-200 truncate">{track.title}</span>
                    {track.uploader && <span className="text-[10.5px] text-slate-400 truncate">{track.uploader}</span>}
                  </div>

                  {/* Duration */}
                  {track.duration && (
                    <span className="text-[11px] font-mono text-slate-400 shrink-0">
                      {fmtDuration(track.duration)}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-surface-2 border-t border-border-subtle flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            {/* Format choice */}
            <div className="flex items-center gap-1.5 text-xs text-slate-300">
              <span>Format:</span>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="h-8 px-2 rounded-lg bg-surface-3 border border-border-subtle text-slate-200 text-xs focus:outline-none cursor-pointer"
              >
                <option value="auto">Auto Video</option>
                <option value="mp3">Audio (MP3)</option>
                <option value="m4a">Audio (M4A)</option>
              </select>
            </div>

            {/* Mode choice */}
            <div className="flex items-center gap-1.5 text-xs text-slate-300">
              <span>Download as:</span>
              <select
                value={downloadMode}
                onChange={(e) => setDownloadMode(e.target.value)}
                className="h-8 px-2 rounded-lg bg-surface-3 border border-border-subtle text-slate-200 text-xs focus:outline-none cursor-pointer"
              >
                <option value="individual">Separate Queue Items ({selectedIndices.size})</option>
                <option value="bundle">Bundled Playlist Job</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white">
              Cancel
            </button>
            <button
              onClick={handleDownload}
              disabled={selectedIndices.size === 0}
              className="px-5 py-2 rounded-xl bg-brand-acc text-white text-xs font-semibold shadow-glow hover:opacity-90 disabled:opacity-40 flex items-center gap-2 transition-opacity"
            >
              <Download className="w-4 h-4" />
              <span>Queue {selectedIndices.size} Tracks</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
