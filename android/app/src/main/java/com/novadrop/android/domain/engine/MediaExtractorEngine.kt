package com.novadrop.android.domain.engine

import com.novadrop.android.core.model.DownloadedFileInfo
import com.novadrop.android.core.model.DownloadJob
import com.novadrop.android.core.model.ExtractionMetadata
import com.novadrop.android.core.model.PlaylistInspection
import com.novadrop.android.core.model.SearchResultItem

interface MediaExtractorEngine {

    val engineName: String
    val engineVersion: String

    fun canHandle(url: String): Boolean

    suspend fun extractMetadata(url: String): Result<ExtractionMetadata>

    suspend fun search(query: String, limit: Int = 12): Result<List<SearchResultItem>>

    suspend fun inspectPlaylist(url: String): Result<PlaylistInspection>

    suspend fun download(
        job: DownloadJob,
        onProgress: (
            progress: Float,
            downloadedBytes: Long,
            totalBytes: Long,
            speedFormatted: String,
            etaFormatted: String
        ) -> Unit
    ): Result<List<DownloadedFileInfo>>

    fun cancel(jobId: String)

    fun pause(jobId: String): Boolean

    fun resume(jobId: String): Boolean
}
