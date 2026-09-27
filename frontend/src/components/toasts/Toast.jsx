import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X, Download } from 'lucide-react';

export function Toast({ message, isSuccess = true, onClose, duration = 3000 }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
      <div className="glass-panel-elevated rounded-xl px-4 py-3 flex items-center gap-3 border border-border shadow-2xl text-xs font-medium text-slate-100">
        {isSuccess ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        ) : (
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
        )}
        <span>{message}</span>
        <button onClick={onClose} className="text-slate-400 hover:text-white ml-2">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function ClipboardToast({ detectedUrl, onStart, onDismiss }) {
  if (!detectedUrl) return null;

  return (
    <div className="fixed bottom-6 left-24 z-50 animate-fade-in max-w-md">
      <div className="glass-panel-elevated rounded-2xl p-4 flex items-center justify-between gap-4 border border-brand-border shadow-2xl">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-brand-dim text-brand-acc flex items-center justify-center shrink-0">
            <Download className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-semibold text-brand-acc uppercase tracking-wider">
              Link detected on clipboard
            </span>
            <span className="text-xs text-slate-200 truncate" title={detectedUrl}>
              {detectedUrl}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onDismiss}
            className="px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
          >
            Dismiss
          </button>
          <button
            onClick={() => onStart(detectedUrl)}
            className="px-3.5 py-1.5 rounded-xl bg-brand-acc text-white text-xs font-semibold shadow-glow hover:opacity-90 transition-opacity"
          >
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
