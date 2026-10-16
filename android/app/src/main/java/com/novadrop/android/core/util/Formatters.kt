package com.novadrop.android.core.util

import com.novadrop.android.core.model.DownloadedFileInfo
import com.novadrop.android.core.model.MediaCategory
import java.util.Locale
import java.util.regex.Pattern

object Formatters {

    private val VIDEO_EXTENSIONS = setOf("mp4", "mkv", "webm", "avi", "mov", "flv", "m4v", "ts", "wmv")
    private val AUDIO_EXTENSIONS = setOf("mp3", "m4a", "flac", "wav", "ogg", "opus", "aac", "wma")
    private val IMAGE_EXTENSIONS = setOf("jpg", "jpeg", "png", "webp", "gif", "bmp", "jfif", "avif", "svg", "tiff", "heic")

    private val GALLERY_HOSTS = setOf(
        "danbooru.donmai.us", "gelbooru.com", "safebooru.org", "e621.net",
        "pixiv.net", "deviantart.com", "artstation.com", "imgur.com",
        "flickr.com", "instagram.com", "reddit.com", "pinterest.com"
    )

    fun formatBytes(bytes: Long): String {
        if (bytes <= 0) return "0 B"
        val units = arrayOf("B", "KB", "MB", "GB", "TB")
        val digitGroups = (Math.log10(bytes.toDouble()) / Math.log10(1024.0)).toInt()
        val index = digitGroups.coerceIn(0, units.size - 1)
        return String.format(Locale.US, "%.1f %s", bytes / Math.pow(1024.0, index.toDouble()), units[index])
    }

    fun formatDuration(seconds: Long?): String {
        if (seconds == null || seconds <= 0) return "00:00"
        val s = seconds % 60
        val m = (seconds / 60) % 60
        val h = seconds / 3600
        return if (h > 0) {
            String.format(Locale.US, "%d:%02d:%02d", h, m, s)
        } else {
            String.format(Locale.US, "%02d:%02d", m, s)
        }
    }

    fun formatViews(views: Long?): String {
        if (views == null || views <= 0) return "0 views"
        return when {
            views >= 1_000_000_000 -> String.format(Locale.US, "%.1fB views", views / 1_000_000_000.0)
            views >= 1_000_000 -> String.format(Locale.US, "%.1fM views", views / 1_000_000.0)
            views >= 1_000 -> String.format(Locale.US, "%.1fK views", views / 1_000.0)
            else -> "$views views"
        }
    }

    fun detectTool(url: String): String {
        val lower = url.lowercase(Locale.ROOT)
        for (host in GALLERY_HOSTS) {
            if (lower.contains(host)) return "gallery-dl"
        }
        return "yt-dlp"
    }

    fun detectCategory(filename: String, files: List<DownloadedFileInfo> = emptyList()): MediaCategory {
        var videoCount = 0
        var audioCount = 0
        var imageCount = 0

        for (f in files) {
            val ext = f.name.substringAfterLast('.', "").lowercase(Locale.ROOT)
            when {
                VIDEO_EXTENSIONS.contains(ext) -> videoCount++
                AUDIO_EXTENSIONS.contains(ext) -> audioCount++
                IMAGE_EXTENSIONS.contains(ext) -> imageCount++
            }
        }

        if (files.isNotEmpty()) {
            if (audioCount > videoCount && audioCount >= imageCount) return MediaCategory.MUSIC
            if (imageCount > 0 && videoCount > 0) return MediaCategory.GALLERY
            if (imageCount > 0 && imageCount >= videoCount) return MediaCategory.IMAGE
            if (videoCount > 0) return MediaCategory.VIDEO
        }

        val ext = filename.substringAfterLast('.', "").lowercase(Locale.ROOT)
        return when {
            VIDEO_EXTENSIONS.contains(ext) -> MediaCategory.VIDEO
            AUDIO_EXTENSIONS.contains(ext) -> MediaCategory.MUSIC
            IMAGE_EXTENSIONS.contains(ext) -> MediaCategory.IMAGE
            else -> MediaCategory.VIDEO
        }
    }

    fun normalizeUrl(input: String): String {
        val trimmed = input.trim()
        return if (!trimmed.startsWith("http://", ignoreCase = true) &&
            !trimmed.startsWith("https://", ignoreCase = true)
        ) {
            "https://$trimmed"
        } else {
            trimmed
        }
    }

    fun isLikelyUrl(text: String): Boolean {
        val trimmed = text.trim()
        if (trimmed.isEmpty() || trimmed.contains(" ")) return false
        val p = Pattern.compile("^(https?://)?([a-zA-Z0-9-]+\\.)+[a-zA-Z]{2,}(/.*)?$")
        return p.matcher(trimmed).matches()
    }
}
