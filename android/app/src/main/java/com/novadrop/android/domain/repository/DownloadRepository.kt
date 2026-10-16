package com.novadrop.android.domain.repository

import com.novadrop.android.core.model.DownloadJob
import kotlinx.coroutines.flow.Flow

interface DownloadRepository {
    fun getAllJobsFlow(): Flow<List<DownloadJob>>
    suspend fun getJobById(id: String): DownloadJob?
    suspend fun enqueueJob(url: String, title: String = "", format: String = "auto", tool: String = ""): DownloadJob
    suspend fun updateJob(job: DownloadJob)
    suspend fun deleteJob(id: String)
    suspend fun clearFinishedJobs()
    suspend fun pauseJob(id: String)
    suspend fun resumeJob(id: String)
    suspend fun cancelJob(id: String)
    suspend fun retryJob(id: String)
}
