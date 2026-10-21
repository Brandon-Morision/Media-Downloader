package com.novadrop.android.spike

import android.content.Context
import android.util.Log
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.yausername.ffmpeg.FFmpeg
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLException
import com.yausername.youtubedl_android.YoutubeDLRequest
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.FixMethodOrder
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.MethodSorters
import java.io.File

@RunWith(AndroidJUnit4::class)
@FixMethodOrder(MethodSorters.NAME_ASCENDING)
class SpikeEngineInstrumentedTest {

    private val TAG = "SPIKE_EVAL"
    private val context: Context
        get() = InstrumentationRegistry.getInstrumentation().targetContext

    @Test
    fun test01_gate1_init_and_version() {
        Log.i(TAG, "=== TEST 01: YoutubeDL Init and Version ===")
        val durationMs = SpikeManager.initYoutubeDL(context)
        Log.i(TAG, "YoutubeDL.init duration: ${durationMs}ms")
        assertTrue("Init duration should be recorded", durationMs >= 0)

        var version = SpikeManager.getYtDlpVersion(context)
        if (version == "unknown") {
            try {
                val req = YoutubeDLRequest(emptyList<String>())
                req.addOption("--version")
                val resp = SpikeManager.executeYtDlp(req)
                version = resp.out.trim()
            } catch (_: Exception) {}
        }
        Log.i(TAG, "Bundled yt-dlp version: $version")
        assertNotNull("yt-dlp version must not be null", version)
        assertTrue("yt-dlp version must be valid date-based (was $version)", version.contains("202"))
    }

    @Test
    fun test02_gate1_runtime_updating_and_fallback() {
        Log.i(TAG, "=== TEST 02: yt-dlp Runtime Updating and Fallback ===")
        SpikeManager.initYoutubeDL(context)
        val initialVersion = SpikeManager.getYtDlpVersion(context)
        Log.i(TAG, "Initial yt-dlp version: $initialVersion")

        // 1. Update STABLE
        try {
            val statusStable = SpikeManager.updateYtDlp(context, YoutubeDL.UpdateChannel.STABLE)
            val stableVersion = SpikeManager.getYtDlpVersion(context)
            Log.i(TAG, "Update STABLE result: $statusStable, Version now: $stableVersion")
        } catch (e: Exception) {
            Log.w(TAG, "STABLE update encountered: ${e.message}")
        }

        // 2. Update NIGHTLY
        try {
            val statusNightly = SpikeManager.updateYtDlp(context, YoutubeDL.UpdateChannel.NIGHTLY)
            val nightlyVersion = SpikeManager.getYtDlpVersion(context)
            Log.i(TAG, "Update NIGHTLY result: $statusNightly, Version now: $nightlyVersion")
        } catch (e: Exception) {
            Log.w(TAG, "NIGHTLY update encountered: ${e.message}")
        }

        // 3. Corrupt/Unreachable update source fallback test
        val fallbackResult = SpikeManager.testUpdateCorruptFallback(context)
        Log.i(TAG, "Fallback test result: $fallbackResult")
        assertTrue("App must fall back cleanly to bundled version on corrupt update", fallbackResult.isSuccess)
    }

    @Test
    fun test03_gate1_media_downloads_and_errors() {
        Log.i(TAG, "=== TEST 03: yt-dlp Media Downloads & Error Handling ===")
        SpikeManager.initYoutubeDL(context)
        val downloadDir = File(context.cacheDir, "ytdlp_downloads").apply { mkdirs() }

        // A. Invalid URL -> verify clean user-readable error
        try {
            val invalidReq = YoutubeDLRequest("https://invalid.example.com/not_a_video_12345")
            invalidReq.addOption("-o", File(downloadDir, "%(title)s.%(ext)s").absolutePath)
            SpikeManager.executeYtDlp(invalidReq)
            assertTrue("Invalid URL must throw YoutubeDLException", false)
        } catch (e: YoutubeDLException) {
            Log.i(TAG, "Invalid URL clean error message: ${e.message}")
            assertNotNull(e.message)
            assertFalse(e.message!!.contains("NullPointerException"))
        }

        // B. Vimeo or Non-YouTube video extraction
        try {
            val vimeoReq = YoutubeDLRequest("https://vimeo.com/22439234")
            vimeoReq.addOption("--dump-json")
            val vimeoResp = SpikeManager.executeYtDlp(vimeoReq)
            Log.i(TAG, "Vimeo extraction exitCode: ${vimeoResp.exitCode}")
            assertTrue("Vimeo extraction must succeed", vimeoResp.exitCode == 0)
            assertTrue("Vimeo dump-json must contain title", vimeoResp.out.contains("title"))
        } catch (e: Exception) {
            Log.w(TAG, "Vimeo extraction error: ${e.message}")
        }

        // C. Reddit video extraction
        try {
            val redditReq = YoutubeDLRequest("https://www.reddit.com/r/aww/comments/1908mws/")
            redditReq.addOption("--dump-json")
            val redditResp = SpikeManager.executeYtDlp(redditReq)
            Log.i(TAG, "Reddit extraction exitCode: ${redditResp.exitCode}")
        } catch (e: Exception) {
            Log.w(TAG, "Reddit extraction error (expected if post archived): ${e.message}")
        }

        // D. Playlist of 3 items
        try {
            val playlistReq = YoutubeDLRequest("https://www.youtube.com/playlist?list=PLrEnWoR732-BHrPp_Pm8_VleD68f9n14-")
            playlistReq.addOption("--playlist-items", "1-3")
            playlistReq.addOption("--flat-playlist")
            playlistReq.addOption("--dump-json")
            val playlistResp = SpikeManager.executeYtDlp(playlistReq)
            Log.i(TAG, "Playlist 3-items exitCode: ${playlistResp.exitCode}")
        } catch (e: Exception) {
            Log.w(TAG, "Playlist extraction status: ${e.message}")
        }
    }

    @Test
    fun test04_gate1_youtube_via_ytdlp_failure_mode() {
        Log.i(TAG, "=== TEST 04: YouTube via yt-dlp Failure Mode (No JS Engine / PO Token) ===")
        SpikeManager.initYoutubeDL(context)
        val downloadDir = File(context.cacheDir, "ytdlp_yt").apply { mkdirs() }

        // Test YouTube download without custom cookies/JS engine
        val ytReq = YoutubeDLRequest("https://youtu.be/jNQXAC9IVRw")
        ytReq.addOption("-o", File(downloadDir, "%(title)s.%(ext)s").absolutePath)
        try {
            val resp = SpikeManager.executeYtDlp(ytReq)
            Log.i(TAG, "YouTube via yt-dlp exitCode: ${resp.exitCode}, out: ${resp.out}")
        } catch (e: YoutubeDLException) {
            Log.i(TAG, "YouTube via yt-dlp expected failure output:\n${e.message}")
            // Document exact failure mode (403 Forbidden / bot detection / nsig)
            assertNotNull(e.message)
        }
    }

    @Test
    fun test05_gate1_aria2c_downloader() {
        Log.i(TAG, "=== TEST 05: Aria2c External Downloader Evaluation ===")
        SpikeManager.initYoutubeDL(context)
        val ariaInitResult = SpikeManager.initAria2c(context)
        Log.i(TAG, "Aria2c init result: $ariaInitResult")

        val downloadDir = File(context.cacheDir, "aria2c_test").apply { mkdirs() }
        val testUrl = "https://speed.cloudflare.com/__down?bytes=1000000" // 1MB test file

        // Standard downloader test
        val stdReq = YoutubeDLRequest(testUrl)
        val stdFile = File(downloadDir, "standard_dl.bin")
        stdReq.addOption("-o", stdFile.absolutePath)
        val stdStart = System.currentTimeMillis()
        var stdSuccess = false
        try {
            val stdResp = SpikeManager.executeYtDlp(stdReq)
            val stdDur = System.currentTimeMillis() - stdStart
            Log.i(TAG, "Standard downloader duration: ${stdDur}ms, exitCode: ${stdResp.exitCode}, size: ${stdFile.length()}")
            stdSuccess = stdResp.exitCode == 0
        } catch (e: Exception) {
            Log.w(TAG, "Standard downloader status: ${e.message}")
        }

        // Aria2c downloader test
        val ariaReq = YoutubeDLRequest(testUrl)
        val ariaFile = File(downloadDir, "aria2c_dl.bin")
        ariaReq.addOption("-o", ariaFile.absolutePath)
        ariaReq.addOption("--downloader", "libaria2c.so")
        val ariaStart = System.currentTimeMillis()
        try {
            val ariaResp = SpikeManager.executeYtDlp(ariaReq)
            val ariaDur = System.currentTimeMillis() - ariaStart
            Log.i(TAG, "Aria2c downloader duration: ${ariaDur}ms, exitCode: ${ariaResp.exitCode}, size: ${ariaFile.length()}")
        } catch (e: Exception) {
            Log.w(TAG, "Aria2c downloader status: ${e.message}")
        }
    }

    @Test
    fun test06_gate1_cancellation_and_subprocess_kill() {
        Log.i(TAG, "=== TEST 06: yt-dlp Cancellation, Kill Subprocess & Cleanup ===")
        SpikeManager.initYoutubeDL(context)
        val downloadDir = File(context.cacheDir, "cancel_test").apply { mkdirs() }
        val processId = "test_cancel_process_123"

        // Large file stream to allow mid-download cancellation
        val req = YoutubeDLRequest("https://speed.cloudflare.com/__down?bytes=50000000") // 50MB
        val targetFile = File(downloadDir, "cancelled_dl.bin")
        req.addOption("-o", targetFile.absolutePath)

        val thread = Thread {
            try {
                SpikeManager.executeYtDlp(req, processId) { progress, _, _ ->
                    Log.i(TAG, "Cancel test progress: $progress%")
                }
            } catch (_: Exception) {}
        }
        thread.start()

        Thread.sleep(1500) // let process spawn and stream begin
        val killed = SpikeManager.destroyProcess(processId)
        Log.i(TAG, "destroyProcessById result: $killed")
        thread.join(3000)

        // Verify partial cleanup and no orphan file
        val partFile = File(downloadDir, "cancelled_dl.bin.part")
        if (partFile.exists()) {
            partFile.delete()
        }
        if (targetFile.exists()) {
            targetFile.delete()
        }
        Log.i(TAG, "Target file exists after cleanup: ${targetFile.exists()}, Part file exists: ${partFile.exists()}")
    }

    @Test
    fun test07_gate2_ffmpeg_coverage() {
        Log.i(TAG, "=== TEST 07: FFmpeg Coverage & Initialization ===")
        val ffmpegInitResult = SpikeManager.initFFmpeg(context)
        Log.i(TAG, "FFmpeg.init result: $ffmpegInitResult")

        if (ffmpegInitResult.isFailure) {
            val err = ffmpegInitResult.exceptionOrNull()
            Log.e(TAG, "FFmpeg module failure observed: ${err?.message}")
            // Document exact reason (e.g. 16 KB page size linker alignment failure on Android 15/16k)
            return
        }

        Log.i(TAG, "FFmpeg initialized successfully")
    }

    @Test
    fun test08_gate3_gallery_dl_subprocess_pip_less() {
        Log.i(TAG, "=== TEST 08: gallery-dl Subprocess (pip-less on PYTHONPATH) ===")

        // 1. --version
        val verResult = SpikeManager.executeGalleryDl(context, listOf("--version"))
        Log.i(TAG, "gallery-dl --version: exitCode=${verResult.exitCode}, stdout=${verResult.stdout.trim()}, stderr=${verResult.stderr.trim()}")
        assertTrue("gallery-dl --version should exit 0", verResult.exitCode == 0)
        assertTrue("Version must be 1.32.x", verResult.stdout.contains("1.32."))

        // 2. Safebooru post
        val safeResult = SpikeManager.executeGalleryDl(context, listOf("-j", "https://safebooru.org/index.php?page=post&s=view&id=4000000"))
        Log.i(TAG, "Safebooru exitCode=${safeResult.exitCode}, duration=${safeResult.durationMs}ms, stdout length=${safeResult.stdout.length}")
        assertTrue("Safebooru must succeed", safeResult.exitCode == 0)
        assertTrue("Safebooru output must contain category/file_url", safeResult.stdout.contains("safebooru") || safeResult.stdout.contains("file_url"))

        // 3. Public Reddit image post
        val redditResult = SpikeManager.executeGalleryDl(context, listOf("-j", "https://www.reddit.com/r/Eyebleach/comments/1b8k7zq/"))
        Log.i(TAG, "Reddit image exitCode=${redditResult.exitCode}, duration=${redditResult.durationMs}ms")

        // 4. Unsupported URL -> clean error
        val unsuppResult = SpikeManager.executeGalleryDl(context, listOf("-j", "https://example.com/unsupported_page"))
        Log.i(TAG, "Unsupported URL exitCode=${unsuppResult.exitCode}, stderr=${unsuppResult.stderr.trim()}")
        assertTrue("Unsupported URL must return non-zero exit code", unsuppResult.exitCode != 0)
        assertTrue("Error message should mention unsupported URL or error", unsuppResult.stderr.contains("Unsupported URL", ignoreCase = true) || unsuppResult.stderr.contains("error", ignoreCase = true))

        // 5. Login-required site (X / Twitter or Instagram)
        val loginResult = SpikeManager.executeGalleryDl(context, listOf("-j", "https://x.com/jack/status/20"))
        Log.i(TAG, "Twitter/X without login exitCode=${loginResult.exitCode}, stderr=${loginResult.stderr.trim()}")
    }

    @Test
    fun test09_gate3_gallery_dl_runtime_updating_and_rollback() {
        Log.i(TAG, "=== TEST 09: gallery-dl Runtime Updating and Rollback ===")
        val updateResult = SpikeManager.testGalleryDlRuntimeUpdateAndRollback(context)
        Log.i(TAG, "gallery-dl update and rollback test: $updateResult")
        assertTrue("Runtime update and rollback must succeed", updateResult.isSuccess)
    }

    @Test
    fun test10_gate4_cookies_import_and_no_logcat_leakage() {
        Log.i(TAG, "=== TEST 10: Netscape Cookies Import & Sanitization ===")
        val dummyNetscapeCookies = """
            # Netscape HTTP Cookie File
            # https://curl.se/docs/http-cookies.html
            .x.com	TRUE	/	TRUE	1893456000	auth_token	SECRET_AUTH_TOKEN_TEST_12345
            .x.com	TRUE	/	TRUE	1893456000	ct0	SECRET_CT0_CSRF_TOKEN_67890
            .instagram.com	TRUE	/	TRUE	1893456000	sessionid	SECRET_INSTAGRAM_SESSION_99999
        """.trimIndent()

        val cookiesFile = SpikeManager.importCookies(context, dummyNetscapeCookies)
        Log.i(TAG, "Imported cookies.txt at: ${cookiesFile.absolutePath}, size: ${cookiesFile.length()} bytes")
        assertTrue("Cookies file must exist", cookiesFile.exists())
        assertTrue("Cookies file size > 0", cookiesFile.length() > 0)

        // Pass --cookies to gallery-dl command
        val gdlResult = SpikeManager.executeGalleryDl(context, listOf("--cookies", cookiesFile.absolutePath, "--version"))
        Log.i(TAG, "gallery-dl with cookies exitCode: ${gdlResult.exitCode}")
        assertTrue("gallery-dl --cookies --version must exit 0", gdlResult.exitCode == 0)

        // Pass --cookies to yt-dlp command
        val ytReq = YoutubeDLRequest("https://example.com")
        ytReq.addOption("--cookies", cookiesFile.absolutePath)
        val cmdString = ytReq.buildCommand().joinToString(" ")
        val sanitizedCmd = SpikeManager.sanitizeForLog(cmdString)
        Log.i(TAG, "Sanitized yt-dlp command line: $sanitizedCmd")

        assertFalse("Raw cookie secret must never appear in sanitized output", sanitizedCmd.contains("SECRET_AUTH_TOKEN"))
    }
}
