import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Layers, X, Upload, Folder, AlertCircle } from 'lucide-react';
import { parseBatchUrls } from '../../utils/parseBatchUrls';
import { api } from '../../lib/api';

const FORMAT_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: '1080p', label: 'Video · 1080p HD' },
  { value: '720p', label: 'Video · 720p' },
  { value: '480p', label: 'Video · 480p' },
  { value: 'best', label: 'Video · Best quality' },
  { value: 'mp3', label: 'Audio · MP3' },
  { value: 'm4a', label: 'Audio · M4A' },
  { value: 'flac', label: 'Audio · FLAC' },
];

const RATE_LIMIT_OPTIONS = [
  { value: '', label: 'Unlimited' },
  { value: '500K', label: '500 KB/s' },
  { value: '1M', label: '1 MB/s' },
  { value: '2M', label: '2 MB/s' },
  { value: '5M', label: '5 MB/s' },
  { value: '10M', label: '10 MB/s' },
];

export default function BatchPasteModal({
  isOpen,
  onClose,
  outputDir,
  onBatchSubmit,
}) {
  const [rawText, setRawText] = useState('');
  const [format, setFormat] = useState('auto');
  const [rateLimit, setRateLimit] = useState('');
  const [customFolder, setCustomFolder] = useState('');
  const outputFolder = customFolder || outputDir || '~/Downloads/media';
  const [sponsorblock, setSponsorblock] = useState(false);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  const modalRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Parse URLs with pure utility
  const parsed = useMemo(() => parseBatchUrls(rawText), [rawText]);

  // Trap focus and handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const previousActiveElement = document.activeElement;
    const timer = setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        if (!modalRef.current) return;
        const focusable = modalRef.current.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        previousActiveElement.focus();
      }
    };
  }, [isOpen, onClose]);

  const handleFileImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result;
      if (typeof content === 'string') {
        setRawText((prev) => {
          const trimmed = prev.trim();
          return trimmed ? `${trimmed}\n${content}` : content;
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleBrowseFolder = async () => {
    try {
      const path = await api.pickFolder();
      if (path) {
        setCustomFolder(path);
      }
    } catch {
      // Fallback ignore if bridge unavailable
    }
  };

  const handleSubmit = () => {
    if (parsed.validUrls.length === 0) return;

    if (onBatchSubmit) {
      onBatchSubmit({
        urls: parsed.validUrls,
        config: {
          format,
          output: outputFolder || '~/Downloads/media',
          rate_limit: rateLimit,
          sponsorblock,
        },
      });
    }

    setRawText('');
    setCustomFolder('');
    setShowErrorDetails(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in motion-reduce:animate-none select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-modal-title"
        className="bg-surface-1 border border-white/10 rounded-3xl max-w-xl w-full p-6 shadow-2xl flex flex-col gap-4 animate-scale-in motion-reduce:animate-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-dim text-brand-acc flex items-center justify-center border border-brand-border">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 id="batch-modal-title" className="text-sm font-bold text-slate-100">
                Batch URL Downloader
              </h3>
              <p className="text-[11px] text-slate-400">
                Queue multiple video, audio, or image links simultaneously
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-8 px-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-slate-300 hover:text-white border border-border-subtle text-xs font-semibold flex items-center gap-1.5 transition-colors active:scale-[0.98] motion-reduce:active:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-acc/60"
              title="Import links from .txt or .csv file"
              aria-label="Import links from file"
            >
              <Upload className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Import File</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.csv"
              className="hidden"
              onChange={handleFileImport}
            />

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-surface-2 transition-colors active:scale-[0.98] motion-reduce:active:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-acc/60"
              aria-label="Close batch modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Textarea Area */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="batch-textarea-input" className="text-xs text-slate-300">
            Paste links below (one URL per line):
          </label>
          <textarea
            id="batch-textarea-input"
            ref={textareaRef}
            rows={5}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={'https://www.youtube.com/watch?v=...\nhttps://www.instagram.com/p/...\nhttps://soundcloud.com/...'}
            spellCheck={false}
            className="w-full p-3 rounded-2xl bg-surface-2 border border-border-subtle text-slate-100 text-xs font-mono placeholder-slate-500 focus:outline-none focus:border-brand-acc focus:ring-1 focus:ring-brand-acc resize-y min-h-[110px]"
          />
        </div>

        {/* Live Parsing Stats */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs py-0.5">
          <span className="text-slate-400 text-[11px]">
            {parsed.totalLines} {parsed.totalLines === 1 ? 'line' : 'lines'} entered
          </span>

          <div className="flex items-center gap-2">
            {parsed.duplicates.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                {parsed.duplicates.length} duplicate{parsed.duplicates.length === 1 ? '' : 's'} removed
              </span>
            )}
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-colors ${
                parsed.validUrls.length > 0
                  ? 'bg-brand-dim text-brand-acc border border-brand-border'
                  : 'bg-surface-3 text-slate-400 border border-border-subtle'
              }`}
            >
              {parsed.validUrls.length} valid URL{parsed.validUrls.length === 1 ? '' : 's'} detected
            </span>
          </div>
        </div>

        {/* Error Breakdown (if any invalid lines) */}
        {parsed.invalidLines.length > 0 && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-3 flex flex-col gap-1.5 text-xs animate-fade-in motion-reduce:animate-none">
            <div className="flex items-center justify-between text-rose-300 font-semibold">
              <span className="flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>
                  {parsed.invalidLines.length} invalid {parsed.invalidLines.length === 1 ? 'line' : 'lines'} detected
                </span>
              </span>
              <button
                type="button"
                onClick={() => setShowErrorDetails((prev) => !prev)}
                className="text-[11px] text-rose-400 hover:text-rose-200 underline focus:outline-none"
              >
                {showErrorDetails ? 'Hide details' : 'Show details'}
              </button>
            </div>

            {showErrorDetails && (
              <div className="max-h-24 overflow-y-auto flex flex-col gap-1 mt-1 pr-1 font-mono text-[11px] text-rose-200/90 divide-y divide-rose-500/10">
                {parsed.invalidLines.map((item, idx) => (
                  <div key={idx} className="pt-1 flex items-start justify-between gap-2">
                    <span className="truncate max-w-[340px]">
                      Line {item.line}: {item.text}
                    </span>
                    <span className="shrink-0 text-[10px] text-rose-400">{item.error}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Presets Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-border-subtle">
          {/* Format Preset */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="batch-format-select" className="text-xs text-slate-300 font-medium">
              Format Preset
            </label>
            <select
              id="batch-format-select"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="h-9 px-3 rounded-xl bg-surface-2 border border-border-subtle text-slate-100 text-xs focus:outline-none focus:border-brand-acc focus:ring-1 focus:ring-brand-acc cursor-pointer"
            >
              {FORMAT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-surface-1 text-slate-100">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Speed Limit */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="batch-rate-select" className="text-xs text-slate-300 font-medium">
              Speed Limit
            </label>
            <select
              id="batch-rate-select"
              value={rateLimit}
              onChange={(e) => setRateLimit(e.target.value)}
              className="h-9 px-3 rounded-xl bg-surface-2 border border-border-subtle text-slate-100 text-xs focus:outline-none focus:border-brand-acc focus:ring-1 focus:ring-brand-acc cursor-pointer"
            >
              {RATE_LIMIT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-surface-1 text-slate-100">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Output Folder */}
          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <label htmlFor="batch-output-folder" className="text-xs text-slate-300 font-medium">
              Output Folder
            </label>
            <div className="flex items-center gap-2">
              <input
                id="batch-output-folder"
                type="text"
                value={outputFolder}
                onChange={(e) => setCustomFolder(e.target.value)}
                className="flex-1 h-9 px-3 rounded-xl bg-surface-2 border border-border-subtle text-slate-100 text-xs font-mono focus:outline-none focus:border-brand-acc focus:ring-1 focus:ring-brand-acc"
              />
              <button
                type="button"
                onClick={handleBrowseFolder}
                className="h-9 px-3 rounded-xl bg-surface-2 hover:bg-surface-3 text-slate-300 hover:text-white border border-border-subtle text-xs font-semibold flex items-center gap-1.5 transition-colors active:scale-[0.98] motion-reduce:active:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-acc/60 shrink-0"
                title="Browse destination folder"
                aria-label="Browse destination folder"
              >
                <Folder className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Browse</span>
              </button>
            </div>
          </div>

          {/* SponsorBlock Toggle */}
          <div className="sm:col-span-2 flex items-center justify-between pt-1">
            <button
              type="button"
              role="switch"
              aria-checked={sponsorblock}
              aria-label="Skip sponsored segments using SponsorBlock"
              onClick={() => setSponsorblock(!sponsorblock)}
              className="flex items-center gap-2.5 text-xs text-slate-300 hover:text-white group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-acc/60 rounded-lg p-1 transition-colors"
            >
              <div
                className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${
                  sponsorblock ? 'bg-brand-acc' : 'bg-surface-4'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${
                    sponsorblock ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </div>
              <span>SponsorBlock (skip sponsored segments)</span>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-xl bg-surface-2 hover:bg-surface-3 text-slate-300 hover:text-white text-xs font-semibold transition-colors active:scale-[0.98] motion-reduce:active:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-acc/60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={parsed.validUrls.length === 0}
            className="h-9 px-5 rounded-xl bg-brand-acc hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100 disabled:pointer-events-none text-slate-950 font-bold text-xs shadow-glow transition-all active:scale-[0.98] motion-reduce:active:scale-100 flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            Queue {parsed.validUrls.length} Download{parsed.validUrls.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  );
}
