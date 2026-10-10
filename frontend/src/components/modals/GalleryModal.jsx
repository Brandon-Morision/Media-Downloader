import React, { useState, useEffect, useRef } from 'react';
import {
  X, Minus, Square, ArrowLeft, ChevronLeft, ChevronRight,
  Image as ImageIcon, Folder, Heart, Info, MoreHorizontal,
  ZoomIn, ZoomOut, RotateCw, Expand, Maximize2, Scan,
  Database, Calendar, MapPin, MessageSquare, Send, Check, Copy,
  ExternalLink, Download
} from 'lucide-react';
import { api } from '../../lib/api';
import { fmtBytes, fmtDate } from '../../lib/formatters';

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

  const totalCount = files.length || 1;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [urls, setUrls] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  // Layout & Panel states
  const [showDetails, setShowDetails] = useState(true);
  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'comments'
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);

  // Pan & Zoom & Rotate states
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Metadata detection
  const [naturalDims, setNaturalDims] = useState(null);
  const viewportRef = useRef(null);

  // Comments / Notes state (persisted per item)
  const itemKey = `nd_comments_${downloadItem?.id || downloadItem?.historyId || downloadItem?.filename || 'default'}`;
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  // Load comments from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(itemKey);
      if (saved) setComments(JSON.parse(saved));
      else setComments([]);
    } catch {
      setComments([]);
    }
  }, [itemKey]);

  // Load favorite state
  useEffect(() => {
    try {
      const favKey = `nd_fav_${downloadItem?.id || downloadItem?.filename || 'item'}`;
      setIsFavorite(localStorage.getItem(favKey) === 'true');
    } catch {
      setIsFavorite(false);
    }
  }, [downloadItem?.id, downloadItem?.filename]);

  const toggleFavorite = () => {
    try {
      const favKey = `nd_fav_${downloadItem?.id || downloadItem?.filename || 'item'}`;
      const next = !isFavorite;
      setIsFavorite(next);
      localStorage.setItem(favKey, String(next));
    } catch {}
  };

  const handleAddComment = (e) => {
    e?.preventDefault();
    if (!newComment.trim()) return;
    const item = {
      id: Date.now(),
      text: newComment.trim(),
      date: new Date().toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    const updated = [item, ...comments];
    setComments(updated);
    try {
      localStorage.setItem(itemKey, JSON.stringify(updated));
    } catch {}
    setNewComment('');
  };

  // Reset transforms on image change
  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
    setNaturalDims(null);
  }, [currentIndex, downloadItem?.id]);

  // Load media URLs via pywebview bridge
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
  const activeUrl = urls[currentFile?.path] || currentFile?.path || downloadItem?.thumbnail;

  const handlePrev = () => setCurrentIndex((prev) => (prev > 0 ? prev - 1 : files.length - 1));
  const handleNext = () => setCurrentIndex((prev) => (prev < files.length - 1 ? prev + 1 : 0));

  // Zoom controls
  const handleZoomIn = () => setZoom((z) => Math.min(Number((z + 0.25).toFixed(2)), 5));
  const handleZoomOut = () => setZoom((z) => Math.max(Number((z - 0.25).toFixed(2)), 0.25));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  const handleFitScreen = () => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  };
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  // Mouse wheel zoom
  const handleWheel = (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoom((z) => Math.min(Number((z + 0.15).toFixed(2)), 5));
    } else {
      setZoom((z) => Math.max(Number((z - 0.15).toFixed(2)), 0.25));
    }
  };

  // Drag to pan when zoomed
  const handleMouseDown = (e) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Keyboard navigation & shortcuts
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      // Don't trigger shortcuts when typing inside comments input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'Escape') {
        e.preventDefault();
        if (zoom > 1) {
          handleResetZoom();
        } else {
          onClose();
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        handleResetZoom();
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        handleRotate();
      } else if (e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setShowDetails((s) => !s);
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsMaximized((m) => !m);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, zoom, files.length]);

  if (!isOpen || !downloadItem) return null;

  // Metadata calculations
  const filename = currentFile?.name || downloadItem.filename || 'download (1).jpg';
  const fileExt = (filename.split('.').pop() || 'JPG').toUpperCase();
  const formattedSize = downloadItem.sizeBytes ? fmtBytes(downloadItem.sizeBytes) : '142 KB';
  const dimensionsStr = naturalDims
    ? `${naturalDims.width} × ${naturalDims.height}`
    : (downloadItem.res || downloadItem.dimensions || '4032 × 3024');

  // Formatted date modified
  const dateStr = downloadItem.finished_at || downloadItem.timestamp || downloadItem.date
    ? fmtDate(downloadItem.finished_at || downloadItem.timestamp || downloadItem.date)
    : 'Aug 14, 2025  5:32 PM';

  // Location representation
  const locationStr = downloadItem.location || downloadItem.uploader || 'Nairobi, Kenya';

  const copyPath = () => {
    const p = currentFile?.path || downloadItem.outputDir || '';
    if (p && navigator.clipboard) {
      navigator.clipboard.writeText(p);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2000);
    }
    setShowMoreMenu(false);
  };

  const handleOpenFolder = () => {
    const target = outDir || downloadItem.outputDir || currentFile?.path;
    if (target) {
      api.openOutputFolder(target);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 select-none animate-fadeIn">
      {/* ── WINDOW SHELL ── */}
      <div
        className={`bg-[#0a0f1d]/95 backdrop-blur-2xl border border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden transition-all duration-200 ${
          isMaximized
            ? 'w-full h-full rounded-none'
            : 'w-full max-w-7xl h-[90vh] rounded-3xl'
        }`}
      >
        {/* ── TOP HEADER / TITLE BAR ── */}
        <div className="h-14 px-4 sm:px-5 bg-[#0e1628]/80 border-b border-white/5 flex items-center justify-between shrink-0 relative z-30">
          {/* Left: Back button + Title & Info */}
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Back button with Windows 11 accent indicator underneath */}
            <div className="flex flex-col items-center">
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                title="Back / Close (Esc)"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              {/* Subtle accent indicator bar under back arrow */}
              <div className="w-5 h-0.5 bg-sky-400 rounded-full shadow-[0_0_8px_rgba(56,189,248,0.9)] mt-0.5" />
            </div>

            {/* Title & Subtitle */}
            <div className="flex flex-col min-w-0 justify-center">
              <span className="text-sm font-semibold text-slate-100 truncate tracking-tight">
                {filename}
              </span>
              <span className="text-xs text-slate-400 font-normal truncate flex items-center gap-1.5">
                <span>{totalCount} {totalCount === 1 ? 'Photo' : 'Photos'}</span>
                <span>·</span>
                <span>{formattedSize}</span>
                <span>·</span>
                <span>{fileExt}</span>
              </span>
            </div>
          </div>

          {/* Right: Actions & Window Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Favorite / Heart toggle */}
            <button
              onClick={toggleFavorite}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                isFavorite
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.35)]'
                  : 'text-slate-400 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-rose-400' : ''}`} />
            </button>

            {/* Details Panel Toggle (i) */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                showDetails
                  ? 'bg-white/10 text-sky-400 border border-white/10'
                  : 'text-slate-400 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
              title="Toggle Details (I)"
            >
              <Info className="w-4 h-4" />
            </button>

            {/* More Options Dropdown (...) */}
            <div className="relative">
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                title="More options"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              {showMoreMenu && (
                <div className="absolute right-0 top-10 w-48 bg-[#101726] border border-white/10 rounded-xl shadow-2xl py-1.5 z-50 text-xs text-slate-200 animate-fadeIn">
                  <button
                    onClick={copyPath}
                    className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center gap-2 transition-colors"
                  >
                    {copiedPath ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                    <span>{copiedPath ? 'Path Copied!' : 'Copy file path'}</span>
                  </button>

                  <button
                    onClick={() => {
                      if (currentFile?.path) api.openFile(currentFile.path);
                      setShowMoreMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center gap-2 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    <span>Open in default app</span>
                  </button>

                  <button
                    onClick={() => {
                      handleOpenFolder();
                      setShowMoreMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center gap-2 transition-colors"
                  >
                    <Folder className="w-3.5 h-3.5 text-slate-400" />
                    <span>Open containing folder</span>
                  </button>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="w-[1px] h-4 bg-white/10 mx-1" />

            {/* Windows Controls: Minimize, Maximize, Close */}
            <div className="flex items-center gap-0.5">
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Minimize"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsMaximized(!isMaximized)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                title={isMaximized ? 'Restore' : 'Maximize'}
              >
                <Square className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-white/10 transition-colors"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ── MAIN WORKSPACE BODY ── */}
        <div className="flex-1 flex min-h-0 overflow-hidden relative">

          {/* ── LEFT COLUMN: THUMBNAILS & COUNTER ── */}
          <div className="w-20 sm:w-24 p-3 bg-[#0a0f1d]/50 border-r border-white/5 flex flex-col items-center gap-3 shrink-0 overflow-y-auto scrollbar-thin">
            {/* Album / Photo counter pill at top */}
            <div className="px-2.5 py-1.5 rounded-xl bg-[#131b2c] border border-white/10 text-[11px] font-semibold text-slate-200 flex items-center gap-1.5 shadow-sm">
              <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
              <span className="font-mono">{currentIndex + 1} / {totalCount}</span>
            </div>

            {/* Vertical thumbnails stack */}
            <div className="flex flex-col gap-2.5 w-full items-center">
              {files.map((file, i) => {
                const u = urls[file.path] || file.path;
                const isActive = currentIndex === i;
                return (
                  <button
                    key={i}
                    onClick={() => setCurrentIndex(i)}
                    className={`w-14 sm:w-16 h-11 sm:h-12 rounded-xl overflow-hidden shrink-0 transition-all duration-200 relative group ${
                      isActive
                        ? 'border-2 border-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.5)] ring-2 ring-sky-400/20 scale-105 opacity-100'
                        : 'border border-white/10 opacity-50 hover:opacity-90 hover:border-white/30'
                    }`}
                    title={file.name || `Photo ${i + 1}`}
                  >
                    <img
                      src={u}
                      alt={file.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── CENTER STAGE: IMAGE VIEWPORT & FLOATING TOOLS ── */}
          <div
            ref={viewportRef}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={`flex-1 m-2.5 sm:m-3 rounded-2xl bg-[#060a14]/90 border border-white/5 relative flex items-center justify-center overflow-hidden select-none ${
              zoom > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
            }`}
          >
            {/* Central High-Res Photo Display */}
            {isLoading ? (
              <div className="flex flex-col items-center gap-3 text-slate-400 text-xs font-mono">
                <div className="w-8 h-8 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
                <span>Loading photo…</span>
              </div>
            ) : (
              <div
                className="transition-transform duration-100 ease-out flex items-center justify-center max-w-full max-h-full"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                }}
              >
                <img
                  key={currentFile?.path}
                  src={activeUrl}
                  alt={filename}
                  draggable={false}
                  onLoad={(e) => {
                    setNaturalDims({
                      width: e.target.naturalWidth,
                      height: e.target.naturalHeight,
                    });
                  }}
                  className="max-w-[75vw] max-h-[70vh] object-contain rounded-xl shadow-2xl pointer-events-none select-none"
                />
              </div>
            )}

            {/* Navigation Chevrons (Multi-photo albums) */}
            {totalCount > 1 && (
              <>
                <button
                  onClick={handlePrev}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-sky-400 hover:text-slate-950 text-white flex items-center justify-center border border-white/10 transition-all shadow-xl hover:scale-105 active:scale-95 group z-20"
                  title="Previous Photo (Left Arrow)"
                >
                  <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
                </button>
                <button
                  onClick={handleNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-sky-400 hover:text-slate-950 text-white flex items-center justify-center border border-white/10 transition-all shadow-xl hover:scale-105 active:scale-95 group z-20"
                  title="Next Photo (Right Arrow)"
                >
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </>
            )}

            {/* Bottom-Left Floating Pill (Filename badge) */}
            <div className="absolute left-4 bottom-4 z-20 px-3 py-1.5 rounded-xl bg-[#0d1424]/85 backdrop-blur-md border border-white/10 text-xs font-medium text-slate-200 flex items-center gap-2 shadow-lg max-w-[260px] truncate">
              <ImageIcon className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="truncate">{filename}</span>
            </div>

            {/* Bottom-Center Floating Frosted Toolbar */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-2xl bg-[#0e1628]/85 backdrop-blur-xl border border-white/10 flex items-center gap-4 text-slate-300 shadow-2xl">
              {/* Zoom Out */}
              <button
                onClick={handleZoomOut}
                className="p-1 rounded-lg hover:text-white hover:bg-white/10 transition-colors"
                title="Zoom Out (-)"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              {/* Zoom In */}
              <button
                onClick={handleZoomIn}
                className="p-1 rounded-lg hover:text-white hover:bg-white/10 transition-colors"
                title="Zoom In (+)"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              {/* 1:1 Reset */}
              <button
                onClick={handleResetZoom}
                className="px-2 py-0.5 text-xs font-semibold rounded-lg hover:text-white hover:bg-white/10 transition-colors font-mono"
                title="Original Size (1:1)"
              >
                1:1
              </button>

              {/* Fit to View */}
              <button
                onClick={handleFitScreen}
                className="p-1 rounded-lg hover:text-white hover:bg-white/10 transition-colors"
                title="Fit to Screen"
              >
                <Scan className="w-4 h-4" />
              </button>

              {/* Rotate Clockwise */}
              <button
                onClick={handleRotate}
                className="p-1 rounded-lg hover:text-white hover:bg-white/10 transition-colors"
                title="Rotate 90° (R)"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              {/* Toggle Fullscreen / Maximize */}
              <button
                onClick={() => setIsMaximized(!isMaximized)}
                className="p-1 rounded-lg hover:text-white hover:bg-white/10 transition-colors"
                title="Fullscreen Mode (F)"
              >
                <Expand className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── RIGHT COLUMN: DETAILS & COMMENTS SIDEBAR ── */}
          {showDetails && (
            <div className="w-72 sm:w-80 bg-[#0a0f1d]/70 border-l border-white/5 flex flex-col justify-between shrink-0 p-4 overflow-y-auto animate-fadeIn">
              <div className="flex flex-col gap-4">
                {/* Segmented Tab Switcher (Details vs Comments) */}
                <div className="grid grid-cols-2 p-1 rounded-2xl bg-[#0e1628] border border-white/5">
                  <button
                    onClick={() => setActiveTab('details')}
                    className={`py-1.5 text-xs font-semibold rounded-xl transition-all ${
                      activeTab === 'details'
                        ? 'bg-[#182338] text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Details
                  </button>
                  <button
                    onClick={() => setActiveTab('comments')}
                    className={`py-1.5 text-xs font-semibold rounded-xl transition-all ${
                      activeTab === 'comments'
                        ? 'bg-[#182338] text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Comments
                  </button>
                </div>

                {activeTab === 'details' ? (
                  <>
                    {/* Mini Item Preview Card */}
                    <div className="p-3 rounded-2xl bg-[#111827]/70 border border-white/5 flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-black/40 border border-white/10 shrink-0">
                        <img
                          src={activeUrl}
                          alt={filename}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-slate-100 truncate">
                          {filename}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {fileExt} · {formattedSize}
                        </span>
                      </div>
                    </div>

                    {/* Metadata Attributes List */}
                    <div className="flex flex-col gap-3.5 mt-1 px-1">
                      {/* Dimensions */}
                      <div className="flex items-start gap-3">
                        <Scan className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                        <div className="flex flex-col">
                          <span className="text-[11px] text-slate-400 font-medium">Dimensions</span>
                          <span className="text-xs font-semibold text-slate-200">{dimensionsStr}</span>
                        </div>
                      </div>

                      {/* Size */}
                      <div className="flex items-start gap-3">
                        <Database className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                        <div className="flex flex-col">
                          <span className="text-[11px] text-slate-400 font-medium">Size</span>
                          <span className="text-xs font-semibold text-slate-200">{formattedSize}</span>
                        </div>
                      </div>

                      {/* Type */}
                      <div className="flex items-start gap-3">
                        <ImageIcon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                        <div className="flex flex-col">
                          <span className="text-[11px] text-slate-400 font-medium">Type</span>
                          <span className="text-xs font-semibold text-slate-200">{fileExt}</span>
                        </div>
                      </div>

                      {/* Date Modified */}
                      <div className="flex items-start gap-3">
                        <Calendar className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                        <div className="flex flex-col">
                          <span className="text-[11px] text-slate-400 font-medium">Date modified</span>
                          <span className="text-xs font-semibold text-slate-200">{dateStr}</span>
                        </div>
                      </div>

                      {/* Location */}
                      <div className="flex items-start gap-3">
                        <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                        <div className="flex flex-col">
                          <span className="text-[11px] text-slate-400 font-medium">Location</span>
                          <span className="text-xs font-semibold text-slate-200">{locationStr}</span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  /* ── COMMENTS & NOTES TAB ── */
                  <div className="flex flex-col gap-3">
                    <form onSubmit={handleAddComment} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Add a note or tag…"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="flex-1 bg-[#111827] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-400"
                      />
                      <button
                        type="submit"
                        disabled={!newComment.trim()}
                        className="p-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 font-bold transition-all shadow-sm"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </form>

                    <div className="flex flex-col gap-2 max-h-[42vh] overflow-y-auto pr-1">
                      {comments.length === 0 ? (
                        <div className="p-4 rounded-xl bg-[#111827]/40 border border-white/5 text-center text-slate-500 text-xs">
                          No notes added yet for this image.
                        </div>
                      ) : (
                        comments.map((c) => (
                          <div key={c.id} className="p-2.5 rounded-xl bg-[#111827]/80 border border-white/5 flex flex-col gap-1">
                            <span className="text-xs text-slate-200">{c.text}</span>
                            <span className="text-[10px] text-slate-500">{c.date}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Action: Open Folder */}
              <div className="mt-4 pt-2">
                <button
                  onClick={handleOpenFolder}
                  className="w-full bg-[#111827]/80 hover:bg-[#1a253a] border border-white/5 rounded-2xl p-3.5 flex items-center justify-between text-slate-200 hover:text-white transition-all shadow-md group"
                  title="Open folder in File Explorer"
                >
                  <div className="flex items-center gap-2.5">
                    <Folder className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-semibold">Open folder</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
