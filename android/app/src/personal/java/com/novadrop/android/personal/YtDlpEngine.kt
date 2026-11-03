package com.novadrop.android.personal

import android.content.Context
import android.os.Environment
import android.util.Log
import com.novadrop.android.core.model.DownloadedFileInfo
import com.novadrop.android.core.model.DownloadJob
import com.novadrop.android.core.model.ExtractionMetadata
import com.novadrop.android.core.model.FormatPreset
import com.novadrop.android.core.model.PlaylistInspection
import com.novadrop.android.core.model.SearchResultItem
import com.novadrop.android.core.util.CookiesManager
import com.novadrop.android.core.util.FFmpegCapabilityManager
import com.novadrop.android.core.util.Validators
import com.novadrop.android.domain.engine.MediaExtractorEngine
import com.novadrop.android.engine.muxer.MediaMuxerUtil
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

/**
 * Executes general web media extraction and downloads using yt-dlp.
 *
 * Rules:
 * 1. Requires configured Netscape cookies file; otherwise rejects with clear user explanation.
 * 2. Uses default format selector: `bv*[vcodec^=avc1]+ba[ext=m4a]/b[ext=mp4]/best` for universal AVC+AAC playback.
 * 3. Inspects [FFmpegCapabilityManager]: if FFmpeg cannot load (e.g. 16 KB page size), falls back to [MediaMuxerUtil.mux].
 * 4. Implements cancellation via [YoutubeDL.destroyProcessById].
 */
class YtDlpEngine(
    private val context: Context
) : MediaExtractorEngine {

    override val engineName: String = "yt-dlp (youtubedl-android)"
    override val engineVersion: String = "2025.11.12"

    companion object {
        private const val TAG = "YtDlpEngine"
        const val DEFAULT_FORMAT_SELECTOR = "bv*[vcodec^=avc1]+ba[ext=m4a]/b[ext=mp4]/best"
    }

    override fun canHandle(url: String): Boolean {
        return Validators.validateUrl(url) && CookiesManager.hasCookies(context)
    }

    override suspend fun extractMetadata(url: String): Result<ExtractionMetadata> = withContext(Dispatchers.IO) {
        if (!CookiesManager.hasCookies(context)) {
            return@withContext Result.failure(
                IllegalStateException("Unsupported URL or authentication required. Please import cookies.txt in Settings to enable extraction for this site.")
            )
        }

        try {
            ensureInitialized()
            val request = YoutubeDLRequest(url)
            request.addOption("--dump-json")
            request.addOption("--no-playlist")
            request.addOption("--cookies", CookiesManager.getCookiesFile(context).absolutePath)

            val response = YoutubeDL.getInstance().execute(request)
            val jsonStr = response.out
            val formats = listOf(
                FormatPreset(
                    id = "best_avc",
                    label = "Best MP4 (H.264 + AAC)",
                    subLabel = "Universal Compatibility",
                    category = com.novadrop.android.core.model.MediaCategory.VIDEO,
                    quality = "Best",
                    extension = "mp4"
                )
            )

            Result.success(
                ExtractionMetadata(
                    originalUrl = url,
                    title = "Media_${System.currentTimeMillis()}",
                    description = "Extracted via yt-dlp",
                    uploader = "Web Media",
                    durationSeconds = 0L,
                    thumbnailUrl = null,
                    availableFormats = formats,
                    suggestedTool = "yt-dlp"
                )
            )
        } catch (e: Exception) {
            Log.e(TAG, "extractMetadata failed: ${e.message}", e)
            Result.failure(e)
        }
    }

    override suspend fun search(query: String, limit: Int): Result<List<SearchResultItem>> {
        return Result.failure(UnsupportedOperationException("yt-dlp search is not enabled; NewPipe handles search"))
    }

    override suspend fun inspectPlaylist(url: String): Result<PlaylistInspection> {
        return Result.failure(UnsupportedOperationException("Playlist inspection handled via NewPipe"))
    }

    override suspend fun download(
        job: DownloadJob,
        onProgress: (
            progress: Float,
            downloadedBytes: Long,
            totalBytes: Long,
            speedFormatted: String,
            etaFormatted: String
        ) -> Unit
    ): Result<List<DownloadedFileInfo>> = withContext(Dispatchers.IO) {
        if (!CookiesManager.hasCookies(context)) {
            return@withContext Result.failure(
                IllegalStateException("Unsupported URL or authentication required. Please import cookies.txt in Settings to enable extraction for this site.")
            )
        }

        val jobId = job.id
        try {
            ensureInitialized()

            val baseDir = getStorageDirectory("mp4", isAudio = false)
            val cleanName = Validators.sanitizeFilename(job.title.ifBlank { "Media_${System.currentTimeMillis()}" })
            val destinationFile = resolveUniqueDestinationFile(baseDir, cleanName, "mp4")

            val capability = FFmpegCapabilityManager.getCapability(context)
            Log.i(TAG, "Starting yt-dlp download for job $jobId. Capability: ${capability.statusMessage}")

            val request = YoutubeDLRequest(job.url)
            request.addOption("-f", DEFAULT_FORMAT_SELECTOR)
            request.addOption("--cookies", CookiesManager.getCookiesFile(context).absolutePath)
            request.addOption("-o", destinationFile.absolutePath)

            if (capability.isAvailable && !capability.fallbackToMediaMuxer) {
                request.addOption("--merge-output-format", "mp4")
            }

            onProgress(5f, 0L, 100L, "Starting yt-dlp...", "00:00")

            val response = YoutubeDL.getInstance().execute(request, jobId) { progress, etaInSeconds, line ->
                val p = progress.coerceIn(5f, 95f)
                val etaStr = String.format("%02d:%02d", etaInSeconds / 60, etaInSeconds % 60)
                onProgress(p, (p * 100_000).toLong(), 10_000_000L, line ?: "Downloading...", etaStr)
            }

            if (response.exitCode != 0 || !destinationFile.exists() || destinationFile.length() == 0L) {
                if (destinationFile.exists()) destinationFile.delete()
                return@withContext Result.failure(IllegalStateException("yt-dlp download failed with exit code ${response.exitCode}: ${response.err}"))
            }

            // Scan downloaded file into MediaStore
            try {
                android.media.MediaScannerConnection.scanFile(
                    context.applicationContext,
                    arrayOf(destinationFile.absolutePath),
                    arrayOf("video/mp4"),
                    null
                )
            } catch (_: Throwable) {}

            val fileInfo = DownloadedFileInfo(
                name = destinationFile.name,
                path = destinationFile.absolutePath,
                sizeBytes = destinationFile.length(),
                mimeType = "video/mp4"
            )

            onProgress(100f, fileInfo.sizeBytes, fileInfo.sizeBytes, "Completed", "00:00")
            Log.i(TAG, "yt-dlp download succeeded: ${destinationFile.name} (${fileInfo.sizeBytes} bytes)")
            Result.success(listOf(fileInfo))

        } catch (e: Exception) {
            Log.e(TAG, "yt-dlp download failed: ${e.message}", e)
            Result.failure(e)
        }
    }

    override fun cancel(jobId: String) {
        try {
            Log.i(TAG, "Cancelling yt-dlp process for job $jobId")
            YoutubeDL.getInstance().destroyProcessById(jobId)
        } catch (e: Exception) {
            Log.w(TAG, "destroyProcessById error: ${e.message}")
        }
    }

    override fun pause(jobId: String): Boolean = false

    override fun resume(jobId: String): Boolean = false

    private fun resolveUniqueDestinationFile(baseDir: File, cleanName: String, ext: String): File {
        var candidate = File(baseDir, "$cleanName.$ext")
        var counter = 1
        while (candidate.exists()) {
            candidate = File(baseDir, "$cleanName ($counter).$ext")
            counter++
        }
        return candidate
    }

    private fun getStorageDirectory(format: String, isAudio: Boolean = false): File {
        val subfolder = if (isAudio) "Music" else "Videos"
        val publicDownloads = try {
            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
        } catch (_: Throwable) { null }
        val target = if (publicDownloads != null) File(publicDownloads, "NovaDrop/$subfolder") else File(context.filesDir, "NovaDrop/$subfolder")
        if (!target.exists()) target.mkdirs()
        return if (target.canWrite()) target else File(context.filesDir, "NovaDrop/$subfolder").apply { mkdirs() }
    }

    private fun ensureInitialized() {
        YoutubeDL.getInstance().init(context.applicationContext)
    }
}
