package com.novadrop.android.core.model

import java.io.Serializable

enum class DownloadState {
    PENDING,
    PREPARING,
    RUNNING,
    PAUSED,
    SCHEDULED,
    COMPLETED,
    FAILED,
    CANCELLED
}

enum class MediaCategory {
    VIDEO,
    MUSIC,
    IMAGE,
    GALLERY,
    OTHER
}

data class DownloadedFileInfo(
    val name: String,
    val path: String,
    val sizeBytes: Long = 0L,
    val mimeType: String = ""
) : Serializable

data class DownloadJob(
    val id: String,
    val url: String,
    val title: String,
    val tool: String = "yt-dlp",
    val state: DownloadState = DownloadState.PENDING,
    val selectedFormat: String = "auto",
    val outputDir: String = "",
    val outputFilePath: String? = null,
    val outputUri: String? = null,
    val progressPercent: Float = 0f,
    val downloadedBytes: Long = 0L,
    val totalBytes: Long = 0L,
    val speedFormatted: String = "",
    val etaFormatted: String = "",
    val itemsDone: Int = 0,
    val totalItems: Int = 0,
    val files: List<DownloadedFileInfo> = emptyList(),
    val thumbnail: String? = null,
    val errorMessage: String? = null,
    val scheduledTimestamp: Long? = null,
    val scheduledTimeFormatted: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val finishedAt: Long? = null
) : Serializable

data class FormatPreset(
    val id: String,
    val label: String,
    val subLabel: String,
    val category: MediaCategory,
    val quality: String,
    val extension: String,
    val filesizeEstimateBytes: Long? = null
)

data class ExtractionMetadata(
    val originalUrl: String,
    val title: String,
    val uploader: String = "",
    val durationSeconds: Long? = null,
    val thumbnailUrl: String? = null,
    val description: String? = null,
    val viewCount: Long? = null,
    val isPlaylist: Boolean = false,
    val playlistCount: Int? = null,
    val availableFormats: List<FormatPreset> = emptyList(),
    val suggestedTool: String = "yt-dlp"
)

data class SearchResultItem(
    val id: String,
    val title: String,
    val uploader: String,
    val durationFormatted: String,
    val viewCountFormatted: String,
    val thumbnailUrl: String,
    val webpageUrl: String
)

data class PlaylistItem(
    val index: Int,
    val id: String,
    val title: String,
    val durationSeconds: Long? = null,
    val uploader: String = "",
    val thumbnailUrl: String = "",
    val webpageUrl: String = ""
)

data class PlaylistInspection(
    val title: String,
    val uploader: String = "",
    val count: Int,
    val entries: List<PlaylistItem> = emptyList(),
    val originalUrl: String
)

data class RateLimitResult(
    val isRateLimited: Boolean,
    val resetTimestamp: Long = 0L,
    val resetTimeFormatted: String = "",
    val secondsRemaining: Long = 0L,
    val message: String = ""
)

data class UserPreferences(
    val themeAccent: String = "ocean",
    val isDarkMode: Boolean = true,
    val defaultFormat: String = "auto",
    val outputFolderUri: String? = null,
    val completionAction: String = "nothing", // nothing, chime, open_folder
    val exitPlayerAudio: String = "mini", // mini, exit
    val exitPlayerVideo: String = "ask", // ask, mini, exit
    val nightOwlEnabled: Boolean = false,
    val nightOwlStartTime: String = "02:00",
    val nightOwlEndTime: String = "06:00",
    val nightOwlRateLimit: String = "500",
    val nativeNotificationsEnabled: Boolean = true
)
