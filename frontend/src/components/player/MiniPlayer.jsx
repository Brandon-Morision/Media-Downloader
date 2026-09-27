import React, { useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Maximize2, X, Music, Film } from 'lucide-react';

/**
 * Floating mini-player widget shown when the full player is minimized.
 *
 * For audio:  spinning vinyl disc with a live SVG progress ring around it.
 * For video:  a compact PiP-style video preview that continues to show the
 *             live video frame, with play/pause + prev/next controls.
 */
export default function MiniPlayer({
  isOpen,
  isPlaying,
  currentFile,
  coverArtUrl,
  title,
  currentIndex,
  totalFiles,
  isAudio,
  currentTime,
  duration,
  mediaRef,        // shared ref to the <audio> / <video> element
  onTogglePlay,
  onPrev,
  onNext,
  onExpand,
  onClose,
}) {
  // Mirror the live video into a tiny <video> element inside the mini player
  // by sharing the same src URL from the original element.
  const miniVideoRef = useRef(null);

  useEffect(() => {
    if (isAudio || !isOpen) return;
    const src = mediaRef?.current;
    const mini = miniVideoRef.current;
    if (!src || !mini) return;

    // Re-use the same src URL — browser shares the decode pipeline
    if (src.src && mini.src !== src.src) {
      mini.src = src.src;
      mini.currentTime = src.currentTime;
      mini.muted = true; // audio comes from the main element
      if (!src.paused) mini.play().catch(() => {});
    }
  }, [isOpen, isAudio, mediaRef]);

  // Keep mini video time in sync with main element
  useEffect(() => {
    if (isAudio || !isOpen) return;
    const src = mediaRef?.current;
    const mini = miniVideoRef.current;
    if (!src || !mini) return;

    const onTime = () => {
      if (Math.abs(mini.currentTime - src.currentTime) > 0.5) {
        mini.currentTime = src.currentTime;
      }
    };
    const onPlay = () => mini.play().catch(() => {});
    const onPause = () => mini.pause();
    const onSrcChange = () => {
      mini.src = src.src;
      mini.currentTime = 0;
      if (!src.paused) mini.play().catch(() => {});
    };

    src.addEventListener('timeupdate', onTime);
    src.addEventListener('play', onPlay);
    src.addEventListener('pause', onPause);
    src.addEventListener('emptied', onSrcChange);
    return () => {
      src.removeEventListener('timeupdate', onTime);
      src.removeEventListener('play', onPlay);
      src.removeEventListener('pause', onPause);
      src.removeEventListener('emptied', onSrcChange);
    };
  }, [isOpen, isAudio, mediaRef]);

  if (!isOpen) return null;

  // Progress ring math (audio vinyl ring)
  const RING_R = 24;
  const RING_CIRC = 2 * Math.PI * RING_R;
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const dashOffset = RING_CIRC * (1 - progress);

  if (isAudio) {
    /* ── AUDIO MINI PLAYER ─────────────────────────────────────────────────── */
    return (
      <div
        onClick={onExpand}
        className="fixed bottom-5 right-6 z-50 flex items-center gap-3 p-2 pr-3.5 bg-surface-1/90 backdrop-blur-xl border border-white/15 rounded-full shadow-2xl cursor-pointer hover:border-brand-acc/50 hover:shadow-glow transition-all duration-200 select-none group max-w-sm"
        title="Click to reopen full player"
      >
        {/* Vinyl Disc + Progress Ring */}
        <div className="relative shrink-0 flex items-center justify-center" style={{ width: 44, height: 44 }}>
          {/* SVG progress ring */}
          <svg
            className="absolute inset-0 pointer-events-none"
            style={{ width: 44, height: 44, transform: 'rotate(-90deg)' }}
            viewBox="0 0 56 56"
          >
            {/* Track ring */}
            <circle
              cx="28" cy="28" r={RING_R}
              fill="none"
              stroke="rgba(255,255,255,0.10)"
              strokeWidth="3"
            />
            {/* Progress arc */}
            <circle
              cx="28" cy="28" r={RING_R}
              fill="none"
              stroke="var(--acc, #00e599)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={RING_CIRC}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 0.4s linear' }}
            />
          </svg>

          {/* Vinyl disc */}
          <div className="relative w-8 h-8 rounded-full overflow-hidden vinyl-disc flex items-center justify-center border border-white/20 shadow-md">
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
                  <Music className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
            {/* Spindle hole */}
            <div className="absolute w-1.5 h-1.5 rounded-full bg-surface-1 border border-white/30" />
          </div>
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

        {/* Controls */}
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

  /* ── VIDEO MINI PLAYER ───────────────────────────────────────────────────── */
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < totalFiles - 1;

  return (
    <div
      className="fixed bottom-5 right-6 z-50 flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-white/15 bg-surface-1/95 backdrop-blur-xl select-none"
      style={{ width: 260 }}
    >
      {/* Live Video Preview */}
      <div
        className="relative w-full bg-black cursor-pointer group"
        style={{ aspectRatio: '16/9' }}
        onClick={onExpand}
        title="Click to reopen full player"
      >
        <video
          ref={miniVideoRef}
          muted
          playsInline
          className="w-full h-full object-contain"
        />

        {/* Overlay: play/pause indicator on hover or when paused */}
        <div
          className={`absolute inset-0 flex items-center justify-center transition-all duration-150 ${
            isPlaying ? 'bg-black/0 group-hover:bg-black/30' : 'bg-black/35'
          }`}
        >
          <div
            className={`w-10 h-10 rounded-full bg-brand-acc text-slate-950 flex items-center justify-center shadow-glow transition-all duration-200 pointer-events-none ${
              isPlaying
                ? 'opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100'
                : 'opacity-90 scale-100'
            }`}
          >
            {isPlaying
              ? <Pause className="w-4 h-4 fill-current" />
              : <Play className="w-4 h-4 ml-0.5 fill-current" />
            }
          </div>
        </div>

        {/* Track counter badge */}
        {totalFiles > 1 && (
          <div className="absolute top-1.5 left-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-md pointer-events-none">
            {currentIndex + 1} / {totalFiles}
          </div>
        )}

        {/* Expand hint */}
        <div className="absolute top-1.5 right-2 bg-black/60 backdrop-blur-sm text-white/70 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 pointer-events-none">
          <Maximize2 className="w-2.5 h-2.5" />
        </div>

        {/* Progress bar at bottom of video */}
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/10 pointer-events-none">
          <div
            className="h-full bg-brand-acc transition-all duration-300"
            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Controls Bar */}
      <div
        className="flex items-center justify-between px-3 py-2 gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <span className="text-[11px] font-semibold text-slate-200 truncate flex-1">
          {currentFile?.name
            ? currentFile.name.replace(/\.[^/.]+$/, '')
            : title || 'Video'}
        </span>

        {/* Playback Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {totalFiles > 1 && (
            <button
              onClick={onPrev}
              disabled={!hasPrev}
              className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Previous video"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={onTogglePlay}
            className="w-7 h-7 rounded-full bg-brand-acc text-slate-950 flex items-center justify-center hover:opacity-90 shadow-glow transition-transform active:scale-95"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying
              ? <Pause className="w-3.5 h-3.5 fill-current" />
              : <Play className="w-3.5 h-3.5 ml-0.5 fill-current" />
            }
          </button>

          {totalFiles > 1 && (
            <button
              onClick={onNext}
              disabled={!hasNext}
              className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Next video"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          )}

          <div className="w-[1px] h-4 bg-white/10 mx-0.5" />

          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-rose-400 hover:bg-surface-3 transition-colors"
            title="Close player"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
