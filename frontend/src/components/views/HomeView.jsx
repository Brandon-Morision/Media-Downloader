import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
  Link as LinkIcon, Film, Music, Image as ImageIcon,
  Play, ArrowRight, Search, Layers, ListVideo, ListMusic, Inbox,
} from 'lucide-react';
import {
  fmtBytes,
  playableFilesFor,
  isLikelyUrl,
  getBundleInfo,
} from '../../lib/formatters';
import MediaThumbnail from '../common/MediaThumbnail';

/* ────────────────────────────────────────────────────────────────────────────
   Uses the app's existing theme tokens (surface-1..4, border-subtle, border,
   brand-acc / brand-dim / brand-border, shadow-glow, --acc).
──────────────────────────────────────────────────────────────────────────── */

// Remembered across unmounts, so coming back to Home restores the scroll position.
let savedScrollTop = 0;

// Set to true while developing to see sample cards when the library is empty.
const SHOW_SAMPLE_ITEMS_WHEN_EMPTY = false;

const RECENT_LIMIT = 8;

// Soft fade for the glass layer behind the pinned search bar: solid under the
// bar, dissolving over the last 28px, so there is no hard edge or border line.
const FADE_MASK = 'linear-gradient(to bottom, #000 0, #000 calc(100% - 28px), transparent 100%)';

const CATEGORIES = [
  { id: 'video', label: 'Videos', hint: 'MP4, MOV, AVI, …', icon: Film, tint: '251, 113, 133' },
  { id: 'audio', label: 'Music', hint: 'MP3, WAV, M4A, …', icon: Music, tint: '167, 139, 250' },
  { id: 'image', label: 'Images', hint: 'JPG, PNG, WEBP, …', icon: ImageIcon, tint: '56, 189, 248' },
  { id: 'link', label: 'Paste link', hint: 'Any supported link', icon: LinkIcon, tint: '251, 191, 36' },
];

const BUNDLE_BADGES = [
  { key: 'isImageBundle', icon: Layers, label: 'Photos', cls: 'border-brand-border text-brand-acc' },
  { key: 'isVideoBundle', icon: ListVideo, label: 'Videos', cls: 'border-sky-500/40 text-sky-300' },
  { key: 'isAudioBundle', icon: ListMusic, label: 'Tracks', cls: 'border-purple-500/40 text-purple-300' },
  { key: 'isMixedBundle', icon: Layers, label: 'Items', cls: 'border-amber-500/40 text-amber-300' },
];

const SAMPLE_ITEMS = [
  { id: 'demo-1', filename: 'Beautiful Mountains.mp4', sizeBytes: 25800000, duration: '12:43', res: '1080p', timeAgo: '2h ago', type: 'video', thumbnail: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&auto=format&fit=crop&q=80' },
  { id: 'demo-2', filename: 'Chill Vibes.mp3', sizeBytes: 8800000, duration: '3:45', res: '320 kbps', timeAgo: '3h ago', type: 'audio', thumbnail: null },
  { id: 'demo-3', filename: 'Lake View.jpg', sizeBytes: 2200000, duration: null, res: '1920 × 1080', timeAgo: '5h ago', type: 'image', thumbnail: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop&q=80' },
  { id: 'demo-4', filename: 'Concert Night.mp4', sizeBytes: 19600000, duration: '14:32', res: '720p', timeAgo: '6h ago', type: 'video', thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80' },
  { id: 'demo-5', filename: 'City Skyline.jpg', sizeBytes: 3100000, duration: null, res: '4K', timeAgo: '8h ago', type: 'image', thumbnail: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=600&auto=format&fit=crop&q=80' },
  { id: 'demo-6', filename: 'Lofi Study Beats.mp3', sizeBytes: 6400000, duration: '1:02:15', res: '320 kbps', timeAgo: '10h ago', type: 'audio', thumbnail: null },
  { id: 'demo-7', filename: 'Ocean Waves 4K.mp4', sizeBytes: 312000000, duration: '30:00', res: '4K', timeAgo: '1d ago', type: 'video', thumbnail: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=600&auto=format&fit=crop&q=80' },
  { id: 'demo-8', filename: 'Sunset Drive.mp4', sizeBytes: 48000000, duration: '5:11', res: '1080p', timeAgo: '1d ago', type: 'video', thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80' },
];

/* ── Category card (compact) ─────────────────────────────────────────────── */

function CategoryCard({ category, onClick }) {
  const { label, hint, icon: Icon, tint } = category;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative text-left rounded-xl p-3 min-h-[80px] flex items-center gap-3.5 overflow-hidden bg-surface-2 border border-white/5 hover:border-white/15 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-[transform,box-shadow,border-color] duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-acc/60"
      style={{ backgroundImage: `linear-gradient(135deg, rgba(${tint}, 0.14), rgba(${tint}, 0.02) 70%)` }}
    >
      {/* Stronger wash on hover */}
      <span
        aria-hidden
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ backgroundImage: `linear-gradient(135deg, rgba(${tint}, 0.12), transparent 70%)` }}
      />
      <span
        className="relative w-10 h-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200"
        style={{ backgroundColor: `rgba(${tint}, 0.16)`, color: `rgb(${tint})` }}
      >
        <Icon className="w-5 h-5" />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="block font-semibold text-sm text-slate-100 tracking-tight truncate">{label}</span>
        <span className="block text-[11px] text-slate-400 mt-0.5 truncate">{hint}</span>
      </span>
    </button>
  );
}

/* ── Recent download card ────────────────────────────────────────────────── */

function RecentCard({ item, onOpenPlayer, onOpenGallery }) {
  const bundle = getBundleInfo(item);
  const badge = BUNDLE_BADGES.find((b) => bundle[b.key]);
  const isBundle = !!badge;

  const isImageCategory = bundle.isImageCat || bundle.isImageBundle;
  const playable = playableFilesFor(item);
  const canOpen = isImageCategory ? Boolean(onOpenGallery) : playable.length > 0;

  const open = () => {
    if (isImageCategory && onOpenGallery) {
      onOpenGallery(item);
    } else if (playable.length > 0 && onOpenPlayer) {
      onOpenPlayer(playable, item.filename);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      open();
    }
  };

  return (
    <div
      role="button"
      tabIndex={canOpen ? 0 : -1}
      aria-disabled={!canOpen}
      aria-label={canOpen ? `Open ${item.filename}` : undefined}
      onClick={open}
      onKeyDown={onKeyDown}
      className={`group relative flex flex-col overflow-hidden rounded-2xl bg-surface-1 border border-border-subtle shadow-sm outline-none transition-[transform,box-shadow,border-color,background-color] duration-200 ${
        canOpen
          ? 'cursor-pointer hover:bg-surface-2 hover:border-border hover:-translate-y-1 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-brand-acc/60'
          : 'cursor-default'
      }`}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-3 flex items-center justify-center">
        <MediaThumbnail
          item={item}
          className={`w-full h-full object-cover transform-gpu transition-transform duration-500 ease-out ${
            canOpen ? 'group-hover:scale-105' : ''
          }`}
        />

        {/* Blend into the text area */}
        <div
          className={`absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface-1 via-surface-1/70 to-transparent pointer-events-none transition-colors duration-200 ${
            canOpen ? 'group-hover:from-surface-2 group-hover:via-surface-2/70' : ''
          }`}
        />

        {/* Bundle badge */}
        {badge && (
          <div
            className={`absolute top-2.5 left-2.5 z-10 px-2.5 py-0.5 rounded-lg bg-black/75 border text-[10.5px] font-bold flex items-center gap-1.5 shadow-lg ${badge.cls}`}
          >
            <badge.icon className="w-3.5 h-3.5" />
            <span>{bundle.count} {badge.label}</span>
          </div>
        )}

        {/* Duration */}
        {!isBundle && item.duration && (
          <span className="absolute bottom-2 right-2.5 z-10 px-2 py-0.5 rounded-md bg-black/75 border border-white/10 text-[10px] font-mono font-medium text-white shadow-sm">
            {item.duration}
          </span>
        )}

        {/* Hover play (only when the card can actually open) */}
        {canOpen && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/35 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-200">
            <div className="w-11 h-11 rounded-full bg-brand-acc text-slate-950 flex items-center justify-center shadow-glow scale-90 group-hover:scale-100 group-focus-visible:scale-100 transition-transform duration-200">
              <Play className="w-5 h-5 ml-0.5 fill-current" />
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col px-3.5 pt-2 pb-3.5 gap-1 min-w-0">
        <span
          className={`text-sm font-semibold text-slate-100 truncate leading-tight transition-colors ${
            canOpen ? 'group-hover:text-brand-acc' : ''
          }`}
          title={item.filename}
        >
          {item.filename}
        </span>
        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400 font-medium">
          <span className="truncate">
            {bundle.count > 1
              ? `${bundle.count} files · ${fmtBytes(item.sizeBytes)}`
              : (item.res || fmtBytes(item.sizeBytes))}
          </span>
          <span className="text-slate-500 font-mono text-[10.5px] shrink-0">{item.timeAgo || 'Recent'}</span>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   HOME VIEW
   One scroll area. The hero scrolls away; the search bar pins to the top and
   floats over the content on a soft frosted fade (no divider lines).
════════════════════════════════════════════════════════════════════════════ */

export default function HomeView({
  onAnalyzeUrl,
  onOpenPlayer,
  onOpenGallery,
  onSwitchToLibrary,
  onSwitchToDownloader,
  downloads = [],
}) {
  const [urlInput, setUrlInput] = useState('');
  const [isStuck, setIsStuck] = useState(false); // is the search bar pinned to the top?

  const scrollRef = useRef(null);
  const sentinelRef = useRef(null);
  const inputRef = useRef(null);

  /* ── Scroll behaviour ─────────────────────────────────────────────────── */

  // Restore where the user was when they left Home
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = savedScrollTop;
  }, []);

  // The bar counts as pinned exactly when its sentinel scrolls out of the top.
  useEffect(() => {
    const root = scrollRef.current;
    const target = sentinelRef.current;
    if (!root || !target || typeof IntersectionObserver === 'undefined') return undefined;

    const io = new IntersectionObserver(
      ([entry]) => {
        const rootTop = entry.rootBounds ? entry.rootBounds.top : 0;
        setIsStuck(!entry.isIntersecting && entry.boundingClientRect.top < rootTop);
      },
      { root, threshold: 0 },
    );
    io.observe(target);
    return () => io.disconnect();
  }, []);

  /* ── Data ─────────────────────────────────────────────────────────────── */

  const recentItems = downloads.filter((d) => d.state === 'done').slice(0, RECENT_LIMIT);
  const displayItems =
    recentItems.length > 0 ? recentItems : (SHOW_SAMPLE_ITEMS_WHEN_EMPTY ? SAMPLE_ITEMS : []);

  /* ── Handlers ─────────────────────────────────────────────────────────── */

  const handlePasteClick = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setUrlInput(text.trim());
        inputRef.current?.focus();
      }
    } catch {}
  };

  const handleInputSubmit = (e) => {
    e.preventDefault();
    const clean = urlInput.trim();
    if (!clean) return;
    // Always route through the Downloader: URLs trigger link-preview, text does YouTube search
    onAnalyzeUrl(clean);
    setUrlInput('');
  };

  const handleCategoryClick = (category) => {
    if (category.id === 'link') handlePasteClick();
    else if (onSwitchToDownloader) onSwitchToDownloader();
  };

  const hasText = urlInput.trim().length > 0;
  const looksLikeUrl = isLikelyUrl(urlInput);

  /* ── Render ───────────────────────────────────────────────────────────── */

  return (
    <div
      ref={scrollRef}
      onScroll={(e) => { savedScrollTop = e.currentTarget.scrollTop; }}
      className="flex-1 min-h-0 flex flex-col h-full w-full overflow-y-auto overscroll-contain select-none scrollbar-thin [scrollbar-gutter:stable]"
    >
      {/* ── HERO (scrolls away) ── */}
      <section className="relative shrink-0 px-8 pt-9 pb-3">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-72"
          style={{
            background:
              'radial-gradient(ellipse 60% 100% at 50% 0%, color-mix(in srgb, var(--acc) 14%, transparent), transparent 70%)',
          }}
        />
        <div className="relative flex flex-col items-center text-center gap-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Download{' '}
            <span
              className="text-brand-acc"
              style={{
                backgroundImage: 'linear-gradient(100deg, var(--acc) 0%, #38bdf8 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Anything
            </span>
          </h1>
          <p className="text-sm sm:text-base text-slate-400 font-medium">
            Videos, images, music — from almost anywhere.
          </p>
        </div>
      </section>

      {/* Sentinel: when this leaves the top, the search bar below is pinned */}
      <div ref={sentinelRef} aria-hidden className="h-px -mb-px w-full shrink-0 pointer-events-none" />

      {/* ── SEARCH (pinned) ── */}
      <div className="sticky top-0 z-30 shrink-0 px-8 py-3">
        {/* Frosted layer that fades out below the bar. Only visible once pinned. */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-x-0 top-0 -bottom-7 bg-surface-1/70 backdrop-blur-xl transition-opacity duration-200 ${
            isStuck ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ WebkitMaskImage: FADE_MASK, maskImage: FADE_MASK }}
        />

        <form onSubmit={handleInputSubmit} className="relative w-full max-w-3xl mx-auto">
          <div
            className={`flex items-center rounded-full p-1.5 pl-5 bg-surface-2/80 backdrop-blur-xl border transition-[border-color,box-shadow] duration-200 focus-within:border-brand-acc focus-within:shadow-glow ${
              isStuck
                ? 'border-white/15 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.7)]'
                : 'border-border-subtle hover:border-border shadow-lg'
            }`}
          >
            {hasText && !looksLikeUrl ? (
              <Search className="w-4 h-4 text-sky-400 shrink-0 mr-3 pointer-events-none" />
            ) : (
              <LinkIcon className="w-4 h-4 text-slate-400 shrink-0 mr-3 pointer-events-none" />
            )}

            <input
              ref={inputRef}
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Paste link to download, or type anything to search YouTube…"
              aria-label="Paste a link or search YouTube"
              autoComplete="off"
              spellCheck={false}
              className="flex-1 min-w-0 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none pr-3 select-text"
            />

            {hasText ? (
              <button
                type="submit"
                className={`px-6 py-2 rounded-full font-bold text-xs tracking-wide shadow-glow transition-transform active:scale-95 shrink-0 ${
                  looksLikeUrl
                    ? 'bg-brand-acc text-slate-950 hover:opacity-95'
                    : 'bg-sky-500 text-slate-950 hover:bg-sky-400 shadow-sky-500/20'
                }`}
              >
                {looksLikeUrl ? 'Download' : 'Search'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePasteClick}
                className="px-6 py-2 rounded-full bg-brand-acc text-slate-950 font-bold text-xs tracking-wide hover:opacity-95 shadow-glow transition-transform active:scale-95 shrink-0"
              >
                Paste
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ── CATEGORIES ── */}
      <section className="shrink-0 px-8 pt-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 w-full">
          {CATEGORIES.map((c) => (
            <CategoryCard key={c.id} category={c} onClick={() => handleCategoryClick(c)} />
          ))}
        </div>
      </section>

      {/* ── RECENT DOWNLOADS ── */}
      <section className="shrink-0 px-8 pt-8 pb-10">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2.5">
            <span>Recent downloads</span>
            {displayItems.length > 0 && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface-3 text-slate-400 tabular-nums">
                {displayItems.length}
              </span>
            )}
          </h2>

          <button
            type="button"
            onClick={onSwitchToLibrary}
            className="text-xs font-semibold text-brand-acc hover:bg-surface-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-acc/60"
          >
            <span>View all</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {displayItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-subtle bg-surface-1/60 px-6 py-12 flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-brand-dim border border-brand-border text-brand-acc flex items-center justify-center">
              <Inbox className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Nothing downloaded yet</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Paste a link above and your finished downloads will show up here.
              </p>
            </div>
            <button
              type="button"
              onClick={handlePasteClick}
              className="mt-1 h-8 px-4 rounded-xl text-xs font-semibold bg-brand-dim text-brand-acc border border-brand-border hover:opacity-90 transition-opacity"
            >
              Paste a link
            </button>
          </div>
        ) : (
          <div
            className="grid gap-5"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
          >
            {displayItems.map((item) => (
              <RecentCard
                key={item.id}
                item={item}
                onOpenPlayer={onOpenPlayer}
                onOpenGallery={onOpenGallery}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
