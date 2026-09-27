import React, { useEffect, useRef, useState } from 'react';
import { Music, BarChart2, Activity, Disc, EyeOff, Sparkles, Image } from 'lucide-react';

export default function AudioVisualizer({ mediaRef, isPlaying, coverArtUrl, title, artist }) {
  const canvasRef = useRef(null);
  const [mode, setMode] = useState(() => localStorage.getItem('md_visualizer_mode') || 'bars');
  const [displayStyle, setDisplayStyle] = useState(() => localStorage.getItem('md_visualizer_style') || 'card'); // 'card' | 'vinyl'

  const handleModeChange = (newMode) => {
    setMode(newMode);
    localStorage.setItem('md_visualizer_mode', newMode);
  };

  const toggleDisplayStyle = () => {
    const nextStyle = displayStyle === 'card' ? 'vinyl' : 'card';
    setDisplayStyle(nextStyle);
    localStorage.setItem('md_visualizer_style', nextStyle);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId;
    const bufferLength = 48;
    const dataArray = new Uint8Array(bufferLength);
    let phase = 0;

    const render = () => {
      animId = requestAnimationFrame(render);

      const w = canvas.clientWidth || 600;
      const h = canvas.clientHeight || 280;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      ctx.clearRect(0, 0, w, h);
      if (mode === 'off') return;

      const mediaEl = mediaRef?.current;
      const active = mediaEl && !mediaEl.paused && !mediaEl.ended;

      if (active) {
        // Dynamic harmonic audio visualizer
        phase += 0.06;
        for (let i = 0; i < bufferLength; i++) {
          const v = Math.sin(phase + i * 0.25) * 0.45 + Math.cos(phase * 1.4 + i * 0.12) * 0.35 + 0.2;
          dataArray[i] = Math.max(15, Math.min(255, Math.floor(v * 210)));
        }
      } else {
        // Decay to zero when paused
        for (let i = 0; i < bufferLength; i++) {
          dataArray[i] = Math.max(0, dataArray[i] * 0.88);
        }
      }

      // Theme accent color extraction
      const computed = getComputedStyle(document.documentElement);
      const acc = computed.getPropertyValue('--acc').trim() || '#00e599';

      // ── MODE: BARS ──────────────────────────────────────────────
      if (mode === 'bars') {
        const barCount = 48;
        const barSpacing = 4;
        const totalSpacing = barSpacing * (barCount - 1);
        const barWidth = Math.max(3, (w - 40 - totalSpacing) / barCount);
        const startX = (w - (barCount * barWidth + totalSpacing)) / 2;

        for (let i = 0; i < barCount; i++) {
          const dataIdx = Math.floor((i / barCount) * bufferLength * 0.85);
          const val = dataArray[dataIdx] || 0;
          const barHeight = Math.max(4, (val / 255) * (h * 0.55));
          const bx = startX + i * (barWidth + barSpacing);
          const by = h - barHeight - 12;

          const grad = ctx.createLinearGradient(0, by, 0, by + barHeight);
          grad.addColorStop(0, acc);
          grad.addColorStop(0.6, 'rgba(0, 229, 153, 0.6)');
          grad.addColorStop(1, 'rgba(0, 229, 153, 0.1)');

          ctx.fillStyle = grad;
          ctx.beginPath();
          const radius = Math.min(barWidth / 2, 4);
          if (ctx.roundRect) {
            ctx.roundRect(bx, by, barWidth, barHeight, [radius, radius, 1, 1]);
          } else {
            ctx.rect(bx, by, barWidth, barHeight);
          }
          ctx.fill();

          // Glowing peak dot
          if (val > 100) {
            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 8;
            ctx.shadowColor = acc;
            ctx.beginPath();
            ctx.arc(bx + barWidth / 2, by + 1.5, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        }
      }

      // ── MODE: WAVE ──────────────────────────────────────────────
      else if (mode === 'wave') {
        ctx.beginPath();
        const sliceWidth = w / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 255.0;
          const y = h / 2 + (v - 0.5) * (h * 0.7);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }

        ctx.lineWidth = 3;
        ctx.strokeStyle = acc;
        ctx.shadowBlur = 18;
        ctx.shadowColor = acc;
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        const fillGrad = ctx.createLinearGradient(0, h / 2, 0, h);
        fillGrad.addColorStop(0, 'rgba(0, 229, 153, 0.18)');
        fillGrad.addColorStop(1, 'rgba(0, 229, 153, 0.0)');
        ctx.fillStyle = fillGrad;
        ctx.fill();
      }

      // ── MODE: HALO (RADIAL CIRCLE) ──────────────────────────────
      else if (mode === 'halo') {
        const cx = w / 2;
        const cy = h / 2;
        const baseRadius = 88;
        const rayCount = 48;

        for (let i = 0; i < rayCount; i++) {
          const angle = (i / rayCount) * Math.PI * 2;
          const dataIdx = Math.floor((i / rayCount) * bufferLength * 0.75);
          const val = dataArray[dataIdx] || 0;
          const rayLength = Math.max(4, (val / 255) * 55);

          const x1 = cx + Math.cos(angle) * (baseRadius + 6);
          const y1 = cy + Math.sin(angle) * (baseRadius + 6);
          const x2 = cx + Math.cos(angle) * (baseRadius + 6 + rayLength);
          const y2 = cy + Math.sin(angle) * (baseRadius + 6 + rayLength);

          ctx.strokeStyle = acc;
          ctx.lineWidth = 2.5;
          ctx.shadowBlur = val > 120 ? 12 : 4;
          ctx.shadowColor = acc;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, mode, mediaRef]);

  return (
    <div className="relative w-full h-full min-h-[300px] flex items-center justify-center overflow-hidden bg-gradient-to-b from-surface-2/80 via-surface-1 to-surface-2/95 select-none">
      {/* Ambient background glow */}
      <div
        className="absolute inset-0 pointer-events-none opacity-25 filter blur-3xl transition-opacity duration-700"
        style={{
          background: coverArtUrl
            ? `radial-gradient(circle at center, var(--acc), transparent 70%)`
            : `radial-gradient(circle at center, rgba(0, 229, 153, 0.35), transparent 70%)`,
        }}
      />

      {/* Background Canvas Visualizer */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full z-10 pointer-events-none"
      />

      {/* Visualizer Mode & Style Controls Toolbar */}
      <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 bg-surface-2/90 backdrop-blur-md border border-white/10 rounded-xl p-1 shadow-md">
        <button
          onClick={toggleDisplayStyle}
          className="px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 text-slate-300 hover:text-white bg-surface-3 transition-colors"
          title={`Switch to ${displayStyle === 'card' ? 'Vinyl Disc' : 'Modern Album Card'}`}
        >
          {displayStyle === 'card' ? <Disc className="w-3.5 h-3.5 text-emerald-400" /> : <Image className="w-3.5 h-3.5 text-emerald-400" />}
          <span className="hidden sm:inline">{displayStyle === 'card' ? 'Card' : 'Vinyl'}</span>
        </button>

        <div className="w-[1px] h-3.5 bg-white/15 mx-0.5" />

        <button
          onClick={() => handleModeChange('bars')}
          className={`p-1.5 rounded-lg transition-colors ${
            mode === 'bars'
              ? 'bg-brand-acc text-slate-950 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-surface-3'
          }`}
          title="Bars Equalizer"
        >
          <BarChart2 className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => handleModeChange('wave')}
          className={`p-1.5 rounded-lg transition-colors ${
            mode === 'wave'
              ? 'bg-brand-acc text-slate-950 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-surface-3'
          }`}
          title="Oscilloscope Wave"
        >
          <Activity className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => handleModeChange('halo')}
          className={`p-1.5 rounded-lg transition-colors ${
            mode === 'halo'
              ? 'bg-brand-acc text-slate-950 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-surface-3'
          }`}
          title="Radial Halo"
        >
          <Sparkles className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => handleModeChange('off')}
          className={`p-1.5 rounded-lg transition-colors ${
            mode === 'off'
              ? 'bg-surface-3 text-slate-200'
              : 'text-slate-400 hover:text-slate-200 hover:bg-surface-3'
          }`}
          title="Turn visualizer off"
        >
          <EyeOff className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── CENTER VISUAL: SCREEN 5 MODERN CARD OR VINYL DISC ── */}
      <div className="relative z-20 flex flex-col items-center gap-3">
        {displayStyle === 'card' ? (
          /* SCREEN 5: Modern Rounded-2xl Album Card */
          <div className="relative group">
            {/* Ambient Card Shadow Glow */}
            <div
              className={`absolute -inset-2 rounded-3xl transition-all duration-700 blur-xl ${
                isPlaying ? 'opacity-70 scale-105' : 'opacity-20 scale-95'
              }`}
              style={{
                background: 'radial-gradient(circle, var(--acc-glow), transparent 70%)',
              }}
            />

            {/* Album Card */}
            <div className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-2xl overflow-hidden shadow-2xl border border-white/15 bg-surface-3 flex items-center justify-center">
              {coverArtUrl ? (
                <img
                  src={coverArtUrl}
                  alt={title || 'Cover Art'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-indigo-600 via-purple-600 to-emerald-600 flex items-center justify-center text-white">
                  <Music className="w-14 h-14 opacity-90" />
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Classic Vinyl Disc */
          <div className="relative group">
            <div
              className={`w-40 h-40 sm:w-48 sm:h-48 rounded-full vinyl-disc flex items-center justify-center shadow-2xl transition-transform duration-500 animate-vinyl-spin ${
                !isPlaying ? 'paused' : ''
              }`}
            >
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden shadow-inner flex items-center justify-center border-2 border-white/10 bg-surface-3">
                {coverArtUrl ? (
                  <img
                    src={coverArtUrl}
                    alt={title || 'Album Art'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-brand-acc to-pink-500 flex items-center justify-center text-white">
                    <Music className="w-10 h-10 opacity-90" />
                  </div>
                )}
                <div className="absolute w-4 h-4 rounded-full bg-surface-1 border border-white/20 shadow-md flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-surface-4" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
