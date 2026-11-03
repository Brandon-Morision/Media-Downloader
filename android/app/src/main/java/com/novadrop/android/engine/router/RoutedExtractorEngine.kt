package com.novadrop.android.engine.router

import com.novadrop.android.core.model.DownloadedFileInfo
import com.novadrop.android.core.model.DownloadJob
import com.novadrop.android.core.model.ExtractionMetadata
import com.novadrop.android.core.model.PlaylistInspection
import com.novadrop.android.core.model.SearchResultItem
import com.novadrop.android.domain.engine.MediaExtractorEngine

/**
 * A composite [MediaExtractorEngine] that delegates extraction and download requests
 * to specific sub-engines according to decisions made by [EngineRouter].
 *
 * @param router The [EngineRouter] evaluating target engines
 * @param newPipeEngine Engine for YouTube streams
 * @param nativeEngine Engine for Reddit single media, Booru single posts, and direct media files
 * @param galleryDlEngine Optional engine for multi-image galleries and art portfolios
 * @param ytDlpEngine Optional engine for general web media with authentication cookies
 */
class RoutedExtractorEngine(
    private val router: EngineRouter,
    private val newPipeEngine: MediaExtractorEngine,
    private val nativeEngine: MediaExtractorEngine,
    private val galleryDlEngine: MediaExtractorEngine? = null,
    private val ytDlpEngine: MediaExtractorEngine? = null
) : MediaExtractorEngine {

    override val engineName: String = "NovaDrop Multi-Engine Router"
    override val engineVersion: String = "0.5.2-personal"

    override fun canHandle(url: String): Boolean {
        val decision = router.route(url)
        return decision.engine != TargetEngine.UNSUPPORTED
    }

    override suspend fun extractMetadata(url: String): Result<ExtractionMetadata> {
        val decision = router.route(url)
        return when (decision.engine) {
            TargetEngine.NEWPIPE -> newPipeEngine.extractMetadata(url)
            TargetEngine.NATIVE -> nativeEngine.extractMetadata(url)
            TargetEngine.GALLERY_DL -> {
                galleryDlEngine?.extractMetadata(url)
                    ?: Result.failure(IllegalStateException(decision.reason ?: EngineRouter.MSG_PERSONAL_FLAVOR_REQUIRED_GALLERY_DL))
            }
            TargetEngine.YT_DLP -> {
                ytDlpEngine?.extractMetadata(url)
                    ?: Result.failure(IllegalStateException(decision.reason ?: EngineRouter.MSG_PERSONAL_FLAVOR_REQUIRED_YTDLP))
            }
            TargetEngine.UNSUPPORTED -> {
                Result.failure(IllegalArgumentException(decision.reason ?: EngineRouter.MSG_UNSUPPORTED_OR_NEEDS_LOGIN))
            }
        }
    }

    override suspend fun search(query: String, limit: Int): Result<List<SearchResultItem>> {
        // YouTube search delegates to NewPipe
        return newPipeEngine.search(query, limit)
    }

    override suspend fun inspectPlaylist(url: String): Result<PlaylistInspection> {
        val decision = router.route(url)
        return when (decision.engine) {
            TargetEngine.NEWPIPE -> newPipeEngine.inspectPlaylist(url)
            TargetEngine.NATIVE -> nativeEngine.inspectPlaylist(url)
            TargetEngine.GALLERY_DL -> {
                galleryDlEngine?.inspectPlaylist(url)
                    ?: Result.failure(IllegalStateException(decision.reason ?: EngineRouter.MSG_PERSONAL_FLAVOR_REQUIRED_GALLERY_DL))
            }
            TargetEngine.YT_DLP -> {
                ytDlpEngine?.inspectPlaylist(url)
                    ?: Result.failure(IllegalStateException(decision.reason ?: EngineRouter.MSG_PERSONAL_FLAVOR_REQUIRED_YTDLP))
            }
            TargetEngine.UNSUPPORTED -> {
                Result.failure(IllegalArgumentException(decision.reason ?: EngineRouter.MSG_UNSUPPORTED_OR_NEEDS_LOGIN))
            }
        }
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
    ): Result<List<DownloadedFileInfo>> {
        val decision = router.route(job.url)
        return when (decision.engine) {
            TargetEngine.NEWPIPE -> newPipeEngine.download(job, onProgress)
            TargetEngine.NATIVE -> nativeEngine.download(job, onProgress)
            TargetEngine.GALLERY_DL -> {
                galleryDlEngine?.download(job, onProgress)
                    ?: Result.failure(IllegalStateException(decision.reason ?: EngineRouter.MSG_PERSONAL_FLAVOR_REQUIRED_GALLERY_DL))
            }
            TargetEngine.YT_DLP -> {
                ytDlpEngine?.download(job, onProgress)
                    ?: Result.failure(IllegalStateException(decision.reason ?: EngineRouter.MSG_PERSONAL_FLAVOR_REQUIRED_YTDLP))
            }
            TargetEngine.UNSUPPORTED -> {
                Result.failure(IllegalArgumentException(decision.reason ?: EngineRouter.MSG_UNSUPPORTED_OR_NEEDS_LOGIN))
            }
        }
    }

    override fun cancel(jobId: String) {
        newPipeEngine.cancel(jobId)
        nativeEngine.cancel(jobId)
        galleryDlEngine?.cancel(jobId)
        ytDlpEngine?.cancel(jobId)
    }

    override fun pause(jobId: String): Boolean {
        val p1 = newPipeEngine.pause(jobId)
        val p2 = nativeEngine.pause(jobId)
        val p3 = galleryDlEngine?.pause(jobId) ?: false
        val p4 = ytDlpEngine?.pause(jobId) ?: false
        return p1 || p2 || p3 || p4
    }

    override fun resume(jobId: String): Boolean {
        val r1 = newPipeEngine.resume(jobId)
        val r2 = nativeEngine.resume(jobId)
        val r3 = galleryDlEngine?.resume(jobId) ?: false
        val r4 = ytDlpEngine?.resume(jobId) ?: false
        return r1 || r2 || r3 || r4
    }
}
