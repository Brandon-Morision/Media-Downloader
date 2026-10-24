package com.novadrop.android.spike

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.yausername.youtubedl_android.YoutubeDLRequest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.io.File

class SpikeForegroundService : Service() {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var wakeLock: PowerManager.WakeLock? = null

    companion object {
        const val TAG = "SpikeDozeTest"
        const val ACTION_DOZE_TEST = "com.novadrop.android.spike.DOZE_TEST"
        const val ACTION_CHECK_RELEASE = "com.novadrop.android.spike.CHECK_RELEASE"
        const val CHANNEL_ID = "spike_foreground_channel"
        const val NOTIFICATION_ID = 2001
    }

    override fun onCreate() {
        super.onCreate()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Spike Test Service",
                NotificationManager.IMPORTANCE_LOW
            )
            val nm = getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(channel)
        }
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Spike:DozeWakeLock").apply {
            setReferenceCounted(false)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: ACTION_CHECK_RELEASE
        Log.i(TAG, "onStartCommand received action: $action")

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("NovaDrop Spike Service")
            .setContentText("Running action: $action")
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setOngoing(true)
            .build()

        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            notification,
            ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
        )

        wakeLock?.acquire(120_000) // 2 min max

        serviceScope.launch {
            try {
                when (action) {
                    ACTION_DOZE_TEST -> executeDozeDownload()
                    ACTION_CHECK_RELEASE -> executeReleaseSanityCheck()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Service execution failed: ${e.message}", e)
            } finally {
                wakeLock?.let { if (it.isHeld) it.release() }
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }

        return START_NOT_STICKY
    }

    private fun executeReleaseSanityCheck() {
        Log.i(TAG, "=== Starting SpikeRelease Real Workloads Execution ===")
        val ytdlpInitTime = SpikeManager.initYoutubeDL(this)
        Log.i(TAG, "YoutubeDL.init duration: ${ytdlpInitTime}ms, version: ${SpikeManager.getYtDlpVersion(this)}")
        val ffmpegResult = SpikeManager.initFFmpeg(this)
        Log.i(TAG, "FFmpeg.init result: $ffmpegResult")
        val ariaResult = SpikeManager.initAria2c(this)
        Log.i(TAG, "Aria2c.init result: $ariaResult")

        // 1. One real yt-dlp download
        val ytdlpDir = File(cacheDir, "spike_release_ytdlp").apply { mkdirs() }
        val ytdlpTarget = File(ytdlpDir, "real_dl.bin")
        if (ytdlpTarget.exists()) ytdlpTarget.delete()
        val ytdlpReq = YoutubeDLRequest("https://speed.cloudflare.com/__down?bytes=1000000")
        ytdlpReq.addOption("-o", ytdlpTarget.absolutePath)
        val ytStart = System.currentTimeMillis()
        try {
            val resp = SpikeManager.executeYtDlp(ytdlpReq)
            val ytDur = System.currentTimeMillis() - ytStart
            Log.i(TAG, "spikeRelease yt-dlp download: exitCode=${resp.exitCode}, duration=${ytDur}ms, size=${ytdlpTarget.length()} bytes")
        } catch (e: Exception) {
            Log.e(TAG, "spikeRelease yt-dlp download failed: ${e.message}")
        }

        // 2. One real gallery-dl download (not -j)
        val gdlDir = File(cacheDir, "spike_release_gdl").apply { mkdirs() }
        gdlDir.listFiles()?.forEach { it.deleteRecursively() }
        val gdlStart = System.currentTimeMillis()
        val gdlResult = SpikeManager.executeGalleryDl(
            this,
            listOf("-d", gdlDir.absolutePath, "https://safebooru.org/index.php?page=post&s=view&id=4000000")
        )
        val gdlDur = System.currentTimeMillis() - gdlStart
        val gdlFiles = gdlDir.walkTopDown().filter { it.isFile && it.length() > 0 }.toList()
        Log.i(TAG, "spikeRelease gallery-dl download: exitCode=${gdlResult.exitCode}, duration=${gdlDur}ms, filesCount=${gdlFiles.size}")
        gdlFiles.forEach {
            Log.i(TAG, "  Downloaded image: ${it.name}, size=${it.length()} bytes")
        }

        // 3. One real FFmpeg merge (YouTube bestvideo+bestaudio)
        if (ffmpegResult.isSuccess) {
            val ffDir = File(cacheDir, "spike_release_ffmpeg").apply { mkdirs() }
            val ffTarget = File(ffDir, "merged_zoo.mp4")
            if (ffTarget.exists()) ffTarget.delete()
            val ffReq = YoutubeDLRequest("https://youtu.be/jNQXAC9IVRw")
            ffReq.addOption("-f", "bv*[vcodec^=avc1]+ba[ext=m4a]/b[ext=mp4]/best")
            ffReq.addOption("--merge-output-format", "mp4")
            ffReq.addOption("-o", ffTarget.absolutePath)
            val ffStart = System.currentTimeMillis()
            try {
                val resp = SpikeManager.executeYtDlp(ffReq)
                val ffDur = System.currentTimeMillis() - ffStart
                Log.i(TAG, "spikeRelease FFmpeg merge: exitCode=${resp.exitCode}, duration=${ffDur}ms, size=${ffTarget.length()} bytes")
            } catch (e: Exception) {
                Log.e(TAG, "spikeRelease FFmpeg merge failed: ${e.message}")
            }
        }
        Log.i(TAG, "=== Finished SpikeRelease Real Workloads Execution ===")
    }

    private fun executeDozeDownload() {
        Log.i(TAG, "=== Starting Doze Mode Download Test ===")
        SpikeManager.initYoutubeDL(this)
        val downloadDir = File(cacheDir, "doze_test").apply { mkdirs() }
        val targetFile = File(downloadDir, "doze_sample.bin")
        if (targetFile.exists()) targetFile.delete()

        // 5MB download rate-limited to 500K/s (~10 seconds duration)
        val req = YoutubeDLRequest("https://speed.cloudflare.com/__down?bytes=5000000")
        req.addOption("-o", targetFile.absolutePath)
        req.addOption("--limit-rate", "500K")

        Log.i(TAG, "Beginning download. Target: ${targetFile.absolutePath}")
        val startTime = System.currentTimeMillis()
        val response = SpikeManager.executeYtDlp(req) { progress, eta, speed ->
            Log.i(TAG, "Doze download progress: $progress%, speed: $speed, eta: $eta")
        }
        val duration = System.currentTimeMillis() - startTime
        Log.i(TAG, "Doze download completed: exitCode=${response.exitCode}, duration=${duration}ms, targetSize=${targetFile.length()}")
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
        wakeLock?.let { if (it.isHeld) it.release() }
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
