package com.novadrop.android.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.novadrop.android.R
import com.novadrop.android.core.model.DownloadJob
import com.novadrop.android.ui.MainActivity

object NotificationHelper {

    const val DOWNLOAD_CHANNEL_ID = "novadrop_downloads"
    const val PLAYBACK_CHANNEL_ID = "novadrop_playback"
    const val DOWNLOAD_NOTIFICATION_ID = 1001
    const val PLAYBACK_NOTIFICATION_ID = 1002

    fun createChannels(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            val downloadChannel = NotificationChannel(
                DOWNLOAD_CHANNEL_ID,
                context.getString(R.string.download_channel_name),
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = context.getString(R.string.download_channel_desc)
                setShowBadge(false)
            }

            val playbackChannel = NotificationChannel(
                PLAYBACK_CHANNEL_ID,
                context.getString(R.string.playback_channel_name),
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = context.getString(R.string.playback_channel_desc)
                setShowBadge(false)
            }

            nm.createNotificationChannel(downloadChannel)
            nm.createNotificationChannel(playbackChannel)
        }
    }

    fun buildDownloadProgressNotification(
        context: Context,
        job: DownloadJob?,
        activeCount: Int
    ): android.app.Notification {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val title = if (job != null) job.title else "Downloading media..."
        val progressInt = job?.progressPercent?.toInt() ?: 0
        val subtext = if (job != null && job.speedFormatted.isNotBlank()) {
            "${job.speedFormatted} • ETA ${job.etaFormatted}"
        } else {
            "$activeCount download(s) active"
        }

        val builder = NotificationCompat.Builder(context, DOWNLOAD_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setContentTitle(title)
            .setContentText(subtext)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setProgress(100, progressInt, job == null || job.totalBytes <= 0)

        // Cancel action
        if (job != null) {
            val cancelIntent = Intent(context, DownloadForegroundService::class.java).apply {
                action = DownloadForegroundService.ACTION_CANCEL
                putExtra(DownloadForegroundService.EXTRA_JOB_ID, job.id)
            }
            val cancelPendingIntent = PendingIntent.getService(
                context,
                job.id.hashCode(),
                cancelIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            builder.addAction(android.R.drawable.ic_menu_close_clear_cancel, "Cancel", cancelPendingIntent)
        }

        return builder.build()
    }
}
