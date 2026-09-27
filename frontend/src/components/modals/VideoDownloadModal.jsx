import React, { useState } from 'react';
import { Film, Music, Play, X, Download, Folder } from 'lucide-react';
import { fmtBytes } from '../../lib/formatters';

export default function VideoDownloadModal({
  isOpen,
  onClose,
  data,
  outputDir,
  onPickFolder,
  onStartDownload,
}) {
  const [selectedFormat, setSelectedFormat] = useState('video'); // video | audio
  const [selectedQuality, setSelectedQuality] = useState('1080p');

  if (!isOpen || !data) return null;

  const qualityOptions = (data.available_qualities && data.available_qualities.length > 0)
    ? data.available_qualities.filter((q) => (selectedFormat === 'video' ? q.type === 'video' : q.type === 'audio'))
    : [
        { id: '1080p', label: '1080p (Full HD)', ext: 'MP4', size_bytes: 25800000 },
        { id: '720p', label: '720p (HD)', ext: 'MP4', size_bytes: 14900000 },
        { id: '480p', label: '480p (SD)', ext: 'MP4', size_bytes: 8500000 },
        { id: '360p', label: '360p', ext: 'MP4', size_bytes: 5800000 },
      ];

  const handleDownloadClick = () => {
    onStartDownload(data.url, {
      format: selectedFormat === 'audio' ? 'mp3' : 'video',
      quality: selectedQuality.replace('p', ''),
      title: data.title,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in select-none">
      <div className="bg-surface-1 border border-white/10 rounded-3xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-emerald-500 flex items-center justify-center text-slate-950 font-black text-xs">
              V
            </div>
            <span className="font-bold text-sm text-slate-100">Video Download</span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Video Preview Card */}
        <div className="flex gap-3.5 items-start">
          <div className="relative aspect-video w-36 rounded-xl overflow-hidden bg-surface-3 shrink-0 flex items-center justify-center">
            {data.thumbnail ? (
              <img
                src={data.thumbnail}
                alt={data.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <Film className="w-8 h-8 text-slate-500" />
            )}
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-emerald-400 text-slate-950 flex items-center justify-center shadow-glow">
                <Play className="w-4 h-4 ml-0.5 fill-current" />
              </div>
            </div>
          </div>

          <div className="flex flex-col min-w-0">
            <h3 className="font-bold text-sm text-slate-100 truncate tracking-tight">
              {data.title || 'Amazing Travel Video'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {data.channel || 'YouTube'} {data.duration ? `· ${Math.floor(data.duration / 60)}:${String(data.duration % 60).padStart(2, '0')}` : ''} {data.views ? `· ${(data.views / 1000000).toFixed(1)}M views` : ''}
            </p>
          </div>
        </div>

        {/* Select Format */}
        <div className="flex flex-col gap-1.5 pt-1">
          <span className="text-xs font-semibold text-slate-300">Select Format</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedFormat('video')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                selectedFormat === 'video'
                  ? 'bg-emerald-500 text-slate-950 shadow-glow font-bold'
                  : 'bg-surface-2 text-slate-300 border border-border-subtle hover:bg-surface-3'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>MP4 (Video)</span>
            </button>
            <button
              onClick={() => setSelectedFormat('audio')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                selectedFormat === 'audio'
                  ? 'bg-emerald-500 text-slate-950 shadow-glow font-bold'
                  : 'bg-surface-2 text-slate-300 border border-border-subtle hover:bg-surface-3'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              <span>MP3 (Audio)</span>
            </button>
          </div>
        </div>

        {/* Select Quality */}
        <div className="flex flex-col gap-1.5 pt-1">
          <span className="text-xs font-semibold text-slate-300">Select Quality</span>
          <div className="flex flex-col gap-1.5">
            {qualityOptions.map((opt) => {
              const isSelected = selectedQuality === opt.id;
              return (
                <div
                  key={opt.id}
                  onClick={() => setSelectedQuality(opt.id)}
                  className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-emerald-500/10 border-emerald-500/50'
                      : 'bg-surface-2 border-border-subtle hover:bg-surface-3'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                        isSelected ? 'border-emerald-400 bg-emerald-400' : 'border-slate-500'
                      }`}
                    >
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                    </div>
                    <span className="text-xs font-semibold text-slate-200">
                      {opt.label || opt.id}
                    </span>
                  </div>

                  <span className="text-xs font-mono text-slate-400">
                    {opt.ext || 'MP4'} {opt.size_bytes ? `· ${fmtBytes(opt.size_bytes)}` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Save to Directory Picker */}
        <div className="flex flex-col gap-1.5 pt-1">
          <span className="text-xs font-semibold text-slate-300">Save to:</span>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={outputDir || '~/Downloads/media'}
              className="flex-1 h-9 px-3 rounded-xl bg-surface-2 border border-border-subtle text-slate-300 text-xs font-mono focus:outline-none"
            />
            <button
              onClick={onPickFolder}
              className="h-9 px-3.5 rounded-xl bg-surface-3 hover:bg-surface-4 text-slate-200 font-semibold text-xs transition-colors"
            >
              Browse
            </button>
          </div>
        </div>

        {/* Big Emerald Download CTA */}
        <button
          onClick={handleDownloadClick}
          className="w-full h-11 rounded-xl bg-emerald-500 hover:opacity-95 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-glow transition-transform active:scale-[0.99] mt-1"
        >
          <Download className="w-4 h-4" />
          <span>Download</span>
        </button>
      </div>
    </div>
  );
}
