import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, Maximize2, Minimize2, X, Music, Film,
  Repeat, Shuffle, Heart, ArrowLeft, MoreHorizontal, Check, ListMusic, ListVideo
} from 'lucide-react';
import { AUDIO_EXT } from '../../lib/formatters';
import { api } from '../../lib/api';
import AudioVisualizer from './AudioVisualizer';
import MiniPlayer from './MiniPlayer';

// Format time precisely as Windows 11 Media Player: HH:MM:SS (e.g. 00:00:05, 00:03:52)
function fmtWin11Time(seconds) {
  if (!seconds || isNaN(seconds) || seconds < 0) return '00:00:00';
  const totalSecs = Math.floor(seconds);
  const s = totalSecs % 60;
  const m = Math.floor((totalSecs / 60) % 60);
  const h = Math.floor(totalSecs / 3600);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Windows 11 Media Player Rewind 10s Icon
function Rewind10Icon({ className = "w-4.5 h-4.5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 11a8 8 0 1 1 2.3 5.7L4 19" />
      <polyline points="4 5 4 11 10 11" />
      <text x="12" y="14.8" textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="currentColor" stroke="none" fontFamily="system-ui, -apple-system, sans-serif">10</text>
    </svg>
  );
}

// Windows 11 Media Player Forward 30s Icon
function Forward30Icon({ className = "w-4.5 h-4.5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 11a8 8 0 1 0-2.3 5.7L20 19" />
      <polyline points="20 5 20 11 14 11" />
      <text x="12" y="14.8" textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="currentColor" stroke="none" fontFamily="system-ui, -apple-system, sans-serif">30</text>
    </svg>
  );
}

// Windows 11 Media Player Mini Player (PIP) Icon
function MiniPlayerIcon({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="4" width="18" height="15" rx="2" />
      <rect x="11" y="10" width="8" height="7" rx="1" fill="currentColor" fillOpacity="0.35" />
    </svg>
  );
}

// Crisp 512x512 SVG cover art fallback for Windows 11 SMTC / Quick Settings Flyout
const DEFAULT_MEDIA_ARTWORK = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23090a0f"/><stop offset="100%" stop-color="%231a1d2e"/></linearGradient><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2338bdf8"/><stop offset="50%" stop-color="%23818cf8"/><stop offset="100%" stop-color="%23c084fc"/></linearGradient></defs><rect width="512" height="512" rx="48" fill="url(%23bg)"/><circle cx="256" cy="256" r="180" fill="%231e2238"/><path d="M256 120 C256 120 170 238 170 304 C170 351 208 390 256 390 C304 390 342 351 342 304 C342 238 256 120 256 120 Z" fill="url(%23grad)"/><circle cx="256" cy="304" r="36" fill="%23ffffff" opacity="0.9"/></svg>`;

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
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  const [mediaUrl, setMediaUrl] = useState('');
  const [playbackError, setPlaybackError] = useState('');
  const [coverArtUrl, setCoverArtUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const mediaRef = useRef(null);
  const modalContainerRef = useRef(null);
  const idleTimerRef = useRef(null);

  // Normalize files or provide fallback
  const safeFiles = Array.isArray(files) && files.length > 0 ? files : [];
  const currentFile = safeFiles[currentIndex] || safeFiles[0] || { name: title || 'Media Track', path: '' };
  const ext = (currentFile?.name?.split('.').pop() || '').toLowerCase();
  const isAudio = AUDIO_EXT.includes(ext) || !ext;
  const trackDisplayName = currentFile?.name ? currentFile.name.replace(/\.[^/.]+$/, '') : (title || 'Media Track');

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

  // Autoplay on mediaUrl load
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
          console.warn('Playback waiting on user interaction:', err);
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

  // Mouse idle auto-hide controls in video/fullscreen
  const handleUserActivity = useCallback(() => {
    setControlsVisible(true);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (isPlaying) {
      idleTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
        setShowSpeedMenu(false);
      }, 3200);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) {
      setControlsVisible(true);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    } else {
      handleUserActivity();
    }
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [isPlaying, handleUserActivity]);

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

  const handleRewind10 = useCallback(() => {
    if (mediaRef.current) {
      mediaRef.current.currentTime = Math.max(0, mediaRef.current.currentTime - 10);
      setCurrentTime(mediaRef.current.currentTime);
    }
  }, []);

  const handleForward30 = useCallback(() => {
    if (mediaRef.current) {
      mediaRef.current.currentTime = Math.min(duration || 0, mediaRef.current.currentTime + 30);
      setCurrentTime(mediaRef.current.currentTime);
    }
  }, [duration]);

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

  const getFullscreenElement = () => {
    return document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement ||
      null;
  };

  const exitFullscreenSafe = async () => {
    try {
      if (getFullscreenElement()) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          await document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        }
      }
    } catch (err) {
      console.warn('exitFullscreen error:', err);
    } finally {
      setIsFullscreen(false);
    }
  };

  const enterFullscreenSafe = async () => {
    const el = modalContainerRef.current;
    if (!el) return;
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
      } else if (el.mozRequestFullScreen) {
        await el.mozRequestFullScreen();
      } else if (el.msRequestFullscreen) {
        await el.msRequestFullscreen();
      }
      setIsFullscreen(true);
    } catch (err) {
      console.warn('requestFullscreen fallback:', err);
      setIsFullscreen(true);
    }
  };

  const toggleFullscreen = () => {
    if (isFullscreen || getFullscreenElement()) {
      exitFullscreenSafe();
    } else {
      enterFullscreenSafe();
    }
  };

  const handleMinimizeToMini = async () => {
    if (isFullscreen || getFullscreenElement()) {
      await exitFullscreenSafe();
    }
    setIsMinimized(true);
  };

  // Sync fullscreen state with native browser fullscreen changes
  useEffect(() => {
    const handleFsChange = () => {
      const fsEl = getFullscreenElement();
      setIsFullscreen(Boolean(fsEl));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    document.addEventListener('mozfullscreenchange', handleFsChange);
    document.addEventListener('MSFullscreenChange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
      document.removeEventListener('mozfullscreenchange', handleFsChange);
      document.removeEventListener('MSFullscreenChange', handleFsChange);
      if (getFullscreenElement()) {
        exitFullscreenSafe();
      }
    };
  }, []);

  const handleFullClose = () => {
    if (isFullscreen || getFullscreenElement()) {
      exitFullscreenSafe();
    }
    if (mediaRef.current) {
      mediaRef.current.pause();
    }
    setIsPlaying(false);
    setIsMinimized(false);
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = 'none';
      } catch (e) {}
    }
    if (onClose) onClose();
  };

  // ── Windows System Media Transport Controls (SMTC) via MediaSession API ──
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    if (!active) {
      try {
        navigator.mediaSession.playbackState = 'none';
        document.title = 'NovaDrop';
      } catch (e) {}
      return;
    }

    let artistName = 'NovaDrop';
    let trackTitle = trackDisplayName;

    if (trackDisplayName.includes(' - ')) {
      const parts = trackDisplayName.split(' - ');
      artistName = parts[0].trim();
      trackTitle = parts.slice(1).join(' - ').trim();
    }

    // Update document.title so Chromium / WebView2 broadcasts the track name to Windows
    document.title = `${trackTitle} • ${artistName}`;

    try {
      const artwork = coverArtUrl
        ? [
            { src: coverArtUrl, sizes: '512x512', type: 'image/jpeg' },
            { src: DEFAULT_MEDIA_ARTWORK, sizes: '512x512', type: 'image/svg+xml' },
          ]
        : [
            { src: DEFAULT_MEDIA_ARTWORK, sizes: '512x512', type: 'image/svg+xml' },
          ];

      navigator.mediaSession.metadata = new MediaMetadata({
        title: trackTitle,
        artist: artistName,
        album: safeFiles.length > 1 ? `Playlist (${currentIndex + 1}/${safeFiles.length})` : 'NovaDrop',
        artwork: artwork,
      });
    } catch (e) {
      console.debug('MediaSession metadata assignment error:', e);
    }

    return () => {
      document.title = 'NovaDrop';
    };
  }, [active, trackDisplayName, coverArtUrl, currentIndex, safeFiles.length]);

  // Hook up MediaSession action handlers (Hardware Media Keys & Windows 11 Flyout)
  useEffect(() => {
    if (!('mediaSession' in navigator) || !active) return;

    const actionHandlers = [
      ['play', () => {
        mediaRef.current?.play().then(() => setIsPlaying(true)).catch(() => {});
      }],
      ['pause', () => {
        mediaRef.current?.pause();
        setIsPlaying(false);
      }],
      ['previoustrack', () => handlePrev()],
      ['nexttrack', () => handleNext()],
      ['seekto', (details) => {
        if (details.seekTime != null && mediaRef.current) {
          mediaRef.current.currentTime = details.seekTime;
          setCurrentTime(details.seekTime);
        }
      }],
      ['seekbackward', (details) => {
        if (mediaRef.current) {
          const skip = details.seekOffset || 10;
          const target = Math.max(mediaRef.current.currentTime - skip, 0);
          mediaRef.current.currentTime = target;
          setCurrentTime(target);
        }
      }],
      ['seekforward', (details) => {
        if (mediaRef.current) {
          const skip = details.seekOffset || 30;
          const target = Math.min(mediaRef.current.currentTime + skip, duration || 0);
          mediaRef.current.currentTime = target;
          setCurrentTime(target);
        }
      }],
      ['stop', () => {
        if (mediaRef.current) {
          mediaRef.current.pause();
          mediaRef.current.currentTime = 0;
        }
        setIsPlaying(false);
      }],
    ];

    for (const [action, handler] of actionHandlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (e) {}
    }

    return () => {
      for (const [action] of actionHandlers) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch (e) {}
      }
    };
  }, [active, handlePrev, handleNext, duration]);

  // Sync MediaSession playbackState (playing/paused)
  useEffect(() => {
    if (!('mediaSession' in navigator) || !active) return;
    try {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    } catch (e) {}
  }, [active, isPlaying]);

  // Sync MediaSession positionState for live Windows 11 flyout scrubber
  useEffect(() => {
    if (!('mediaSession' in navigator) || !active || !('setPositionState' in navigator.mediaSession)) return;
    if (duration > 0 && currentTime >= 0 && currentTime <= duration) {
      try {
        navigator.mediaSession.setPositionState({
          duration: duration,
          playbackRate: playbackRate || 1,
          position: currentTime,
        });
      } catch (e) {}
    }
  }, [active, duration, currentTime, playbackRate]);

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
        handleRewind10();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleForward30();
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
        if (isQueueOpen) {
          setIsQueueOpen(false);
        } else if (isFullscreen || getFullscreenElement()) {
          exitFullscreenSafe();
        } else {
          handleFullClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active, isFullscreen, duration, togglePlay, isMuted, handleRewind10, handleForward30, isQueueOpen]);

  if (!active) return null;

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

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
        currentTime={currentTime}
        duration={duration}
        mediaRef={mediaRef}
        onTogglePlay={togglePlay}
        onPrev={handlePrev}
        onNext={handleNext}
        onExpand={() => setIsMinimized(false)}
        onClose={handleFullClose}
      />

      {/* Main Fullscreen / Media Player Surface */}
      <div
        className={`fixed inset-0 z-50 bg-black flex items-center justify-center select-none transition-all duration-300 ${
          isMinimized ? 'opacity-0 pointer-events-none -z-50 scale-95' : 'opacity-100 z-50 scale-100'
        }`}
        onMouseMove={handleUserActivity}
        onClick={handleUserActivity}
      >
        <div
          ref={modalContainerRef}
          className="w-full h-full bg-[#0a0a0c] flex flex-col justify-between overflow-hidden relative"
        >
          {/* ── WINDOWS 11 MEDIA PLAYER TOP BAR ── */}
          <div
            className={`absolute top-0 left-0 right-0 z-30 h-14 px-5 bg-gradient-to-b from-black/85 via-black/45 to-transparent flex items-center justify-between transition-opacity duration-300 ${
              controlsVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
          >
            {/* Top Left: Back Arrow + App Icon + "Media Player" */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleFullClose}
                className="w-9 h-9 rounded-full flex items-center justify-center text-slate-200 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
                title="Back (Esc)"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 select-none">
                {/* Windows 11 Media Player Play Icon Badge */}
                <div className="w-5 h-5 rounded-full bg-brand-acc/20 border border-brand-acc/40 flex items-center justify-center text-brand-acc shadow-sm">
                  <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
                </div>
                <span className="text-[13px] font-semibold text-slate-200 tracking-tight">
                  Media Player
                </span>
                {safeFiles.length > 1 && (
                  <span className="text-xs text-slate-400 font-normal ml-1">
                    ({currentIndex + 1} of {safeFiles.length})
                  </span>
                )}
              </div>
            </div>

            {/* Top Right: Minimal Controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleMinimizeToMini}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Mini player (Picture-in-Picture)"
              >
                <MiniPlayerIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleFullClose}
                className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/10 transition-colors"
                title="Close player"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          {/* ── MEDIA CANVAS (VIDEO / AUDIO VISUALIZER) ── */}
          <div className="flex-1 w-full h-full relative bg-black flex items-center justify-center overflow-hidden">
            {playbackError ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[#0d0e12] gap-3 select-none">
                <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-rose-400 shadow-lg">
                  <Film className="w-7 h-7" />
                </div>
                <div className="flex flex-col gap-1 max-w-sm">
                  <h4 className="text-sm font-bold text-slate-100">Unable to Play File</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{playbackError}</p>
                  <p className="text-[11px] font-mono text-slate-500 truncate mt-1 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 max-w-xs">
                    {currentFile?.path || currentFile?.name}
                  </p>
                </div>
              </div>
            ) : isAudio ? (
              <>
                <audio
                  ref={mediaRef}
                  src={mediaUrl}
                  title={trackDisplayName}
                  aria-label={trackDisplayName}
                  crossOrigin="anonymous"
                  onTimeUpdate={() => mediaRef.current && setCurrentTime(mediaRef.current.currentTime)}
                  onDurationChange={() => mediaRef.current && setDuration(mediaRef.current.duration)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={handleNext}
                  onError={() => setPlaybackError('Playback error: Unable to decode audio stream.')}
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
                onDoubleClick={toggleFullscreen}
              >
                <video
                  ref={mediaRef}
                  src={mediaUrl}
                  title={trackDisplayName}
                  aria-label={trackDisplayName}
                  crossOrigin="anonymous"
                  className="w-full h-full object-contain max-h-screen"
                  onTimeUpdate={() => mediaRef.current && setCurrentTime(mediaRef.current.currentTime)}
                  onDurationChange={() => mediaRef.current && setDuration(mediaRef.current.duration)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={handleNext}
                  onError={() => setPlaybackError('Playback error: Unable to play video.')}
                  playsInline
                />
                {!isPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/35 pointer-events-none transition-opacity">
                    <div className="w-16 h-16 rounded-full bg-surface-1/90 border border-white/20 text-white flex items-center justify-center shadow-2xl transition-transform group-hover:scale-105">
                      <Play className="w-7 h-7 ml-0.5 fill-current text-white" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Slide-out Queue / Playlist Drawer (Windows 11 Media Player side drawer) */}
            {safeFiles.length > 1 && (
              <div
                className={`absolute top-0 right-0 bottom-0 w-80 max-w-[85vw] z-40 bg-[#111216]/95 backdrop-blur-2xl border-l border-white/10 shadow-2xl flex flex-col transition-transform duration-300 ${
                  isQueueOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ListMusic className="w-4 h-4 text-brand-acc" />
                    <span className="text-sm font-semibold text-white">Play Queue</span>
                    <span className="text-xs text-slate-400">({safeFiles.length})</span>
                  </div>
                  <button
                    onClick={() => setIsQueueOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
                  {safeFiles.map((file, idx) => {
                    const isActive = currentIndex === idx;
                    const itemName = file.name ? file.name.replace(/\.[^/.]+$/, '') : `Item ${idx + 1}`;
                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          setCurrentIndex(idx);
                        }}
                        className={`p-2.5 rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                          isActive
                            ? 'bg-brand-acc/15 border border-brand-acc/35 text-white font-medium'
                            : 'hover:bg-white/5 text-slate-300 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              isActive ? 'bg-brand-acc text-slate-950 font-bold' : 'bg-white/5 text-slate-400'
                            }`}
                          >
                            {isActive ? (
                              <Play className="w-3 h-3 fill-current ml-0.5" />
                            ) : (
                              <span className="text-xs font-mono">{idx + 1}</span>
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs truncate">{itemName}</span>
                            <span className="text-[10px] text-slate-400">
                              {isActive ? 'Now Playing' : `Track #${idx + 1}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── WINDOWS 11 MEDIA PLAYER BOTTOM CONTROLS BAR ── */}
          <div
            className={`w-full z-30 bg-[#0e0f14]/90 backdrop-blur-2xl border-t border-white/5 transition-opacity duration-300 ${
              controlsVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ROW 1: FULL-WIDTH PRECISE SEEKBAR */}
            <div className="px-5 sm:px-8 pt-3 pb-1 flex items-center gap-3.5 w-full">
              {/* Left Timestamp: 00:00:05 */}
              <span className="font-mono text-[11px] sm:text-xs text-slate-300 font-medium select-none min-w-[56px] text-left">
                {fmtWin11Time(currentTime)}
              </span>

              {/* Windows 11 Styled Scrub Track */}
              <div className="relative flex-1 flex items-center group py-2 cursor-pointer">
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  step={0.1}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-1 group-hover:h-1.5 rounded-full appearance-none cursor-pointer bg-white/20 transition-all focus:outline-none"
                  style={{
                    background: `linear-gradient(to right, var(--acc, #38bdf8) 0%, var(--acc, #38bdf8) ${progressPercent}%, rgba(255,255,255,0.2) ${progressPercent}%, rgba(255,255,255,0.2) 100%)`,
                    accentColor: 'var(--acc, #38bdf8)',
                  }}
                />
              </div>

              {/* Right Timestamp: 00:03:52 */}
              <span className="font-mono text-[11px] sm:text-xs text-slate-300 font-medium select-none min-w-[56px] text-right">
                {fmtWin11Time(duration)}
              </span>
            </div>

            {/* ROW 2: CONTROLS CLUSTER (LEFT: TITLE | CENTER: PLAYBACK | RIGHT: UTILITIES) */}
            <div className="px-5 sm:px-8 pt-0.5 pb-4 flex items-center justify-between gap-4">
              {/* Left Section: Track Title (Matching Windows 11 Media Player) */}
              <div className="flex items-center min-w-0 w-1/4">
                <h3
                  className="text-sm sm:text-base font-semibold text-white truncate tracking-tight select-text"
                  title={trackDisplayName}
                >
                  {trackDisplayName}
                </h3>
              </div>

              {/* Center Section: Playback Controls (Perfect Windows 11 alignment) */}
              <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 shrink-0">
                {/* 1. Shuffle */}
                <button
                  type="button"
                  onClick={toggleShuffle}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    isShuffling
                      ? 'text-brand-acc bg-brand-acc/10'
                      : 'text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                  title={isShuffling ? 'Shuffle On' : 'Shuffle Off'}
                >
                  <Shuffle className="w-4 h-4" />
                </button>

                {/* 2. Previous Track */}
                <button
                  type="button"
                  onClick={handlePrev}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
                  title="Previous track"
                >
                  <SkipBack className="w-4.5 h-4.5 fill-current" />
                </button>

                {/* 3. Rewind 10 seconds (Windows 11 signature control) */}
                <button
                  type="button"
                  onClick={handleRewind10}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
                  title="Rewind 10 seconds (Left Arrow)"
                >
                  <Rewind10Icon className="w-4.5 h-4.5" />
                </button>

                {/* 4. Play / Pause Button (The Windows 11 Accent Ring Button!) */}
                <button
                  type="button"
                  onClick={togglePlay}
                  className="w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-[#1c1c22] hover:bg-[#25252c] border-[2.5px] border-brand-acc flex items-center justify-center shadow-[0_0_16px_var(--acc-glow,rgba(56,189,248,0.3))] hover:scale-105 active:scale-95 transition-all cursor-pointer mx-1 shrink-0"
                  title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 fill-white text-white" />
                  ) : (
                    <Play className="w-5 h-5 fill-white text-white ml-0.5" />
                  )}
                </button>

                {/* 5. Fast Forward 30 seconds (Windows 11 signature control) */}
                <button
                  type="button"
                  onClick={handleForward30}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
                  title="Forward 30 seconds (Right Arrow)"
                >
                  <Forward30Icon className="w-4.5 h-4.5" />
                </button>

                {/* 6. Next Track */}
                <button
                  type="button"
                  onClick={handleNext}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
                  title="Next track"
                >
                  <SkipForward className="w-4.5 h-4.5 fill-current" />
                </button>

                {/* 7. Repeat / Loop */}
                <button
                  type="button"
                  onClick={toggleLoop}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    isLooping
                      ? 'text-brand-acc bg-brand-acc/10'
                      : 'text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                  title={isLooping ? 'Repeat On' : 'Repeat Off'}
                >
                  <Repeat className="w-4 h-4" />
                </button>
              </div>

              {/* Right Section: Utility Cluster (PIP, Volume, Fullscreen, Queue, More) */}
              <div className="flex items-center justify-end gap-1 sm:gap-2 w-1/4">
                {/* 1. Mini Player (PIP) */}
                <button
                  type="button"
                  onClick={handleMinimizeToMini}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
                  title="Mini Player (Picture in Picture)"
                >
                  <MiniPlayerIcon className="w-4 h-4" />
                </button>

                {/* 2. Volume with smooth hover slider */}
                <div className="relative flex items-center group/vol">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                    title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4.5 h-4.5 text-rose-400" />
                    ) : (
                      <Volume2 className="w-4.5 h-4.5" />
                    )}
                  </button>
                  <div className="w-0 group-hover/vol:w-20 transition-all duration-200 overflow-hidden flex items-center pr-1">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-18 h-1 rounded-full cursor-pointer bg-white/20"
                      style={{ accentColor: 'var(--acc, #38bdf8)' }}
                      title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
                    />
                  </div>
                </div>

                {/* 3. Fullscreen Toggle */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
                  title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-4.5 h-4.5 text-brand-acc" />
                  ) : (
                    <Maximize2 className="w-4.5 h-4.5" />
                  )}
                </button>

                {/* 4. Queue / Playlist Drawer Toggle */}
                {safeFiles.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setIsQueueOpen((prev) => !prev)}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                      isQueueOpen
                        ? 'text-brand-acc bg-brand-acc/15'
                        : 'text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                    title="Toggle Queue Drawer"
                  >
                    <ListMusic className="w-4.5 h-4.5" />
                  </button>
                )}

                {/* 5. More Options (Playback Speed, etc.) */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSpeedMenu((prev) => !prev)}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                      showSpeedMenu
                        ? 'text-white bg-white/15'
                        : 'text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                    title="More Options"
                  >
                    <MoreHorizontal className="w-4.5 h-4.5" />
                  </button>

                  {/* Windows 11 Fluent Context Menu */}
                  {showSpeedMenu && (
                    <div
                      className="absolute right-0 bottom-11 w-44 bg-[#18191e]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-1.5 flex flex-col gap-1 z-50 text-xs animate-fade-in"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                        Playback Speed
                      </span>
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map((spd) => (
                        <button
                          key={spd}
                          type="button"
                          onClick={() => {
                            setPlaybackRate(spd);
                            setShowSpeedMenu(false);
                          }}
                          className={`px-2.5 py-1.5 rounded-xl flex items-center justify-between transition-colors ${
                            playbackRate === spd
                              ? 'bg-brand-acc/20 text-brand-acc font-semibold'
                              : 'text-slate-300 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <span>{spd === 1 ? '1.0x (Normal)' : `${spd}x`}</span>
                          {playbackRate === spd && <Check className="w-3.5 h-3.5 text-brand-acc" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
