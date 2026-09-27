import React, { useState } from 'react';
import {
  Film, Music, Image as ImageIcon, Search, Folder,
  Play, Trash2, LayoutGrid, List, MoreVertical, ExternalLink,
  Layers, Eye, Images, ListVideo, ListMusic, RotateCcw
} from 'lucide-react';
import { fmtBytes, fmtDate, getMediaCategory, playableFilesFor, galleryFilesFor, isImage, AUDIO_EXT } from '../../lib/formatters';
import { api } from '../../lib/api';
import MediaThumbnail from '../common/MediaThumbnail';

/**
 * Categorize media and detect multi-item bundles/albums across videos, photos, and audio.
 */
export function getBundleInfo(item) {
  let cat = item.category;
  if (!cat) {
    const detected = getMediaCategory(item);
    cat = detected === 'audio' ? 'music' : detected === 'gallery' ? 'image' : detected;
  }

  const filesList = Array.isArray(item.files) ? item.files : [];
  const playableList = playableFilesFor(item);

  let videoFilesCount = 0;
  let audioFilesCount = 0;
  let imageFilesCount = 0;

  for (const f of filesList) {
    const name = typeof f === 'string' ? f : f?.name || f?.path || '';
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (['mp4', 'mkv', 'webm', 'avi', 'mov', 'flv', 'm4v', 'ts'].includes(ext)) {
      videoFilesCount++;
    } else if (AUDIO_EXT.includes(ext)) {
      audioFilesCount++;
    } else if (isImage(name)) {
      imageFilesCount++;
    }
  }

  const totalCount = filesList.length || (item.itemsDone > 0 ? item.itemsDone : 0);
  const isAudioCat = cat === 'music' || cat === 'audio';
  const isVideoCat = cat === 'video';
  const isImageCat = cat === 'image' || cat === 'gallery';

  const isVideoBundle = videoFilesCount > 1 || (isVideoCat && (totalCount > 1 || playableList.length > 1));
  const isAudioBundle = audioFilesCount > 1 || (isAudioCat && totalCount > 1);
  const isImageBundle = imageFilesCount > 1 || (isImageCat && (totalCount > 1 || item.isAlbum));
  const isMixedBundle = !isVideoBundle && !isAudioBundle && !isImageBundle && totalCount > 1;

  const count = isVideoBundle
    ? (videoFilesCount || playableList.length || totalCount)
    : isAudioBundle
    ? (audioFilesCount || totalCount)
    : isImageBundle
    ? (imageFilesCount || totalCount || (item.isAlbum ? 6 : 1))
    : totalCount;

  return {
    cat,
    filesList,
    playableList,
    totalCount,
    isAudioCat,
    isVideoCat,
    isImageCat,
    isVideoBundle,
    isAudioBundle,
    isImageBundle,
    isMixedBundle,
    count,
  };
}

export default function LibraryView({
  downloads = [],
  onDeleteDownload,
  onClearHistory,
  onOpenPlayer,
  onOpenGallery,
  onSwitchToDownloader,
  onRefreshHistory,
}) {
  const [filter, setFilter] = useState('all'); // all | video | music | image
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // grid | list

  const doneDownloads = downloads.filter(
    (d) => d.state === 'done' || (d.files && d.files.length > 0)
  );

  const isDesktop = typeof window !== 'undefined' && Boolean(window.pywebview?.api);

  // Fallback demo items ONLY when previewing in standard browser without pywebview backend
  const displayItems = doneDownloads.length > 0 ? doneDownloads : (isDesktop ? [] : [
    {
      id: 'lib-1',
      filename: 'Amazing Travel Video.mp4',
      sizeBytes: 25800000,
      res: '1080p',
      duration: '12:43',
      category: 'video',
      thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'lib-2',
      filename: 'Sunset Beach.mp4',
      sizeBytes: 19100000,
      res: '720p',
      duration: '8:21',
      category: 'video',
      thumbnail: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'lib-3',
      filename: 'City Lights.mp4',
      sizeBytes: 12900000,
      res: '1080p',
      duration: '14:32',
      category: 'video',
      thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'lib-4',
      filename: 'My Favorite Song.mp3',
      sizeBytes: 8800000,
      res: '320 kbps',
      duration: null,
      category: 'music',
      thumbnail: null,
    },
    {
      id: 'lib-7',
      filename: 'Nature & Landscape Photography',
      sizeBytes: 28400000,
      res: '6 Photos',
      duration: null,
      category: 'gallery',
      isAlbum: true,
      thumbnail: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600&auto=format&fit=crop&q=80',
      files: [
        { name: 'Nature Wallpaper 01.jpg', path: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1200&auto=format&fit=crop&q=80' },
        { name: 'Forest Mist 02.jpg', path: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1200&auto=format&fit=crop&q=80' },
        { name: 'Ocean Sunset 03.jpg', path: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&auto=format&fit=crop&q=80' },
        { name: 'Tropical Paradise 04.jpg', path: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1200&auto=format&fit=crop&q=80' },
        { name: 'Mountain Peak 05.jpg', path: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&auto=format&fit=crop&q=80' },
        { name: 'Autumn Woods 06.jpg', path: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&auto=format&fit=crop&q=80' },
      ],
    },
  ]);

  // Filter items
  const filteredItems = displayItems.filter((item) => {
    const info = getBundleInfo(item);
    const cat = info.cat;

    if (filter === 'video' && cat !== 'video') return false;
    if (filter === 'music' && cat !== 'music' && cat !== 'audio') return false;
    if (filter === 'image' && cat !== 'image' && cat !== 'gallery') return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const title = (item.filename || '').toLowerCase();
      return title.includes(q);
    }
    return true;
  });

  const handleCardClick = (item) => {
    const info = getBundleInfo(item);

    // Image bundles and single images open with Gallery modal
    if (info.isImageCat) {
      onOpenGallery(item);
      return;
    }

    // Video bundles / single videos / audio albums
    if (info.playableList && info.playableList.length > 0) {
      onOpenPlayer(info.playableList, item.filename);
      return;
    }

    if (item.files && item.files.length > 0) {
      const galleries = galleryFilesFor(item);
      if (galleries.length > 0) {
        onOpenGallery(item);
        return;
      }
    }

    // Fallback open file if local path available
    const first = item.files?.[0];
    const path = typeof first === 'string' ? first : first?.path || '';
    if (path) api.openFile(path);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto px-6 py-6 gap-6 max-w-6xl mx-auto w-full select-none">
      {/* ── TOP SEARCH & CONTROLS BAR ── */}
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-extrabold text-slate-100 tracking-tight">Library</h1>

        <div className="flex items-center gap-3">
          {/* Search Input Bar */}
          <div className="relative flex-1 flex items-center bg-surface-2/90 border border-border-subtle hover:border-border rounded-xl px-3 h-10 shadow-sm focus-within:border-brand-acc transition-all">
            <Search className="w-4 h-4 text-slate-400 mr-2.5 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your media..."
              className="w-full bg-transparent text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
            />
          </div>

          {/* Sync History Button */}
          {onRefreshHistory && (
            <button
              onClick={onRefreshHistory}
              className="p-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-slate-400 hover:text-emerald-400 border border-border-subtle transition-colors shrink-0"
              title="Refresh library history from disk"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          {/* Grid vs List View Mode Switcher */}
          <div className="flex items-center bg-surface-2 border border-border-subtle p-1 rounded-xl shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'grid' ? 'bg-surface-3 text-emerald-400' : 'text-slate-400 hover:text-white'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'list' ? 'bg-surface-3 text-emerald-400' : 'text-slate-400 hover:text-white'
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── CATEGORY FILTER PILLS ── */}
        <div className="flex items-center gap-2 pt-1">
          {[
            { id: 'all', label: 'All' },
            { id: 'video', label: 'Videos', icon: Film },
            { id: 'music', label: 'Music', icon: Music },
            { id: 'image', label: 'Images', icon: ImageIcon },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = filter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  isActive
                    ? 'bg-brand-acc text-slate-950 shadow-glow font-bold'
                    : 'bg-surface-2 text-slate-400 hover:text-slate-200 border border-border-subtle hover:bg-surface-3'
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── EMPTY STATE ── */}
      {filteredItems.length === 0 && (
        <div className="py-20 border border-dashed border-border-subtle rounded-2xl flex flex-col items-center justify-center text-slate-500 gap-3">
          <Folder className="w-10 h-10 opacity-30 text-emerald-400" />
          <div className="flex flex-col items-center gap-1">
            <p className="text-sm font-semibold text-slate-300">No media found in Library</p>
            <p className="text-xs text-slate-500">
              {search ? `No items matched "${search}"` : 'Downloaded videos, pictures, and songs will appear here.'}
            </p>
          </div>
          {onSwitchToDownloader && (
            <button
              onClick={onSwitchToDownloader}
              className="mt-2 px-4 py-1.5 rounded-xl bg-brand-acc text-slate-950 font-bold text-xs shadow-glow transition-transform active:scale-95"
            >
              Go to Downloader
            </button>
          )}
        </div>
      )}

      {/* ── MEDIA CARDS VIEW ── */}
      {filteredItems.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const info = getBundleInfo(item);
            const {
              cat,
              isAudioCat,
              isVideoCat,
              isImageCat,
              isVideoBundle,
              isAudioBundle,
              isImageBundle,
              isMixedBundle,
              count,
              playableList,
            } = info;

            const isSingleImage = isImageCat && !isImageBundle;
            const isSingleVideo = isVideoCat && !isVideoBundle;

            return (
              <div
                key={item.id}
                onClick={() => handleCardClick(item)}
                className={`bg-surface-1 border border-border-subtle hover:border-border rounded-2xl p-2.5 flex flex-col gap-2.5 cursor-pointer hover:bg-surface-2 transition-all duration-150 group shadow-sm hover:shadow-lg relative ${
                  isImageBundle
                    ? 'hover:border-emerald-500/40'
                    : isVideoBundle
                    ? 'hover:border-sky-500/40'
                    : isAudioBundle
                    ? 'hover:border-purple-500/40'
                    : ''
                }`}
              >
                {/* Visual Area */}
                <div className="relative aspect-video rounded-xl overflow-hidden bg-surface-3 flex items-center justify-center">
                  <MediaThumbnail
                    item={item}
                    type={cat}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />

                  {/* Album Layer Indicator: Top-left badge for Image Albums */}
                  {isImageBundle && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-black/85 backdrop-blur-md border border-emerald-500/40 text-[10.5px] font-bold text-emerald-300 flex items-center gap-1.5 shadow-lg z-10">
                      <Layers className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{count} Photos</span>
                    </div>
                  )}

                  {/* Video Series Indicator: Top-left badge for Multi-video Batch / Series */}
                  {isVideoBundle && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-black/85 backdrop-blur-md border border-sky-500/40 text-[10.5px] font-bold text-sky-300 flex items-center gap-1.5 shadow-lg z-10">
                      <ListVideo className="w-3.5 h-3.5 text-sky-400" />
                      <span>{count} Videos</span>
                    </div>
                  )}

                  {/* Audio Album Indicator: Top-left badge for Multi-track Audio Album */}
                  {isAudioBundle && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-black/85 backdrop-blur-md border border-purple-500/40 text-[10.5px] font-bold text-purple-300 flex items-center gap-1.5 shadow-lg z-10">
                      <ListMusic className="w-3.5 h-3.5 text-purple-400" />
                      <span>{count} Tracks</span>
                    </div>
                  )}

                  {/* Mixed Bundle Indicator: Top-left badge */}
                  {isMixedBundle && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-black/85 backdrop-blur-md border border-amber-500/40 text-[10.5px] font-bold text-amber-300 flex items-center gap-1.5 shadow-lg z-10">
                      <Layers className="w-3.5 h-3.5 text-amber-400" />
                      <span>{count} Items</span>
                    </div>
                  )}

                  {/* Single Video Duration Badge */}
                  {(isSingleVideo || isAudioCat) && item.duration && (
                    <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-sm text-[10px] font-mono font-medium text-white">
                      {item.duration}
                    </span>
                  )}

                  {/* External Link button */}
                  {item.url && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        api.openUrlExternal(item.url);
                      }}
                      className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/60 hover:bg-black/85 backdrop-blur-sm text-slate-300 hover:text-white transition-colors opacity-0 group-hover:opacity-100 z-10"
                      title="Open source link in browser"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Hover Open / Play Icon */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1.5 transition-opacity">
                    <div className="w-10 h-10 rounded-full bg-brand-acc text-slate-950 flex items-center justify-center shadow-glow group-hover:scale-105 transition-transform">
                      {isImageBundle ? (
                        <Images className="w-5 h-5" />
                      ) : isSingleImage ? (
                        <Eye className="w-5 h-5" />
                      ) : isAudioBundle ? (
                        <ListMusic className="w-5 h-5" />
                      ) : isVideoBundle ? (
                        <ListVideo className="w-5 h-5" />
                      ) : (
                        <Play className="w-5 h-5 ml-0.5 fill-current" />
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-white bg-black/75 px-2 py-0.5 rounded-md backdrop-blur-sm">
                      {isImageBundle
                        ? 'View Album'
                        : isSingleImage
                        ? 'View Photo'
                        : isVideoBundle
                        ? 'Play Video Bundle'
                        : isAudioBundle
                        ? 'Play Album'
                        : 'Play'}
                    </span>
                  </div>
                </div>

                {/* Card Info */}
                <div className="flex flex-col px-1 pb-1">
                  <span className="text-xs font-semibold text-slate-100 truncate group-hover:text-emerald-400 transition-colors">
                    {item.filename}
                  </span>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 font-medium">
                    <span>{fmtBytes(item.sizeBytes)}</span>
                    <span className="font-mono text-[11px]">
                      {isImageBundle ? (
                        <span className="text-emerald-400 font-semibold">{count} Photos · Album</span>
                      ) : isVideoBundle ? (
                        <span className="text-sky-400 font-semibold">{count} Videos · Bundle</span>
                      ) : isAudioBundle ? (
                        <span className="text-purple-400 font-semibold">{count} Tracks · Album</span>
                      ) : isMixedBundle ? (
                        <span className="text-amber-400 font-semibold">{count} Items · Bundle</span>
                      ) : isSingleImage ? (
                        <span className="text-slate-400">{item.res || 'Photo'}</span>
                      ) : isAudioCat ? (
                        <span className="text-slate-400">{item.res || '320 kbps'}</span>
                      ) : (
                        <span className="text-slate-400">{item.res || '1080p'}</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {filteredItems.length > 0 && viewMode === 'list' && (
        <div className="flex flex-col gap-2">
          {filteredItems.map((item) => {
            const info = getBundleInfo(item);
            const {
              cat,
              isAudioCat,
              isImageCat,
              isVideoBundle,
              isAudioBundle,
              isImageBundle,
              isMixedBundle,
              count,
            } = info;

            return (
              <div
                key={item.id}
                onClick={() => handleCardClick(item)}
                className="bg-surface-1 border border-border-subtle hover:border-border rounded-xl p-3 px-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-surface-2 transition-all group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl overflow-hidden bg-surface-3 shrink-0 flex items-center justify-center relative shadow-sm">
                    <MediaThumbnail
                      item={item}
                      type={cat}
                      className="w-full h-full object-cover"
                      iconClassName="w-4 h-4"
                    />
                    {(isImageBundle || isVideoBundle || isAudioBundle || isMixedBundle) && (
                      <div className="absolute bottom-0.5 right-0.5 px-1 py-0.2 rounded bg-black/85 backdrop-blur-xs text-[9px] font-bold flex items-center gap-0.5 shadow-sm border border-white/10">
                        {isImageBundle && <Layers className="w-2.5 h-2.5 text-emerald-400" />}
                        {isVideoBundle && <ListVideo className="w-2.5 h-2.5 text-sky-400" />}
                        {isAudioBundle && <ListMusic className="w-2.5 h-2.5 text-purple-400" />}
                        {isMixedBundle && <Layers className="w-2.5 h-2.5 text-amber-400" />}
                        <span className="text-white text-[9px]">{count}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-slate-100 truncate group-hover:text-emerald-400 transition-colors">
                      {item.filename}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {fmtBytes(item.sizeBytes)} ·{' '}
                      {isImageBundle
                        ? `${count} Photos · Album`
                        : isVideoBundle
                        ? `${count} Videos · Bundle`
                        : isAudioBundle
                        ? `${count} Tracks · Album`
                        : isMixedBundle
                        ? `${count} Items · Bundle`
                        : isImageCat
                        ? (item.res || 'Photo')
                        : isAudioCat
                        ? (item.res || '320 kbps')
                        : (item.res || '1080p')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const first = item.files?.[0];
                      const path = typeof first === 'string' ? first : first?.path || item.outputDir || item.output_dir || '';
                      if (path) api.openOutputFolder(path);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-3 transition-colors"
                    title="Open in Folder"
                  >
                    <Folder className="w-4 h-4" />
                  </button>

                  {item.url && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        api.openUrlExternal(item.url);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-3 transition-colors"
                      title="Open source link in browser"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
