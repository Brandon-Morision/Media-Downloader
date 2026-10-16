package com.novadrop.android.service

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.ServiceCompat
import com.novadrop.android.NovaDropApp
import com.novadrop.android.core.model.DownloadState
import com.novadrop.android.core.util.RateLimitParser
import com.novadrop.android.data.local.NovaDropDatabase
import com.novadrop.android.data.local.entity.DownloadJobEntity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.util.concurrent.ConcurrentHashMap

class DownloadForegroundService : Service() {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var wakeLock: PowerManager.WakeLock? = null
    private val activeJobCoroutines = ConcurrentHashMap<String, Job>()

    override fun onCreate() {
        super.onCreate()
        NotificationHelper.createChannels(this)
        acquireWakeLock()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        val jobId = intent?.getStringExtra(EXTRA_JOB_ID)

        when (action) {
            ACTION_START -> {
                if (jobId != null) {
                    startJobDownload(jobId)
                }
            }
            ACTION_CANCEL -> {
                if (jobId != null) {
                    cancelJobDownload(jobId)
                }
            }
        }

        return START_NOT_STICKY
    }

    private fun startJobDownload(jobId: String) {
        if (activeJobCoroutines.containsKey(jobId)) return

        val app = application as NovaDropApp
        val database = NovaDropDatabase.getInstance(this)
        val dao = database.downloadJobDao()
        val engine = app.extractorEngine

        val job = serviceScope.launch {
            val jobEntity = dao.getJobById(jobId) ?: return@launch
            val domainJob = jobEntity.toDomain()

            // Update to preparing / running
            dao.updateJob(DownloadJobEntity.fromDomain(domainJob.copy(state = DownloadState.RUNNING)))

            // Promote to Foreground Service
            updateForegroundNotification(domainJob)

            var lastDbUpdateTime = 0L
            val result = engine.download(domainJob) { progress, downloaded, total, speed, eta ->
                val now = System.currentTimeMillis()
                val updated = domainJob.copy(
                    progressPercent = progress,
                    downloadedBytes = downloaded,
                    totalBytes = total,
                    speedFormatted = speed,
                    etaFormatted = eta
                )
                if (now - lastDbUpdateTime >= 1000L || progress >= 100f) {
                    lastDbUpdateTime = now
                    serviceScope.launch {
                        dao.updateJob(DownloadJobEntity.fromDomain(updated))
                    }
                }
                updateForegroundNotification(updated)
            }

            activeJobCoroutines.remove(jobId)

            result.fold(
                onSuccess = { files ->
                    val finished = domainJob.copy(
                        state = DownloadState.COMPLETED,
                        progressPercent = 100f,
                        files = files,
                        outputFilePath = files.firstOrNull()?.path,
                        finishedAt = System.currentTimeMillis()
                    )
                    dao.updateJob(DownloadJobEntity.fromDomain(finished))

                    val pathsToScan = files.map { it.path }.filter { it.isNotBlank() }.toTypedArray()
                    if (pathsToScan.isNotEmpty()) {
                        try {
                            android.media.MediaScannerConnection.scanFile(
                                this@DownloadForegroundService.applicationContext,
                                pathsToScan,
                                null,
                                null
                            )
                        } catch (_: Throwable) {}
                    }
                },
                onFailure = { error ->
                    val rateLimit = RateLimitParser.parse(error.message)
                    if (rateLimit != null) {
                        val scheduled = domainJob.copy(
                            state = DownloadState.SCHEDULED,
                            scheduledTimestamp = rateLimit.resetTimestamp,
                            scheduledTimeFormatted = rateLimit.resetTimeFormatted,
                            errorMessage = rateLimit.message
                        )
                        dao.updateJob(DownloadJobEntity.fromDomain(scheduled))
                    } else {
                        val failed = domainJob.copy(
                            state = DownloadState.FAILED,
                            errorMessage = error.message ?: "Download failed"
                        )
                        dao.updateJob(DownloadJobEntity.fromDomain(failed))
                    }
                }
            )

            checkQueueFinished()
        }

        activeJobCoroutines[jobId] = job
    }

    private fun cancelJobDownload(jobId: String) {
        val app = application as NovaDropApp
        app.extractorEngine.cancel(jobId)
        activeJobCoroutines[jobId]?.cancel()
        activeJobCoroutines.remove(jobId)

        serviceScope.launch {
            val dao = NovaDropDatabase.getInstance(this@DownloadForegroundService).downloadJobDao()
            val job = dao.getJobById(jobId)?.toDomain()
            if (job != null) {
                dao.updateJob(DownloadJobEntity.fromDomain(job.copy(state = DownloadState.CANCELLED, errorMessage = "Cancelled by user")))
            }
            checkQueueFinished()
        }
    }

    private fun updateForegroundNotification(job: com.novadrop.android.core.model.DownloadJob?) {
        val notification = NotificationHelper.buildDownloadProgressNotification(
            this,
            job,
            activeJobCoroutines.size
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceCompat.startForeground(
                this,
                NotificationHelper.DOWNLOAD_NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
            )
        } else {
            startForeground(NotificationHelper.DOWNLOAD_NOTIFICATION_ID, notification)
        }
    }

    private fun checkQueueFinished() {
        if (activeJobCoroutines.isEmpty()) {
            releaseWakeLock()
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
        }
    }

    private fun acquireWakeLock() {
        if (wakeLock == null) {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "NovaDrop:DownloadWakeLock").apply {
                setReferenceCounted(false)
                acquire(2 * 60 * 60 * 1000L) // 2 hours max safe limit
            }
        }
    }

    private fun releaseWakeLock() {
        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
            }
        } catch (_: Exception) {}
        wakeLock = null
    }

    override fun onDestroy() {
        super.onDestroy()
        releaseWakeLock()
        serviceScope.cancel()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val ACTION_START = "com.novadrop.android.service.START_DOWNLOAD"
        const val ACTION_CANCEL = "com.novadrop.android.service.CANCEL_DOWNLOAD"
        const val EXTRA_JOB_ID = "extra_job_id"

        fun startDownload(context: Context, jobId: String) {
            val intent = Intent(context, DownloadForegroundService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_JOB_ID, jobId)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stopDownload(context: Context, jobId: String) {
            val intent = Intent(context, DownloadForegroundService::class.java).apply {
                action = ACTION_CANCEL
                putExtra(EXTRA_JOB_ID, jobId)
            }
            context.startService(intent)
        }
    }
}
