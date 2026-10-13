import React, { useState, useEffect } from 'react';
import {
  Download, Play, Pause, X, RotateCcw, Folder, Image,
  ChevronDown, ChevronUp, Trash2, Search, CheckCircle2,
  AlertCircle, AlertTriangle, XCircle, Clock, Sparkles, ListMusic,
  Film, Music, ExternalLink, Layers, ListVideo, Bell
} from 'lucide-react';
import {
  fmtBytes, fmtDate, toolLabel,
  playableFilesFor, galleryFilesFor, isLikelyUrl, normalizeUrl, detectTool,
  friendlyError, getBundleInfo,
} from '../../lib/formatters';
import { api } from '../../lib/api';
import MediaThumbnail from '../common/MediaThumbnail';

function ScheduledCountdown({ scheduledTime, scheduledTimeStr }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    function calc() {
      if (!scheduledTime) {
        setTimeLeft(scheduledTimeStr || 'Pending');
        return;
      }
      const target = new Date(scheduledTime).getTime();
      const diff = Math.max(0, Math.floor((target - Date.now()) / 1000));
      if (diff <= 0) {
        setTimeLeft('Resuming shortly…');
        return;
      }
      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;
      if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`);
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds.toString().padStart(2, '0')}s`);
      } else {
        setTimeLeft(`${seconds}s`);
      }
    }
    calc();
    const timer = setInterval(calc, 1000);
    return () => clearInterval(timer);
  }, [scheduledTime, scheduledTimeStr]);

  return <span>{timeLeft}</span>;
}

export default function DownloaderView({
  downloads,
  onAddDownload,
  onCancelDownload,
  onPauseDownload,
  onResumeDownload,
  onDeleteDownload,
  onRetryDownload,
  onClearFinished,
  onClearWaiting,
  onOpenPlayer,
  onOpenGallery,
  onOpenNightOwlModal,
  onInspectPlaylist,
  onMoveItemUp,
  onMoveItemDown,
  onTogglePauseQueue,
  isQueuePaused,
  nightOwlEnabled,
  defaultFormat,
  onShowToast,
  onRefreshHistory,
}) {
  // Queue state
  const [queueTab, setQueueTab] = useState('all'); // all | active | completed | failed | cancelled | scheduled
  const [searchQuery, setSearchQuery] = useState('');

  // Filter queue items by state
  const scheduledDownloads = downloads.filter((item) => item.state === 'scheduled');
  const activeDownloads = downloads.filter((item) => ['pending', 'running', 'paused', 'scheduled'].includes(item.state));
  const completedDownloads = downloads.filter((item) => item.state === 'done');
  const failedDownloads = downloads.filter((item) => item.state === 'error');
  const cancelledDownloads = downloads.filter((item) => item.state === 'cancelled');
  const historyDownloads = downloads.filter((item) => ['done', 'cancelled', 'error'].includes(item.state));

  const filterItemBySearch = (item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = (item.filename || '').toLowerCase();
    const url = (item.url || '').toLowerCase();
    return name.includes(q) || url.includes(q);
  };

  const filteredActiveDownloads = activeDownloads.filter(filterItemBySearch);
  const filteredScheduledDownloads = scheduledDownloads.filter(filterItemBySearch);

  const handleStartScheduledNow = async (jobId) => {
    try {
      const res = await api.startScheduledDownloadNow(jobId);
      if (res && res.error) {
        if (onShowToast) onShowToast(res.error, 'error');
      } else {
        if (onShowToast) onShowToast('Resuming scheduled download now…');
        if (onRefreshHistory) onRefreshHistory();
      }
    } catch (err) {
      if (onShowToast) onShowToast(String(err), 'error');
    }
  };

  const handleCancelScheduled = async (jobId, itemId) => {
    try {
      await api.cancelScheduledDownload(jobId);
      if (onCancelDownload) onCancelDownload(itemId);
      if (onShowToast) onShowToast('Scheduled download cancelled');
    } catch (err) {
      if (onShowToast) onShowToast(String(err), 'error');
    }
  };

  const currentSectionDownloads = (() => {
    let list = [];
    if (queueTab === 'all') list = historyDownloads;
    else if (queueTab === 'completed') list = completedDownloads;
    else if (queueTab === 'failed') list = failedDownloads;
    else if (queueTab === 'cancelled') list = cancelledDownloads;
    else if (queueTab === 'scheduled') list = scheduledDownloads;
    else return [];

    return list.filter(filterItemBySearch);
  })();

  const handleClearSection = () => {
    if (queueTab === 'failed') {
      failedDownloads.forEach((i) => onDeleteDownload(i.id));
      if (onShowToast) onShowToast('Cleared failed downloads');
    } else if (queueTab === 'cancelled') {
      cancelledDownloads.forEach((i) => onDeleteDownload(i.id));
      if (onShowToast) onShowToast('Cleared cancelled downloads');
    } else if (queueTab === 'completed') {
      completedDownloads.forEach((i) => onDeleteDownload(i.id));
      if (onShowToast) onShowToast('Cleared completed downloads');
    } else {
      if (onClearFinished) onClearFinished();
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 select-none">
      {/* ── PERSISTENT STICKY TOP AREA: Downloads Header & Filters ── */}
      <div className="shrink-0 px-6 pt-6 pb-2 bg-surface-0 z-20 flex flex-col gap-3 w-full">
        {/* Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-extrabold text-slate-100 tracking-tight">Downloads</h2>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 bg-surface-2 border border-border-subtle p-1 rounded-xl overflow-x-auto">
              <button
                type="button"
                onClick={() => setQueueTab('all')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  queueTab === 'all'
                    ? 'bg-brand-acc text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>All</span>
                {downloads.length > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    queueTab === 'all' ? 'bg-slate-950 text-brand-acc font-bold' : 'bg-surface-3 text-slate-300'
                  }`}>
                    {downloads.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setQueueTab('active')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  queueTab === 'active'
                    ? 'bg-brand-acc text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>Active</span>
                {activeDownloads.length > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    queueTab === 'active' ? 'bg-slate-950 text-brand-acc font-bold' : 'bg-surface-3 text-slate-300'
                  }`}>
                    {activeDownloads.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setQueueTab('completed')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  queueTab === 'completed'
                    ? 'bg-brand-acc text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>Completed</span>
                {completedDownloads.length > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    queueTab === 'completed' ? 'bg-slate-950 text-brand-acc font-bold' : 'bg-surface-3 text-slate-300'
                  }`}>
                    {completedDownloads.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setQueueTab('failed')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  queueTab === 'failed'
                    ? 'bg-rose-500 text-white shadow-sm font-bold'
                    : 'text-slate-400 hover:text-rose-400'
                }`}
              >
                <span>Failed</span>
                {failedDownloads.length > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    queueTab === 'failed' ? 'bg-black/40 text-white font-bold' : 'bg-rose-500/20 text-rose-400'
                  }`}>
                    {failedDownloads.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setQueueTab('cancelled')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  queueTab === 'cancelled'
                    ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                    : 'text-slate-400 hover:text-amber-400'
                }`}
              >
                <span>Cancelled</span>
                {cancelledDownloads.length > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    queueTab === 'cancelled' ? 'bg-slate-950 text-amber-400 font-bold' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {cancelledDownloads.length}
                  </span>
                )}
              </button>

              {scheduledDownloads.length > 0 && (
                <button
                  type="button"
                  onClick={() => setQueueTab('scheduled')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    queueTab === 'scheduled'
                      ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                      : 'text-slate-400 hover:text-amber-400'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Scheduled</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    queueTab === 'scheduled' ? 'bg-slate-950 text-amber-400 font-bold' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {scheduledDownloads.length}
                  </span>
                </button>
              )}
            </div>

            {/* Search downloads filter input */}
            <div className="relative flex items-center min-w-[170px] max-w-[240px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search downloads…"
                className="w-full h-8 pl-8 pr-7 rounded-lg bg-surface-2 border border-border-subtle text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-acc focus:ring-1 focus:ring-brand-acc transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 text-slate-400 hover:text-white transition-colors"
                  title="Clear filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Right Action: Sync History & Clear Current Tab */}
          <div className="flex items-center gap-2">
            {onRefreshHistory && (
              <button
                type="button"
                onClick={onRefreshHistory}
                className="px-2.5 py-1 rounded-lg bg-surface-2 hover:bg-surface-3 text-slate-400 hover:text-brand-acc border border-border-subtle transition-colors flex items-center gap-1.5 text-xs font-semibold"
                title="Refresh download history from disk"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sync History</span>
              </button>
            )}

            {activeDownloads.some((d) => ['running', 'paused'].includes(d.state)) && onTogglePauseQueue && (
              <button
                type="button"
                onClick={onTogglePauseQueue}
                className="text-xs font-semibold text-slate-400 hover:text-amber-400 transition-colors flex items-center gap-1.5"
                title={isQueuePaused ? "Resume all active downloads" : "Pause all active downloads"}
              >
                {isQueuePaused ? <Play className="w-3.5 h-3.5 fill-current text-amber-400" /> : <Pause className="w-3.5 h-3.5" />}
                <span>{isQueuePaused ? 'Resume Queue' : 'Pause Queue'}</span>
              </button>
            )}

            {((queueTab !== 'active' && currentSectionDownloads.length > 0) || (queueTab === 'active' && activeDownloads.length > 0)) && (
              <button
                type="button"
                onClick={queueTab === 'active' ? onClearWaiting : handleClearSection}
                className="text-xs font-semibold text-slate-400 hover:text-rose-400 transition-colors"
              >
                {queueTab === 'active' ? 'Clear Waiting' :
                 queueTab === 'failed' ? 'Clear Failed' :
                 queueTab === 'cancelled' ? 'Clear Cancelled' :
                 queueTab === 'completed' ? 'Clear Completed' :
                 'Clear All'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable area: downloads queue */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        <div className="px-6 pb-6 pt-2 flex flex-col gap-6 w-full">
          {/* ── SCREEN 3: DOWNLOADS QUEUE (Active & Completed Tabs) ── */}
          <div className="flex flex-col gap-5 shrink-0">
            {/* Animated content area — re-mounts on tab change */}
            <div key={queueTab} className="flex flex-col gap-5 animate-tab-enter">

        {/* ── 1. ACTIVE / SCHEDULED DOWNLOADS SECTION ── */}
        {(queueTab === 'all' || queueTab === 'active' || queueTab === 'scheduled') && (queueTab === 'scheduled' ? filteredScheduledDownloads : filteredActiveDownloads).length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {queueTab === 'scheduled' ? 'Scheduled Downloads' : 'Active Downloads'}
            </h3>

            <div className="flex flex-col gap-3">
              {(queueTab === 'scheduled' ? filteredScheduledDownloads : filteredActiveDownloads).map((item) => {
                const pct = typeof item.progressPercent === 'number'
                  ? item.progressPercent
                  : (parseFloat(item.progressPercent) || 0);

                const isPaused = item.state === 'paused';
                const isScheduled = item.state === 'scheduled';
                const isMusic = (item.filename || '').endsWith('.mp3') || (item.filename || '').endsWith('.m4a');
                const isGallery = item.tool === 'gallery-dl' || (!item.limit && item.itemsDone > 0);
                const isIndeterminate = isGallery && (!item.limit || item.limit <= 0);

                return (
                  <div
                    key={item.id}
                    className={`border rounded-2xl p-4 flex flex-col gap-3 shadow-md transition-all ${
                      isScheduled
                        ? 'bg-amber-950/20 border-amber-500/30 hover:border-amber-500/50'
                        : isPaused
                          ? 'bg-surface-1 border border-amber-500/40 hover:border-amber-500/60'
                          : 'bg-surface-1 border border-border-subtle hover:border-border'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Thumbnail or Music/Clock Icon */}
                      <div className={`w-12 h-12 rounded-xl shrink-0 overflow-hidden flex items-center justify-center relative shadow-sm ${
                        isScheduled ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-surface-3'
                      }`}>
                        {isScheduled && !item.thumbnail ? (
                          <Clock className="w-5 h-5 text-amber-400 animate-pulse" />
                        ) : (
                          <MediaThumbnail
                            item={item}
                            className="w-full h-full object-cover"
                            iconClassName={`w-5 h-5 ${isScheduled ? 'text-amber-400' : ''}`}
                          />
                        )}
                        {(item.itemsDone > 1 || (item.files && item.files.length > 1)) && (
                          <div className="absolute bottom-0.5 right-0.5 px-1 py-0.2 rounded bg-black/85 backdrop-blur-xs text-[9px] font-bold text-white flex items-center gap-0.5 border border-white/10 shadow-sm">
                            <Layers className="w-2.5 h-2.5 text-brand-acc" />
                            <span>{item.itemsDone || item.files.length}</span>
                          </div>
                        )}
                      </div>

                      {/* Title & Specs */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-bold text-slate-100 truncate">
                            {item.filename || item.url}
                          </h4>
                          {item.url && (
                            <button
                              type="button"
                              onClick={() => api.openUrlExternal(item.url)}
                              className="text-slate-500 hover:text-brand-acc transition-colors p-0.5 shrink-0"
                              title="Open source link in browser"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {isScheduled ? (
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              <Clock className="w-3 h-3" />
                              Resets at {item.scheduled_time_str || fmtDate(item.scheduled_time)}
                            </span>
                            <span className="text-xs text-amber-300/80 font-mono flex items-center gap-1">
                              <span>Auto-resumes in</span>
                              <ScheduledCountdown scheduledTime={item.scheduled_time} scheduledTimeStr={item.scheduled_time_str} />
                            </span>
                          </div>
                        ) : (
                          <p className={`text-xs font-mono mt-0.5 ${isPaused ? 'text-amber-400/80' : 'text-slate-400'}`}>
                            {isPaused
                              ? 'Paused'
                              : item.downloadedBytes
                                ? fmtBytes(item.downloadedBytes)
                                : item.sizeBytes
                                  ? fmtBytes(item.sizeBytes)
                                  : item.itemsDone > 0
                                    ? `${item.itemsDone} file${item.itemsDone === 1 ? '' : 's'} downloaded`
                                    : item.tool === 'gallery-dl'
                                      ? 'Gallery extractor running…'
                                      : 'Extracting stream…'}
                          </p>
                        )}
                      </div>

                      {/* Controls */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isScheduled ? (
                          <>
                            <button
                              onClick={() => handleStartScheduledNow(item.jobId || item.id)}
                              className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-1.5 border border-amber-500/30 transition-all hover:scale-[1.02]"
                              title="Bypass schedule and start immediately"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Start Now</span>
                            </button>
                            <button
                              onClick={() => handleCancelScheduled(item.jobId || item.id, item.id)}
                              className="p-2 rounded-xl bg-surface-2 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                              title="Cancel scheduled download"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            {item.state === 'pending' && (
                              <div className="flex items-center gap-0.5 mr-1">
                                {onMoveItemUp && (
                                  <button
                                    onClick={() => onMoveItemUp(item.id)}
                                    className="p-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-slate-400 hover:text-slate-200 transition-colors"
                                    title="Move up in queue"
                                  >
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {onMoveItemDown && (
                                  <button
                                    onClick={() => onMoveItemDown(item.id)}
                                    className="p-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-slate-400 hover:text-slate-200 transition-colors"
                                    title="Move down in queue"
                                  >
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            )}

                            {isPaused ? (
                              <button
                                onClick={() => onResumeDownload(item.jobId)}
                                className="p-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 hover:text-amber-300 transition-colors"
                                title="Resume download"
                              >
                                <Play className="w-4 h-4 fill-current" />
                              </button>
                            ) : (
                              <button
                                onClick={() => onPauseDownload(item.jobId)}
                                disabled={!item.jobId || item.state === 'pending'}
                                className="p-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-slate-300 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                title={item.jobId ? 'Pause download' : 'Waiting to start…'}
                              >
                                <Pause className="w-4 h-4" />
                              </button>
                            )}

                            <button
                              onClick={() => onCancelDownload(item.id)}
                              className="p-2 rounded-xl bg-surface-2 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-surface-3 overflow-hidden">
                      {isScheduled ? (
                        <div className="h-full w-full bg-gradient-to-r from-amber-500/30 via-amber-400 to-amber-500/30 animate-pulse rounded-full" />
                      ) : isPaused ? (
                        <div
                          className="h-full bg-amber-500/50 transition-all duration-300 rounded-full"
                          style={{ width: `${Math.max(1, Math.min(100, pct))}%` }}
                        />
                      ) : isIndeterminate ? (
                        <div className="h-full w-full bg-gradient-to-r from-brand-dim via-brand-acc to-brand-dim animate-pulse rounded-full" />
                      ) : (
                        <div
                          className="h-full bg-brand-acc transition-all duration-300 rounded-full"
                          style={{ width: `${Math.max(1, Math.min(100, pct))}%` }}
                        />
                      )}
                    </div>

                    {/* Progress Metrics */}
                    <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                      {isScheduled ? (
                        <>
                          <span className="flex items-center gap-1 text-[11px] text-amber-400/90">
                            <Bell className="w-3 h-3 text-amber-400" />
                            Notification alert will sound 1 minute prior to resumption
                          </span>
                          <span className="text-[11px] text-amber-400/80 font-medium">
                            Rate limit standby
                          </span>
                        </>
                      ) : isIndeterminate ? (
                        <>
                          <span className="text-brand-acc font-medium">
                            {item.itemsDone > 0
                              ? `${item.itemsDone} item${item.itemsDone === 1 ? '' : 's'} downloaded${item.downloadedBytes ? ` · ${fmtBytes(item.downloadedBytes)}` : ''}`
                              : 'Downloading media…'}
                          </span>
                          <span>{item.speedStr || 'Active'}</span>
                        </>
                      ) : isPaused ? (
                        <>
                          <span className="text-amber-400/70 flex items-center gap-1">
                            <Pause className="w-3 h-3" />
                            {pct > 0 ? `${pct.toFixed(0)}% saved` : 'Paused — click ▶ to resume'}
                          </span>
                          <span className="text-amber-400/50">{item.downloadedBytes && item.totalBytes ? `${fmtBytes(item.downloadedBytes)} / ${fmtBytes(item.totalBytes)}` : ''}</span>
                        </>
                      ) : (
                        <>
                          <span>{pct > 0 ? `${pct.toFixed(0)}% · ` : ''}{item.speedStr || (pct > 0 ? 'Downloading…' : 'Connecting…')}</span>
                          <span>{item.etaStr ? `${item.etaStr} left` : (item.downloadedBytes && item.totalBytes ? `${fmtBytes(item.downloadedBytes)} / ${fmtBytes(item.totalBytes)}` : '')}</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state when on Active tab and no active downloads */}
        {queueTab === 'active' && activeDownloads.length === 0 && (
          <div className="py-12 border border-dashed border-border-subtle rounded-2xl flex flex-col items-center justify-center text-slate-500 gap-2">
            <Download className="w-8 h-8 opacity-40 text-brand-acc" />
            <p className="text-xs font-medium">No active downloads in progress</p>
          </div>
        )}

        {/* Empty state when on Scheduled tab and no scheduled downloads */}
        {queueTab === 'scheduled' && scheduledDownloads.length === 0 && (
          <div className="py-12 border border-dashed border-border-subtle rounded-2xl flex flex-col items-center justify-center text-slate-500 gap-2">
            <Clock className="w-8 h-8 opacity-40 text-amber-400" />
            <p className="text-xs font-medium">No rate-limited scheduled downloads</p>
          </div>
        )}

        {/* ── 2. COMPLETED / FAILED / CANCELLED / HISTORY DOWNLOADS SECTION ── */}
        {queueTab !== 'active' && (
          <div className="flex flex-col gap-3 mt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {queueTab === 'all' && 'History & Finished Downloads'}
                {queueTab === 'completed' && 'Completed Downloads'}
                {queueTab === 'failed' && 'Failed Downloads'}
                {queueTab === 'cancelled' && 'Cancelled Downloads'}
              </h3>
            </div>

            {currentSectionDownloads.length === 0 ? (
              <div className="py-12 border border-dashed border-border-subtle rounded-2xl flex flex-col items-center justify-center text-slate-500 gap-2">
                {searchQuery.trim() ? (
                  <>
                    <Search className="w-8 h-8 opacity-40 text-slate-400" />
                    <p className="text-xs font-medium">No downloads matching "{searchQuery}"</p>
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="text-xs text-brand-acc hover:underline mt-1"
                    >
                      Clear search filter
                    </button>
                  </>
                ) : queueTab === 'failed' ? (
                  <>
                    <AlertTriangle className="w-8 h-8 opacity-40 text-rose-400" />
                    <p className="text-xs font-medium">No failed downloads</p>
                  </>
                ) : queueTab === 'cancelled' ? (
                  <>
                    <XCircle className="w-8 h-8 opacity-40 text-amber-400" />
                    <p className="text-xs font-medium">No cancelled downloads</p>
                  </>
                ) : (
                  <>
                    <Download className="w-8 h-8 opacity-40" />
                    <p className="text-xs font-medium">
                      {queueTab === 'completed' ? 'No completed downloads yet' : 'No downloads in history yet'}
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {currentSectionDownloads.map((item) => {
                  const firstFile = item.files?.[0];
                  const filePath = typeof firstFile === 'string' ? firstFile : firstFile?.path || '';
                  const isDone = item.state === 'done';
                  const isCancelled = item.state === 'cancelled';
                  const isError = item.state === 'error';
                  const hasFiles = item.files && item.files.length > 0;
                  const playable = playableFilesFor(item);
                  const galleries = galleryFilesFor(item);
                  const hasPlayable = playable.length > 0;
                  const hasGallery = galleries.length > 0;
                  const bundleInfo = getBundleInfo(item);

                  return (
                    <div
                      key={item.id}
                      className="bg-surface-1 border border-border-subtle hover:border-border rounded-2xl p-3 px-4 flex items-center justify-between gap-4 transition-all hover:bg-surface-2 group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        {/* Thumbnail / Icon */}
                        <div className="w-11 h-11 rounded-xl bg-surface-3 shrink-0 overflow-hidden flex items-center justify-center relative shadow-sm">
                          <MediaThumbnail
                            item={item}
                            className="w-full h-full object-cover"
                            iconClassName="w-4 h-4"
                          />
                          {bundleInfo.count > 1 && (
                            <div className="absolute bottom-0.5 right-0.5 px-1 py-0.2 rounded bg-black/85 backdrop-blur-xs text-[9px] font-bold text-white flex items-center gap-0.5 border border-white/10 shadow-sm">
                              {bundleInfo.isImageBundle ? (
                                <Layers className="w-2.5 h-2.5 text-brand-acc" />
                              ) : bundleInfo.isVideoBundle ? (
                                <ListVideo className="w-2.5 h-2.5 text-sky-400" />
                              ) : bundleInfo.isAudioBundle ? (
                                <ListMusic className="w-2.5 h-2.5 text-purple-400" />
                              ) : (
                                <Layers className="w-2.5 h-2.5 text-amber-400" />
                              )}
                              <span>{bundleInfo.count}</span>
                            </div>
                          )}
                        </div>

                        {/* Title & Info */}
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-semibold text-slate-100 truncate group-hover:text-brand-acc transition-colors">
                            {item.filename || item.url}
                          </span>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-0.5">
                            {isDone && (
                              <>
                                <span>{fmtBytes(item.sizeBytes || item.downloadedBytes)}</span>
                                <span>•</span>
                                <span className="text-brand-acc font-medium">
                                  Completed {item.finishedAt ? fmtDate(item.finishedAt) : ''}
                                </span>
                                {bundleInfo.count > 1 && (
                                  <>
                                    <span>•</span>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-surface-3 text-slate-200 border border-white/10">
                                      {bundleInfo.isImageBundle ? (
                                        <Layers className="w-3 h-3 text-brand-acc" />
                                      ) : bundleInfo.isVideoBundle ? (
                                        <ListVideo className="w-3 h-3 text-sky-400" />
                                      ) : bundleInfo.isAudioBundle ? (
                                        <ListMusic className="w-3 h-3 text-purple-400" />
                                      ) : (
                                        <Layers className="w-3 h-3 text-amber-400" />
                                      )}
                                      {bundleInfo.count} {bundleInfo.isImageBundle ? 'photos' : bundleInfo.isVideoBundle ? 'videos' : bundleInfo.isAudioBundle ? 'tracks' : 'items'}
                                    </span>
                                  </>
                                )}
                              </>
                            )}
                            {isCancelled && (
                              <>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                  Cancelled
                                </span>
                                {hasFiles && (
                                  <>
                                    <span>•</span>
                                    <span className="text-slate-300 font-medium">
                                      {item.files.length} file{item.files.length === 1 ? '' : 's'} saved ({fmtBytes(item.sizeBytes || item.downloadedBytes)})
                                    </span>
                                  </>
                                )}
                                <span>•</span>
                                <span>{item.finishedAt ? fmtDate(item.finishedAt) : ''}</span>
                              </>
                            )}
                            {isError && (
                              <>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                  Failed
                                </span>
                                <span>•</span>
                                <span className="text-rose-300/90 font-medium truncate max-w-[280px]" title={item.error}>
                                  {friendlyError(item.error)}
                                </span>
                                {hasFiles && (
                                  <>
                                    <span>•</span>
                                    <span className="text-slate-300 font-medium">
                                      {item.files.length} file{item.files.length === 1 ? '' : 's'} saved
                                    </span>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions: Retry/Redownload, Play/Gallery, Open Folder, Open Link, Delete */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Retry / Redownload button */}
                        <button
                          onClick={() => onRetryDownload(item.id)}
                          className="p-2 rounded-xl bg-surface-2 hover:bg-brand-dim text-slate-300 hover:text-brand-acc transition-colors flex items-center gap-1 text-xs font-medium"
                          title={isDone ? "Redownload media" : "Retry download"}
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span className="hidden sm:inline">{isDone ? "Redownload" : "Retry"}</span>
                        </button>

                        {/* Play / Gallery button if files exist */}
                        {hasPlayable ? (
                          <button
                            onClick={() => onOpenPlayer(playable, item.filename)}
                            className="p-2 rounded-xl bg-surface-2 hover:bg-brand-dim text-brand-acc transition-colors"
                            title="Play downloaded media"
                          >
                            <Play className="w-4 h-4 fill-current" />
                          </button>
                        ) : hasGallery ? (
                          <button
                            onClick={() => onOpenGallery(item)}
                            className="p-2 rounded-xl bg-surface-2 hover:bg-brand-dim text-brand-acc transition-colors"
                            title="View gallery images"
                          >
                            <Image className="w-4 h-4" />
                          </button>
                        ) : filePath ? (
                          <button
                            onClick={() => api.openFile(filePath)}
                            className="p-2 rounded-xl bg-surface-2 hover:bg-brand-dim text-slate-300 hover:text-brand-acc transition-colors"
                            title="Open file"
                          >
                            <Play className="w-4 h-4 fill-current" />
                          </button>
                        ) : null}

                        {/* Folder button */}
                        <button
                          onClick={() => {
                            const target = filePath || item.outputDir || item.output_dir;
                            if (target) {
                              api.openOutputFolder(target);
                            }
                          }}
                          className="p-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-slate-400 hover:text-white transition-colors"
                          title="Open containing folder"
                        >
                          <Folder className="w-4 h-4" />
                        </button>

                        {/* Open source link in browser */}
                        {item.url && (
                          <button
                            type="button"
                            onClick={() => api.openUrlExternal(item.url)}
                            className="p-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-slate-400 hover:text-white transition-colors"
                            title="Open download link in browser"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        )}

                        {/* Delete button */}
                        <button
                          onClick={() => onDeleteDownload(item.id)}
                          className="p-2 rounded-xl bg-surface-2 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                          title="Remove from history"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        </div>{/* end keyed tab-enter wrapper */}
      </div>{/* end Screen 3 */}
      </div>{/* end scrollable inner */}
      </div>{/* end overflow-y-auto */}
    </div>
  );
}
