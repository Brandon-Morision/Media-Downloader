export const PLAYABLE_EXT = ["mp4", "m4a", "mp3", "webm", "mov", "mkv", "wav", "ogg", "flac", "avi", "m4v", "aac", "opus", "m4b"];
export const AUDIO_EXT = ["mp3", "m4a", "aac", "wav", "ogg", "flac", "opus", "m4b"];
export const IMAGE_EXT = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "tiff", "heic", "avif"];

export function isPlayable(name = "") {
  const ext = (name.split(".").pop() || "").toLowerCase();
  return PLAYABLE_EXT.includes(ext);
}

export function isImage(name = "") {
  const ext = (name.split(".").pop() || "").toLowerCase();
  return IMAGE_EXT.includes(ext);
}

export function fmtBytes(bytes) {
  const num = Number(bytes);
  if (!num || isNaN(num) || num <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0, v = num;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export function fmtDate(ts) {
  if (!ts) return "—";
  const ms = ts > 1e11 ? ts : ts * 1000;
  try {
    return new Date(ms).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return new Date(ms).toLocaleDateString();
  }
}

export function fmtTime(ms) {
  if (!ms && ms !== 0) return "0:00";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function fmtDuration(secs) {
  if (!secs && secs !== 0) return "";
  const s = Math.floor(secs % 60);
  const m = Math.floor((secs / 60) % 60);
  const h = Math.floor(secs / 3600);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function fmtViews(n) {
  const num = Number(n);
  if (!num || isNaN(num) || num <= 0) return "";
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B views`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M views`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K views`;
  return `${num} views`;
}

export function playableFilesFor(item) {
  if (!item) return [];
  const raw = item.files || [];
  const list = raw
    .map((f) => (typeof f === "string" ? { name: f.split(/[/\\]/).pop() || f, path: f } : f))
    .filter((f) => f && f.name && isPlayable(f.name));

  if (list.length === 0 && item.filename && isPlayable(item.filename)) {
    const fullPath = item.outputDir
      ? item.outputDir.replace(/[/\\]+$/, "") + "/" + item.filename
      : item.filename;
    list.push({ name: item.filename, path: fullPath });
  }
  return list;
}

export function galleryFilesFor(item) {
  if (!item) return [];
  const raw = item.files || [];
  return raw
    .map((f) => (typeof f === "string" ? { name: f.split(/[/\\]/).pop() || f, path: f } : f))
    .filter(
      (f) =>
        f &&
        f.name &&
        (isImage(f.name) ||
          (isPlayable(f.name) && !AUDIO_EXT.includes((f.name.split(".").pop() || "").toLowerCase())))
    );
}

export function getMediaCategory(item) {
  if (!item) return "other";
  const files = item.files || [];
  const candidates = files.map((f) => (typeof f === "string" ? f : f.path || f.name || ""));
  if (item.filename) candidates.push(item.filename);

  let hasVideo = false;
  let hasAudio = false;
  let hasImage = false;

  for (const p of candidates) {
    if (!p) continue;
    const ext = p.split(".").pop().toLowerCase();
    if (["mp4", "mkv", "webm", "avi", "mov", "flv", "m4v", "ts"].includes(ext)) hasVideo = true;
    if (["mp3", "m4a", "flac", "wav", "opus", "ogg", "aac"].includes(ext)) hasAudio = true;
    if (["jpg", "jpeg", "png", "webp", "gif", "bmp", "tiff", "heic", "avif", "svg", "zip"].includes(ext)) hasImage = true;
  }

  if (hasVideo && !hasImage && !hasAudio) return "video";
  if (hasAudio && !hasVideo && !hasImage) return "audio";
  if (hasImage && !hasVideo && !hasAudio) return "gallery";
  if (hasImage || (hasVideo && hasImage)) return "gallery";
  if (hasVideo) return "video";
  if (hasAudio) return "audio";

  if (item.tool === "gallery-dl") return "gallery";
  if (item.tool === "yt-dlp") {
    if (["mp3", "m4a", "flac", "wav"].includes(item.cfg?.format)) return "audio";
    return "video";
  }
  return "other";
}

export const YTDLP_SITES = [
  "youtube.com", "youtu.be", "vimeo.com", "tiktok.com",
  "twitch.tv", "pornhub.com", "xvideos.com", "xhamster.com",
  "xnxx.com", "spankbang.com", "dailymotion.com", "bilibili.com",
  "1flex.org",
];

export function detectTool(url = "") {
  try {
    const host = new URL(normalizeUrl(url)).hostname.replace(/^www\./, "").toLowerCase();
    for (const s of YTDLP_SITES) {
      if (host.includes(s)) return "yt-dlp";
    }
  } catch {}
  return "gallery-dl";
}

export function getToolDetails(url = "") {
  const tool = detectTool(url);
  if (tool === "yt-dlp") {
    return {
      tool: "yt-dlp",
      label: "Video",
      engine: "yt-dlp",
      badgeColor: "bg-pink-500/15 text-pink-400 border border-pink-500/30",
      description: "Video stream extractor",
    };
  }
  return {
    tool: "gallery-dl",
    label: "Gallery",
    engine: "gallery-dl",
    badgeColor: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    description: "Image & gallery extractor",
  };
}

export function toolLabel(tool) {
  return tool === "yt-dlp" ? "Video" : "Gallery";
}

export function friendlyError(err = "") {
  if (!err) return "Failed";
  const s = String(err).trim();

  // 1. Rate limits with specific reset time (e.g. Tumblr, Twitter)
  const resetMatch = s.match(/rate limit (?:will )?reset at (\d+:\d+(?::\d+)?(?: [AP]M)?)/i);
  if (resetMatch) {
    return `Rate limited by site — resets at ${resetMatch[1]}`;
  }

  // 2. Generic rate limit patterns
  if (/429|too many requests|rate limit/i.test(s)) {
    return "Rate limited by site — please wait before retrying";
  }

  // 3. User cancelled
  if (/cancelled by user|cancelled/i.test(s)) {
    return "Cancelled by user";
  }

  // 4. Authentication / Sign-in required
  if (/sign in to confirm you're not a bot|bot check/i.test(s)) {
    return "Sign in required (YouTube bot check)";
  }
  if (/age[- ]restrict|confirm your age/i.test(s)) {
    return "Age-restricted content — login or cookies required";
  }
  if (/x\.com|twitter/i.test(s) && /login|auth|block anonymous/i.test(s)) {
    return "X/Twitter requires cookies to view this media";
  }
  if (/instagram/i.test(s) && /login|checkpoint/i.test(s)) {
    return "Instagram requires login for this profile";
  }
  if (/login|sign in|authentication|registered users/i.test(s)) {
    return "Login required for this content (configure in Settings)";
  }

  // 5. Video / Content availability
  if (/private video|video is private|this video is private/i.test(s)) {
    return "This video or content is private";
  }
  if (/video unavailable|content isn't available|removed/i.test(s)) {
    return "Content unavailable or removed by author";
  }
  if (/copyright/i.test(s)) {
    return "Removed due to a copyright claim";
  }
  if (/403|forbidden|access denied/i.test(s)) {
    return "Access denied (HTTP 403) — cookies may be needed";
  }
  if (/404|not found/i.test(s)) {
    return "Page or media not found (HTTP 404)";
  }

  // 6. Network issues
  if (/network|timed? ?out|connection (?:reset|refused)|getaddrinfo|incomplete read/i.test(s)) {
    return "Network connection lost or timed out";
  }

  // 7. Disk / Permissions
  if (/no space left|disk full/i.test(s)) {
    return "Not enough disk space";
  }
  if (/permission denied|access is denied/i.test(s)) {
    return "Permission denied writing to download folder";
  }

  // 8. Clean up raw tool CLI noise (e.g. [tumblr][error] Aborting - ...)
  let clean = s
    .replace(/^\[.*?\]\[(?:error|warning|info)\]\s*/i, "")
    .replace(/^ERROR:\s*/i, "")
    .replace(/^WARNING:\s*/i, "")
    .replace(/\(exit code \d+\)\s*$/i, "")
    .trim();

  if (clean.length > 55) {
    clean = clean.slice(0, 52) + "…";
  }
  return clean || "Download failed";
}

export function isLikelyUrl(text) {
  const s = (text || "").trim();
  if (!s || /\s/.test(s)) return false;
  if (/^https?:\/\//i.test(s)) return true;
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+([\/?#].*)?$/i.test(s);
}

export function normalizeUrl(text) {
  const s = (text || "").trim();
  return /^https?:\/\//i.test(s) ? s : "https://" + s;
}

/**
 * Categorize media and detect multi-item bundles/albums across videos, photos, and audio.
 */
export function getBundleInfo(item) {
  if (!item) {
    return {
      cat: 'other',
      filesList: [],
      playableList: [],
      totalCount: 0,
      isAudioCat: false,
      isVideoCat: false,
      isImageCat: false,
      isVideoBundle: false,
      isAudioBundle: false,
      isImageBundle: false,
      isMixedBundle: false,
      count: 0,
    };
  }

  let cat = item.category;
  if (!cat) {
    const detected = getMediaCategory(item);
    cat = detected === 'audio' ? 'music' : detected === 'gallery' ? 'image' : detected;
  }

  const filesList = Array.isArray(item.files) ? item.files : [];
  const playableList = playableFilesFor(item);

  let videoFilesCount = 0;
  let audioFilesCount = 0;
  let imageFilesCount = 0;

  for (const f of filesList) {
    const name = typeof f === 'string' ? f : f?.name || f?.path || '';
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (['mp4', 'mkv', 'webm', 'avi', 'mov', 'flv', 'm4v', 'ts', 'wmv'].includes(ext)) {
      videoFilesCount++;
    } else if (AUDIO_EXT.includes(ext)) {
      audioFilesCount++;
    } else if (isImage(name)) {
      imageFilesCount++;
    }
  }

  const totalCount = filesList.length || (item.itemsDone > 0 ? item.itemsDone : 0);
  const isAudioCat = cat === 'music' || cat === 'audio';
  const isVideoCat = cat === 'video';
  const isImageCat = cat === 'image' || cat === 'gallery';

  const isVideoBundle = videoFilesCount > 1 || (isVideoCat && (totalCount > 1 || playableList.length > 1));
  const isAudioBundle = audioFilesCount > 1 || (isAudioCat && totalCount > 1);
  const isImageBundle = imageFilesCount > 1 || (isImageCat && (totalCount > 1 || item.isAlbum));
  const isMixedBundle = !isVideoBundle && !isAudioBundle && !isImageBundle && totalCount > 1;

  const count = isVideoBundle
    ? (videoFilesCount || playableList.length || totalCount)
    : isAudioBundle
    ? (audioFilesCount || totalCount)
    : isImageBundle
    ? (imageFilesCount || totalCount || (item.isAlbum ? 6 : 1))
    : totalCount;

  return {
    cat,
    filesList,
    playableList,
    totalCount,
    isAudioCat,
    isVideoCat,
    isImageCat,
    isVideoBundle,
    isAudioBundle,
    isImageBundle,
    isMixedBundle,
    count,
  };
}

