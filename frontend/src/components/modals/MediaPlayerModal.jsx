import React, { useState, useEffect, useRef } from 'react';
import {
  Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX,
  Maximize2, Minimize2, X, Music, Film, Repeat, Volume1
} from 'lucide-react';
import { fmtTime, AUDIO_EXT } from '../../lib/formatters';
import { api } from '../../lib/api';

export default function MediaPlayerModal({ isOpen, onClose, files = [], title = '' }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mediaUrl, setMediaUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const mediaRef = useRef(null);
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  const currentFile = files && files.length > 0 ? (files[currentIndex] || files[0]) : null;
  const ext = (currentFile?.name?.split('.').pop() || '').toLowerCase();
  const isAudio = AUDIO_EXT.includes(ext);

  // Animated Audio Spectrum Visualizer
  useEffect(() => {
    if (!isOpen || !isAudio || !isPlaying) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let step = 0;

    const barCount = 36;
    const render = () => {
      step += 0.08;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / barCount) - 3;
      for (let i = 0; i < barCount; i++) {
        const wave = Math.sin(step + i * 0.28) * 0.5 + Math.cos(step * 0.7 + i * 0.15) * 0.3;
        const norm = Math.max(0.12, Math.min(0.95, (wave + 0.8) / 1.6));
        const barHeight = norm * (canvas.height - 12);
        const x = i * (barWidth + 3);
        const y = canvas.height - barHeight;

        const grad = ctx.createLinearGradient(0, y, 0, canvas.height);
        grad.addColorStop(0, '#a78bfa');
        grad.addColorStop(0.4, '#7c6dfa');
        grad.addColorStop(1, 'rgba(124, 109, 250, 0.15)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, barWidth, barHeight, [3, 3, 0, 0]);
        } else {
          ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, Math.max(2, y - 2), barWidth, 2);
      }
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [isOpen, isAudio, isPlaying]);

  // Load stream URL from Python pywebview server
  useEffect(() => {
    if (!isOpen || !currentFile) return;
    let active = true;
    async function fetchUrl() {
      setIsLoading(true);
      try {
        const res = await api.getMediaUrl(currentFile.path);
        if (active) {
          if (res?.ok && res.url) {
            setMediaUrl(res.url);
          } else {
            setMediaUrl(currentFile.path);
          }
          setIsLoading(false);
        }
      } catch {
        if (active) setIsLoading(false);
      }
    }
    fetchUrl();
    return () => { active = false; };
  }, [isOpen, currentIndex, currentFile]);

  // Keyboard hotkeys
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowLeft' || e.key === 'j') {
        e.preventDefault();
        if (mediaRef.current) mediaRef.current.currentTime = Math.max(0, mediaRef.current.currentTime - 10);
      } else if (e.key === 'ArrowRight' || e.key === 'l') {
        e.preventDefault();
        if (mediaRef.current) mediaRef.current.currentTime = Math.min(duration, mediaRef.current.currentTime + 10);
      } else if (e.key === 'm') {
        e.preventDefault();
        toggleMute();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, duration, isPlaying, isMuted]);

  const togglePlay = () => {
    if (!mediaRef.current) return;
    if (isPlaying) {
      mediaRef.current.pause();
    } else {
      mediaRef.current.play().catch(() => {});
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (mediaRef.current) mediaRef.current.currentTime = val;
  };

  const handleVolume = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);
    if (mediaRef.current) {
      mediaRef.current.volume = val;
      mediaRef.current.muted = val === 0;
    }
  };

  const toggleMute = () => {
    if (!mediaRef.current) return;
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    mediaRef.current.muted = newMuted;
  };

  const toggleLoop = () => {
    const next = !isLooping;
    setIsLooping(next);
    if (mediaRef.current) mediaRef.current.loop = next;
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Safe early exit AFTER hooks
  if (!isOpen || !files?.length || !currentFile) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div
        ref={containerRef}
        className="w-full max-w-4xl max-h-[90vh] bg-surface-1 rounded-2xl border border-border-highlight/50 shadow-2xl flex flex-col overflow-hidden relative"
      >
        {/* Header */}
        <div className="h-12 px-4 bg-surface-2 border-b border-border-subtle flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 truncate">
            {isAudio ? <Music className="w-4 h-4 text-brand-acc shrink-0" /> : <Film className="w-4 h-4 text-brand-acc shrink-0" />}
            <span className="text-xs font-semibold text-slate-100 truncate">{currentFile.name}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-surface-3 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Media Frame */}
        <div className="flex-1 min-h-[300px] max-h-[560px] bg-black flex items-center justify-center relative overflow-hidden">
          {isLoading ? (
            <div className="text-xs text-slate-400 font-mono animate-pulse">Loading media stream…</div>
          ) : isAudio ? (
            <div className="w-full flex flex-col items-center justify-center gap-3 p-6 text-slate-300">
              <div className="w-20 h-20 rounded-2xl bg-brand-dim border border-brand-border flex items-center justify-center text-brand-acc shadow-glow">
                <Music className="w-10 h-10 animate-bounce" style={{ animationDuration: '2s' }} />
              </div>
              <span className="text-sm font-semibold text-slate-100 truncate max-w-md">{currentFile.name}</span>

              {/* Spectrum Visualizer Canvas */}
              <canvas
                ref={canvasRef}
                width={500}
                height={100}
                className="w-full max-w-lg h-24 rounded-xl bg-surface-1/40 border border-border-subtle"
              />

              <audio
                ref={mediaRef}
                src={mediaUrl}
                autoPlay
                loop={isLooping}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={() => mediaRef.current && setCurrentTime(mediaRef.current.currentTime)}
                onLoadedMetadata={() => mediaRef.current && setDuration(mediaRef.current.duration)}
                onEnded={() => {
                  if (currentIndex < files.length - 1) {
                    setCurrentIndex(currentIndex + 1);
                  } else {
                    setIsPlaying(false);
                  }
                }}
              />
            </div>
          ) : (
            <video
              ref={mediaRef}
              src={mediaUrl}
              autoPlay
              loop={isLooping}
              className="w-full h-full object-contain"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={() => mediaRef.current && setCurrentTime(mediaRef.current.currentTime)}
              onLoadedMetadata={() => mediaRef.current && setDuration(mediaRef.current.duration)}
              onEnded={() => {
                if (currentIndex < files.length - 1) {
                  setCurrentIndex(currentIndex + 1);
                } else {
                  setIsPlaying(false);
                }
              }}
              onClick={togglePlay}
            />
          )}
        </div>

        {/* Controls Bar */}
        <div className="p-3 bg-surface-2 border-t border-border-subtle flex flex-col gap-2 shrink-0 select-none">
          {/* Seek Bar */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400 min-w-[36px]">
              {fmtTime(currentTime * 1000)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-1.5 rounded-lg bg-surface-4 accent-brand-acc cursor-pointer"
            />
            <span className="text-[11px] font-mono text-slate-400 min-w-[36px]">
              {fmtTime((duration || 0) * 1000)}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => mediaRef.current && (mediaRef.current.currentTime = Math.max(0, mediaRef.current.currentTime - 10))}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-3 transition-colors"
                title="Rewind 10s (Left Arrow)"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={togglePlay}
                className="w-8 h-8 rounded-full bg-brand-acc text-white flex items-center justify-center hover:opacity-90 shadow-glow"
                title="Play/Pause (Space)"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>
              <button
                onClick={() => mediaRef.current && (mediaRef.current.currentTime = Math.min(duration, mediaRef.current.currentTime + 10))}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-3 transition-colors"
                title="Fast forward 10s (Right Arrow)"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              <button
                onClick={toggleLoop}
                className={`p-1.5 rounded-lg border transition-colors ${
                  isLooping ? 'bg-brand-dim text-brand-acc border-brand-border' : 'text-slate-400 border-transparent hover:text-white hover:bg-surface-3'
                }`}
                title={isLooping ? 'Looping enabled' : 'Loop disabled'}
              >
                <Repeat className="w-3.5 h-3.5" />
              </button>

              {/* Volume */}
              <div className="flex items-center gap-1.5 ml-2">
                <button onClick={toggleMute} className="text-slate-400 hover:text-white">
                  {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolume}
                  className="w-16 h-1.5 bg-surface-4 accent-brand-acc cursor-pointer"
                />
              </div>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              {!isAudio && (
                <button
                  onClick={toggleFullscreen}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-3 transition-colors"
                  title="Toggle Fullscreen"
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Playlist Bar (If multi-file) */}
        {files.length > 1 && (
          <div className="p-2 bg-surface-1 border-t border-border-subtle flex items-center gap-1.5 overflow-x-auto">
            {files.map((f, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  currentIndex === i
                    ? 'bg-brand-dim text-brand-acc border border-brand-border'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-surface-2'
                }`}
              >
                {i + 1}. {f.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
