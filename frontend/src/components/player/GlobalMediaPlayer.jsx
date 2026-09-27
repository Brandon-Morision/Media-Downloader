import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, Maximize2, Minimize2, X, Music, Film,
  Repeat, Shuffle, Heart, Expand, AlertCircle, ListVideo
} from 'lucide-react';
import { fmtTime, AUDIO_EXT } from '../../lib/formatters';
import { api } from '../../lib/api';
import AudioVisualizer from './AudioVisualizer';
import MiniPlayer from './MiniPlayer';

export default function GlobalMediaPlayer({
  active,
  files = [],
  title = '',
  onClose,
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('md_player_volume');
    return saved !== null ? parseFloat(saved) : 1;
  });
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showVideoQueue, setShowVideoQueue] = useState(true);

  const [mediaUrl, setMediaUrl] = useState('');
  const [playbackError, setPlaybackError] = useState('');
  const [coverArtUrl, setCoverArtUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const mediaRef = useRef(null);
  const modalContainerRef = useRef(null);

  // Normalize files or provide demo track queue if single file
  const safeFiles = Array.isArray(files) && files.length > 0 ? files : [];
  const currentFile = safeFiles[currentIndex] || safeFiles[0] || { name: title || 'Better Days.mp3', path: '' };
  const ext = (currentFile?.name?.split('.').pop() || '').toLowerCase();
  const isAudio = AUDIO_EXT.includes(ext) || !ext;

  // Up Next playlist queue: only present when multiple tracks are queued/downloaded together
  const upNextTracks = safeFiles.length > 1 ? safeFiles : [];

  // Reset index when fresh playlist provided
  useEffect(() => {
    if (active && safeFiles.length > 0) {
      setCurrentIndex(0);
      setIsMinimized(false);
    }
  }, [active, files]);

  // Load stream URL & cover art whenever current file changes
  useEffect(() => {
    if (!active || !currentFile?.path) return;
    let cancelled = false;

    async function loadTrack() {
      setIsLoading(true);
      setPlaybackError('');
      setCoverArtUrl(null);

      try {
        const streamRes = await api.getMediaUrl(currentFile.path);
        if (!cancelled) {
          if (streamRes?.ok && streamRes.url) {
            setMediaUrl(streamRes.url);
            setPlaybackError('');
          } else {
            setMediaUrl('');
            setPlaybackError(streamRes?.error || 'File not found on disk. The file may have been moved, renamed, or deleted.');
          }
          setIsLoading(false);
        }

        if (isAudio) {
          const artRes = await api.getCoverArtUrl(currentFile.path);
          if (!cancelled && artRes?.ok && artRes.url) {
            setCoverArtUrl(artRes.url);
          }
        } else {
          const thumbRes = await api.getVideoThumbnailUrl(currentFile.path);
          if (!cancelled && thumbRes?.ok && thumbRes.url) {
            setCoverArtUrl(thumbRes.url);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setMediaUrl('');
          setPlaybackError(err?.message || 'Failed to initialize media stream.');
          setIsLoading(false);
        }
      }
    }

    loadTrack();
    return () => {
      cancelled = true;
    };
  }, [active, currentFile?.path, isAudio]);

  // Autoplay and volume initialization on mediaUrl load
  useEffect(() => {
    if (!mediaUrl || !mediaRef.current) return;
    const el = mediaRef.current;
    el.volume = isMuted ? 0 : volume;
    el.playbackRate = playbackRate;
    const playPromise = el.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn('Playback auto-start prevented or waiting user interaction:', err);
          setIsPlaying(false);
        });
    }
  }, [mediaUrl]);

  // Sync volume & rate to media element
  useEffect(() => {
    if (mediaRef.current) {
      mediaRef.current.volume = isMuted ? 0 : volume;
      mediaRef.current.playbackRate = playbackRate;
    }
    localStorage.setItem('md_player_volume', String(volume));
  }, [volume, isMuted, playbackRate]);

  // Play / Pause toggle
  const togglePlay = useCallback(() => {
    const el = mediaRef.current;
    if (!el) return;
    if (el.paused || el.ended) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, []);

  const handlePrev = useCallback(() => {
    if (currentTime > 3) {
      if (mediaRef.current) mediaRef.current.currentTime = 0;
      return;
    }
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    } else if (safeFiles.length > 1) {
      setCurrentIndex(safeFiles.length - 1);
    }
  }, [currentIndex, currentTime, safeFiles.length]);

  const handleNext = useCallback(() => {
    if (isShuffling && safeFiles.length > 1) {
      let nextIdx = Math.floor(Math.random() * safeFiles.length);
      if (nextIdx === currentIndex) nextIdx = (currentIndex + 1) % safeFiles.length;
      setCurrentIndex(nextIdx);
    } else if (currentIndex < safeFiles.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else if (isLooping) {
      setCurrentIndex(0);
    }
  }, [currentIndex, isShuffling, isLooping, safeFiles.length]);

  const toggleLoop = () => setIsLooping((prev) => !prev);
  const toggleShuffle = () => setIsShuffling((prev) => !prev);
  const toggleMute = () => setIsMuted((prev) => !prev);

  const handleSeek = (e) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (mediaRef.current) {
      mediaRef.current.currentTime = val;
    }
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (isMuted && val > 0) setIsMuted(false);
  };

  const toggleFullscreen = () => {
    if (!modalContainerRef.current) return;
    if (!document.fullscreenElement) {
      modalContainerRef.current.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  // Sync fullscreen state with native browser fullscreen changes
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  const handleFullClose = () => {
    if (mediaRef.current) {
      mediaRef.current.pause();
    }
    setIsPlaying(false);
    setIsMinimized(false);
    if (onClose) onClose();
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!active) return;
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        if (mediaRef.current) mediaRef.current.currentTime = Math.max(0, mediaRef.current.currentTime - 10);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (mediaRef.current) mediaRef.current.currentTime = Math.min(duration, mediaRef.current.currentTime + 10);
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        setVolume((v) => Math.min(1, parseFloat((v + 0.1).toFixed(2))));
        if (isMuted) setIsMuted(false);
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        setVolume((v) => Math.max(0, parseFloat((v - 0.1).toFixed(2))));
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {});
          setIsFullscreen(false);
        } else if (!isMinimized) {
          setIsMinimized(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active, isMinimized, duration, togglePlay, isMuted]);

  if (!active) return null;

  const trackDisplayName = currentFile?.name ? currentFile.name.replace(/\.[^/.]+$/, '') : (title || 'Track');

  return (
    <>
      {/* Floating Mini Player Widget (Shown when minimized) */}
      <MiniPlayer
        isOpen={isMinimized}
        isPlaying={isPlaying}
        currentFile={currentFile}
        coverArtUrl={coverArtUrl}
        title={trackDisplayName}
        currentIndex={currentIndex}
        totalFiles={safeFiles.length}
        isAudio={isAudio}
        onTogglePlay={togglePlay}
        onPrev={handlePrev}
        onNext={handleNext}
        onExpand={() => setIsMinimized(false)}
        onClose={handleFullClose}
      />

      {/* Media Player Modal (Kept in DOM so audio/video playback never breaks across minimize) */}
      <div
        className={`fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center ${
          isFullscreen ? 'p-0' : 'p-4'
        } select-none transition-all duration-200 ${
          isMinimized ? 'opacity-0 pointer-events-none -z-50 scale-95' : 'opacity-100 z-50 scale-100'
        }`}
      >
        <div
          ref={modalContainerRef}
          className={`w-full ${
            isFullscreen
              ? 'w-screen h-screen max-w-none max-h-none rounded-none border-none bg-black flex flex-col justify-between'
              : isAudio ? 'max-w-md max-h-[92vh] rounded-3xl border border-white/10' : 'max-w-3xl max-h-[92vh] rounded-3xl border border-white/10'
          } bg-surface-1 shadow-2xl flex flex-col overflow-hidden relative`}
        >
          {/* Top Modal Controls Header */}
          <div className="h-11 px-4 bg-surface-2 border-b border-border-subtle flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 truncate">
              {isAudio ? (
                <Music className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <Film className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              )}
              <span className="text-xs font-semibold text-slate-300 truncate">
                {isAudio
                  ? (safeFiles.length > 1 ? `Music Playlist · ${currentIndex + 1} of ${safeFiles.length}` : 'Music Player')
                  : (safeFiles.length > 1 ? `Video Album · Video ${currentIndex + 1} of ${safeFiles.length}` : 'Video Player')}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Video Queue toggle button (only shown when multiple videos are queued/downloaded together and not fullscreen) */}
              {!isAudio && safeFiles.length > 1 && !isFullscreen && (
                <button
                  onClick={() => setShowVideoQueue((prev) => !prev)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border ${
                    showVideoQueue
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'text-slate-400 border-white/5 hover:text-white hover:bg-surface-3'
                  }`}
                  title="Toggle Album Video Queue"
                >
                  <ListVideo className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Queue ({safeFiles.length})</span>
                </button>
              )}

              {!isAudio && (
                <button
                  onClick={toggleFullscreen}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-surface-3 transition-colors"
                  title="Toggle Fullscreen (F)"
                >
                  <Expand className="w-3.5 h-3.5 text-slate-300" />
                </button>
              )}
              <button
                onClick={() => setIsMinimized(true)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-surface-3 transition-colors flex items-center gap-1.5 border border-white/5"
                title="Minimize to mini-player (Esc)"
              >
                <Minimize2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Minimize</span>
              </button>
              <button
                onClick={handleFullClose}
                className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-surface-3 transition-colors"
                title="Close player"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Media Visual Area */}
          <div className={`relative ${isFullscreen ? 'flex-1 w-full h-full' : isAudio ? 'min-h-[260px]' : 'aspect-video min-h-[300px] max-h-[58vh]'} bg-black flex items-center justify-center overflow-hidden`}>
            {playbackError ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-surface-2/90 gap-3 select-none">
                <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-rose-400 shadow-lg">
                  <AlertCircle className="w-7 h-7" />
                </div>
                <div className="flex flex-col gap-1 max-w-sm">
                  <h4 className="text-sm font-bold text-slate-100">Unable to Play File</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{playbackError}</p>
                  <p className="text-[11px] font-mono text-slate-500 truncate mt-1 bg-surface-3 px-2.5 py-1 rounded-lg border border-white/5 max-w-xs">
                    {currentFile?.path || currentFile?.name}
                  </p>
                </div>
              </div>
            ) : isAudio ? (
              <>
                <audio
                  ref={mediaRef}
                  src={mediaUrl}
                  crossOrigin="anonymous"
                  onTimeUpdate={() => mediaRef.current && setCurrentTime(mediaRef.current.currentTime)}
                  onDurationChange={() => mediaRef.current && setDuration(mediaRef.current.duration)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={handleNext}
                  onError={() => setPlaybackError('Playback error: Unable to load or decode this audio track.')}
                />
                <AudioVisualizer
                  mediaRef={mediaRef}
                  isPlaying={isPlaying}
                  coverArtUrl={coverArtUrl}
                  title={trackDisplayName}
                />
              </>
            ) : (
              <div
                className="relative w-full h-full flex items-center justify-center bg-black cursor-pointer group select-none"
                onClick={togglePlay}
              >
                <video
                  ref={mediaRef}
                  src={mediaUrl}
                  crossOrigin="anonymous"
                  className={`w-full h-full object-contain ${isFullscreen ? 'max-h-full' : 'max-h-[58vh]'}`}
                  onTimeUpdate={() => mediaRef.current && setCurrentTime(mediaRef.current.currentTime)}
                  onDurationChange={() => mediaRef.current && setDuration(mediaRef.current.duration)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={handleNext}
                  onError={() => setPlaybackError('Playback error: Unable to load or decode this video file.')}
                  playsInline
                />
                {!isPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none transition-opacity">
                    <div className="w-16 h-16 rounded-full bg-emerald-400 text-slate-950 flex items-center justify-center shadow-glow transition-transform group-hover:scale-105">
                      <Play className="w-8 h-8 ml-0.5 fill-current" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Track Info & Like Row */}
          <div className="flex items-center justify-between px-6 pt-4 pb-2">
            <div className="flex flex-col min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-slate-100 truncate tracking-tight">
                {trackDisplayName}
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                {currentFile?.artist || (isAudio ? 'Audio Track' : 'Video')}
              </p>
            </div>

            <button
              onClick={() => setIsLiked(!isLiked)}
              className={`p-2 rounded-full transition-transform active:scale-125 ${
                isLiked ? 'text-rose-500 fill-rose-500' : 'text-slate-400 hover:text-white'
              }`}
              title={isLiked ? 'Liked' : 'Like'}
            >
              <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
            </button>
          </div>

          {/* Scrubber Bar */}
          <div className="flex items-center gap-3 px-6 pt-1">
            <span className="text-[11px] font-mono text-slate-400 min-w-[34px] text-right">
              {fmtTime(currentTime * 1000)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-1.5 rounded-lg bg-surface-3 accent-emerald-400 cursor-pointer"
            />
            <span className="text-[11px] font-mono text-slate-400 min-w-[34px]">
              {fmtTime((duration || 0) * 1000)}
            </span>
          </div>

          {/* Playback Controls Row */}
          <div className="flex items-center justify-between px-6 py-3">
            {/* Left Controls: Shuffle & Volume */}
            <div className="flex items-center gap-2">
              {safeFiles.length > 1 && (
                <button
                  onClick={toggleShuffle}
                  className={`p-2 rounded-xl transition-colors ${
                    isShuffling ? 'text-emerald-400' : 'text-slate-400 hover:text-white'
                  }`}
                  title={isShuffling ? 'Shuffle On' : 'Shuffle Off'}
                >
                  <Shuffle className="w-4 h-4" />
                </button>
              )}

              <div className="flex items-center gap-1.5 ml-1">
                <button
                  onClick={toggleMute}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors"
                  title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4 text-rose-400" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-slate-300" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-16 sm:w-20 h-1.5 rounded-lg bg-surface-3 accent-emerald-400 cursor-pointer"
                  title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
                />
              </div>
            </div>

            {/* Center Controls: Prev, Play/Pause, Next */}
            <div className="flex items-center gap-3">
              {safeFiles.length > 1 && (
                <button
                  onClick={handlePrev}
                  className="p-2 rounded-xl text-slate-300 hover:text-white transition-colors"
                  title="Previous track"
                >
                  <SkipBack className="w-5 h-5" />
                </button>
              )}

              <button
                onClick={togglePlay}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-emerald-400 text-slate-950 flex items-center justify-center hover:opacity-95 shadow-glow transition-transform active:scale-95 shrink-0"
                title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6 fill-current" />
                ) : (
                  <Play className="w-6 h-6 ml-0.5 fill-current" />
                )}
              </button>

              {safeFiles.length > 1 && (
                <button
                  onClick={handleNext}
                  className="p-2 rounded-xl text-slate-300 hover:text-white transition-colors"
                  title="Next track"
                >
                  <SkipForward className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Right Controls: Loop */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleLoop}
                className={`p-2 rounded-xl transition-colors ${
                  isLooping ? 'text-emerald-400' : 'text-slate-400 hover:text-white'
                }`}
                title={isLooping ? 'Repeat On' : 'Repeat Off'}
              >
                <Repeat className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* "Up Next" Video Queue (Shown ONLY if videos are in bulk / same album, and hidden in fullscreen) */}
          {!isAudio && safeFiles.length > 1 && showVideoQueue && !isFullscreen && (
            <div className="px-6 py-3 border-t border-border-subtle bg-surface-2/60 flex flex-col gap-2 max-h-48 overflow-y-auto">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 tracking-tight flex items-center gap-1.5">
                  <ListVideo className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Up Next in Album ({safeFiles.length} videos)</span>
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  Playing {currentIndex + 1} of {safeFiles.length}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {safeFiles.map((item, idx) => {
                  const isActive = currentIndex === idx;
                  const vName = item.name ? item.name.replace(/\.[^/.]+$/, '') : `Video ${idx + 1}`;
                  return (
                    <div
                      key={idx}
                      onClick={() => setCurrentIndex(idx)}
                      className={`p-2 rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                        isActive
                          ? 'bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 font-semibold shadow-sm'
                          : 'hover:bg-surface-2 text-slate-300 border border-transparent hover:border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                            isActive
                              ? 'bg-emerald-400 text-slate-950 shadow-glow'
                              : 'bg-surface-3 text-slate-400'
                          }`}
                        >
                          {isActive ? (
                            <Play className="w-3.5 h-3.5 fill-current" />
                          ) : (
                            <Film className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs truncate font-medium">
                            {vName}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {isActive ? 'Now Playing' : `Video #${idx + 1}`}
                          </span>
                        </div>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 shrink-0">
                        {item.duration || ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* "Up Next" Audio Playlist Queue (Only for songs downloaded in bulk or together) */}
          {isAudio && safeFiles.length > 1 && (
            <div className="px-6 py-3 border-t border-border-subtle flex flex-col gap-2 max-h-40 overflow-y-auto">
              <span className="text-xs font-bold text-slate-300 tracking-tight">
                Up Next ({safeFiles.length} tracks)
              </span>
              <div className="flex flex-col gap-1.5">
                {upNextTracks.map((item, idx) => {
                  const isActive = currentIndex === idx;
                  return (
                    <div
                      key={idx}
                      onClick={() => setCurrentIndex(idx)}
                      className={`p-2 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${
                        isActive
                          ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold'
                          : 'hover:bg-surface-2 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-surface-3 flex items-center justify-center shrink-0">
                          <Music className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs truncate font-medium">
                            {item.name ? item.name.replace(/\.[^/.]+$/, '') : `Track ${idx + 1}`}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {item.artist || 'Audio Track'}
                          </span>
                        </div>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">
                        {item.duration || ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
