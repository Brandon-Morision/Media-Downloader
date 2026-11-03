package com.novadrop.android.core.util

import android.content.Context
import android.system.Os
import android.system.OsConstants
import android.util.Log

data class FFmpegCapability(
    val isAvailable: Boolean,
    val statusMessage: String,
    val fallbackToMediaMuxer: Boolean,
    val pageSize: Long
)

/**
 * Evaluates FFmpeg availability at runtime by inspecting the kernel page size
 * and catching [UnsatisfiedLinkError] on 16 KB page-size kernels.
 *
 * When FFmpeg cannot be loaded, automatically routes media merging to Android's
 * hardware-accelerated [com.novadrop.android.engine.muxer.MediaMuxerUtil].
 */
object FFmpegCapabilityManager {

    private const val TAG = "FFmpegCapability"

    @Volatile
    private var cachedCapability: FFmpegCapability? = null

    /**
     * Reads the true kernel page size via [Os.sysconf].
     */
    fun getPageSize(): Long {
        return try {
            Os.sysconf(OsConstants._SC_PAGESIZE)
        } catch (_: Throwable) {
            4096L
        }
    }

    /**
     * Resolves the [FFmpegCapability] for the current device and runtime environment.
     */
    fun getCapability(context: Context): FFmpegCapability {
        cachedCapability?.let { return it }
        synchronized(this) {
            cachedCapability?.let { return it }
            val capability = checkCapabilityInternal(context.applicationContext)
            cachedCapability = capability
            return capability
        }
    }

    private fun checkCapabilityInternal(context: Context): FFmpegCapability {
        val pageSize = getPageSize()
        Log.i(TAG, "Checking FFmpeg capability. System page size: $pageSize bytes")

        // 1. If kernel page size > 4096 (e.g. 16 KB kernel on Android 15/17), ELF 4096 alignment fails dlopen
        if (pageSize > 4096L) {
            val msg = "Disabled (16 KB page size kernel detected — MediaMuxer fallback active)"
            Log.w(TAG, msg)
            return FFmpegCapability(
                isAvailable = false,
                statusMessage = msg,
                fallbackToMediaMuxer = true,
                pageSize = pageSize
            )
        }

        // 2. Check if FFmpeg native library is bundled (personal flavor) and can be initialized
        return try {
            val ffmpegClass = Class.forName("com.yausername.ffmpeg.FFmpeg")
            val getInstanceMethod = ffmpegClass.getMethod("getInstance")
            val ffmpegInstance = getInstanceMethod.invoke(null)
            val initMethod = ffmpegClass.getMethod("init", Context::class.java)

            initMethod.invoke(ffmpegInstance, context)
            val msg = "Available (FFmpeg 6.x, 4 KB kernel)"
            Log.i(TAG, "FFmpeg initialized successfully: $msg")
            FFmpegCapability(
                isAvailable = true,
                statusMessage = msg,
                fallbackToMediaMuxer = false,
                pageSize = pageSize
            )
        } catch (linkError: UnsatisfiedLinkError) {
            val msg = "Disabled (Linker alignment error: ${linkError.message} — MediaMuxer fallback active)"
            Log.w(TAG, msg)
            FFmpegCapability(
                isAvailable = false,
                statusMessage = msg,
                fallbackToMediaMuxer = true,
                pageSize = pageSize
            )
        } catch (notFound: ClassNotFoundException) {
            val msg = "Standard Flavor (MediaMuxer active)"
            Log.i(TAG, msg)
            FFmpegCapability(
                isAvailable = false,
                statusMessage = msg,
                fallbackToMediaMuxer = true,
                pageSize = pageSize
            )
        } catch (t: Throwable) {
            val cause = t.cause
            val msg = if (cause is UnsatisfiedLinkError) {
                "Disabled (Linker alignment error: ${cause.message} — MediaMuxer fallback active)"
            } else {
                "Disabled (${t.message ?: "Init failed"} — MediaMuxer fallback active)"
            }
            Log.w(TAG, msg)
            FFmpegCapability(
                isAvailable = false,
                statusMessage = msg,
                fallbackToMediaMuxer = true,
                pageSize = pageSize
            )
        }
    }
}
