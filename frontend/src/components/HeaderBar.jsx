import React from 'react';
import { Folder } from 'lucide-react';
import { api } from '../lib/api';

const ACCENT_OPTIONS = [
  { id: 'violet', label: 'Violet Glow', color: '#7c6dfa' },
  { id: 'emerald', label: 'Emerald Mint', color: '#00e599' },
  { id: 'ocean', label: 'Ocean Blue', color: '#38bdf8' },
  { id: 'amber', label: 'Solar Amber', color: '#f59e0b' },
  { id: 'rose', label: 'Crimson Rose', color: '#f43f5e' },
];

export default function HeaderBar({ currentView, themeAccent, setThemeAccent, outputDir, runningCount }) {
  const titles = {
    home: 'Home',
    downloader: 'Downloads',
    library: 'Library',
    settings: 'Settings',
  };

  const handleOpenFolder = () => {
    if (outputDir) {
      api.openOutputFolder(outputDir);
    }
  };

  return (
    <header className="h-13 bg-surface-1/95 backdrop-blur-md border-b border-border-subtle px-5 flex items-center justify-between shrink-0 select-none z-10">
      {/* View Title & Active Indicator */}
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold tracking-wide text-slate-100 flex items-center gap-2">
          <span>{titles[currentView] || 'MediaDown'}</span>
        </h1>
        {runningCount > 0 && (
          <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase bg-brand-dim text-brand-acc border border-brand-border rounded-full animate-pulse">
            {runningCount} downloading
          </span>
        )}
      </div>

      {/* Header Actions & Profile */}
      <div className="flex items-center gap-3">
        {/* Open Output Folder */}
        <button
          onClick={handleOpenFolder}
          className="h-7 px-2 rounded-lg bg-surface-2 hover:bg-surface-3 text-slate-300 hover:text-white border border-border-subtle text-xs flex items-center gap-1.5 transition-colors"
          title={`Open output directory: ${outputDir || 'Downloads'}`}
        >
          <Folder className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden sm:inline">Folder</span>
        </button>

        {/* Quick Accent Selector */}
        <div className="flex items-center bg-surface-2 border border-border-subtle rounded-lg p-1 gap-1">
          {ACCENT_OPTIONS.map((theme) => (
            <button
              key={theme.id}
              onClick={() => setThemeAccent(theme.id)}
              className={`w-3.5 h-3.5 rounded-full transition-transform ${
                themeAccent === theme.id ? 'scale-125 ring-2 ring-white/70' : 'opacity-60 hover:opacity-100 hover:scale-110'
              }`}
              style={{ backgroundColor: theme.color }}
              title={`Switch to ${theme.label} theme`}
            />
          ))}
        </div>

        {/* User Avatar Circle */}
        <div
          className="w-7 h-7 rounded-full bg-surface-3 border border-white/10 text-slate-200 font-bold text-xs flex items-center justify-center cursor-default shadow-sm select-none"
          title="MediaDown User"
        >
          M
        </div>
      </div>
    </header>
  );
}
