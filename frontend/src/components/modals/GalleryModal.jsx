import React, { useState, useEffect } from 'react';
import {
  X, ChevronLeft, ChevronRight, Image as ImageIcon,
  LayoutGrid, Folder, ExternalLink, Maximize2, Images, Eye
} from 'lucide-react';
import { api } from '../../lib/api';
import { fmtBytes } from '../../lib/formatters';

export default function GalleryModal({ isOpen, onClose, downloadItem }) {
  const rawFiles = downloadItem?.files || [];
  const outDir = downloadItem?.outputDir ? downloadItem.outputDir.replace(/[/\\]+$/, '') : '';
  const files = rawFiles.length > 0
    ? rawFiles.map((f) => {
        if (typeof f === 'string') {
          const name = f.split(/[/\\]/).pop() || f;
          const isAbsoluteOrUrl = f.includes(':') || f.startsWith('/') || f.startsWith('\\') || f.startsWith('http');
          const fullPath = (!isAbsoluteOrUrl && outDir) ? `${outDir}\\${f}` : f;
          return { name, path: fullPath };
        }
        const p = f?.path || '';
        const name = f?.name || (p ? p.split(/[/\\]/).pop() : 'Photo');
        const isAbsoluteOrUrl = p.includes(':') || p.startsWith('/') || p.startsWith('\\') || p.startsWith('http');
        const fullPath = (!isAbsoluteOrUrl && outDir && p) ? `${outDir}\\${p}` : p;
        return { ...f, name, path: fullPath };
      })
    : (downloadItem?.thumbnail ? [{ name: downloadItem.filename || 'Image', path: downloadItem.thumbnail }] : []);

  // Default to arranged 'grid' view if album has multiple photos, or 'full' if only 1 photo
  const [viewMode, setViewMode] = useState(files.length > 1 ? 'grid' : 'full');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [urls, setUrls] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  // Reset view mode and index whenever a different download item is opened
  useEffect(() => {
    if (downloadItem) {
      setViewMode(files.length > 1 ? 'grid' : 'full');
      setCurrentIndex(0);
    }
  }, [downloadItem?.id, downloadItem?.filename, files.length]);

  // Load bridge URLs for all files in this gallery/album
  useEffect(() => {
    let active = true;
    async function loadUrls() {
      if (!files.length) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);

      const directMap = {};
      const localPaths = [];

      files.forEach((f) => {
        if (!f.path || f.path.startsWith('http://') || f.path.startsWith('https://')) {
          directMap[f.path] = f.path;
        } else {
          localPaths.push(f.path);
        }
      });

      if (localPaths.length === 0) {
        if (active) {
          setUrls(directMap);
          setIsLoading(false);
        }
        return;
      }

      try {
        const res = await api.getMediaUrls(localPaths);
        if (active) {
          const merged = { ...directMap, ...(res?.urls || {}) };
          // If any local path is missing from response, fallback to item thumbnail if available
          localPaths.forEach((p) => {
            if (!merged[p] && downloadItem?.thumbnail) {
              merged[p] = downloadItem.thumbnail;
            }
          });
          setUrls(merged);
          setIsLoading(false);
        }
      } catch (err) {
        if (active) {
          setUrls(directMap);
          setIsLoading(false);
        }
      }
    }
    loadUrls();
    return () => {
      active = false;
    };
  }, [downloadItem?.id, downloadItem?.filename, files.length]);

  const currentFile = files[currentIndex] || files[0];
  const activeUrl = urls[currentFile?.path] || currentFile?.path;

  const handlePrev = () => setCurrentIndex((prev) => (prev > 0 ? prev - 1 : files.length - 1));
  const handleNext = () => setCurrentIndex((prev) => (prev < files.length - 1 ? prev + 1 : 0));

  // Keyboard navigation for full view and grid view
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (viewMode === 'full' && files.length > 1) {
          setViewMode('grid');
        } else {
          onClose();
        }
      } else if (viewMode === 'full' && files.length > 1) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          handlePrev();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          handleNext();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, viewMode, currentIndex, files.length]);

  if (!isOpen || !downloadItem) return null;

  const albumTitle = downloadItem.filename || 'Image Gallery';
  const totalCount = files.length;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 select-none animate-fadeIn">
      <div className="w-full max-w-6xl h-[88vh] bg-surface-1 rounded-3xl border border-border-highlight/50 shadow-2xl flex flex-col overflow-hidden relative">

        {/* ── MODAL TOP BAR ── */}
        <div className="h-14 px-5 bg-surface-2/95 border-b border-border-subtle flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {viewMode === 'full' && totalCount > 1 ? (
              <button
                onClick={() => setViewMode('grid')}
                className="px-3 py-1.5 rounded-xl bg-surface-3 hover:bg-surface-2 border border-border-subtle hover:border-brand-border text-xs font-semibold text-slate-200 hover:text-brand-acc flex items-center gap-2 transition-all shadow-sm group"
                title="Return to Gallery Grid View (Esc)"
              >
                <LayoutGrid className="w-4 h-4 text-brand-acc group-hover:scale-110 transition-transform" />
                <span>Gallery View ({totalCount})</span>
              </button>
            ) : (
              <div className="flex items-center gap-2.5 truncate">
                <div className="w-8 h-8 rounded-xl bg-brand-dim border border-brand-border flex items-center justify-center text-brand-acc shrink-0">
                  <Images className="w-4 h-4" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs sm:text-sm font-bold text-slate-100 truncate">
                    {albumTitle}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {totalCount} {totalCount === 1 ? 'Photo' : 'Photos'} {downloadItem.sizeBytes ? `· ${fmtBytes(downloadItem.sizeBytes)}` : ''}
                  </span>
                </div>
              </div>
            )}

            {viewMode === 'full' && (
              <span className="hidden sm:inline-block text-xs font-semibold px-2.5 py-1 rounded-lg bg-surface-3 border border-white/5 text-slate-300 font-mono">
                {currentIndex + 1} / {totalCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Folder button */}
            {downloadItem.outputDir && (
              <button
                onClick={() => api.openFile(downloadItem.outputDir)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-surface-3 transition-colors border border-transparent hover:border-white/5"
                title="Open download folder in File Explorer"
              >
                <Folder className="w-4 h-4" />
              </button>
            )}

            {/* View Full / Slideshow button (when in grid mode) */}
            {viewMode === 'grid' && totalCount > 0 && (
              <button
                onClick={() => {
                  setCurrentIndex(0);
                  setViewMode('full');
                }}
                className="px-3 py-1.5 rounded-xl bg-brand-dim hover:bg-brand-dim border border-brand-border text-xs font-semibold text-brand-acc flex items-center gap-1.5 transition-all shadow-sm"
                title="View Fullscreen"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Slideshow</span>
              </button>
            )}

            {/* External URL link if available */}
            {downloadItem.url && (
              <button
                onClick={() => api.openUrlExternal(downloadItem.url)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-surface-3 transition-colors border border-transparent hover:border-white/5"
                title="Open post / album online"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-surface-3 transition-colors"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── STAGE 1: ARRANGED GALLERY GRID VIEW ── */}
        {viewMode === 'grid' ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-surface-1">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
              {files.map((file, i) => {
                const u = urls[file.path] || file.path;
                const displayName = file.name ? file.name.replace(/\.[^/.]+$/, '') : `Photo ${i + 1}`;
                return (
                  <div
                    key={i}
                    onClick={() => {
                      setCurrentIndex(i);
                      setViewMode('full');
                    }}
                    className="group relative aspect-square rounded-2xl overflow-hidden bg-surface-2 border border-border-subtle hover:border-brand-border cursor-pointer shadow-sm hover:shadow-xl transition-all duration-200 hover:-translate-y-1"
                  >
                    <img
                      src={u}
                      alt={file.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />

                    {/* Photo index pill */}
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-sm text-[10px] font-mono font-bold text-white border border-white/10 shadow-sm">
                      #{i + 1}
                    </div>

                    {/* Hover Overlay with View action & filename */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent opacity-0 group-hover:opacity-100 flex flex-col justify-between p-2.5 transition-opacity">
                      <div className="self-end p-1.5 rounded-full bg-brand-acc text-slate-950 shadow-glow">
                        <Eye className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[11px] font-semibold text-white truncate drop-shadow-md">
                        {displayName}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ── STAGE 2: FULL VIEW / LIGHTBOX CAROUSEL ── */
          <div className="flex-1 flex flex-col min-h-0 bg-black/80 relative">
            {/* Central High-Res Viewport */}
            <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden select-none">
              {isLoading ? (
                <div className="flex flex-col items-center gap-2 text-slate-400 font-mono text-xs">
                  <div className="w-8 h-8 rounded-full border-2 border-brand-acc border-t-transparent animate-spin" />
                  <span>Loading full resolution photo…</span>
                </div>
              ) : (
                <img
                  key={currentFile?.path}
                  src={activeUrl}
                  alt={currentFile?.name}
                  className="max-w-full max-h-[64vh] sm:max-h-[68vh] object-contain rounded-lg shadow-2xl transition-all duration-200"
                />
              )}

              {/* Navigation Chevrons */}
              {totalCount > 1 && (
                <>
                  <button
                    onClick={handlePrev}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/70 hover:bg-brand-acc hover:text-slate-950 text-white flex items-center justify-center border border-white/15 transition-all shadow-xl hover:scale-105 active:scale-95 group"
                    title="Previous Photo (Left Arrow)"
                  >
                    <ChevronLeft className="w-6 h-6 group-hover:-translate-x-0.5 transition-transform" />
                  </button>
                  <button
                    onClick={handleNext}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/70 hover:bg-brand-acc hover:text-slate-950 text-white flex items-center justify-center border border-white/15 transition-all shadow-xl hover:scale-105 active:scale-95 group"
                    title="Next Photo (Right Arrow)"
                  >
                    <ChevronRight className="w-6 h-6 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </>
              )}
            </div>

            {/* Bottom Photo Title and Filmstrip */}
            <div className="px-4 py-2.5 bg-surface-2/95 border-t border-border-subtle flex flex-col gap-2 shrink-0">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span className="font-semibold text-slate-200 truncate">
                  {currentFile?.name || 'Photo'}
                </span>
                <span className="font-mono text-[11px] text-brand-acc shrink-0">
                  {currentIndex + 1} of {totalCount}
                </span>
              </div>

              {/* Thumbnail Strip */}
              {totalCount > 1 && (
                <div className="h-14 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                  {files.map((f, i) => {
                    const u = urls[f.path] || f.path;
                    const isActive = currentIndex === i;
                    return (
                      <button
                        key={i}
                        onClick={() => setCurrentIndex(i)}
                        className={`h-12 w-12 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                          isActive
                            ? 'border-brand-acc scale-105 shadow-glow opacity-100'
                            : 'border-transparent opacity-50 hover:opacity-90'
                        }`}
                        title={`Jump to photo #${i + 1}`}
                      >
                        <img src={u} alt="" className="w-full h-full object-cover" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
