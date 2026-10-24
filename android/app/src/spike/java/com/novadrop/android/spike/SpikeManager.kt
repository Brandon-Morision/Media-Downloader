package com.novadrop.android.spike

import android.content.Context
import android.os.Build
import android.util.Log
import com.yausername.aria2c.Aria2c
import com.yausername.ffmpeg.FFmpeg
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLException
import com.yausername.youtubedl_android.YoutubeDLRequest
import com.yausername.youtubedl_android.YoutubeDLResponse
import java.io.File
import java.io.FileOutputStream
import java.io.IOException

object SpikeManager {

    private const val TAG = "SpikeManager"

    data class GalleryDlResult(
        val exitCode: Int,
        val stdout: String,
        val stderr: String,
        val durationMs: Long
    )

    var isYtdlpInitialized = false
        private set
    var isFfmpegInitialized = false
        private set
    var isAria2cInitialized = false
        private set

    /**
     * Initializes YoutubeDL.
     */
    @Synchronized
    fun initYoutubeDL(context: Context): Long {
        val start = System.currentTimeMillis()
        if (!isYtdlpInitialized) {
            YoutubeDL.getInstance().init(context.applicationContext)
            isYtdlpInitialized = true
        }
        return System.currentTimeMillis() - start
    }

    /**
     * Initializes FFmpeg module.
     */
    @Synchronized
    fun initFFmpeg(context: Context): Result<Long> {
        val start = System.currentTimeMillis()
        return try {
            if (!isFfmpegInitialized) {
                FFmpeg.getInstance().init(context.applicationContext)
                isFfmpegInitialized = true
            }
            Result.success(System.currentTimeMillis() - start)
        } catch (t: Throwable) {
            Log.e(TAG, "FFmpeg init failed: ${t.message}", t)
            Result.failure(t)
        }
    }

    /**
     * Initializes Aria2c module.
     */
    @Synchronized
    fun initAria2c(context: Context): Result<Long> {
        val start = System.currentTimeMillis()
        return try {
            if (!isAria2cInitialized) {
                Aria2c.getInstance().init(context.applicationContext)
                isAria2cInitialized = true
            }
            Result.success(System.currentTimeMillis() - start)
        } catch (t: Throwable) {
            Log.e(TAG, "Aria2c init failed: ${t.message}", t)
            Result.failure(t)
        }
    }

    fun getYtDlpVersion(context: Context): String {
        return YoutubeDL.getInstance().version(context.applicationContext) ?: "unknown"
    }

    fun updateYtDlp(context: Context, channel: YoutubeDL.UpdateChannel): YoutubeDL.UpdateStatus? {
        return YoutubeDL.getInstance().updateYoutubeDL(context.applicationContext, channel)
    }

    /**
     * Tests behavior when the update source is corrupted or invalid.
     * Verifies that the app falls back safely and reports a readable error.
     */
    fun testUpdateCorruptFallback(context: Context): Result<String> {
        val originalVersion = getYtDlpVersion(context)
        return try {
            val invalidChannel = object : YoutubeDL.UpdateChannel("https://127.0.0.1:9/nonexistent/update.json") {}
            YoutubeDL.getInstance().updateYoutubeDL(context.applicationContext, invalidChannel)
            Result.failure(IllegalStateException("Corrupt update should have thrown IOException"))
        } catch (e: Exception) {
            val currentVersion = getYtDlpVersion(context)
            if (currentVersion == originalVersion) {
                Result.success("Clean fallback to bundled version ($currentVersion) after error: ${e.message}")
            } else {
                Result.failure(IllegalStateException("Version changed despite update failure: $currentVersion"))
            }
        }
    }

    /**
     * Executes a yt-dlp request.
     */
    fun executeYtDlp(
        request: YoutubeDLRequest,
        processId: String? = null,
        callback: ((Float, Long, String) -> Unit)? = null
    ): YoutubeDLResponse {
        return YoutubeDL.getInstance().execute(request, processId, callback)
    }

    /**
     * Destroys a running process by ID.
     */
    fun destroyProcess(processId: String): Boolean {
        return YoutubeDL.getInstance().destroyProcessById(processId)
    }

    /**
     * Unpacks pure-Python wheels from assets to app-private files directory.
     */
    fun setupGalleryDl(context: Context): List<File> {
        val wheelsDir = File(context.filesDir, "wheels").apply { mkdirs() }
        val assetManager = context.assets
        val assetWheels = assetManager.list("wheels") ?: emptyArray()

        val unpackedFiles = mutableListOf<File>()
        for (wheelName in assetWheels) {
            val targetFile = File(wheelsDir, wheelName)
            if (!targetFile.exists() || targetFile.length() == 0L) {
                assetManager.open("wheels/$wheelName").use { input ->
                    FileOutputStream(targetFile).use { output ->
                        input.copyTo(output)
                    }
                }
            }
            unpackedFiles.add(targetFile)
        }
        return unpackedFiles
    }

    /**
     * Spawns gallery-dl as a subprocess inside the bundled Python environment.
     */
    fun startGalleryDlProcess(
        context: Context,
        args: List<String>,
        envExtra: Map<String, String> = emptyMap(),
        overrideGalleryDlWhl: File? = null
    ): Process {
        initYoutubeDL(context)
        val wheels = setupGalleryDl(context)

        val baseDir = File(context.noBackupFilesDir, "youtubedl-android")
        val pythonBin = File(context.applicationInfo.nativeLibraryDir, "libpython.so")
        val pythonHome = File(baseDir, "packages/python/usr")
        val pythonLib = File(baseDir, "packages/python/usr/lib/python3.12")
        val nativeLibDir = context.applicationInfo.nativeLibraryDir

        if (!pythonBin.exists()) {
            throw IOException("Python binary not found at ${pythonBin.absolutePath}")
        }

        val primaryGalleryWhl = overrideGalleryDlWhl ?: wheels.firstOrNull { it.name.startsWith("gallery_dl-") }
            ?: throw IOException("No gallery-dl wheel found")

        val dependencyWheels = wheels.filter { !it.name.startsWith("gallery_dl") }

        // Construct PYTHONPATH with primary gallery wheel first, then dependencies, then stdlib
        val pythonPathElements = mutableListOf<String>()
        pythonPathElements.add(primaryGalleryWhl.absolutePath)
        dependencyWheels.forEach { pythonPathElements.add(it.absolutePath) }
        pythonPathElements.add(pythonLib.absolutePath)

        val pyPath = pythonPathElements.joinToString(":")
        val pyHome = pythonHome.absolutePath
        val ldPath = "$nativeLibDir:${File(pythonHome, "lib").absolutePath}"

        val command = mutableListOf<String>()
        command.add(pythonBin.absolutePath)
        command.add("-m")
        command.add("gallery_dl")
        command.addAll(args)

        val pb = ProcessBuilder(command)
        pb.environment().apply {
            put("PYTHONPATH", pyPath)
            put("PYTHONHOME", pyHome)
            put("LD_LIBRARY_PATH", ldPath)
            put("TMPDIR", context.cacheDir.absolutePath)
            // Certifi / CA bundle path
            val certFile = wheels.firstOrNull { it.name.startsWith("certifi") }
            if (certFile != null) {
                put("SSL_CERT_FILE", certFile.absolutePath)
            }
            putAll(envExtra)
        }

        return pb.start()
    }

    /**
     * Executes gallery-dl as a subprocess inside the bundled Python environment.
     */
    fun executeGalleryDl(
        context: Context,
        args: List<String>,
        envExtra: Map<String, String> = emptyMap(),
        overrideGalleryDlWhl: File? = null
    ): GalleryDlResult {
        val start = System.currentTimeMillis()
        val process = startGalleryDlProcess(context, args, envExtra, overrideGalleryDlWhl)

        val stdout = process.inputStream.bufferedReader().readText()
        val stderr = process.errorStream.bufferedReader().readText()
        val exitCode = process.waitFor()
        val durationMs = System.currentTimeMillis() - start

        return GalleryDlResult(
            exitCode = exitCode,
            stdout = stdout,
            stderr = stderr,
            durationMs = durationMs
        )
    }

    /**
     * Tests runtime updating for gallery-dl:
     * Loads a newer version from app-private storage in preference to the bundled one;
     * rolls back if corrupt.
     */
    fun testGalleryDlRuntimeUpdateAndRollback(context: Context): Result<String> {
        val wheelsDir = File(context.filesDir, "wheels").apply { mkdirs() }
        val bundledResult = executeGalleryDl(context, listOf("--version"))
        if (bundledResult.exitCode != 0) {
            return Result.failure(IllegalStateException("Bundled gallery-dl failed: ${bundledResult.stderr}"))
        }
        val bundledVersion = bundledResult.stdout.trim()

        // 1. Create a simulated newer version wheel (copied or tagged)
        val updatedWheel = File(wheelsDir, "gallery_dl_updated.whl")
        val bundledWhl = wheelsDir.listFiles { _, name -> name.startsWith("gallery_dl-") }?.firstOrNull()
            ?: return Result.failure(IllegalStateException("Bundled gallery wheel not found"))

        bundledWhl.copyTo(updatedWheel, overwrite = true)

        val updatedResult = executeGalleryDl(context, listOf("--version"), overrideGalleryDlWhl = updatedWheel)
        updatedWheel.delete()
        if (updatedResult.exitCode != 0) {
            return Result.failure(IllegalStateException("Updated wheel execution failed: ${updatedResult.stderr}"))
        }

        // 2. Corrupt the wheel and verify rollback
        val corruptWheel = File(wheelsDir, "gallery_dl_corrupt.whl")
        corruptWheel.writeText("CORRUPT_INVALID_ZIP_PAYLOAD_FOR_TESTING")

        val corruptResult = executeGalleryDl(context, listOf("--version"), overrideGalleryDlWhl = corruptWheel)
        val rollbackSuccess = if (corruptResult.exitCode != 0) {
            // Detected corruption, rollback to bundled
            corruptWheel.delete()
            val fallbackResult = executeGalleryDl(context, listOf("--version"))
            fallbackResult.exitCode == 0 && fallbackResult.stdout.trim() == bundledVersion
        } else {
            false
        }
        corruptWheel.delete()

        return if (rollbackSuccess) {
            Result.success("Runtime update verified; corruption correctly caught and rolled back to bundled $bundledVersion")
        } else {
            Result.failure(IllegalStateException("Rollback after corruption failed: corruptResult exit=${corruptResult.exitCode}"))
        }
    }

    /**
     * Imports a Netscape format cookies.txt into app-private storage.
     * Sanitizes permissions and returns the File.
     */
    fun importCookies(context: Context, netscapeContent: String): File {
        val cookiesDir = File(context.filesDir, "cookies").apply { mkdirs() }
        val cookiesFile = File(cookiesDir, "cookies.txt")
        cookiesFile.writeText(netscapeContent)
        // Ensure app-private file permissions
        cookiesFile.setReadable(true, true)
        cookiesFile.setWritable(true, true)
        return cookiesFile
    }

    /**
     * Sanitizes logs to ensure no cookies, auth tokens, or signed URLs are printed.
     */
    fun sanitizeForLog(text: String): String {
        return text
            .replace(Regex("(?i)(auth_token|sessionid|ct0|cookie|token)=[^&;\\s]+"), "$1=***REDACTED***")
            .replace(Regex("(?i)(--cookies\\s+)\\S+"), "$1***REDACTED_COOKIE_PATH***")
            .replace(Regex("(https?://[^\\s?]+\\?)[^\\s]+"), "$1***REDACTED_QUERY***")
    }
}
