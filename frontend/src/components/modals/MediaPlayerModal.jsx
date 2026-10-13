import React, { useState, useEffect, useRef } from 'react';
import {
  Play, Pause, RotateCcw, RotateCw, Volume1, Volume2, VolumeX,
  Maximize2, Minimize2, X, Music, Film, Repeat, SkipBack, SkipForward,
  ListMusic, AlertCircle, ExternalLink,
} from 'lucide-react';
import { fmtTime, AUDIO_EXT } from '../../lib/formatters';
import { api } from '../../lib/api';

/* ────────────────────────────────────────────────────────────────────────────
   Uses the app's existing theme tokens: surface-1..4, border-subtle,
   border-highlight, brand-acc / brand-dim / brand-border, shadow-glow, --acc.
   Controls: 36px hit areas, 18px icons, rounded-xl; panels rounded-2xl/3xl.
──────────────────────────────────────────────────────────────────────────── */

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SEEK_STEP = 10; // seconds
const IDLE_MS = 2500; // fullscreen controls auto-hide delay
const VOL_KEY = 'nd_player_volume';

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

const readVolume = () => {
  try {
    const v = parseFloat(localStorage.getItem(VOL_KEY));
    return Number.isFinite(v) ? clamp(v, 0, 1) : 1;
  } catch {
    return 1;
  }
};

const withAlpha = (color, a) => {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color);
  if (!m) return `rgba(124, 109, 250, ${a})`;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/* ── Small reusable controls ─────────────────────────────────────────────── */

function IconButton({ title, onClick, active = false, disabled = false, className = '', children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active || undefined}
      disabled={disabled}
      onClick={onClick}
      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-acc/60 disabled:opacity-30 disabled:pointer-events-none ${
        active
          ? 'bg-brand-dim text-brand-acc'
          : 'text-slate-400 hover:text-white hover:bg-surface-3 active:bg-surface-4'
      } ${className}`}
    >
      {children}
    </button>
  );
}

// Seek / volume slider with a filled track (and optional buffered segment)
function RangeSlider({ value, max, step = 'any', onChange, buffered = 0, label, className = '' }) {
  const pct = max > 0 ? clamp((value / max) * 100, 0, 100) : 0;
  const buf = Math.max(pct, clamp(buffered, 0, 100));
  return (
    <input
      type="range"
      min={0}
      max={max}
      step={step}
      value={value}
      onChange={onChange}
      onPointerUp={(e) => e.currentTarget.blur()} // keep Space / arrow shortcuts working after a drag
      aria-label={label}
      className={`appearance-none h-1.5 rounded-full cursor-pointer outline-none bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:opacity-0 [&::-webkit-slider-thumb]:transition-opacity hover:[&::-webkit-slider-thumb]:opacity-100 focus-visible:[&::-webkit-slider-thumb]:opacity-100 ${className}`}
      style={{
        background: `linear-gradient(to right, var(--acc) ${pct}%, rgba(255,255,255,0.28) ${pct}%, rgba(255,255,255,0.28) ${buf}%, rgba(255,255,255,0.10) ${buf}%)`,
      }}
    />
  );
}

function Equalizer({ playing }) {
  return (
    <span className="flex items-end gap-[2px] h-3">
      {[60, 100, 40].map((h, i) => (
        <span
          key={i}
          className={`w-[2px] bg-current rounded-full ${playing ? 'animate-pulse' : ''}`}
          style={{ height: `${h}%`, animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   MEDIA PLAYER MODAL
════════════════════════════════════════════════════════════════════════════ */

export default function MediaPlayerModal({ isOpen, onClose, files = [], title = '' }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(readVolume);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [rate, setRate] = useState(1);
  const [showSpeed, setShowSpeed] = useState(false);
  const [isFs, setIsFs] = useState(false); // real browser fullscreen
  const [fill, setFill] = useState(false); // fallback: fill the app window
  const [queueOpen, setQueueOpen] = useState(true);
  const [mediaUrl, setMediaUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [active, setActive] = useState(true); // recent pointer/keyboard activity

  const mediaRef = useRef(null);
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const idleTimer = useRef(null);
  const queueRefs = useRef([]);

  /* ── Derived values ───────────────────────────────────────────────────── */

  const total = files?.length || 0;
  const index = total > 0 && files[currentIndex] ? currentIndex : 0;
  const currentFile = total > 0 ? files[index] : null;
  const ext = (currentFile?.name?.split('.').pop() || '').toLowerCase();
  const isAudio = AUDIO_EXT.includes(ext);
  const hasQueue = total > 1;
  const hasNext = index < total - 1;
  const immersive = isFs || fill;
  const chromeHidden = immersive && isPlaying && !active;

  /* ── Media actions ────────────────────────────────────────────────────── */

  const poke = () => {
    setActive(true);
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setActive(false), IDLE_MS);
  };

  const syncPrefs = () => {
    const m = mediaRef.current;
    if (!m) return;
    m.volume = volume;
    m.muted = isMuted;
    m.loop = isLooping;
    m.defaultPlaybackRate = rate;
    m.playbackRate = rate;
  };

  const updateBuffered = () => {
    const m = mediaRef.current;
    if (!m || !Number.isFinite(m.duration) || m.duration <= 0) return;
    let end = 0;
    for (let i = 0; i < m.buffered.length; i += 1) {
      if (m.buffered.start(i) <= m.currentTime && m.buffered.end(i) >= m.currentTime) {
        end = m.buffered.end(i);
      }
    }
    setBuffered((end / m.duration) * 100);
  };

  const togglePlay = () => {
    const m = mediaRef.current;
    if (!m) return;
    if (m.paused) m.play().catch(() => {});
    else m.pause();
  };

  const seekBy = (delta) => {
    const m = mediaRef.current;
    if (!m || !Number.isFinite(m.duration)) return;
    m.currentTime = clamp(m.currentTime + delta, 0, m.duration);
  };

  const handleSeek = (e) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (mediaRef.current) mediaRef.current.currentTime = val;
  };

  const applyVolume = (val) => {
    const v = clamp(val, 0, 1);
    const mute = v === 0;
    setVolume(v);
    setIsMuted(mute);
    const m = mediaRef.current;
    if (m) { m.volume = v; m.muted = mute; }
    try { localStorage.setItem(VOL_KEY, String(v)); } catch {}
  };

  const toggleMute = () => {
    if (isMuted || volume === 0) {
      applyVolume(volume === 0 ? 0.5 : volume);
    } else {
      setIsMuted(true);
      if (mediaRef.current) mediaRef.current.muted = true;
    }
  };

  const toggleLoop = () => {
    const next = !isLooping;
    setIsLooping(next);
    if (mediaRef.current) mediaRef.current.loop = next;
  };

  const chooseRate = (r) => {
    setRate(r);
    setShowSpeed(false);
    if (mediaRef.current) {
      mediaRef.current.defaultPlaybackRate = r;
      mediaRef.current.playbackRate = r;
    }
  };

  const goNext = () => { if (hasNext) setCurrentIndex(index + 1); };
  const goPrev = () => {
    const m = mediaRef.current;
    if (index === 0 || (m && m.currentTime > 3)) {
      if (m) m.currentTime = 0; // restart the track first, like most players
    } else {
      setCurrentIndex(index - 1);
    }
  };

  const handleEnded = () => {
    if (hasNext) goNext();
    else setIsPlaying(false);
  };

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
      return;
    }
    if (fill) { setFill(false); return; }
    const el = containerRef.current;
    if (!el) return;
    try {
      await el.requestFullscreen();
    } catch {
      setFill(true); // webview without Fullscreen API: fill the window instead
    }
  };

  /* ── Effects ──────────────────────────────────────────────────── */

  // Start from the first item whenever the modal opens; tidy up when it closes
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
    } else {
      setFill(false);
      setShowSpeed(false);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    }
  }, [isOpen]);

  // Keep isFs in sync (Esc or the browser can leave fullscreen without us)
  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => () => clearTimeout(idleTimer.current), []);

  // Resolve the stream URL for the current file
  useEffect(() => {
    if (!isOpen || !currentFile?.path) return undefined;
    let alive = true;
    setIsLoading(true);
    setHasError(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setBuffered(0);

    (async () => {
      try {
        const res = await api.getMediaUrl(currentFile.path);
        if (alive) setMediaUrl(res?.ok && res.url ? res.url : currentFile.path);
      } catch {
        if (alive) setMediaUrl(currentFile.path);
      } finally {
        if (alive) setIsLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [isOpen, currentFile?.path]);

  // Always read the latest handlers from here so the key listener stays stable
  const actionsRef = useRef({});
  actionsRef.current = {
    poke, togglePlay, seekBy, toggleMute, toggleFullscreen, goNext, goPrev, onClose,
    nudgeVolume: (d) => applyVolume((isMuted ? 0 : volume) + d),
    showSpeed, closeSpeed: () => setShowSpeed(false),
    fill, exitFill: () => setFill(false), isAudio,
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e) => {
      const a = actionsRef.current;
      a.poke();
      const t = e.target;
      if (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && t.type !== 'range') || t.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Let a focused button handle its own Space / Enter
      if (t.tagName === 'BUTTON' && (e.code === 'Space' || e.key === 'Enter')) return;
      const key = e.key.toLowerCase();

      if (e.key === 'Escape') {
        if (a.showSpeed) { e.preventDefault(); a.closeSpeed(); }
        else if (a.fill) { e.preventDefault(); a.exitFill(); }
        else if (!document.fullscreenElement) { e.preventDefault(); a.onClose(); }
      } else if (e.code === 'Space') { e.preventDefault(); a.togglePlay(); }
      else if (e.key === 'ArrowLeft' || key === 'j') { e.preventDefault(); a.seekBy(-SEEK_STEP); }
      else if (e.key === 'ArrowRight' || key === 'l') { e.preventDefault(); a.seekBy(SEEK_STEP); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); a.nudgeVolume(0.05); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); a.nudgeVolume(-0.05); }
      else if (key === 'm') { e.preventDefault(); a.toggleMute(); }
      else if (key === 'n') { e.preventDefault(); a.goNext(); }
      else if (key === 'p') { e.preventDefault(); a.goPrev(); }
      else if (key === 'f' && !a.isAudio) { e.preventDefault(); a.toggleFullscreen(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  // Keep the playing queue item in view
  useEffect(() => {
    queueRefs.current[index]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [index]);

  // Audio visualiser (decorative: animated, not driven by the actual audio signal)
  useEffect(() => {
    if (!isOpen || !isAudio || isLoading || hasError) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const acc = (getComputedStyle(document.documentElement).getPropertyValue('--acc') || '').trim() || '#7c6dfa';
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const size = { w: 0, h: 0 };
    let step = 0;
    let animId = 0;

    const fit = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      size.w = r.width;
      size.h = r.height;
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (amp) => {
      const { w, h } = size;
      if (!w || !h) return;
      ctx.clearRect(0, 0, w, h);
      const bw = 4;
      const gap = 4;
      const count = Math.max(16, Math.floor((w + gap) / (bw + gap)));
      const x0 = (w - (count * (bw + gap) - gap)) / 2;
      for (let i = 0; i < count; i += 1) {
        const wave = Math.sin(step + i * 0.28) * 0.5 + Math.cos(step * 0.7 + i * 0.15) * 0.3;
        const norm = clamp((wave + 0.8) / 1.6, 0.12, 0.95);
        const bh = Math.max(4, norm * amp * h);
        ctx.fillStyle = withAlpha(acc, 0.35 + 0.65 * norm);
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x0 + i * (bw + gap), (h - bh) / 2, bw, bh, bw / 2);
        else ctx.rect(x0 + i * (bw + gap), (h - bh) / 2, bw, bh);
        ctx.fill();
      }
    };

    fit();
    const ro = new ResizeObserver(() => { fit(); draw(isPlaying ? 1 : 0.3); });
    ro.observe(canvas);

    if (isPlaying && !reduceMotion) {
      const loop = () => { step += 0.08; draw(1); animId = requestAnimationFrame(loop); };
      loop();
    } else {
      draw(isPlaying ? 0.8 : 0.3);
    }

    return () => { cancelAnimationFrame(animId); ro.disconnect(); };
  }, [isOpen, isAudio, isLoading, hasError, isPlaying]);

  // Safe early exit AFTER hooks
  if (!isOpen || !total || !currentFile) return null;

  /* ── Render helpers ───────────────────────────────────────────────────── */

  const trackTitle = currentFile.name.replace(/\.[^/.]+$/, '');
  const subtitle = [title, hasQueue ? `${index + 1} of ${total}` : null, ext ? ext.toUpperCase() : null]
    .filter(Boolean)
    .join(' · ');
  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  const mediaProps = {
    ref: mediaRef,
    src: mediaUrl,
    autoPlay: true,
    loop: isLooping,
    onPlay: () => setIsPlaying(true),
    onPause: () => setIsPlaying(false),
    onTimeUpdate: () => {
      const m = mediaRef.current;
      if (m) { setCurrentTime(m.currentTime); updateBuffered(); }
    },
    onProgress: updateBuffered,
    onLoadedMetadata: () => {
      const m = mediaRef.current;
      if (m) {
        setDuration(Number.isFinite(m.duration) ? m.duration : 0);
        syncPrefs();
      }
    },
    onError: () => setHasError(true),
    onEnded: handleEnded,
  };

  const shellClass = immersive
    ? 'w-full h-full max-w-none rounded-none'
    : `w-full ${hasQueue && queueOpen ? 'max-w-5xl' : 'max-w-4xl'} h-[min(88vh,680px)] rounded-3xl`;

  const fade = `transition-opacity duration-300 ${chromeHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'}`;

  return (
    <div
      className={`fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center animate-fadeIn ${
        immersive ? 'p-0' : 'p-4'
      }`}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !immersive) onClose(); }}
    >
      <div
        ref={containerRef}
        onMouseMove={poke}
        className={`relative flex flex-col bg-surface-1 border border-border-highlight/50 shadow-2xl overflow-hidden transition-[max-width,border-radius] duration-200 ${shellClass} ${
          chromeHidden ? 'cursor-none' : ''
        }`}
      >
        {/* ── HEADER ── */}
        <header
          className={`h-14 px-4 flex items-center justify-between shrink-0 z-20 ${fade} ${
            immersive
              ? 'absolute top-0 inset-x-0 bg-gradient-to-b from-black/80 to-transparent'
              : 'bg-surface-2 border-b border-border-subtle'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-brand-dim border border-brand-border text-brand-acc flex items-center justify-center shrink-0">
              {isAudio ? <Music className="w-4 h-4" /> : <Film className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-100 truncate tracking-tight">{currentFile.name}</div>
              {subtitle && <div className="text-xs text-slate-400 truncate">{subtitle}</div>}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {hasQueue && !immersive && (
              <IconButton
                title={queueOpen ? 'Hide queue' : 'Show queue'}
                active={queueOpen}
                onClick={() => setQueueOpen((q) => !q)}
              >
                <ListMusic className="w-[18px] h-[18px]" />
              </IconButton>
            )}
            <IconButton title="Close (Esc)" onClick={onClose}>
              <X className="w-[18px] h-[18px]" />
            </IconButton>
          </div>
        </header>

        {/* ── BODY ── */}
        <div className="flex-1 min-h-0 flex">
          <div className="flex-1 min-w-0 relative flex flex-col">

            {/* STAGE */}
            <div className={`flex-1 min-h-0 relative overflow-hidden ${isAudio ? 'bg-surface-1' : 'bg-black'}`}>
              {isLoading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400 text-xs">
                  <div className="w-8 h-8 rounded-full border-2 border-brand-acc border-t-transparent animate-spin" />
                  <span>Loading {isAudio ? 'audio' : 'video'}…</span>
                </div>
              ) : hasError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-surface-2 border border-border-subtle flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-slate-400" />
                  </div>
                  <div className="max-w-xs">
                    <p className="text-sm font-semibold text-slate-100">Can't play this file</p>
                    <p className="text-xs text-slate-500 mt-1">
                      It may be missing, moved, or in a format that can't be decoded here.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => api.openFile(currentFile.path)}
                      className="h-9 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-surface-3 text-slate-200 hover:bg-surface-4 hover:text-white transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" /> Open in default app
                    </button>
                    {hasNext && (
                      <button
                        type="button"
                        onClick={goNext}
                        className="h-9 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-brand-dim text-brand-acc border border-brand-border hover:opacity-90 transition-opacity"
                      >
                        <SkipForward className="w-4 h-4" /> Next
                      </button>
                    )}
                  </div>
                </div>
              ) : isAudio ? (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-6 text-center"
                  style={{
                    background:
                      'radial-gradient(ellipse 70% 60% at 50% 35%, color-mix(in srgb, var(--acc) 16%, transparent), transparent 70%)',
                  }}
                >
                  <div className="relative">
                    <div
                      className={`absolute inset-0 rounded-[28px] blur-2xl transition-opacity duration-700 ${
                        isPlaying ? 'opacity-50' : 'opacity-15'
                      }`}
                      style={{ background: 'var(--acc)' }}
                    />
                    <div className="relative w-36 h-36 rounded-[28px] bg-brand-dim border border-brand-border flex items-center justify-center text-brand-acc shadow-glow">
                      <Music className="w-14 h-14" />
                    </div>
                  </div>

                  <div className="min-w-0 max-w-md">
                    <h2 className="text-lg font-semibold text-slate-50 truncate">{trackTitle}</h2>
                    <p className="text-xs text-slate-400 mt-1 uppercase tracking-wide">{ext || 'audio'}</p>
                  </div>

                  <canvas ref={canvasRef} className="w-full max-w-lg h-20" />

                  <audio key={currentFile.path} {...mediaProps} />
                </div>
              ) : (
                <>
                  <video
                    key={currentFile.path}
                    {...mediaProps}
                    playsInline
                    className="w-full h-full object-contain bg-black"
                    onClick={togglePlay}
                    onDoubleClick={toggleFullscreen}
                  />
                  {!isPlaying && (
                    <button
                      type="button"
                      onClick={togglePlay}
                      aria-label="Play"
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-black/55 backdrop-blur-md border border-white/15 text-white flex items-center justify-center hover:bg-brand-acc hover:border-transparent transition-colors animate-fadeIn"
                    >
                      <Play className="w-7 h-7 ml-1 fill-current" />
                    </button>
                  )}
                </>
              )}
            </div>

            {/* ── CONTROLS ── */}
            <div
              className={`z-20 shrink-0 flex flex-col gap-1.5 select-none ${fade} ${
                immersive
                  ? 'absolute bottom-0 inset-x-0 px-6 pt-12 pb-5 bg-gradient-to-t from-black/85 via-black/50 to-transparent'
                  : 'px-5 pt-3 pb-4 bg-surface-2 border-t border-border-subtle'
              }`}
            >
              {/* Seek bar */}
              <div className="flex items-center gap-3">
                <span className="w-12 text-[11px] font-mono tabular-nums text-slate-400">
                  {fmtTime(currentTime * 1000)}
                </span>
                <RangeSlider
                  className="flex-1"
                  label="Seek"
                  value={currentTime}
                  max={duration || 1}
                  buffered={buffered}
                  onChange={handleSeek}
                />
                <span className="w-12 text-right text-[11px] font-mono tabular-nums text-slate-400">
                  {fmtTime((duration || 0) * 1000)}
                </span>
              </div>

              {/* Buttons */}
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                {/* Volume */}
                <div className="flex items-center justify-self-start group">
                  <IconButton title={isMuted || volume === 0 ? 'Unmute (M)' : 'Mute (M)'} onClick={toggleMute}>
                    <VolumeIcon className="w-[18px] h-[18px]" />
                  </IconButton>
                  <div className="w-0 overflow-hidden group-hover:w-24 group-focus-within:w-24 transition-[width] duration-200 flex items-center">
                    <RangeSlider
                      className="w-20 mx-2"
                      label="Volume"
                      value={isMuted ? 0 : volume}
                      max={1}
                      step={0.05}
                      onChange={(e) => applyVolume(parseFloat(e.target.value))}
                    />
                  </div>
                </div>

                {/* Transport */}
                <div className="flex items-center gap-1">
                  {hasQueue && (
                    <IconButton title="Previous (P)" onClick={goPrev}>
                      <SkipBack className="w-[18px] h-[18px] fill-current" />
                    </IconButton>
                  )}
                  <IconButton title={`Back ${SEEK_STEP}s (←)`} onClick={() => seekBy(-SEEK_STEP)} disabled={isLoading || hasError} className="relative">
                    <RotateCcw className="w-[18px] h-[18px]" />
                    <span className="absolute text-[7px] font-bold leading-none pt-px">{SEEK_STEP}</span>
                  </IconButton>
                  <button
                    type="button"
                    onClick={togglePlay}
                    disabled={isLoading || hasError}
                    title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                    className="w-11 h-11 mx-1 rounded-full bg-brand-acc text-white flex items-center justify-center shadow-glow hover:brightness-110 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 ml-0.5 fill-current" />}
                  </button>
                  <IconButton title={`Forward ${SEEK_STEP}s (→)`} onClick={() => seekBy(SEEK_STEP)} disabled={isLoading || hasError} className="relative">
                    <RotateCw className="w-[18px] h-[18px]" />
                    <span className="absolute text-[7px] font-bold leading-none pt-px">{SEEK_STEP}</span>
                  </IconButton>
                  {hasQueue && (
                    <IconButton title="Next (N)" onClick={goNext} disabled={!hasNext}>
                      <SkipForward className="w-[18px] h-[18px] fill-current" />
                    </IconButton>
                  )}
                </div>

                {/* Options */}
                <div className="flex items-center gap-1 justify-self-end">
                  <div className="relative">
                    <button
                      type="button"
                      title="Playback speed"
                      aria-label="Playback speed"
                      onClick={() => setShowSpeed((s) => !s)}
                      className={`h-9 min-w-[48px] px-2.5 rounded-xl text-xs font-semibold tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-acc/60 ${
                        showSpeed || rate !== 1
                          ? 'bg-brand-dim text-brand-acc'
                          : 'text-slate-400 hover:text-white hover:bg-surface-3'
                      }`}
                    >
                      {rate}×
                    </button>
                    {showSpeed && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={() => setShowSpeed(false)} />
                        <div className="absolute bottom-full right-0 mb-2 w-28 p-1.5 rounded-2xl bg-surface-3 border border-border-subtle shadow-2xl z-40 animate-fadeIn">
                          {RATES.map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => chooseRate(r)}
                              className={`w-full px-3 py-1.5 rounded-xl text-xs font-medium text-left tabular-nums transition-colors ${
                                r === rate
                                  ? 'bg-brand-dim text-brand-acc'
                                  : 'text-slate-300 hover:bg-surface-4 hover:text-white'
                              }`}
                            >
                              {r === 1 ? 'Normal' : `${r}×`}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  <IconButton title={isLooping ? 'Repeat on' : 'Repeat off'} active={isLooping} onClick={toggleLoop}>
                    <Repeat className="w-[18px] h-[18px]" />
                  </IconButton>

                  {!isAudio && (
                    <IconButton title={immersive ? 'Exit fullscreen (F)' : 'Fullscreen (F)'} onClick={toggleFullscreen}>
                      {immersive ? <Minimize2 className="w-[18px] h-[18px]" /> : <Maximize2 className="w-[18px] h-[18px]" />}
                    </IconButton>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── QUEUE ── */}
          {hasQueue && queueOpen && !immersive && (
            <aside className="w-72 shrink-0 border-l border-border-subtle bg-surface-1 flex flex-col">
              <div className="h-12 px-4 flex items-center justify-between border-b border-border-subtle shrink-0">
                <span className="text-xs font-semibold text-slate-200">Queue</span>
                <span className="text-[11px] text-slate-500 tabular-nums">{index + 1} / {total}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
                {files.map((f, i) => {
                  const isCur = i === index;
                  const fExt = (f.name?.split('.').pop() || '').toLowerCase();
                  return (
                    <button
                      key={`${f.path || f.name}-${i}`}
                      ref={(el) => { queueRefs.current[i] = el; }}
                      type="button"
                      onClick={() => setCurrentIndex(i)}
                      className={`w-full px-3 py-2 rounded-xl flex items-center gap-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-acc/60 ${
                        isCur ? 'bg-brand-dim text-brand-acc' : 'text-slate-300 hover:bg-surface-2 hover:text-white'
                      }`}
                    >
                      <span className="w-5 shrink-0 flex items-center justify-center text-[11px] tabular-nums">
                        {isCur ? <Equalizer playing={isPlaying} /> : i + 1}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-xs font-medium truncate">{f.name}</span>
                        <span className="block text-[10px] uppercase opacity-60">
                          {AUDIO_EXT.includes(fExt) ? 'Audio' : 'Video'}{fExt ? ` · ${fExt}` : ''}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}