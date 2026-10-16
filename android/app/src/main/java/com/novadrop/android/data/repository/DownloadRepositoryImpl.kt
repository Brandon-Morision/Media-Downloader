package com.novadrop.android.data.repository

import android.content.Context
import com.novadrop.android.core.model.DownloadJob
import com.novadrop.android.core.model.DownloadState
import com.novadrop.android.core.util.Formatters
import com.novadrop.android.data.local.dao.DownloadJobDao
import com.novadrop.android.data.local.entity.DownloadJobEntity
import com.novadrop.android.domain.engine.MediaExtractorEngine
import com.novadrop.android.domain.repository.DownloadRepository
import com.novadrop.android.service.DownloadForegroundService
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.util.UUID

class DownloadRepositoryImpl(
    private val context: Context,
    private val dao: DownloadJobDao,
    private val engine: MediaExtractorEngine
) : DownloadRepository {

    override fun getAllJobsFlow(): Flow<List<DownloadJob>> {
        return dao.getAllJobsFlow().map { list -> list.map { it.toDomain() } }
    }

    override suspend fun getJobById(id: String): DownloadJob? {
        return dao.getJobById(id)?.toDomain()
    }

    override suspend fun enqueueJob(
        url: String,
        title: String,
        format: String,
        tool: String
    ): DownloadJob {
        val normalizedUrl = Formatters.normalizeUrl(url)
        val detectedTool = if (tool.isNotBlank()) tool else Formatters.detectTool(normalizedUrl)
        val jobTitle = if (title.isNotBlank()) title else normalizedUrl

        val job = DownloadJob(
            id = "dl-" + UUID.randomUUID().toString().take(8),
            url = normalizedUrl,
            title = jobTitle,
            tool = detectedTool,
            state = DownloadState.PENDING,
            selectedFormat = format,
            createdAt = System.currentTimeMillis()
        )

        dao.insertJob(DownloadJobEntity.fromDomain(job))
        DownloadForegroundService.startDownload(context, job.id)
        return job
    }

    override suspend fun updateJob(job: DownloadJob) {
        dao.updateJob(DownloadJobEntity.fromDomain(job))
    }

    override suspend fun deleteJob(id: String) {
        engine.cancel(id)
        dao.deleteJobById(id)
    }

    override suspend fun clearFinishedJobs() {
        dao.clearFinishedJobs()
    }

    override suspend fun pauseJob(id: String) {
        engine.pause(id)
        val current = dao.getJobById(id)?.toDomain() ?: return
        dao.updateJob(DownloadJobEntity.fromDomain(current.copy(state = DownloadState.PAUSED)))
    }

    override suspend fun resumeJob(id: String) {
        val current = dao.getJobById(id)?.toDomain() ?: return
        if (current.state == DownloadState.PAUSED) {
            val resumed = engine.resume(id)
            if (!resumed) {
                // Restart download if engine could not unpause directly
                DownloadForegroundService.startDownload(context, id)
            } else {
                dao.updateJob(DownloadJobEntity.fromDomain(current.copy(state = DownloadState.RUNNING)))
            }
        } else if (current.state == DownloadState.SCHEDULED || current.state == DownloadState.FAILED) {
            DownloadForegroundService.startDownload(context, id)
        }
    }

    override suspend fun cancelJob(id: String) {
        engine.cancel(id)
        DownloadForegroundService.stopDownload(context, id)
        val current = dao.getJobById(id)?.toDomain() ?: return
        dao.updateJob(
            DownloadJobEntity.fromDomain(
                current.copy(
                    state = DownloadState.CANCELLED,
                    errorMessage = "Cancelled by user"
                )
            )
        )
    }

    override suspend fun retryJob(id: String) {
        val current = dao.getJobById(id)?.toDomain() ?: return
        val resetJob = current.copy(
            state = DownloadState.PENDING,
            progressPercent = 0f,
            downloadedBytes = 0L,
            errorMessage = null,
            createdAt = System.currentTimeMillis()
        )
        dao.updateJob(DownloadJobEntity.fromDomain(resetJob))
        DownloadForegroundService.startDownload(context, id)
    }
}
