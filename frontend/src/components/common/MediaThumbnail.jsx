import React, { useState, useEffect } from 'react';
import { Film, Music, Image as ImageIcon } from 'lucide-react';
import { api } from '../../lib/api';

// Module-level caches to avoid redundant or duplicate IPC calls across re-renders
const _thumbCache = new Map();
const _inFlight = new Set();

/**
 * Extract the first actual media file from an item or item.files bundle
 */
function getFirstMediaFilePath(item, propPath) {
  if (propPath && typeof propPath === 'string') return propPath;
  if (!item) return '';

  const outDir = item.outputDir || item.output_dir || '';
  const files = Array.isArray(item.files) ? item.files : [];
  if (files.length > 0) {
    const mediaExtensions = [
      '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.jfif', '.avif',
      '.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v', '.flv', '.ts', '.wmv',
      '.mp3', '.m4a', '.flac', '.ogg', '.opus', '.aac', '.wav', '.wma'
    ];
    for (const f of files) {
      const p = typeof f === 'string' ? f : f?.path || f?.name || '';
      const lower = p.toLowerCase();
      if (mediaExtensions.some((ext) => lower.endsWith(ext))) {
        let fullPath = typeof f === 'string' ? f : f?.path || '';
        if (fullPath && !fullPath.includes('/') && !fullPath.includes('\\') && outDir) {
          const sep = outDir.includes('/') ? '/' : '\\';
          fullPath = `${outDir.replace(/[\\/]$/, '')}${sep}${fullPath}`;
        }
        return fullPath;
      }
    }
    const first = files[0];
    let fullFirst = typeof first === 'string' ? first : first?.path || '';
    if (fullFirst && !fullFirst.includes('/') && !fullFirst.includes('\\') && outDir) {
      const sep = outDir.includes('/') ? '/' : '\\';
      fullFirst = `${outDir.replace(/[\\/]$/, '')}${sep}${fullFirst}`;
    }
    return fullFirst;
  }

  if (item.filePath) return item.filePath;
  if (item.path) return item.path;
  if (outDir && item.filename) {
    const sep = outDir.includes('/') ? '/' : '\\';
    return `${outDir.replace(/[\\/]$/, '')}${sep}${item.filename}`;
  }
  return '';
}

/**
 * Reusable Media Thumbnail Component
 * Prioritizes item.thumbnail if present; otherwise queries api.getItemThumbnailUrl(firstMediaFile)
 * with deduplication, auto-retry on stale token errors, and in-memory caching.
 * Fallback to polished category gradient / icon box when no art can be found.
 */
export default function MediaThumbnail({
  item,
  path,
  type,
  className = 'w-full h-full object-cover',
  fallbackClassName = 'w-full h-full flex items-center justify-center',
  iconClassName = 'w-8 h-8',
}) {
  const [thumbUrl, setThumbUrl] = useState(() => item?.thumbnail || '');
  const [hasError, setHasError] = useState(false);
  const [retried, setRetried] = useState(false);

  useEffect(() => {
    if (item?.thumbnail) {
      setThumbUrl(item.thumbnail);
      setHasError(false);
      setRetried(false);
      return;
    }

    const filePath = getFirstMediaFilePath(item, path);
    if (!filePath) {
      return;
    }

    if (_thumbCache.has(filePath)) {
      setThumbUrl(_thumbCache.get(filePath));
      setHasError(false);
      return;
    }

    if (_inFlight.has(filePath)) {
      return;
    }

    const outDir = item?.outputDir || item?.output_dir || '';
    _inFlight.add(filePath);
    api.getItemThumbnailUrl(filePath, outDir)
      .then((res) => {
        _inFlight.delete(filePath);
        if (res?.ok && res.url) {
          _thumbCache.set(filePath, res.url);
          setThumbUrl(res.url);
          setHasError(false);
        } else {
          setHasError(true);
        }
      })
      .catch(() => {
        _inFlight.delete(filePath);
        setHasError(true);
      });
  }, [item?.thumbnail, item?.id, path]);

  const handleImgError = () => {
    const filePath = getFirstMediaFilePath(item, path);
    const outDir = item?.outputDir || item?.output_dir || '';
    // If the image failed (e.g. stale bridge token after app restart) and we haven't retried yet:
    if (!retried && filePath) {
      setRetried(true);
      api.getItemThumbnailUrl(filePath, outDir)
        .then((res) => {
          if (res?.ok && res.url) {
            _thumbCache.set(filePath, res.url);
            setThumbUrl(res.url);
            setHasError(false);
          } else {
            setHasError(true);
          }
        })
        .catch(() => setHasError(true));
    } else {
      setHasError(true);
    }
  };

  const filename = item?.filename || (typeof path === 'string' ? path : '') || '';
  const isAudio =
    type === 'audio' ||
    type === 'music' ||
    item?.type === 'audio' ||
    item?.category === 'music' ||
    filename.endsWith('.mp3') ||
    filename.endsWith('.m4a') ||
    filename.endsWith('.flac') ||
    filename.endsWith('.wav') ||
    filename.endsWith('.ogg') ||
    filename.endsWith('.opus') ||
    filename.endsWith('.wma') ||
    filename.endsWith('.aac');

  const isImage =
    type === 'image' ||
    type === 'gallery' ||
    item?.type === 'image' ||
    item?.type === 'gallery' ||
    item?.category === 'image' ||
    item?.category === 'gallery' ||
    item?.isAlbum ||
    filename.endsWith('.jpg') ||
    filename.endsWith('.jpeg') ||
    filename.endsWith('.png') ||
    filename.endsWith('.webp') ||
    filename.endsWith('.gif') ||
    filename.endsWith('.svg') ||
    filename.endsWith('.jfif') ||
    filename.endsWith('.bmp') ||
    filename.endsWith('.avif') ||
    filename.endsWith('.heic');

  if (thumbUrl && !hasError) {
    return (
      <img
        src={thumbUrl}
        alt={filename}
        className={className}
        onError={handleImgError}
      />
    );
  }

  if (isAudio) {
    return (
      <div className={`${fallbackClassName} bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 text-white`}>
        <Music className={`${iconClassName} opacity-90`} />
      </div>
    );
  }

  if (isImage) {
    return (
      <div className={`${fallbackClassName} bg-surface-3 text-slate-400`}>
        <ImageIcon className={iconClassName} />
      </div>
    );
  }

  return (
    <div className={`${fallbackClassName} bg-surface-3 text-slate-500`}>
      <Film className={iconClassName} />
    </div>
  );
}
