import React, { useState, useEffect } from 'react';
import { Power, AlertTriangle, X } from 'lucide-react';
import { api } from '../../lib/api';

export default function ShutdownWarningModal({ isOpen, onClose, remainingSeconds = 30 }) {
  const [count, setCount] = useState(remainingSeconds);

  useEffect(() => {
    setCount(remainingSeconds);
    const interval = setInterval(() => {
      setCount((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [remainingSeconds]);

  const handleAbort = async () => {
    try {
      await api.cancelShutdown();
    } catch {}
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-surface-1 rounded-2xl border border-rose-500/40 p-6 flex flex-col items-center text-center gap-4 shadow-2xl animate-scale-in">
        <div className="w-14 h-14 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center border border-rose-500/30 animate-pulse">
          <Power className="w-7 h-7" />
        </div>

        <div className="flex flex-col gap-1">
          <h3 className="text-base font-bold text-slate-100">Automatic Shutdown Pending</h3>
          <p className="text-xs text-slate-400">
            Queue finished. Your computer will shut down in:
          </p>
        </div>

        <div className="text-4xl font-extrabold font-mono text-rose-400 tracking-wider">
          {count}s
        </div>

        <button
          onClick={handleAbort}
          className="w-full h-11 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm shadow-lg shadow-rose-900/30 active:scale-95 transition-all mt-2"
        >
          Cancel Shutdown
        </button>
      </div>
    </div>
  );
}
