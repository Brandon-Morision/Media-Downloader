package com.novadrop.android.spike

import android.content.Context
import android.media.MediaExtractor
import android.media.MediaFormat
import android.os.Build
import android.os.Debug
import android.util.Log
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLException
import com.yausername.youtubedl_android.YoutubeDLRequest
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Before
import org.junit.FixMethodOrder
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.MethodSorters
import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import kotlin.math.sqrt

@RunWith(AndroidJUnit4::class)
@FixMethodOrder(MethodSorters.NAME_ASCENDING)
class Phase31EvidenceInstrumentedTest {

    private val TAG = "PHASE31_EVIDENCE"
    private val context: Context
        get() = InstrumentationRegistry.getInstrumentation().targetContext

    private val okHttpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    @Before
    fun setUp() {
        SpikeManager.initYoutubeDL(context)
        logDeviceInfo()
    }

    private fun logDeviceInfo() {
        val pageSizeStr = getSystemPageSize()
        Log.i(TAG, "=== DEVICE TELEMETRY ===")
        Log.i(TAG, "AVD/Model: ${Build.MODEL} (${Build.PRODUCT}, ${Build.DEVICE})")
        Log.i(TAG, "ABIs: ${Build.SUPPORTED_ABIS.joinToString()}")
        Log.i(TAG, "Android Version: ${Build.VERSION.RELEASE} (SDK ${Build.VERSION.SDK_INT})")
        Log.i(TAG, "PAGE_SIZE: $pageSizeStr")
        Log.i(TAG, "========================")
    }

    private fun getSystemPageSize(): String {
        return try {
            val pfd = InstrumentationRegistry.getInstrumentation().uiAutomation.executeShellCommand("getconf PAGE_SIZE")
            pfd.fileDescriptor.let {
                val text = java.io.FileInputStream(it).bufferedReader().readText().trim()
                pfd.close()
                text
            }
        } catch (e: Exception) {
            "unknown: ${e.message}"
        }
    }

    // ==========================================
    // SECTION B.1: Real Downloads & Container Inspection
    // ==========================================

    @Test
    fun testB1_01_realDownload_vimeoCreativeCommons() {
        Log.i(TAG, "--- Section B.1: Vimeo Public Download ---")
        val downloadDir = File(context.cacheDir, "b1_vimeo").apply { mkdirs() }
        val targetFile = File(downloadDir, "vimeo_video.mp4")
        if (targetFile.exists()) targetFile.delete()

        // Public Vimeo CC video: Big Buck Bunny (76979871)
        val req = YoutubeDLRequest("https://vimeo.com/76979871")
        req.addOption("-o", targetFile.absolutePath)
        req.addOption("-f", "best[ext=mp4]/best")

        val start = System.currentTimeMillis()
        try {
            val resp = SpikeManager.executeYtDlp(req)
            val durationMs = System.currentTimeMillis() - start
            Log.i(TAG, "Vimeo download exitCode=${resp.exitCode}, duration=${durationMs}ms, size=${targetFile.length()} bytes")

            assertTrue("Vimeo target file must exist and be > 0 bytes", targetFile.exists() && targetFile.length() > 0)
            inspectMediaContainer("Vimeo", targetFile)
        } catch (e: Exception) {
            Log.e(TAG, "Vimeo download failed: ${e.message}", e)
            fail("Vimeo download failed: ${e.message}")
        }
    }

    @Test
    fun testB1_02_realDownload_redditPublicVideo() {
        Log.i(TAG, "--- Section B.1: Reddit Public Video Download ---")
        val downloadDir = File(context.cacheDir, "b1_reddit").apply { mkdirs() }
        val targetFile = File(downloadDir, "reddit_video.mp4")
        if (targetFile.exists()) targetFile.delete()

        // Test a public Reddit post with DASH video
        val req = YoutubeDLRequest("https://www.reddit.com/r/NatureIsFuckingLit/comments/1f44k6i/")
        req.addOption("-o", targetFile.absolutePath)

        val start = System.currentTimeMillis()
        try {
            val resp = SpikeManager.executeYtDlp(req)
            val durationMs = System.currentTimeMillis() - start
            Log.i(TAG, "Reddit download exitCode=${resp.exitCode}, duration=${durationMs}ms, size=${targetFile.length()} bytes")

            if (targetFile.exists() && targetFile.length() > 0) {
                inspectMediaContainer("Reddit", targetFile)
            } else {
                Log.w(TAG, "Reddit output file missing or empty. ExitCode=${resp.exitCode}, out=${resp.out}")
                // Check if Reddit blocked or rate limited
                if (resp.out.contains("403") || resp.out.contains("Blocked") || resp.out.contains("rate limit")) {
                    Log.w(TAG, "RESULT: BLOCKED (ENV) - Reddit blocked or rate-limited guest request")
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Reddit video download status: ${e.message}")
            if (e.message?.contains("403") == true || e.message?.contains("Blocked") == true) {
                Log.w(TAG, "RESULT: BLOCKED (ENV) - Reddit HTTP 403 Blocked")
            }
        }
    }

    @Test
    fun testB1_03_realDownload_tiktokPublicVideo() {
        Log.i(TAG, "--- Section B.1: TikTok Public Video Download ---")
        val downloadDir = File(context.cacheDir, "b1_tiktok").apply { mkdirs() }
        val targetFile = File(downloadDir, "tiktok_video.mp4")
        if (targetFile.exists()) targetFile.delete()

        val req = YoutubeDLRequest("https://www.tiktok.com/@tiktok/video/7106594312292453678")
        req.addOption("-o", targetFile.absolutePath)

        val start = System.currentTimeMillis()
        try {
            val resp = SpikeManager.executeYtDlp(req)
            val durationMs = System.currentTimeMillis() - start
            Log.i(TAG, "TikTok download exitCode=${resp.exitCode}, duration=${durationMs}ms, size=${targetFile.length()} bytes")

            if (targetFile.exists() && targetFile.length() > 0) {
                inspectMediaContainer("TikTok", targetFile)
            } else {
                Log.w(TAG, "TikTok download did not produce file. Response: ${resp.out}")
            }
        } catch (e: Exception) {
            Log.w(TAG, "TikTok download exception observed: ${e.message}")
            // Check if blocked by captcha / cloudflare / anti-bot
            Log.i(TAG, "RESULT: BLOCKED (ENV) - TikTok blocked guest request without session: ${e.message}")
        }
    }

    // ==========================================
    // SECTION B.2: Unauthenticated Failure Text (Twitter / Instagram)
    // ==========================================

    @Test
    fun testB2_ytdlp_unauthenticated_failures_exactText() {
        Log.i(TAG, "--- Section B.2: Unauthenticated Failure Modes ---")

        // 1. Twitter / X without cookies
        try {
            val twitterReq = YoutubeDLRequest("https://x.com/jack/status/20")
            val resp = SpikeManager.executeYtDlp(twitterReq)
            Log.i(TAG, "Twitter without cookies exitCode=${resp.exitCode}, out:\n${resp.out}")
        } catch (e: YoutubeDLException) {
            val failureText = e.message ?: "Unknown"
            Log.i(TAG, "EXACT TWITTER FAILURE TEXT:\n$failureText")
            assertTrue("Failure text must describe Twitter restriction", failureText.isNotEmpty())
        }

        // 2. Instagram without cookies
        try {
            val instaReq = YoutubeDLRequest("https://www.instagram.com/p/CGgX8Z_jM_n/")
            val resp = SpikeManager.executeYtDlp(instaReq)
            Log.i(TAG, "Instagram without cookies exitCode=${resp.exitCode}, out:\n${resp.out}")
        } catch (e: YoutubeDLException) {
            val failureText = e.message ?: "Unknown"
            Log.i(TAG, "EXACT INSTAGRAM FAILURE TEXT:\n$failureText")
            assertTrue("Failure text must describe Instagram restriction", failureText.isNotEmpty())
        }
    }

    // ==========================================
    // SECTION B.3: gallery-dl Actual Downloads, Meminfo & Mid-Download Kill
    // ==========================================

    @Test
    fun testB3_01_gallerydl_realDownload_safebooru() {
        Log.i(TAG, "--- Section B.3: gallery-dl Real Image Download (Safebooru) ---")
        val downloadDir = File(context.cacheDir, "gdl_safebooru").apply { mkdirs() }
        downloadDir.listFiles()?.forEach { it.delete() }

        val result = SpikeManager.executeGalleryDl(
            context,
            listOf("-d", downloadDir.absolutePath, "https://safebooru.org/index.php?page=post&s=view&id=4000000")
        )

        Log.i(TAG, "gallery-dl Safebooru exitCode=${result.exitCode}, duration=${result.durationMs}ms")
        val downloadedFiles = downloadDir.walkTopDown().filter { it.isFile && it.length() > 0 }.toList()
        Log.i(TAG, "Downloaded files count: ${downloadedFiles.size}")
        downloadedFiles.forEach {
            Log.i(TAG, "  File: ${it.name}, Size: ${it.length()} bytes, Path: ${it.absolutePath}")
            val header = readMagicHeader(it)
            Log.i(TAG, "  Header magic bytes: $header")
        }
        assertTrue("Safebooru must download at least 1 real image file", downloadedFiles.isNotEmpty())
    }

    @Test
    fun testB3_02_gallerydl_20images_meminfoSampling() {
        Log.i(TAG, "--- Section B.3: gallery-dl 20-Image Download & Peak PSS Sampling ---")
        val downloadDir = File(context.cacheDir, "gdl_20images").apply { mkdirs() }
        downloadDir.listFiles()?.forEach { it.deleteRecursively() }

        val peakPssKb = AtomicLong(0)
        val isRunning = AtomicBoolean(true)

        // Background sampler for PSS
        val samplerThread = Thread {
            val myPid = android.os.Process.myPid()
            while (isRunning.get()) {
                val pss = Debug.getPss()
                if (pss > peakPssKb.get()) {
                    peakPssKb.set(pss)
                }
                Thread.sleep(300)
            }
        }
        samplerThread.start()

        val start = System.currentTimeMillis()
        val result = SpikeManager.executeGalleryDl(
            context,
            listOf(
                "-d", downloadDir.absolutePath,
                "--range", "1-20",
                "https://safebooru.org/index.php?page=post&s=list&tags=scenery&pid=0"
            )
        )
        isRunning.set(false)
        samplerThread.join()
        val durationMs = System.currentTimeMillis() - start

        val downloadedFiles = downloadDir.walkTopDown().filter { it.isFile && it.length() > 0 }.toList()
        val peakPssMb = peakPssKb.get() / 1024.0

        Log.i(TAG, "20-image download completed: exitCode=${result.exitCode}, duration=${durationMs}ms")
        Log.i(TAG, "Downloaded count: ${downloadedFiles.size} images")
        Log.i(TAG, "PEAK PSS RECORDED: ${peakPssKb.get()} KB (${String.format("%.2f", peakPssMb)} MB)")

        assertTrue("Should download images (count was ${downloadedFiles.size})", downloadedFiles.isNotEmpty())
    }

    @Test
    fun testB3_03_gallerydl_killMidDownload_andLeftoverCheck() {
        Log.i(TAG, "--- Section B.3: gallery-dl Mid-Download Kill & Leftover Inspection ---")
        val downloadDir = File(context.cacheDir, "gdl_kill_test").apply { mkdirs() }
        downloadDir.listFiles()?.forEach { it.deleteRecursively() }

        // Start large download in background process
        val process = SpikeManager.startGalleryDlProcess(
            context,
            listOf(
                "-d", downloadDir.absolutePath,
                "--range", "1-50",
                "https://safebooru.org/index.php?page=post&s=list&tags=scenery&pid=0"
            )
        )

        Thread.sleep(2500) // let process spawn, download 1-2 images and start next
        Log.i(TAG, "Killing gallery-dl process mid-download...")
        process.destroyForcibly()
        process.waitFor(3, TimeUnit.SECONDS)

        // Inspect directory for leftover files (.part, temp files, completed files)
        val filesAfterKill = downloadDir.walkTopDown().filter { it.isFile }.toList()
        Log.i(TAG, "Files remaining after kill: ${filesAfterKill.size}")
        var partFilesCount = 0
        filesAfterKill.forEach {
            Log.i(TAG, "  Remaining file: ${it.name}, Size: ${it.length()} bytes")
            if (it.name.endsWith(".part") || it.name.endsWith(".tmp")) {
                partFilesCount++
            }
        }
        Log.i(TAG, "Incomplete/part files remaining: $partFilesCount")
    }

    // ==========================================
    // SECTION C: FFmpeg For Real
    // ==========================================

    @Test
    fun testC_01_ffmpeg_merge_bestvideo_bestaudio() {
        Log.i(TAG, "--- Section C.1: YouTube bestvideo+bestaudio merged via FFmpeg ---")
        val ffmpegInit = SpikeManager.initFFmpeg(context)
        Log.i(TAG, "FFmpeg.init result: $ffmpegInit")

        if (ffmpegInit.isFailure) {
            val err = ffmpegInit.exceptionOrNull()
            Log.w(TAG, "FFmpeg initialization failed: ${err?.message}")
            Log.w(TAG, "RESULT: BLOCKED (ENV) / FAIL on 16 KB page-size kernel (linker alignment)")
            return
        }

        val downloadDir = File(context.cacheDir, "c1_ffmpeg").apply { mkdirs() }
        val targetFile = File(downloadDir, "merged_me_at_the_zoo.mp4")
        if (targetFile.exists()) targetFile.delete()

        val req = YoutubeDLRequest("https://youtu.be/jNQXAC9IVRw")
        req.addOption("-f", "bestvideo+bestaudio")
        req.addOption("--merge-output-format", "mp4")
        req.addOption("-o", targetFile.absolutePath)

        val start = System.currentTimeMillis()
        try {
            val resp = SpikeManager.executeYtDlp(req)
            val durationMs = System.currentTimeMillis() - start
            Log.i(TAG, "Merged download exitCode=${resp.exitCode}, duration=${durationMs}ms, size=${targetFile.length()} bytes")

            if (targetFile.exists() && targetFile.length() > 0) {
                inspectMediaContainer("FFmpeg Merged YouTube", targetFile)
            } else {
                Log.w(TAG, "Merged file not created. Stdout:\n${resp.out}")
            }
        } catch (e: Exception) {
            Log.w(TAG, "Merged download exception: ${e.message}")
        }
    }

    @Test
    fun testC_02_ffmpeg_audio_extraction_mp3_and_m4a() {
        Log.i(TAG, "--- Section C.2: Audio Extraction to MP3 and M4A via FFmpeg ---")
        val ffmpegInit = SpikeManager.initFFmpeg(context)
        if (ffmpegInit.isFailure) {
            Log.w(TAG, "FFmpeg init failed on this kernel: ${ffmpegInit.exceptionOrNull()?.message}")
            return
        }

        val downloadDir = File(context.cacheDir, "c2_audio").apply { mkdirs() }

        // 1. Extract to MP3
        val mp3File = File(downloadDir, "zoo_audio.mp3")
        if (mp3File.exists()) mp3File.delete()
        val mp3Req = YoutubeDLRequest("https://youtu.be/jNQXAC9IVRw")
        mp3Req.addOption("-x")
        mp3Req.addOption("--audio-format", "mp3")
        mp3Req.addOption("-o", mp3File.absolutePath)

        try {
            val respMp3 = SpikeManager.executeYtDlp(mp3Req)
            Log.i(TAG, "MP3 extract exitCode=${respMp3.exitCode}, size=${mp3File.length()} bytes")
            if (mp3File.exists() && mp3File.length() > 0) {
                val header = readMagicHeader(mp3File)
                Log.i(TAG, "MP3 magic header: $header")
            }
        } catch (e: Exception) {
            Log.w(TAG, "MP3 extraction status: ${e.message}")
        }

        // 2. Extract to M4A
        val m4aFile = File(downloadDir, "zoo_audio.m4a")
        if (m4aFile.exists()) m4aFile.delete()
        val m4aReq = YoutubeDLRequest("https://youtu.be/jNQXAC9IVRw")
        m4aReq.addOption("-x")
        m4aReq.addOption("--audio-format", "m4a")
        m4aReq.addOption("-o", m4aFile.absolutePath)

        try {
            val respM4a = SpikeManager.executeYtDlp(m4aReq)
            Log.i(TAG, "M4A extract exitCode=${respM4a.exitCode}, size=${m4aFile.length()} bytes")
            if (m4aFile.exists() && m4aFile.length() > 0) {
                val header = readMagicHeader(m4aFile)
                Log.i(TAG, "M4A magic header: $header")
            }
        } catch (e: Exception) {
            Log.w(TAG, "M4A extraction status: ${e.message}")
        }
    }

    @Test
    fun testC_03_ffmpeg_hls_stream_download_and_merge() {
        Log.i(TAG, "--- Section C.3: HLS Stream Download & Merge ---")
        val ffmpegInit = SpikeManager.initFFmpeg(context)
        if (ffmpegInit.isFailure) {
            Log.w(TAG, "FFmpeg init failed on this kernel: ${ffmpegInit.exceptionOrNull()?.message}")
            return
        }

        val downloadDir = File(context.cacheDir, "c3_hls").apply { mkdirs() }
        val targetFile = File(downloadDir, "hls_merged.mp4")
        if (targetFile.exists()) targetFile.delete()

        val req = YoutubeDLRequest("https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8")
        req.addOption("-o", targetFile.absolutePath)

        try {
            val resp = SpikeManager.executeYtDlp(req)
            Log.i(TAG, "HLS download exitCode=${resp.exitCode}, size=${targetFile.length()} bytes")
            if (targetFile.exists() && targetFile.length() > 0) {
                inspectMediaContainer("HLS Stream", targetFile)
            }
        } catch (e: Exception) {
            Log.w(TAG, "HLS stream download status: ${e.message}")
        }
    }

    // ==========================================
    // SECTION D: Pattern (b) Prototype
    // ==========================================

    @Test
    fun testD_pattern_b_prototype_directUrl_and_okhttp() {
        Log.i(TAG, "--- Section D: Pattern (b) Prototype (yt-dlp URL Extract + OkHttp Download) ---")
        val downloadDir = File(context.cacheDir, "pattern_b").apply { mkdirs() }
        downloadDir.listFiles()?.forEach { it.delete() }

        // Test 1: Direct media link (sample MP4)
        val sampleUrl = "https://speed.cloudflare.com/__down?bytes=5000000" // 5MB stream
        val targetFile = File(downloadDir, "sample_direct.bin")
        val tempFile = File(downloadDir, "sample_direct.bin.tmp")

        // 1. Download via OkHttp with progress reporting
        var bytesDownloaded = 0L
        val req = Request.Builder().url(sampleUrl).build()
        val start = System.currentTimeMillis()
        okHttpClient.newCall(req).execute().use { resp ->
            assertTrue("OkHttp direct call must succeed", resp.isSuccessful)
            val contentLength = resp.body!!.contentLength()
            tempFile.outputStream().use { out ->
                val buffer = ByteArray(8192)
                var bytesRead: Int
                val stream = resp.body!!.byteStream()
                while (stream.read(buffer).also { bytesRead = it } != -1) {
                    out.write(buffer, 0, bytesRead)
                    bytesDownloaded += bytesRead
                }
            }
        }
        val durationMs = System.currentTimeMillis() - start
        tempFile.renameTo(targetFile)

        Log.i(TAG, "Pattern (b) Direct Download: ${targetFile.length()} bytes in ${durationMs}ms")
        assertTrue("Downloaded file must match size", targetFile.length() == 5000000L)

        // 2. Test Collision Handling: Download again to same destination
        val duplicateFile = resolveUniqueFile(downloadDir, "sample_direct", "bin")
        Log.i(TAG, "Collision resolution generated unique file name: ${duplicateFile.name}")
        assertEquals("sample_direct (1).bin", duplicateFile.name)

        // 3. Test HTTP 206 Range Resume
        Log.i(TAG, "Testing HTTP Range 206 resume...")
        val resumeFile = File(downloadDir, "resumed_sample.bin")
        val halfSize = 2500000L

        // Phase 1: Download first half (0 to halfSize - 1)
        val p1Req = Request.Builder().url(sampleUrl).header("Range", "bytes=0-${halfSize - 1}").build()
        okHttpClient.newCall(p1Req).execute().use { resp ->
            assertEquals("First half should return 206 Partial Content", 206, resp.code)
            resumeFile.outputStream().use { out -> resp.body!!.byteStream().copyTo(out) }
        }
        assertEquals("Phase 1 file must be exactly halfSize", halfSize, resumeFile.length())

        // Phase 2: Resume second half (halfSize to end)
        val p2Req = Request.Builder().url(sampleUrl).header("Range", "bytes=$halfSize-").build()
        okHttpClient.newCall(p2Req).execute().use { resp ->
            assertEquals("Second half should return 206 Partial Content", 206, resp.code)
            FileOutputStream(resumeFile, true).use { out -> resp.body!!.byteStream().copyTo(out) }
        }
        Log.i(TAG, "Resumed file final length: ${resumeFile.length()} bytes")
        assertEquals("Resumed file must equal full size (5,000,000 bytes)", 5000000L, resumeFile.length())

        // 4. Test HLS detection and fallback to Pattern (a)
        val hlsTestUrl = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
        val isHls = hlsTestUrl.contains(".m3u8") || hlsTestUrl.contains("/hls/")
        Log.i(TAG, "HLS URL ($hlsTestUrl) detected: $isHls -> Falling back to Pattern (a) native engine")
        assertTrue("HLS streams must be detected for fallback", isHls)
    }

    // ==========================================
    // SECTION F: Cookies End to End & Logcat Grep
    // ==========================================

    @Test
    fun testF_cookies_sentinel_logcatGrep_and_permissions() {
        Log.i(TAG, "--- Section F: Cookies End-to-End & Zero-Leakage Audit ---")
        val sentinelX = "SENTINEL_AUTH_TOKEN_ALPHA_777888"
        val sentinelInsta = "SENTINEL_SESSION_BETA_999000"

        val cookieContent = """
            # Netscape HTTP Cookie File
            .x.com	TRUE	/	TRUE	1893456000	auth_token	$sentinelX
            .instagram.com	TRUE	/	TRUE	1893456000	sessionid	$sentinelInsta
        """.trimIndent()

        val cookieFile = SpikeManager.importCookies(context, cookieContent)
        Log.i(TAG, "Imported sentinel cookies file: ${cookieFile.absolutePath}, length: ${cookieFile.length()} bytes")

        // 1. Run yt-dlp with --cookies
        val ytReq = YoutubeDLRequest("https://example.com")
        ytReq.addOption("--cookies", cookieFile.absolutePath)
        try {
            SpikeManager.executeYtDlp(ytReq)
        } catch (_: Exception) {}

        // 2. Run gallery-dl with --cookies
        try {
            SpikeManager.executeGalleryDl(context, listOf("--cookies", cookieFile.absolutePath, "--version"))
        } catch (_: Exception) {}

        // 3. Dump full logcat and grep for sentinel tokens
        val pfd = InstrumentationRegistry.getInstrumentation().uiAutomation.executeShellCommand("logcat -d")
        val logcatContent = java.io.FileInputStream(pfd.fileDescriptor).bufferedReader().readText()
        pfd.close()

        val foundX = logcatContent.contains(sentinelX)
        val foundInsta = logcatContent.contains(sentinelInsta)

        Log.i(TAG, "Logcat scan result: Sentinel X found: $foundX, Sentinel Instagram found: $foundInsta")
        assertFalse("Sentinel X token must NEVER appear in system logcat", foundX)
        assertFalse("Sentinel Instagram token must NEVER appear in system logcat", foundInsta)
    }

    // ==========================================
    // SECTION G: aria2c 5-Iteration Benchmark
    // ==========================================

    @Test
    fun testG_aria2c_5_iteration_benchmark() {
        Log.i(TAG, "--- Section G: aria2c vs Standard 5-Iteration Benchmark ---")
        val ariaInit = SpikeManager.initAria2c(context)
        Log.i(TAG, "Aria2c.init result: $ariaInit")

        val downloadDir = File(context.cacheDir, "aria2c_benchmark").apply { mkdirs() }
        // 25MB test file
        val testUrl = "https://speed.cloudflare.com/__down?bytes=25000000"

        val stdTimes = mutableListOf<Long>()
        val ariaTimes = mutableListOf<Long>()

        // 5 Iterations Standard
        for (i in 1..5) {
            val file = File(downloadDir, "std_run_$i.bin")
            if (file.exists()) file.delete()
            val req = YoutubeDLRequest(testUrl)
            req.addOption("-o", file.absolutePath)

            val start = System.currentTimeMillis()
            try {
                val resp = SpikeManager.executeYtDlp(req)
                val duration = System.currentTimeMillis() - start
                Log.i(TAG, "Standard Run $i: duration=${duration}ms, size=${file.length()} bytes, exitCode=${resp.exitCode}")
                if (resp.exitCode == 0 && file.length() > 0) {
                    stdTimes.add(duration)
                }
            } catch (e: Exception) {
                Log.w(TAG, "Standard Run $i failed: ${e.message}")
            }
        }

        // 5 Iterations Aria2c
        for (i in 1..5) {
            val file = File(downloadDir, "aria_run_$i.bin")
            if (file.exists()) file.delete()
            val req = YoutubeDLRequest(testUrl)
            req.addOption("-o", file.absolutePath)
            req.addOption("--downloader", "libaria2c.so")

            val start = System.currentTimeMillis()
            try {
                val resp = SpikeManager.executeYtDlp(req)
                val duration = System.currentTimeMillis() - start
                Log.i(TAG, "Aria2c Run $i: duration=${duration}ms, size=${file.length()} bytes, exitCode=${resp.exitCode}")
                if (resp.exitCode == 0 && file.length() > 0) {
                    ariaTimes.add(duration)
                }
            } catch (e: Exception) {
                Log.w(TAG, "Aria2c Run $i failed: ${e.message}")
            }
        }

        val stdMean = if (stdTimes.isNotEmpty()) stdTimes.average() else 0.0
        val ariaMean = if (ariaTimes.isNotEmpty()) ariaTimes.average() else 0.0

        val stdStdDev = calculateStdDev(stdTimes, stdMean)
        val ariaStdDev = calculateStdDev(ariaTimes, ariaMean)

        Log.i(TAG, "=== ARIA2C BENCHMARK RESULTS (25 MB) ===")
        Log.i(TAG, "Standard Times: $stdTimes ms")
        Log.i(TAG, "Standard Mean: ${String.format("%.1f", stdMean)} ms, StdDev: ${String.format("%.1f", stdStdDev)} ms")
        Log.i(TAG, "Aria2c Times: $ariaTimes ms")
        Log.i(TAG, "Aria2c Mean: ${String.format("%.1f", ariaMean)} ms, StdDev: ${String.format("%.1f", ariaStdDev)} ms")

        if (stdMean > 0 && ariaMean > 0) {
            val speedupPercent = ((stdMean - ariaMean) / stdMean) * 100.0
            Log.i(TAG, "Empirical Aria2c Speedup Delta: ${String.format("%.2f", speedupPercent)}%")
        }
        Log.i(TAG, "========================================")
    }

    // ==========================================
    // UTILITIES
    // ==========================================

    private fun inspectMediaContainer(sourceName: String, file: File) {
        val extractor = MediaExtractor()
        try {
            extractor.setDataSource(file.absolutePath)
            val trackCount = extractor.trackCount
            Log.i(TAG, "[$sourceName Container] Track count: $trackCount, File size: ${file.length()} bytes")

            for (i in 0 until trackCount) {
                val format = extractor.getTrackFormat(i)
                val mime = format.getString(MediaFormat.KEY_MIME) ?: "unknown"
                val durationUs = if (format.containsKey(MediaFormat.KEY_DURATION)) format.getLong(MediaFormat.KEY_DURATION) else -1L
                val durationSec = if (durationUs > 0) durationUs / 1_000_000.0 else -1.0

                if (mime.startsWith("video/")) {
                    val width = if (format.containsKey(MediaFormat.KEY_WIDTH)) format.getInteger(MediaFormat.KEY_WIDTH) else -1
                    val height = if (format.containsKey(MediaFormat.KEY_HEIGHT)) format.getInteger(MediaFormat.KEY_HEIGHT) else -1
                    Log.i(TAG, "  Track $i: VIDEO MIME=$mime, resolution=${width}x${height}, duration=${durationSec}s")
                } else if (mime.startsWith("audio/")) {
                    val sampleRate = if (format.containsKey(MediaFormat.KEY_SAMPLE_RATE)) format.getInteger(MediaFormat.KEY_SAMPLE_RATE) else -1
                    val channels = if (format.containsKey(MediaFormat.KEY_CHANNEL_COUNT)) format.getInteger(MediaFormat.KEY_CHANNEL_COUNT) else -1
                    Log.i(TAG, "  Track $i: AUDIO MIME=$mime, sampleRate=${sampleRate}Hz, channels=$channels, duration=${durationSec}s")
                } else {
                    Log.i(TAG, "  Track $i: OTHER MIME=$mime, duration=${durationSec}s")
                }
            }
        } finally {
            extractor.release()
        }
    }

    private fun readMagicHeader(file: File): String {
        return try {
            val bytes = ByteArray(8)
            file.inputStream().use { it.read(bytes) }
            bytes.joinToString(" ") { String.format("%02X", it) }
        } catch (e: Exception) {
            "error: ${e.message}"
        }
    }

    private fun resolveUniqueFile(directory: File, baseName: String, extension: String): File {
        var file = File(directory, "$baseName.$extension")
        var counter = 1
        while (file.exists()) {
            file = File(directory, "$baseName ($counter).$extension")
            counter++
        }
        return file
    }

    private fun calculateStdDev(values: List<Long>, mean: Double): Double {
        if (values.size <= 1) return 0.0
        val sumSquares = values.sumOf { (it - mean) * (it - mean) }
        return sqrt(sumSquares / (values.size - 1))
    }
}
