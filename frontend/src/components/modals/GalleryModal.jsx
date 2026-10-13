import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Image as ImageIcon, ImageOff, Folder,
  Heart, Info, MoreHorizontal, ZoomIn, ZoomOut, RotateCw, RotateCcw, Expand, Shrink,
  Scan, Database, Calendar, MapPin, User, Send, Check, Copy, ExternalLink, Film, Play,
} from 'lucide-react';
import { api } from '../../lib/api';
import { fmtBytes, fmtDate } from '../../lib/formatters';

/* ────────────────────────────────────────────────────────────────────────────
   DESIGN TOKENS
   Surfaces (darkest → lightest):  canvas #060a14 · shell #0a0f1d · panel #0c1221 · raised #131b2c
   Accent: sky-400.  Radius: rounded-2xl for panels, rounded-xl for controls.
   Controls: 36px hit area (w-9 h-9), 18px icons.
──────────────────────────────────────────────────────────────────────────── */

const VIDEO_EXTS = ['mp4', 'webm', 'mov', 'mkv', 'm4v', 'avi', 'flv', 'wmv', 'ts'];
export const isVideoFile = (name = '') => {
  const ext = (name.split('.').pop() || '').toLowerCase();
  return VIDEO_EXTS.includes(ext);
};

const TRANSPARENT_EXTS = ['png', 'webp', 'gif', 'svg', 'avif'];
const CHECKER_STYLE = {
  backgroundColor: '#161d30',
  backgroundImage:
    'linear-gradient(45deg,#1f2840 25%,transparent 25%),linear-gradient(-45deg,#1f2840 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#1f2840 75%),linear-gradient(-45deg,transparent 75%,#1f2840 75%)',
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
};

const MIN_SCALE = 0.1;
const MAX_SCALE = 8;
const ZOOM_STEP = 1.25;
const STAGE_MARGIN = 48; // breathing room around a fitted image
const MAX_FIT_UPSCALE = 3; // small images are enlarged to fill the stage, but not beyond 300%

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/* ── Small reusable controls ─────────────────────────────────────────────── */

function IconButton({ title, onClick, active = false, className = '', children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active || undefined}
      onClick={onClick}
      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 ${
        active
          ? 'bg-white/10 text-sky-400'
          : 'text-slate-400 hover:text-white hover:bg-white/10 active:bg-white/15'
      } ${className}`}
    >
      {children}
    </button>
  );
}

function ToolButton({ title, onClick, active = false, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`h-9 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 ${
        active
          ? 'bg-sky-400/15 text-sky-300'
          : 'text-slate-300 hover:text-white hover:bg-white/10 active:bg-white/15'
      }`}
    >
      {children}
    </button>
  );
}

const Divider = () => <span className="w-px h-5 bg-white/10 mx-1.5 shrink-0" />;

/* ════════════════════════════════════════════════════════════════════════════
   GALLERY MODAL
════════════════════════════════════════════════════════════════════════════ */

export default function GalleryModal({ isOpen, onClose, downloadItem }) {
  const outDir = downloadItem?.outputDir ? downloadItem.outputDir.replace(/[/\\]+$/, '') : '';

  // Memoised so effects that depend on `files` don't re-run on every render.
  const files = useMemo(() => {
    const raw = downloadItem?.files || [];
    const resolve = (p) => {
      const isAbs = p.includes(':') || p.startsWith('/') || p.startsWith('\\') || p.startsWith('http');
      return !isAbs && outDir && p ? `${outDir}\\${p}` : p;
    };
    if (raw.length > 0) {
      return raw.map((f) => {
        if (typeof f === 'string') {
          return { name: f.split(/[/\\]/).pop() || f, path: resolve(f) };
        }
        const p = f?.path || '';
        return { ...f, name: f?.name || (p ? p.split(/[/\\]/).pop() : 'Photo'), path: resolve(p) };
      });
    }
    return downloadItem?.thumbnail
      ? [{ name: downloadItem.filename || 'Image', path: downloadItem.thumbnail }]
      : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [downloadItem?.id, downloadItem?.filename, downloadItem?.files, downloadItem?.outputDir, downloadItem?.thumbnail]);

  const totalCount = files.length || 1;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [urls, setUrls] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Layout & panels
  const [showDetails, setShowDetails] = useState(false);
  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'notes'
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const [videoThumbs, setVideoThumbs] = useState({});
  const videoRef = useRef(null);
  const thumbRefs = useRef([]);

  // View state: mode 'fit' scales the image to the stage, 'custom' uses `scale`.
  const [view, setView] = useState({ mode: 'fit', scale: 1, pan: { x: 0, y: 0 }, rotation: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [naturalDims, setNaturalDims] = useState(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const stageRef = useRef(null);
  const dragRef = useRef(null);

  // Notes (persisted per item)
  const itemKey = `nd_comments_${downloadItem?.id || downloadItem?.historyId || downloadItem?.filename || 'default'}`;
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  /* ── Derived values ───────────────────────────────────────────────────── */

  const currentFile = files[currentIndex] || files[0];
  const isCurVideo = isVideoFile(currentFile?.name);
  const activeUrl = urls[currentFile?.path] || currentFile?.path || downloadItem?.thumbnail;

  const quarterTurn = Math.abs(Math.round(view.rotation / 90)) % 2 === 1;
  const baseW = naturalDims ? (quarterTurn ? naturalDims.height : naturalDims.width) : 0;
  const baseH = naturalDims ? (quarterTurn ? naturalDims.width : naturalDims.height) : 0;

  const fitScale =
    naturalDims && viewport.w > 0 && viewport.h > 0
      ? clamp(
          Math.min(
            (viewport.w - STAGE_MARGIN * 2) / baseW,
            (viewport.h - STAGE_MARGIN * 2) / baseH,
            MAX_FIT_UPSCALE
          ),
          0.02,
          MAX_FIT_UPSCALE
        )
      : 1;

  const isFit = view.mode === 'fit';
  const scale = isFit ? fitScale : view.scale;
  const canPan = !isFit && scale > fitScale * 1.001;
  const isActualSize = Math.abs(scale - 1) < 0.005;

  /* ── View actions ─────────────────────────────────────────────────────── */

  const clampPan = (p, s) => {
    const maxX = Math.max(0, (baseW * s + viewport.w) / 2 - 120);
    const maxY = Math.max(0, (baseH * s + viewport.h) / 2 - 120);
    return { x: clamp(p.x, -maxX, maxX), y: clamp(p.y, -maxY, maxY) };
  };

  // Zoom to `nextRaw`, keeping the point under `anchor` (relative to stage centre) fixed.
  const zoomTo = (nextRaw, anchor) => {
    setView((v) => {
      const s1 = v.mode === 'fit' ? fitScale : v.scale;
      const s2 = clamp(nextRaw, MIN_SCALE, MAX_SCALE);
      if (Math.abs(s2 - fitScale) / fitScale < 0.02) {
        return { ...v, mode: 'fit', pan: { x: 0, y: 0 } }; // snap back to fit
      }
      const a = anchor || { x: 0, y: 0 };
      const ratio = s2 / s1;
      const pan = clampPan(
        { x: a.x - (a.x - v.pan.x) * ratio, y: a.y - (a.y - v.pan.y) * ratio },
        s2
      );
      return { ...v, mode: 'custom', scale: s2, pan };
    });
  };

  const zoomIn = () => zoomTo(scale * ZOOM_STEP);
  const zoomOut = () => zoomTo(scale / ZOOM_STEP);
  const toFit = () => setView((v) => ({ ...v, mode: 'fit', pan: { x: 0, y: 0 } }));
  const toActualSize = () => zoomTo(1);
  const rotate = (dir = 1) =>
    setView((v) => ({ ...v, mode: 'fit', pan: { x: 0, y: 0 }, rotation: v.rotation + 90 * dir }));

  const anchorFromEvent = (e) => {
    const r = stageRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
  };

  const handleWheel = (e) => {
    if (isCurVideo || !naturalDims) return;
    e.preventDefault();
    zoomTo(scale * Math.exp(-e.deltaY * 0.0015), anchorFromEvent(e));
  };

  const handleDoubleClick = (e) => {
    if (isCurVideo || !naturalDims || e.target.closest('button')) return;
    if (isFit) zoomTo(Math.max(1, fitScale * 2), anchorFromEvent(e));
    else toFit();
  };

  const handlePointerDown = (e) => {
    if (!canPan || e.button !== 0 || e.target.closest('button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { sx: e.clientX, sy: e.clientY, px: view.pan.x, py: view.pan.y };
    setIsDragging(true);
  };

  const handlePointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const next = { x: d.px + e.clientX - d.sx, y: d.py + e.clientY - d.sy };
    setView((v) => ({ ...v, pan: clampPan(next, scale) }));
  };

  const endDrag = () => {
    dragRef.current = null;
    setIsDragging(false);
  };

  const handlePrev = () => setCurrentIndex((i) => (i > 0 ? i - 1 : files.length - 1));
  const handleNext = () => setCurrentIndex((i) => (i < files.length - 1 ? i + 1 : 0));

  const toggleVideo = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  /* ── Favourites & notes ───────────────────────────────────────────────── */

  const favKey = `nd_fav_${downloadItem?.id || downloadItem?.filename || 'item'}`;

  const toggleFavorite = () => {
    try {
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
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      }),
    };
    const updated = [item, ...comments];
    setComments(updated);
    try { localStorage.setItem(itemKey, JSON.stringify(updated)); } catch {}
    setNewComment('');
  };

  const copyPath = () => {
    const p = currentFile?.path || downloadItem?.outputDir || '';
    if (p && navigator.clipboard) {
      navigator.clipboard.writeText(p);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2000);
    }
    setShowMoreMenu(false);
  };

  const handleOpenFolder = () => {
    const target = outDir || downloadItem?.outputDir || currentFile?.path;
    if (target) api.openOutputFolder(target);
  };

  /* ── Effects ──────────────────────────────────────────────────────────── */

  // Details panel starts closed for each new item
  useEffect(() => {
    setShowDetails(false);
    setShowMoreMenu(false);
  }, [downloadItem?.id, downloadItem?.filename]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(itemKey);
      setComments(saved ? JSON.parse(saved) : []);
    } catch {
      setComments([]);
    }
  }, [itemKey]);

  useEffect(() => {
    try { setIsFavorite(localStorage.getItem(favKey) === 'true'); } catch { setIsFavorite(false); }
  }, [favKey]);

  // Reset the view whenever the displayed file changes
  useEffect(() => {
    setView({ mode: 'fit', scale: 1, pan: { x: 0, y: 0 }, rotation: 0 });
    setNaturalDims(null);
    setLoadError(false);
  }, [currentIndex, downloadItem?.id]);

  // Track stage size so "fit" always matches the real available space
  useEffect(() => {
    if (!isOpen) return undefined;
    const el = stageRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => {
      setViewport({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isOpen, downloadItem?.id]);

  // Always read the latest handlers from here, so listeners below stay stable
  const actionsRef = useRef({});
  actionsRef.current = {
    onClose, handlePrev, handleNext, zoomIn, zoomOut, toFit, toActualSize, rotate,
    toggleVideo, handleWheel, isFit, isCurVideo, showMoreMenu,
    closeMenu: () => setShowMoreMenu(false),
    toggleDetails: () => setShowDetails((s) => !s),
    toggleMaximize: () => setIsMaximized((m) => !m),
  };

  // Wheel must be a non-passive native listener, otherwise preventDefault() is ignored
  useEffect(() => {
    if (!isOpen) return undefined;
    const el = stageRef.current;
    if (!el) return undefined;
    const onWheel = (e) => actionsRef.current.handleWheel(e);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [isOpen, downloadItem?.id]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e) => {
      const t = e.target;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const a = actionsRef.current;
      const key = e.key.toLowerCase();

      if (e.key === 'Escape') {
        e.preventDefault();
        if (a.showMoreMenu) a.closeMenu();
        else if (!a.isFit) a.toFit();
        else a.onClose();
      } else if (e.code === 'Space') {
        if (a.isCurVideo) { e.preventDefault(); a.toggleVideo(); }
      } else if (e.key === 'ArrowLeft') { e.preventDefault(); a.handlePrev(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); a.handleNext(); }
      else if (e.key === '+' || e.key === '=') { e.preventDefault(); a.zoomIn(); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); a.zoomOut(); }
      else if (e.key === '0') { e.preventDefault(); a.toFit(); }
      else if (e.key === '1') { e.preventDefault(); a.toActualSize(); }
      else if (key === 'r') { e.preventDefault(); a.rotate(e.shiftKey ? -1 : 1); }
      else if (key === 'i') { e.preventDefault(); a.toggleDetails(); }
      else if (key === 'f') { e.preventDefault(); a.toggleMaximize(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  // Resolve media URLs through the pywebview bridge
  useEffect(() => {
    let active = true;
    async function loadUrls() {
      if (!files.length) { setIsLoading(false); return; }
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
        if (active) { setUrls(directMap); setIsLoading(false); }
        return;
      }

      try {
        const res = await api.getMediaUrls(localPaths);
        if (!active) return;
        const merged = { ...directMap, ...(res?.urls || {}) };
        localPaths.forEach((p) => {
          if (!merged[p] && downloadItem?.thumbnail) merged[p] = downloadItem.thumbnail;
        });
        setUrls(merged);
        setIsLoading(false);
      } catch {
        if (active) { setUrls(directMap); setIsLoading(false); }
      }
    }
    loadUrls();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  // Video poster frames for the filmstrip
  useEffect(() => {
    let active = true;
    async function loadVideoThumbs() {
      for (const f of files) {
        if (isVideoFile(f.name) && f.path && !f.path.startsWith('http')) {
          try {
            const res = await api.getVideoThumbnailUrl(f.path);
            if (active && res?.ok && res.url) {
              setVideoThumbs((prev) => ({ ...prev, [f.path]: res.url }));
            }
          } catch {}
        }
      }
    }
    loadVideoThumbs();
    return () => { active = false; };
  }, [files]);

  // Keep the active thumbnail visible in the filmstrip
  useEffect(() => {
    thumbRefs.current[currentIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentIndex]);

  if (!isOpen || !downloadItem) return null;

  /* ── Metadata ─────────────────────────────────────────────────────────── */

  const filename = currentFile?.name || downloadItem.filename || 'Untitled';
  const fileExt = filename.includes('.')
    ? filename.split('.').pop().toUpperCase()
    : (isCurVideo ? 'VIDEO' : 'IMAGE');

  const sizeBytes =
    currentFile?.sizeBytes ?? currentFile?.size ?? (totalCount === 1 ? downloadItem.sizeBytes : null);
  const formattedSize = sizeBytes ? fmtBytes(sizeBytes) : null;

  const dimensionsStr = naturalDims
    ? `${naturalDims.width} × ${naturalDims.height}`
    : (downloadItem.res || downloadItem.dimensions || null);

  const rawDate = downloadItem.finished_at || downloadItem.timestamp || downloadItem.date;
  const dateStr = rawDate ? fmtDate(rawDate) : null;

  const kindLabel = totalCount === 1 ? (isCurVideo ? 'Video' : 'Photo') : `${totalCount} items`;
  const subtitle = [kindLabel, formattedSize, fileExt].filter(Boolean).join(' · ');

  const detailRows = [
    { icon: Scan, label: 'Dimensions', value: dimensionsStr },
    { icon: Database, label: 'Size', value: formattedSize },
    { icon: isCurVideo ? Film : ImageIcon, label: 'Type', value: `${isCurVideo ? 'Video' : 'Photo'} · ${fileExt}` },
    { icon: Calendar, label: 'Date modified', value: dateStr },
    { icon: User, label: 'Source', value: downloadItem.uploader },
    { icon: MapPin, label: 'Location', value: downloadItem.location },
  ].filter((r) => r.value);

  const hasAlpha = !isCurVideo && TRANSPARENT_EXTS.includes(fileExt.toLowerCase());

  /* ── Render ───────────────────────────────────────────────────────────── */

  return (
    <div
      className={`fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center select-none animate-fadeIn ${
        isMaximized ? 'p-0' : 'p-2 sm:p-6'
      }`}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* ── WINDOW SHELL ── */}
      <div
        className={`bg-[#0a0f1d]/95 backdrop-blur-2xl border border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden transition-all duration-200 ${
          isMaximized ? 'w-full h-full rounded-none' : 'w-full max-w-7xl h-[90vh] rounded-3xl'
        }`}
      >
        {/* ── HEADER ── */}
        <header className="h-14 px-4 sm:px-5 bg-[#0e1628]/80 border-b border-white/5 flex items-center justify-between shrink-0 relative z-30">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex flex-col items-center">
              <IconButton title="Back (Esc)" onClick={onClose}>
                <ArrowLeft className="w-[18px] h-[18px]" />
              </IconButton>
              <div className="w-5 h-0.5 bg-sky-400 rounded-full shadow-[0_0_8px_rgba(56,189,248,0.9)] -mt-0.5" />
            </div>

            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-slate-100 truncate tracking-tight">{filename}</span>
              <span className="text-xs text-slate-400 truncate">{subtitle}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <IconButton
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              onClick={toggleFavorite}
              active={isFavorite}
              className={isFavorite ? '!bg-rose-500/15 !text-rose-400' : ''}
            >
              <Heart className={`w-[18px] h-[18px] ${isFavorite ? 'fill-rose-400' : ''}`} />
            </IconButton>

            <IconButton title="Details (I)" onClick={() => setShowDetails((s) => !s)} active={showDetails}>
              <Info className="w-[18px] h-[18px]" />
            </IconButton>

            <div className="relative">
              <IconButton title="More options" onClick={() => setShowMoreMenu((s) => !s)} active={showMoreMenu}>
                <MoreHorizontal className="w-[18px] h-[18px]" />
              </IconButton>

              {showMoreMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                  <div className="absolute right-0 top-11 w-52 bg-[#101726] border border-white/10 rounded-2xl shadow-2xl p-1.5 z-50 text-xs text-slate-200 animate-fadeIn">
                    <button
                      onClick={copyPath}
                      className="w-full px-3 py-2 rounded-xl text-left hover:bg-white/10 flex items-center gap-2.5 transition-colors"
                    >
                      {copiedPath
                        ? <Check className="w-4 h-4 text-emerald-400" />
                        : <Copy className="w-4 h-4 text-slate-400" />}
                      <span>{copiedPath ? 'Path copied' : 'Copy file path'}</span>
                    </button>
                    <button
                      onClick={() => { if (currentFile?.path) api.openFile(currentFile.path); setShowMoreMenu(false); }}
                      className="w-full px-3 py-2 rounded-xl text-left hover:bg-white/10 flex items-center gap-2.5 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 text-slate-400" />
                      <span>Open in default app</span>
                    </button>
                    <button
                      onClick={() => { handleOpenFolder(); setShowMoreMenu(false); }}
                      className="w-full px-3 py-2 rounded-xl text-left hover:bg-white/10 flex items-center gap-2.5 transition-colors"
                    >
                      <Folder className="w-4 h-4 text-slate-400" />
                      <span>Open containing folder</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* ── BODY ── */}
        <div className="flex-1 flex min-h-0 overflow-hidden">

          {/* FILMSTRIP: only when there is more than one item */}
          {totalCount > 1 && (
            <aside className="w-[88px] shrink-0 bg-[#0c1221] border-r border-white/5 flex flex-col">
              <div className="p-3 pb-2">
                <div className="w-full py-1.5 rounded-xl bg-[#131b2c] border border-white/10 text-[11px] font-semibold text-slate-200 text-center whitespace-nowrap tabular-nums">
                  {currentIndex + 1} / {totalCount}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-3 pb-3 pt-1 flex flex-col items-center gap-2.5 scrollbar-thin">
                {files.map((file, i) => {
                  const isVid = isVideoFile(file.name);
                  const u = isVid ? (videoThumbs[file.path] || urls[file.path]) : (urls[file.path] || file.path);
                  const isActive = currentIndex === i;
                  return (
                    <button
                      key={`${file.path}-${i}`}
                      ref={(el) => { thumbRefs.current[i] = el; }}
                      onClick={() => setCurrentIndex(i)}
                      title={`${file.name || `Item ${i + 1}`} ${isVid ? '(Video)' : '(Photo)'}`}
                      className={`w-16 h-12 rounded-xl overflow-hidden shrink-0 relative group transition-all duration-200 focus:outline-none ${
                        isActive
                          ? 'ring-2 ring-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.45)] opacity-100'
                          : 'ring-1 ring-white/10 opacity-55 hover:opacity-100 hover:ring-white/30'
                      }`}
                    >
                      {u ? (
                        <img src={u} alt={file.name} className="w-full h-full object-cover" draggable={false} />
                      ) : (
                        <div className="w-full h-full bg-[#111827] flex items-center justify-center text-slate-500">
                          {isVid ? <Film className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                        </div>
                      )}
                      {isVid && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/35 group-hover:bg-black/20 transition-colors">
                          <div className="w-5 h-5 rounded-full bg-black/60 flex items-center justify-center">
                            <Play className="w-2.5 h-2.5 text-white fill-white ml-0.5" />
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </aside>
          )}

          {/* CENTRE: canvas + docked toolbar */}
          <main className="flex-1 min-w-0 flex flex-col p-3 gap-3">
            <div
              ref={stageRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onDoubleClick={handleDoubleClick}
              className={`group flex-1 min-h-0 relative rounded-2xl border border-white/5 overflow-hidden flex items-center justify-center touch-none bg-[radial-gradient(ellipse_at_center,#0d1426_0%,#060a14_100%)] ${
                canPan ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
              }`}
            >
              {isLoading ? (
                <div className="flex flex-col items-center gap-3 text-slate-400 text-xs">
                  <div className="w-8 h-8 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
                  <span>Loading {isCurVideo ? 'video' : 'photo'}…</span>
                </div>
              ) : loadError ? (
                <div className="flex flex-col items-center gap-3 text-center max-w-xs">
                  <div className="w-14 h-14 rounded-2xl bg-[#111827] border border-white/10 flex items-center justify-center">
                    <ImageOff className="w-6 h-6 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">Can't display this file</p>
                    <p className="text-xs text-slate-500 mt-1">It may be missing, moved or corrupted.</p>
                  </div>
                  {currentFile?.path && (
                    <ToolButton title="Open in default app" onClick={() => api.openFile(currentFile.path)}>
                      <ExternalLink className="w-4 h-4" /> Open in default app
                    </ToolButton>
                  )}
                </div>
              ) : isCurVideo ? (
                <div className="absolute inset-0 flex items-center justify-center p-6">
                  <video
                    key={currentFile?.path}
                    ref={videoRef}
                    src={activeUrl}
                    controls
                    autoPlay
                    onError={() => setLoadError(true)}
                    onLoadedMetadata={(e) =>
                      setNaturalDims({ width: e.target.videoWidth, height: e.target.videoHeight })
                    }
                    className="max-w-full max-h-full rounded-xl bg-black shadow-2xl outline-none"
                  />
                </div>
              ) : (
                <img
                  key={currentFile?.path}
                  src={activeUrl}
                  alt={filename}
                  draggable={false}
                  onLoad={(e) =>
                    setNaturalDims({ width: e.target.naturalWidth, height: e.target.naturalHeight })
                  }
                  onError={() => setLoadError(true)}
                  className="shrink-0 select-none shadow-2xl"
                  style={{
                    width: naturalDims?.width,
                    height: naturalDims?.height,
                    maxWidth: 'none',
                    opacity: naturalDims ? 1 : 0,
                    transform: `translate(${view.pan.x}px, ${view.pan.y}px) scale(${scale}) rotate(${view.rotation}deg)`,
                    transition: isDragging
                      ? 'none'
                      : 'transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 200ms ease-out',
                    imageRendering: scale > 2 ? 'pixelated' : 'auto',
                    ...(hasAlpha ? CHECKER_STYLE : null),
                  }}
                />
              )}

              {/* Prev / next: appear on hover or keyboard focus */}
              {totalCount > 1 && !isLoading && (
                <>
                  <button
                    onClick={handlePrev}
                    title="Previous (←)"
                    aria-label="Previous"
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#0e1628]/80 backdrop-blur-md border border-white/10 text-white flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-sky-400 hover:text-slate-950 active:scale-95 transition-all z-20"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleNext}
                    title="Next (→)"
                    aria-label="Next"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#0e1628]/80 backdrop-blur-md border border-white/10 text-white flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-sky-400 hover:text-slate-950 active:scale-95 transition-all z-20"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            {/* ── TOOLBAR (docked below the canvas, never covers the image) ── */}
            <div className="flex justify-center shrink-0">
              <div className="flex items-center p-1.5 rounded-2xl bg-[#0e1628]/80 backdrop-blur-xl border border-white/10 shadow-xl text-slate-300">
                {isCurVideo ? (
                  <>
                    <ToolButton
                      title="Open in default player"
                      onClick={() => currentFile?.path && api.openFile(currentFile.path)}
                    >
                      <ExternalLink className="w-4 h-4" /> Open in player
                    </ToolButton>
                    <Divider />
                    <IconButton
                      title={isMaximized ? 'Restore window (F)' : 'Fill window (F)'}
                      onClick={() => setIsMaximized((m) => !m)}
                    >
                      {isMaximized ? <Shrink className="w-[18px] h-[18px]" /> : <Expand className="w-[18px] h-[18px]" />}
                    </IconButton>
                  </>
                ) : (
                  <>
                    <IconButton title="Zoom out (−)" onClick={zoomOut}>
                      <ZoomOut className="w-[18px] h-[18px]" />
                    </IconButton>
                    <span className="w-14 text-center text-xs font-semibold text-slate-200 tabular-nums">
                      {Math.round(scale * 100)}%
                    </span>
                    <IconButton title="Zoom in (+)" onClick={zoomIn}>
                      <ZoomIn className="w-[18px] h-[18px]" />
                    </IconButton>

                    <Divider />

                    <ToolButton title="Fit to window (0)" onClick={toFit} active={isFit}>Fit</ToolButton>
                    <ToolButton title="Actual size (1)" onClick={toActualSize} active={!isFit && isActualSize}>100%</ToolButton>

                    <Divider />

                    <IconButton title="Rotate left (Shift+R)" onClick={() => rotate(-1)}>
                      <RotateCcw className="w-[18px] h-[18px]" />
                    </IconButton>
                    <IconButton title="Rotate right (R)" onClick={() => rotate(1)}>
                      <RotateCw className="w-[18px] h-[18px]" />
                    </IconButton>

                    <Divider />

                    <IconButton
                      title={isMaximized ? 'Restore window (F)' : 'Fill window (F)'}
                      onClick={() => setIsMaximized((m) => !m)}
                    >
                      {isMaximized ? <Shrink className="w-[18px] h-[18px]" /> : <Expand className="w-[18px] h-[18px]" />}
                    </IconButton>
                  </>
                )}
              </div>
            </div>
          </main>

          {/* DETAILS PANEL: slides open/closed */}
          <aside
            aria-hidden={!showDetails}
            className={`shrink-0 overflow-hidden bg-[#0c1221] transition-[width] duration-200 ease-out ${
              showDetails ? 'w-80 border-l border-white/5' : 'w-0'
            }`}
          >
            <div className="w-80 h-full flex flex-col p-4 gap-4 overflow-y-auto">
              {/* Segmented tabs */}
              <div className="grid grid-cols-2 p-1 rounded-2xl bg-[#0e1628] border border-white/5 shrink-0">
                {[
                  { id: 'details', label: 'Details' },
                  { id: 'notes', label: comments.length ? `Notes (${comments.length})` : 'Notes' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-1.5 text-xs font-semibold rounded-xl transition-all ${
                      activeTab === tab.id
                        ? 'bg-[#182338] text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === 'details' ? (
                <div className="flex flex-col gap-3">
                  <dl className="rounded-2xl bg-[#111827]/60 border border-white/5 divide-y divide-white/5">
                    {detailRows.map(({ icon: Icon, label, value }) => (
                      <div key={label} className="px-3.5 py-3 flex items-start gap-3">
                        <Icon className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <dt className="text-[11px] text-slate-500 font-medium">{label}</dt>
                          <dd className="text-xs font-semibold text-slate-200 break-words">{value}</dd>
                        </div>
                      </div>
                    ))}
                  </dl>

                  {currentFile?.path && !currentFile.path.startsWith('http') && (
                    <div className="rounded-2xl bg-[#111827]/60 border border-white/5 p-3.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] text-slate-500 font-medium">Path</span>
                        <button
                          onClick={copyPath}
                          title="Copy path"
                          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                        >
                          {copiedPath ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <p className="text-[11px] font-mono text-slate-300 break-all leading-relaxed">{currentFile.path}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <form onSubmit={handleAddComment} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add a note or tag…"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="flex-1 min-w-0 bg-[#111827] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-400"
                    />
                    <button
                      type="submit"
                      disabled={!newComment.trim()}
                      aria-label="Add note"
                      className="w-9 h-9 shrink-0 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 flex items-center justify-center transition-all"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>

                  <div className="flex flex-col gap-2">
                    {comments.length === 0 ? (
                      <div className="p-4 rounded-2xl bg-[#111827]/40 border border-white/5 text-center text-slate-500 text-xs">
                        No notes yet for this item.
                      </div>
                    ) : (
                      comments.map((c) => (
                        <div key={c.id} className="p-3 rounded-xl bg-[#111827]/80 border border-white/5 flex flex-col gap-1">
                          <span className="text-xs text-slate-200 break-words">{c.text}</span>
                          <span className="text-[10px] text-slate-500">{c.date}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Pinned footer action */}
              <button
                onClick={handleOpenFolder}
                title="Open folder in File Explorer"
                className="mt-auto w-full bg-[#111827]/80 hover:bg-[#1a253a] border border-white/5 rounded-2xl p-3.5 flex items-center justify-between text-slate-200 hover:text-white transition-all group shrink-0"
              >
                <span className="flex items-center gap-2.5">
                  <Folder className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-semibold">Open folder</span>
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
