import React, { useState } from 'react';
import {
  Link as LinkIcon, Film, Music, Image as ImageIcon,
  Play, ArrowRight, Search, Layers, ListVideo, ListMusic
} from 'lucide-react';
import {
  fmtBytes,
  playableFilesFor,
  isLikelyUrl,
  toolLabel,
  getBundleInfo
} from '../../lib/formatters';
import MediaThumbnail from '../common/MediaThumbnail';

export default function HomeView({
  onAnalyzeUrl,
  onAddDownload,
  onOpenPlayer,
  onSwitchToLibrary,
  onSwitchToDownloader,
  downloads = [],
  onShowToast,
}) {
  const [urlInput, setUrlInput] = useState('');

  // Extract recent completed downloads
  const completedDownloads = downloads.filter((d) => d.state === 'done');
  const recentItems = completedDownloads.slice(0, 8);

  // Fallback demo items if library is empty yet
  const displayItems = recentItems.length > 0 ? recentItems : [
    {
      id: 'demo-1',
      filename: 'Beautiful Mountains.mp4',
      sizeBytes: 25800000,
      duration: '12:43',
      res: '1080p',
      timeAgo: '2h ago',
      type: 'video',
      thumbnail: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'demo-2',
      filename: 'Chill Vibes.mp3',
      sizeBytes: 8800000,
      duration: '3:45',
      res: '320 kbps',
      timeAgo: '3h ago',
      type: 'audio',
      thumbnail: null,
    },
    {
      id: 'demo-3',
      filename: 'Lake View.jpg',
      sizeBytes: 2200000,
      duration: null,
      res: '1920 × 1080',
      timeAgo: '5h ago',
      type: 'image',
      thumbnail: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'demo-4',
      filename: 'Concert Night.mp4',
      sizeBytes: 19600000,
      duration: '14:32',
      res: '720p',
      timeAgo: '6h ago',
      type: 'video',
      thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'demo-5',
      filename: 'City Skyline.jpg',
      sizeBytes: 3100000,
      duration: null,
      res: '4K',
      timeAgo: '8h ago',
      type: 'image',
      thumbnail: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'demo-6',
      filename: 'Lofi Study Beats.mp3',
      sizeBytes: 6400000,
      duration: '1:02:15',
      res: '320 kbps',
      timeAgo: '10h ago',
      type: 'audio',
      thumbnail: null,
    },
    {
      id: 'demo-7',
      filename: 'Ocean Waves 4K.mp4',
      sizeBytes: 312000000,
      duration: '30:00',
      res: '4K',
      timeAgo: '1d ago',
      type: 'video',
      thumbnail: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'demo-8',
      filename: 'Sunset Drive.mp4',
      sizeBytes: 48000000,
      duration: '5:11',
      res: '1080p',
      timeAgo: '1d ago',
      type: 'video',
      thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80',
    },
  ];

  const handlePasteClick = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setUrlInput(text.trim());
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
    if (onSwitchToDownloader) onSwitchToDownloader();
  };

  const handleItemClick = (item) => {
    if (item.files && item.files.length > 0) {
      const playable = playableFilesFor(item);
      if (playable.length > 0) {
        onOpenPlayer(playable, item.filename);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto px-8 py-8 gap-8 w-full select-none">
      {/* ── 1. HERO SECTION ── */}
      <div className="flex flex-col items-center text-center mt-2 gap-2">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
          Download <span className="text-brand-acc">Anything</span>
        </h1>
        <p className="text-sm sm:text-base text-slate-400 font-medium">
          Videos, Images, Music — from almost anywhere.
        </p>
      </div>

      {/* ── 2. SEARCH & PASTE INPUT PILL ── */}
      <form onSubmit={handleInputSubmit} className="w-full max-w-4xl mx-auto">
        <div className="relative flex items-center bg-surface-2/90 border border-border-subtle hover:border-border rounded-full p-1.5 pl-4 shadow-xl transition-all focus-within:border-brand-acc focus-within:shadow-glow">
          {urlInput.trim() && !isLikelyUrl(urlInput) ? (
            <Search className="w-4 h-4 text-sky-400 shrink-0 mr-3 pointer-events-none" />
          ) : (
            <LinkIcon className="w-4 h-4 text-slate-400 shrink-0 mr-3 pointer-events-none" />
          )}

          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Paste link to download, or type anything to search YouTube…"
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none pr-3"
          />

          {urlInput.trim() ? (
            <button
              type="submit"
              className={`px-6 py-2 rounded-full font-bold text-xs tracking-wide shadow-glow transition-transform active:scale-95 shrink-0 ${
                isLikelyUrl(urlInput)
                  ? 'bg-brand-acc text-slate-950 hover:opacity-95'
                  : 'bg-sky-500 text-slate-950 hover:bg-sky-400 shadow-sky-500/20'
              }`}
            >
              {isLikelyUrl(urlInput) ? 'Download' : 'Search'}
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

      {/* ── 3. CATEGORY QUICK-ACTION CARDS (4 COLUMNS) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
        {/* Card 1: Videos */}
        <div
          onClick={() => handleCategoryClick('video')}
          className="rounded-2xl p-5 bg-gradient-to-br from-rose-500/90 to-red-600/90 text-white cursor-pointer hover:scale-[1.02] hover:shadow-xl transition-all duration-200 flex flex-col justify-between min-h-[130px] shadow-md group"
        >
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <Film className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-base tracking-tight">Videos</h3>
            <p className="text-xs text-white/80 font-medium mt-0.5">MP4, MOV, AVI, ...</p>
          </div>
        </div>

        {/* Card 2: Music */}
        <div
          onClick={() => handleCategoryClick('audio')}
          className="rounded-2xl p-5 bg-gradient-to-br from-violet-600/90 to-purple-600/90 text-white cursor-pointer hover:scale-[1.02] hover:shadow-xl transition-all duration-200 flex flex-col justify-between min-h-[130px] shadow-md group"
        >
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <Music className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-base tracking-tight">Music</h3>
            <p className="text-xs text-white/80 font-medium mt-0.5">MP3, WAV, M4A, ...</p>
          </div>
        </div>

        {/* Card 3: Images */}
        <div
          onClick={() => handleCategoryClick('image')}
          className="rounded-2xl p-5 bg-gradient-to-br from-sky-500/90 to-blue-600/90 text-white cursor-pointer hover:scale-[1.02] hover:shadow-xl transition-all duration-200 flex flex-col justify-between min-h-[130px] shadow-md group"
        >
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <ImageIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-base tracking-tight">Images</h3>
            <p className="text-xs text-white/80 font-medium mt-0.5">JPG, PNG, WEBP, ...</p>
          </div>
        </div>

        {/* Card 4: Paste Link */}
        <div
          onClick={handlePasteClick}
          className="rounded-2xl p-5 bg-gradient-to-br from-amber-500/90 to-orange-600/90 text-white cursor-pointer hover:scale-[1.02] hover:shadow-xl transition-all duration-200 flex flex-col justify-between min-h-[130px] shadow-md group"
        >
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <LinkIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-base tracking-tight">Paste Link</h3>
            <p className="text-xs text-white/80 font-medium mt-0.5">Any supported link</p>
          </div>
        </div>
      </div>

      {/* ── 4. RECENT DOWNLOADS SECTION ── */}
      <div className="flex flex-col gap-3.5 mt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-100 tracking-tight">Recent Downloads</h2>
          <button
            onClick={onSwitchToLibrary}
            className="text-xs font-semibold text-brand-acc hover:opacity-75 flex items-center gap-1 transition-colors"
          >
            <span>View all</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Recent Items Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {displayItems.map((item) => {
            const bundleInfo = getBundleInfo(item);
            return (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className="bg-surface-1 border border-border-subtle hover:border-border rounded-2xl overflow-hidden flex flex-col cursor-pointer hover:bg-surface-2 transition-all duration-200 group shadow-sm hover:shadow-xl hover:-translate-y-1 relative"
              >
                {/* Thumbnail / Visual Box - fills top, left, and right */}
                <div className="relative aspect-[16/11] sm:aspect-[4/3] w-full overflow-hidden bg-surface-3 flex items-center justify-center">
                  <MediaThumbnail
                    item={item}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                  />

                  {/* Gradient Blend into the bottom of the card where it meets words */}
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface-1 via-surface-1/70 to-transparent pointer-events-none transition-colors duration-200 group-hover:from-surface-2 group-hover:via-surface-2/70" />

                  {/* Album / Bundle Indicator: Top-left badge */}
                  {bundleInfo.isImageBundle && (
                    <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-lg bg-black/80 backdrop-blur-md border border-brand-border text-[10.5px] font-bold flex items-center gap-1.5 shadow-lg z-10" style={{color: 'var(--acc)'}}>
                      <Layers className="w-3.5 h-3.5" style={{color: 'var(--acc)'}} />
                      <span>{bundleInfo.count} Photos</span>
                    </div>
                  )}

                  {bundleInfo.isVideoBundle && (
                    <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-lg bg-black/80 backdrop-blur-md border border-sky-500/40 text-[10.5px] font-bold text-sky-300 flex items-center gap-1.5 shadow-lg z-10">
                      <ListVideo className="w-3.5 h-3.5 text-sky-400" />
                      <span>{bundleInfo.count} Videos</span>
                    </div>
                  )}

                  {bundleInfo.isAudioBundle && (
                    <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-lg bg-black/80 backdrop-blur-md border border-purple-500/40 text-[10.5px] font-bold text-purple-300 flex items-center gap-1.5 shadow-lg z-10">
                      <ListMusic className="w-3.5 h-3.5 text-purple-400" />
                      <span>{bundleInfo.count} Tracks</span>
                    </div>
                  )}

                  {bundleInfo.isMixedBundle && (
                    <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-lg bg-black/80 backdrop-blur-md border border-amber-500/40 text-[10.5px] font-bold text-amber-300 flex items-center gap-1.5 shadow-lg z-10">
                      <Layers className="w-3.5 h-3.5 text-amber-400" />
                      <span>{bundleInfo.count} Items</span>
                    </div>
                  )}

                  {/* Single Item Duration Badge */}
                  {!bundleInfo.isImageBundle && !bundleInfo.isVideoBundle && !bundleInfo.isAudioBundle && !bundleInfo.isMixedBundle && item.duration && (
                    <span className="absolute bottom-2 right-2.5 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md border border-white/10 text-[10px] font-mono font-medium text-white shadow-sm z-10">
                      {item.duration}
                    </span>
                  )}

                  {/* Hover Play Button */}
                  <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-200 z-10">
                    <div className="w-11 h-11 rounded-full bg-brand-acc text-slate-950 flex items-center justify-center shadow-glow group-hover:scale-110 transition-transform">
                      <Play className="w-5 h-5 ml-0.5 fill-current" />
                    </div>
                  </div>
                </div>

                {/* Info Text */}
                <div className="flex flex-col px-3.5 pt-2 pb-3.5 gap-1 min-w-0">
                  <span className="text-xs sm:text-sm font-semibold text-slate-100 truncate group-hover:text-brand-acc transition-colors leading-tight">
                    {item.filename}
                  </span>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-0.5 font-medium">
                    <span>
                      {bundleInfo.count > 1
                        ? `${bundleInfo.count} files · ${fmtBytes(item.sizeBytes)}`
                        : (item.res || fmtBytes(item.sizeBytes))}
                    </span>
                    <span className="text-slate-500 font-mono text-[10.5px]">{item.timeAgo || 'Recent'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
