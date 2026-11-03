package com.novadrop.android.core.util

import android.content.Context
import android.util.Log

data class EngineVersions(
    val newPipeVersion: String,
    val galleryDlVersion: String,
    val ffmpegStatus: String,
    val ytDlpVersion: String,
    val isPersonalFlavor: Boolean
)

/**
 * Provides metadata and over-the-air update capabilities for the media engines.
 */
object EngineInfoProvider {

    private const val TAG = "EngineInfoProvider"

    fun getEngineVersions(context: Context): EngineVersions {
        val ffmpegCap = FFmpegCapabilityManager.getCapability(context)

        return try {
            val personalInfoClass = Class.forName("com.novadrop.android.personal.PersonalEngineInfoProvider")
            val getVersionsMethod = personalInfoClass.getMethod("getPersonalVersions", Context::class.java)
            getVersionsMethod.invoke(null, context) as EngineVersions
        } catch (_: ClassNotFoundException) {
            EngineVersions(
                newPipeVersion = "v0.26.5",
                galleryDlVersion = "Not bundled (Standard flavor)",
                ffmpegStatus = ffmpegCap.statusMessage,
                ytDlpVersion = "Not bundled (Standard flavor)",
                isPersonalFlavor = false
            )
        }
    }

    /**
     * Executes an over-the-air update of yt-dlp with rollback on failure.
     */
    suspend fun updateEngines(context: Context): Result<String> = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
        try {
            val personalInfoClass = Class.forName("com.novadrop.android.personal.PersonalEngineInfoProvider")
            val updateMethod = personalInfoClass.getMethod("performUpdate", Context::class.java)
            val msg = updateMethod.invoke(null, context) as String
            Result.success(msg)
        } catch (_: ClassNotFoundException) {
            Result.failure(IllegalStateException("Engine updates are only supported on the Personal build."))
        } catch (e: Exception) {
            val cause = if (e is java.lang.reflect.InvocationTargetException && e.targetException != null) {
                e.targetException
            } else {
                e.cause ?: e
            }
            Log.e(TAG, "Update failed: ${cause.message}", cause)
            Result.failure(cause)
        }
    }
}
