package com.novadrop.android.personal

import android.content.Context
import android.util.Log
import com.novadrop.android.core.util.EngineVersions
import com.novadrop.android.core.util.FFmpegCapabilityManager
import com.yausername.youtubedl_android.YoutubeDL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Personal flavor engine metadata and OTA update provider.
 */
object PersonalEngineInfoProvider {

    private const val TAG = "PersonalEngineInfo"

    @JvmStatic
    fun getPersonalVersions(context: Context): EngineVersions {
        val ffmpegCap = FFmpegCapabilityManager.getCapability(context)

        val ytDlpVer = try {
            YoutubeDL.getInstance().versionName(context) ?: "2025.11.12"
        } catch (_: Throwable) {
            "2025.11.12 (Bundled)"
        }

        return EngineVersions(
            newPipeVersion = "v0.26.5 (Production YouTube Engine)",
            galleryDlVersion = "v1.32.17 (Pure-Python Wheels)",
            ffmpegStatus = ffmpegCap.statusMessage,
            ytDlpVersion = ytDlpVer,
            isPersonalFlavor = true
        )
    }

    @JvmStatic
    fun performUpdate(context: Context): String {
        try {
            YoutubeDL.getInstance().init(context.applicationContext)
        } catch (_: Throwable) {}

        val currentVersion = try {
            YoutubeDL.getInstance().versionName(context) ?: "unknown"
        } catch (_: Throwable) {
            "unknown"
        }

        Log.i(TAG, "Starting OTA update for yt-dlp from current version: $currentVersion")

        try {
            // Attempt update to nightly channel
            val status = YoutubeDL.getInstance().updateYoutubeDL(context, YoutubeDL.UpdateChannel.NIGHTLY)
            val newVersion = YoutubeDL.getInstance().versionName(context) ?: "unknown"
            val successMsg = "Successfully updated yt-dlp ($status). Active version: $newVersion"
            Log.i(TAG, successMsg)
            return successMsg
        } catch (e: Exception) {
            Log.e(TAG, "yt-dlp OTA update failed: ${e.message}. Executing rollback...", e)
            // Rollback to bundled static version by re-initializing from APK assets
            try {
                YoutubeDL.getInstance().init(context.applicationContext)
                val rollbackVersion = YoutubeDL.getInstance().versionName(context) ?: "2025.11.12"
                val rollbackMsg = "Update failed (${e.message}). Rolled back to bundled version: $rollbackVersion"
                Log.w(TAG, rollbackMsg)
                throw IllegalStateException(rollbackMsg, e)
            } catch (re: Throwable) {
                if (re is IllegalStateException && re.message?.contains("Rolled back") == true) {
                    throw re
                }
                throw IllegalStateException("Update failed (${e.message}) and rollback encountered error: ${re.message}", e)
            }
        }
    }

    @JvmStatic
    suspend fun updateEngines(context: Context): Result<String> = withContext(Dispatchers.IO) {
        try {
            Result.success(performUpdate(context))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
