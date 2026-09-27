import React from 'react';
import { Home, Download, Library, Settings, Moon } from 'lucide-react';

export default function NavigationRail({ currentView, setView, activeCount, libraryCount, nightOwlEnabled }) {
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'downloader', label: 'Downloads', icon: Download, badge: activeCount },
    { id: 'library', label: 'Library', icon: Library, badge: libraryCount },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-52 md:w-56 bg-surface-1 border-r border-border-subtle flex flex-col py-5 px-3 select-none shrink-0 z-20 transition-all duration-200">
      {/* Brand Header: Logo + "MediaDown" */}
      <div className="px-2 mb-7 flex items-center gap-2.5 cursor-pointer" onClick={() => setView('home')}>
        {/* Emerald 'V' Logo Icon */}
        <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center shadow-sm shrink-0">
          <svg
            className="w-4 h-4 text-slate-950 font-black"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 6l8 12 8-12" />
          </svg>
        </div>
        <span className="font-bold text-base tracking-tight text-white flex items-center gap-1">
          MediaDown
        </span>
      </div>

      {/* Nav List */}
      <nav className="flex-1 flex flex-col gap-1.5 w-full">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between transition-all duration-150 group text-sm font-medium ${
                isActive
                  ? 'bg-brand-dim text-brand-acc font-semibold border border-brand-border shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-surface-2'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 transition-transform duration-150 group-hover:scale-110 ${
                    isActive ? 'text-brand-acc' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />
                <span className="tracking-tight">{item.label}</span>
              </div>

              {/* Badge indicator */}
              {Boolean(item.badge) && item.badge > 0 && (
                <span
                  className={`min-w-[18px] h-[18px] px-1.5 text-[10px] font-bold rounded-full flex items-center justify-center ${
                    isActive
                      ? 'bg-brand-acc text-slate-950'
                      : 'bg-surface-3 text-slate-300 border border-white/10'
                  }`}
                >
                  {item.badge}
                </span>
              )}
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
          <span className="text-[10px] font-mono text-slate-500 tracking-wider">v0.3.0</span>
        </div>
      </div>
    </aside>
  );
}
