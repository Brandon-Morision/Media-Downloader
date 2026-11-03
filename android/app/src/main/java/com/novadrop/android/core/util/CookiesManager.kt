package com.novadrop.android.core.util

import android.content.Context
import android.net.Uri
import android.util.Log
import java.io.File
import java.io.FileOutputStream

/**
 * Manages import, persistence, permission masking, and lifecycle of the Netscape `cookies.txt` file.
 *
 * Security Guarantees:
 * 1. Storage is strictly within app-private directory: `files/cookies/cookies.txt`.
 * 2. File permissions are restricted to owner-only read/write (`600` via POSIX attributes / file permissions).
 * 3. Cookie data is NEVER written to Android Logcat or any telemetry pipeline.
 */
object CookiesManager {

    private const val TAG = "CookiesManager"
    private const val COOKIES_DIR_NAME = "cookies"
    private const val COOKIES_FILE_NAME = "cookies.txt"

    /**
     * Resolves the app-private [File] for `cookies.txt`.
     */
    fun getCookiesFile(context: Context): File {
        val dir = File(context.filesDir, COOKIES_DIR_NAME)
        if (!dir.exists()) {
            dir.mkdirs()
            dir.setReadable(true, true)
            dir.setWritable(true, true)
            dir.setExecutable(true, true) // Required to traverse directory
        }
        return File(dir, COOKIES_FILE_NAME)
    }

    /**
     * Returns true if a valid, non-empty `cookies.txt` exists in app-private storage.
     */
    fun hasCookies(context: Context): Boolean {
        val file = getCookiesFile(context)
        return file.exists() && file.isFile && file.length() > 0
    }

    /**
     * Returns the size of `cookies.txt` in bytes, or 0 if missing.
     */
    fun getCookiesSizeBytes(context: Context): Long {
        val file = getCookiesFile(context)
        return if (file.exists() && file.isFile) file.length() else 0L
    }

    /**
     * Imports a `cookies.txt` file from a Storage Access Framework (SAF) [Uri].
     * Copies the content to app-private storage, sets mode 600, and returns the file size.
     * Note: Cookie values are strictly preserved without parsing or logging.
     */
    fun importCookies(context: Context, sourceUri: Uri): Result<Long> {
        return try {
            val targetFile = getCookiesFile(context)
            if (targetFile.exists()) {
                targetFile.delete()
            }

            val inputStream = context.contentResolver.openInputStream(sourceUri)
                ?: return Result.failure(IllegalStateException("Could not open input stream from selected URI"))

            FileOutputStream(targetFile).use { outputStream ->
                inputStream.use { input ->
                    input.copyTo(outputStream)
                }
            }

            // Set strict owner-only permissions (mode 600)
            targetFile.setReadable(false, false)
            targetFile.setReadable(true, true)   // Owner read only
            targetFile.setWritable(false, false)
            targetFile.setWritable(true, true)   // Owner write only
            targetFile.setExecutable(false, false) // Not executable

            val size = targetFile.length()
            Log.i(TAG, "Successfully imported cookies.txt (size=$size bytes, permissions=600)")
            Result.success(size)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to import cookies: ${e.message}")
            Result.failure(e)
        }
    }

    /**
     * Deletes the active `cookies.txt` file from app-private storage upon user request.
     */
    fun deleteCookies(context: Context): Boolean {
        return try {
            val file = getCookiesFile(context)
            val deleted = if (file.exists()) file.delete() else true
            Log.i(TAG, "Deleted cookies.txt: $deleted")
            deleted
        } catch (e: Exception) {
            Log.e(TAG, "Failed to delete cookies: ${e.message}")
            false
        }
    }
}
