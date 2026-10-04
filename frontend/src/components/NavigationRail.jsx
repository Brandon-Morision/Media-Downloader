import React, { useState } from 'react';
import { Home, Download, Library, Settings, Moon } from 'lucide-react';
import novadropIcon from '../assets/novadrop-icon.png';

export default function NavigationRail({ currentView, setView, activeCount, libraryCount, nightOwlEnabled, hasUpdate }) {
  const [clickCount, setClickCount] = useState({});

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'downloader', label: 'Downloads', icon: Download, badge: activeCount },
    { id: 'library', label: 'Library', icon: Library, badge: libraryCount },
    { id: 'settings', label: 'Settings', icon: Settings, hasDot: hasUpdate },
  ];

  const handleNavClick = (id) => {
    setView(id);
    setClickCount((prev) => ({
      ...prev,
      [id]: (prev[id] || 0) + 1,
    }));
  };

  return (
    <aside className="w-52 md:w-56 lg:w-60 xl:w-64 bg-surface-1 border-r border-border-subtle flex flex-col py-5 px-3 select-none shrink-0 z-20 transition-all duration-200">
      {/* Brand Header: Logo + "NovaDrop" */}
      <div className="px-2 mb-7 flex items-center gap-2.5 cursor-pointer group" onClick={() => handleNavClick('home')}>
        <div className="w-8 h-8 rounded-xl overflow-hidden flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform duration-200">
          <img
            src={novadropIcon}
            alt="NovaDrop"
            className="w-full h-full object-contain filter drop-shadow"
          />
        </div>
        <div className="flex flex-col">
          <span className="font-extrabold text-base tracking-tight text-white flex items-center leading-none">
            Nova<span className="text-sky-400">Drop</span>
          </span>
          <span className="text-[10px] text-slate-400 font-medium tracking-wide mt-0.5 leading-none">
            Media Downloader
          </span>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 flex flex-col gap-1.5 w-full">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          const count = clickCount[item.id] || 0;

          // Fluent micro-animation and hover styling for Windows 11 Media Player experience
          let animClass = '';
          let hoverClass = '';
          let staticClass = '';

          if (item.id === 'settings') {
            animClass = isActive ? 'animate-fluent-gear' : '';
            hoverClass = 'group-hover:rotate-45 group-hover:scale-110';
            staticClass = isActive
              ? 'text-brand-acc'
              : 'text-slate-400 group-hover:text-slate-200';
          } else if (item.id === 'downloader') {
            animClass = isActive ? 'animate-fluent-download' : '';
            hoverClass = 'group-hover:translate-y-0.5 group-hover:scale-110';
            staticClass = isActive
              ? 'text-brand-acc'
              : 'text-slate-400 group-hover:text-slate-200';
          } else if (item.id === 'library') {
            animClass = isActive ? 'animate-fluent-library' : '';
            hoverClass = 'group-hover:-rotate-8 group-hover:scale-110';
            staticClass = isActive
              ? 'text-brand-acc'
              : 'text-slate-400 group-hover:text-slate-200';
          } else if (item.id === 'home') {
            animClass = isActive ? 'animate-fluent-home' : '';
            hoverClass = 'group-hover:-translate-y-0.5 group-hover:scale-110';
            staticClass = isActive
              ? 'text-brand-acc'
              : 'text-slate-400 group-hover:text-slate-200';
          }

          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`relative w-full h-10 pl-3.5 pr-3 rounded-xl flex items-center justify-between transition-all duration-200 group text-sm font-medium ${
                isActive
                  ? 'bg-brand-dim text-brand-acc font-semibold border border-brand-border/70 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-surface-2 border border-transparent'
              }`}
            >
              {/* Windows 11 Fluent Active Indicator Pill - Perfectly Centered Vertically */}
              {isActive && (
                <div className="absolute left-1.5 inset-y-0 flex items-center pointer-events-none">
                  <span className="w-1 h-4 bg-brand-acc rounded-full shadow-[0_0_8px_var(--acc-glow)]" />
                </div>
              )}

              <div className="flex items-center gap-3">
                <span
                  key={`${item.id}-${isActive ? 'active' : 'inactive'}-${count}`}
                  className={`w-5 h-5 flex items-center justify-center transition-transform duration-300 ease-out origin-center shrink-0 ${animClass} ${hoverClass} ${staticClass}`}
                >
                  <Icon className="w-4 h-4 block shrink-0" />
                </span>
                <span className="tracking-tight select-none">{item.label}</span>
              </div>

              {/* Badge or update dot indicator */}
              {Boolean(item.badge) && item.badge > 0 ? (
                <span
                  className={`min-w-[18px] h-[18px] px-1.5 text-[10px] font-bold rounded-full flex items-center justify-center transition-transform duration-200 group-hover:scale-105 shrink-0 ${
                    isActive
                      ? 'bg-brand-acc text-slate-950 shadow-sm'
                      : 'bg-surface-3 text-slate-300 border border-white/10'
                  }`}
                >
                  {item.badge}
                </span>
              ) : item.hasDot ? (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.8)] shrink-0" />
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Footer System Status */}
      <div className="flex items-center justify-between pt-3 border-t border-border-subtle w-full px-2">
        <div className="flex items-center gap-2">
          {nightOwlEnabled && (
            <div
              className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30"
              title="Night-Owl Scheduler Active"
            >
              <Moon className="w-3.5 h-3.5 animate-pulse" />
            </div>
          )}
          <span className="text-[10px] font-mono text-slate-500 tracking-wider">v0.4.0</span>
        </div>
      </div>
    </aside>
  );
}
