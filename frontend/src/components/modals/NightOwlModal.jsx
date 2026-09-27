import React, { useState } from 'react';
import { Moon, Clock, X, Check } from 'lucide-react';

export default function NightOwlModal({ isOpen, onClose, nightOwlSettings, onSaveSettings }) {
  const [enabled, setEnabled] = useState(nightOwlSettings?.enabled || false);
  const [startTime, setStartTime] = useState(nightOwlSettings?.startTime || '02:00');
  const [endTime, setEndTime] = useState(nightOwlSettings?.endTime || '06:00');
  const [dayRateLimit, setDayRateLimit] = useState(nightOwlSettings?.dayRateLimit || '500');

  const handleSave = () => {
    onSaveSettings({
      enabled,
      startTime,
      endTime,
      dayRateLimit,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface-1 rounded-2xl border border-border-highlight/50 shadow-2xl overflow-hidden p-6 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Moon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Night-Owl Scheduler</h3>
              <p className="text-[11px] text-slate-400">Queue heavy downloads for off-peak hours</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Enable Toggle */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-2 border border-border-subtle">
          <div>
            <div className="text-xs font-semibold text-slate-200">Activate Night-Owl Window</div>
            <div className="text-[11px] text-slate-400">Pause large downloads until nighttime</div>
          </div>
          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
            className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
              enabled ? 'bg-indigo-500' : 'bg-surface-4'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Schedule Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Window Start</span>
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="h-10 px-3 rounded-xl bg-surface-2 border border-border-subtle text-slate-100 text-xs font-mono focus:outline-none focus:border-brand-acc"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Window End</span>
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="h-10 px-3 rounded-xl bg-surface-2 border border-border-subtle text-slate-100 text-xs font-mono focus:outline-none focus:border-brand-acc"
            />
          </div>
        </div>

        {/* Day Speed Throttle */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-slate-300">Daytime Bandwidth Throttle (KB/s)</label>
          <input
            type="number"
            min="50"
            max="100000"
            value={dayRateLimit}
            onChange={(e) => setDayRateLimit(e.target.value)}
            placeholder="500"
            className="h-10 px-3 rounded-xl bg-surface-2 border border-border-subtle text-slate-100 text-xs font-mono focus:outline-none focus:border-brand-acc"
          />
          <span className="text-[10.5px] text-slate-400">
            Speed is unrestricted during the scheduled night window.
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-brand-acc text-white text-xs font-semibold shadow-glow hover:opacity-90 flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save Schedule</span>
          </button>
        </div>
      </div>
    </div>
  );
}
