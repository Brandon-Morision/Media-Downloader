import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Maximize2, X, Music, Film } from 'lucide-react';

export default function MiniPlayer({
  isOpen,
  isPlaying,
  currentFile,
  coverArtUrl,
  title,
  currentIndex,
  totalFiles,
  isAudio,
  onTogglePlay,
  onPrev,
  onNext,
  onExpand,
  onClose,
}) {
  if (!isOpen) return null;

  return (
    <div
      onClick={onExpand}
      className="fixed bottom-5 right-6 z-50 flex items-center gap-3 p-2 pr-3.5 bg-surface-1/90 backdrop-blur-xl border border-white/15 rounded-full shadow-2xl cursor-pointer hover:border-brand-acc/50 hover:shadow-glow transition-all duration-200 select-none group max-w-sm"
      title="Click to reopen full player"
    >
      {/* Mini Album Art / Vinyl Disc */}
      <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 vinyl-disc flex items-center justify-center border border-white/20 shadow-md">
        <div
          className={`w-full h-full rounded-full flex items-center justify-center animate-vinyl-spin ${
            !isPlaying ? 'paused' : ''
          }`}
        >
          {coverArtUrl ? (
            <img
              src={coverArtUrl}
              alt="Cover Art"
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-brand-acc to-pink-500 flex items-center justify-center text-white">
              {isAudio ? <Music className="w-4 h-4" /> : <Film className="w-4 h-4" />}
            </div>
          )}
        </div>

        {/* Center spindle hole */}
        <div className="absolute w-2 h-2 rounded-full bg-surface-1 border border-white/30" />
      </div>

      {/* Track info & mini EQ */}
      <div className="flex flex-col min-w-0 max-w-[130px] sm:max-w-[160px]">
        <span className="text-xs font-semibold text-slate-100 truncate tracking-tight group-hover:text-brand-acc transition-colors">
          {currentFile?.name || title || 'Now playing'}
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          {isPlaying ? (
            <div className="flex items-end gap-0.5 h-3">
              <span className="w-0.5 bg-brand-acc rounded-full eq-bar-1" />
              <span className="w-0.5 bg-brand-acc rounded-full eq-bar-2" />
              <span className="w-0.5 bg-brand-acc rounded-full eq-bar-3" />
            </div>
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
          )}
          <span className="text-[10.5px] text-slate-400 font-medium truncate">
            {isPlaying ? 'Playing' : 'Paused'}
            {totalFiles > 1 ? ` • ${currentIndex + 1}/${totalFiles}` : ''}
          </span>
        </div>
      </div>

      {/* Control Buttons */}
      <div
        className="flex items-center gap-1 shrink-0 ml-1"
        onClick={(e) => e.stopPropagation()}
      >
        {totalFiles > 1 && (
          <button
            onClick={onPrev}
            disabled={currentIndex <= 0}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Previous track"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          onClick={onTogglePlay}
          className="w-7 h-7 rounded-full bg-brand-acc text-white flex items-center justify-center hover:opacity-90 shadow-glow transition-transform active:scale-95"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
        </button>

        {totalFiles > 1 && (
          <button
            onClick={onNext}
            disabled={currentIndex >= totalFiles - 1}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Next track"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        )}

        <div className="w-[1px] h-4 bg-white/10 mx-0.5" />

        <button
          onClick={onExpand}
          className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-surface-3 transition-colors"
          title="Reopen full player"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onClose}
          className="p-1 rounded-full text-slate-400 hover:text-rose-400 hover:bg-surface-3 transition-colors"
          title="Close player"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
