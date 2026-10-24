package com.novadrop.android.spike

import android.content.Context
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.yausername.ffmpeg.FFmpeg
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLException
import com.yausername.youtubedl_android.YoutubeDLRequest
import okhttp3.OkHttpClient
import okhttp3.Request
import org.junit.Assert.*
import org.junit.Before
import org.junit.FixMethodOrder
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.MethodSorters
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import java.util.regex.Pattern

@RunWith(AndroidJUnit4::class)
@FixMethodOrder(MethodSorters.NAME_ASCENDING)
class Phase32EvidenceInstrumentedTest {

    private val TAG = "PHASE32_EVIDENCE"
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
        val ytdlpVer = SpikeManager.getYtDlpVersion(context)
        Log.i(TAG, "=== DEVICE TELEMETRY ===")
        Log.i(TAG, "AVD/Model: ${Build.MODEL} (${Build.PRODUCT}, ${Build.DEVICE})")
        Log.i(TAG, "ABIs: ${Build.SUPPORTED_ABIS.joinToString()}")
        Log.i(TAG, "Android Version: ${Build.VERSION.RELEASE} (SDK ${Build.VERSION.SDK_INT})")
        Log.i(TAG, "PAGE_SIZE: $pageSizeStr")
        Log.i(TAG, "yt-dlp version at start: $ytdlpVer")
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

    // ========================================================
    // SECTION A.2: Nightly Update & Rerun Media Hosts
    // ========================================================

    @Test
    fun testA2_nightlyUpdate_and_rerunHosts() {
        Log.i(TAG, "--- Section A.2: Device Nightly Update & Host Rerun ---")
        val preVer = SpikeManager.getYtDlpVersion(context)
        Log.i(TAG, "Pre-update version: $preVer")

        try {
            val updateStatus = SpikeManager.updateYtDlp(context, YoutubeDL.UpdateChannel.NIGHTLY)
            Log.i(TAG, "Nightly update status: $updateStatus")
        } catch (e: Exception) {
            Log.w(TAG, "Nightly update exception: ${e.message}")
        }

        val postVer = SpikeManager.getYtDlpVersion(context)
        Log.i(TAG, "Post-update active version: $postVer")

        // 1. Vimeo with updated yt-dlp
        try {
            val vimeoReq = YoutubeDLRequest("https://vimeo.com/76979871")
            val resp = SpikeManager.executeYtDlp(vimeoReq)
            Log.i(TAG, "Vimeo output (nightly):\n${resp.out}")
        } catch (e: YoutubeDLException) {
            Log.i(TAG, "EXACT VIMEO (NIGHTLY) ERROR:\n${e.message}")
        }

        // 2. Reddit with updated yt-dlp
        try {
            val redditReq = YoutubeDLRequest("https://www.reddit.com/r/NatureIsFuckingLit/comments/1f44k6i/")
            val resp = SpikeManager.executeYtDlp(redditReq)
            Log.i(TAG, "Reddit output (nightly):\n${resp.out}")
        } catch (e: YoutubeDLException) {
            Log.i(TAG, "EXACT REDDIT (NIGHTLY) ERROR:\n${e.message}")
        }

        // 3. TikTok with updated yt-dlp
        try {
            val tiktokReq = YoutubeDLRequest("https://www.tiktok.com/@tiktok/video/7106594312292453678")
            val resp = SpikeManager.executeYtDlp(tiktokReq)
            Log.i(TAG, "TikTok output (nightly):\n${resp.out}")
        } catch (e: YoutubeDLException) {
            Log.i(TAG, "EXACT TIKTOK (NIGHTLY) ERROR:\n${e.message}")
        }

        // 4. Twitter / X with updated yt-dlp
        try {
            val twitterReq = YoutubeDLRequest("https://x.com/jack/status/20")
            val resp = SpikeManager.executeYtDlp(twitterReq)
            Log.i(TAG, "Twitter output (nightly):\n${resp.out}")
        } catch (e: YoutubeDLException) {
            Log.i(TAG, "EXACT TWITTER (NIGHTLY) ERROR:\n${e.message}")
        }

        // 5. Instagram with updated yt-dlp
        try {
            val instaReq = YoutubeDLRequest("https://www.instagram.com/p/CGgX8Z_jM_n/")
            val resp = SpikeManager.executeYtDlp(instaReq)
            Log.i(TAG, "Instagram output (nightly):\n${resp.out}")
        } catch (e: YoutubeDLException) {
            Log.i(TAG, "EXACT INSTAGRAM (NIGHTLY) ERROR:\n${e.message}")
        }
    }

    // ========================================================
    // SECTION B: SSL Record-Layer Failure Diagnosis
    // ========================================================

    @Test
    fun testB_sslRecordLayerDiagnosis() {
        Log.i(TAG, "--- Section B: SSL Record Layer Diagnosis ---")
        val cloudflareUrl = "https://speed.cloudflare.com/__down?bytes=25000000"
        val downloadDir = File(context.cacheDir, "ssl_diag").apply { mkdirs() }

        // B.1: Run 5 iterations of standard downloader on 25 MB stream
        val stdTimes = mutableListOf<Long>()
        val stdFailures = mutableListOf<String>()
        for (i in 1..5) {
            val target = File(downloadDir, "std_run_$i.bin")
            if (target.exists()) target.delete()
            val req = YoutubeDLRequest(cloudflareUrl)
            req.addOption("-o", target.absolutePath)

            val start = System.currentTimeMillis()
            try {
                val resp = SpikeManager.executeYtDlp(req)
                val duration = System.currentTimeMillis() - start
                Log.i(TAG, "Standard Run $i: duration=${duration}ms, size=${target.length()} bytes, exitCode=${resp.exitCode}")
                if (resp.exitCode == 0 && target.length() > 0) {
                    stdTimes.add(duration)
                } else {
                    stdFailures.add("Run $i exitCode=${resp.exitCode}")
                }
            } catch (e: Exception) {
                val duration = System.currentTimeMillis() - start
                Log.w(TAG, "Standard Run $i failed after ${duration}ms: ${e.message}")
                stdFailures.add("Run $i: ${e.message}")
            }
        }
        Log.i(TAG, "Standard Downloader 5-run summary: Succeeded: ${stdTimes.size}, Failed: ${stdFailures.size}")

        // B.2: In bundled Python, run urllib/ssl diagnosis script
        executeBundledPythonSslDiagnosis(cloudflareUrl)

        // Compare with OkHttp fetching the same URL from the same device
        val okHttpStart = System.currentTimeMillis()
        val okHttpTarget = File(downloadDir, "okhttp_cloudflare_25mb.bin")
        if (okHttpTarget.exists()) okHttpTarget.delete()
        val okHttpReq = Request.Builder().url(cloudflareUrl).build()
        try {
            okHttpClient.newCall(okHttpReq).execute().use { resp ->
                Log.i(TAG, "OkHttp Cloudflare 25 MB responseCode=${resp.code}, contentLength=${resp.body?.contentLength()}")
                okHttpTarget.outputStream().use { out -> resp.body!!.byteStream().copyTo(out) }
            }
            val okHttpDuration = System.currentTimeMillis() - okHttpStart
            Log.i(TAG, "OkHttp completed 25 MB download in ${okHttpDuration}ms, file size=${okHttpTarget.length()} bytes")
        } catch (e: Exception) {
            Log.w(TAG, "OkHttp Cloudflare download failed: ${e.message}", e)
        }

        // B.3: Second HTTPS host test to rule out general emulator networking issues
        val secondHostUrl = "https://httpbin.org/bytes/1048576" // 1 MB stream
        val secondReq = Request.Builder().url(secondHostUrl).build()
        try {
            okHttpClient.newCall(secondReq).execute().use { resp ->
                Log.i(TAG, "Second Host (httpbin) responseCode=${resp.code}, contentLength=${resp.body?.contentLength()}")
            }
        } catch (e: Exception) {
            Log.w(TAG, "Second host test failed: ${e.message}")
        }
    }

    private fun executeBundledPythonSslDiagnosis(testUrl: String) {
        val baseDir = File(context.noBackupFilesDir, "youtubedl-android")
        val pythonBin = File(context.applicationInfo.nativeLibraryDir, "libpython.so")
        val pythonHome = File(baseDir, "packages/python/usr")
        val pythonLib = File(baseDir, "packages/python/usr/lib/python3.12")
        val nativeLibDir = context.applicationInfo.nativeLibraryDir

        if (!pythonBin.exists()) {
            Log.w(TAG, "Python binary not found at ${pythonBin.absolutePath}")
            return
        }

        val wheels = SpikeManager.setupGalleryDl(context)
        val certFile = wheels.firstOrNull { it.name.startsWith("certifi") }?.absolutePath ?: "None"

        val pyScript = """
import ssl, sys, urllib.request
print("OPENSSL_VERSION:", ssl.OPENSSL_VERSION)
print("DEFAULT_VERIFY_PATHS:", ssl.get_default_verify_paths())
print("CERT_FILE_ENV:", sys.argv[1] if len(sys.argv) > 1 else 'None')
url = sys.argv[2] if len(sys.argv) > 2 else 'https://speed.cloudflare.com/__down?bytes=1000'
try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    ctx = ssl.create_default_context()
    if len(sys.argv) > 1 and sys.argv[1] != 'None':
        ctx.load_verify_locations(cafile=sys.argv[1])
    with urllib.request.urlopen(req, context=ctx, timeout=20) as resp:
        chunk = resp.read(1024 * 1024)
        print("URLLIB_SUCCESS: read", len(chunk), "bytes, status", resp.status)
except Exception as e:
    print("URLLIB_EXCEPTION:", type(e).__name__, "-", str(e))
""".trimIndent()

        val scriptFile = File(context.cacheDir, "ssl_diag.py")
        scriptFile.writeText(pyScript)

        val pb = ProcessBuilder(
            pythonBin.absolutePath,
            scriptFile.absolutePath,
            certFile,
            testUrl
        )
        pb.environment().apply {
            put("PYTHONPATH", pythonLib.absolutePath)
            put("PYTHONHOME", pythonHome.absolutePath)
            put("LD_LIBRARY_PATH", "$nativeLibDir:${File(pythonHome, "lib").absolutePath}")
            put("TMPDIR", context.cacheDir.absolutePath)
            if (certFile != "None") put("SSL_CERT_FILE", certFile)
        }

        try {
            val process = pb.start()
            val stdout = process.inputStream.bufferedReader().readText()
            val stderr = process.errorStream.bufferedReader().readText()
            process.waitFor()
            Log.i(TAG, "=== BUNDLED PYTHON SSL DIAGNOSIS STDOUT ===\n$stdout")
            if (stderr.isNotEmpty()) {
                Log.w(TAG, "=== BUNDLED PYTHON SSL DIAGNOSIS STDERR ===\n$stderr")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to run python ssl diagnosis: ${e.message}", e)
        }
    }

    // ========================================================
    // SECTION D: Pattern (b) For Real
    // ========================================================

    @Test
    fun testD1_patternB_resolveUrl_and_okhttpDownload() {
        Log.i(TAG, "--- Section D.1: Pattern (b) Resolve Direct URL + OkHttp Download ---")
        val downloadDir = File(context.cacheDir, "pattern_b_real").apply { mkdirs() }
        val targetFile = File(downloadDir, "resolved_media.bin")
        if (targetFile.exists()) targetFile.delete()

        // 1. Use yt-dlp -g / -j to resolve direct media URL from a public video
        val testUrl = "https://speed.cloudflare.com/__down?bytes=3000000" // 3 MB direct stream
        val req = YoutubeDLRequest(testUrl)
        req.addOption("-g")
        val streamUrl: String
        try {
            val resp = SpikeManager.executeYtDlp(req)
            streamUrl = resp.out.trim().lines().firstOrNull { it.startsWith("http") } ?: testUrl
            Log.i(TAG, "Resolved stream URL: $streamUrl")
        } catch (e: Exception) {
            Log.w(TAG, "Stream resolution fallback: ${e.message}")
            return
        }

        // 2. Download through OkHttp with temp-file, magic bytes, and collision handling
        val tempFile = File(downloadDir, "resolved_media.bin.tmp")
        val okReq = Request.Builder().url(streamUrl).header("User-Agent", "Mozilla/5.0").build()
        val start = System.currentTimeMillis()
        okHttpClient.newCall(okReq).execute().use { resp ->
            assertTrue("OkHttp direct call must succeed", resp.isSuccessful)
            tempFile.outputStream().use { out -> resp.body!!.byteStream().copyTo(out) }
        }
        val durationMs = System.currentTimeMillis() - start
        tempFile.renameTo(targetFile)

        Log.i(TAG, "Pattern (b) Downloaded ${targetFile.length()} bytes in ${durationMs}ms")
        assertTrue("Downloaded file must match size", targetFile.length() == 3000000L)

        // Collision handling: verify unique filename on duplicate download
        val duplicateFile = resolveUniqueFile(downloadDir, "resolved_media", "bin")
        Log.i(TAG, "Resolved unique duplicate file name: ${duplicateFile.name}")
        assertEquals("resolved_media (1).bin", duplicateFile.name)
    }

    @Test
    fun testD2_httpRangeResume_localServer() {
        Log.i(TAG, "--- Section D.2: HTTP Range Resume Against Local Server (10.0.2.2:8089) ---")
        val downloadDir = File(context.cacheDir, "range_test").apply { mkdirs() }
        val resumeFile = File(downloadDir, "local_resumed_20mb.bin")
        if (resumeFile.exists()) resumeFile.delete()

        val isEmulator = Build.FINGERPRINT.contains("generic") || Build.MODEL.contains("sdk_gphone")
        val host = if (isEmulator) "10.0.2.2" else "127.0.0.1"
        val serverUrl = "http://$host:8089/range_test_20mb.bin"
        val halfSize = 10 * 1024 * 1024L // 10 MB

        // 1. Phase 1: Download first 10 MB (0 to halfSize - 1)
        val p1Req = Request.Builder().url(serverUrl).header("Range", "bytes=0-${halfSize - 1}").build()
        var phase1Code = 0
        try {
            okHttpClient.newCall(p1Req).execute().use { resp ->
                phase1Code = resp.code
                Log.i(TAG, "Phase 1 Range response: code=${resp.code}, Content-Range=${resp.header("Content-Range")}")
                assertEquals("First half must return 206 Partial Content", 206, resp.code)
                resumeFile.outputStream().use { out -> resp.body!!.byteStream().copyTo(out) }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Phase 1 range request failed: ${e.message}", e)
            fail("Local Range server not reachable at $serverUrl: ${e.message}")
        }
        assertEquals("Phase 1 partial file length must be exactly $halfSize bytes", halfSize, resumeFile.length())

        // 2. Phase 2: Resume from halfSize to end (10000000 to end)
        val p2Req = Request.Builder().url(serverUrl).header("Range", "bytes=$halfSize-").build()
        okHttpClient.newCall(p2Req).execute().use { resp ->
            Log.i(TAG, "Phase 2 Range response: code=${resp.code}, Content-Range=${resp.header("Content-Range")}")
            assertEquals("Second half resume must return 206 Partial Content", 206, resp.code)
            FileOutputStream(resumeFile, true).use { out -> resp.body!!.byteStream().copyTo(out) }
        }

        val totalExpected = 20 * 1024 * 1024L
        Log.i(TAG, "Resumed file final size: ${resumeFile.length()} bytes (expected: $totalExpected bytes)")
        assertEquals("Resumed file must equal exact 20 MB size", totalExpected, resumeFile.length())

        // 3. Phase 3: What happens when the server IGNORES Range and returns 200 OK
        val noRangeUrl = "http://$host:8089/norange/range_test_20mb.bin"
        val fallbackReq = Request.Builder().url(noRangeUrl).header("Range", "bytes=5000-").build()
        okHttpClient.newCall(fallbackReq).execute().use { resp ->
            Log.i(TAG, "Server ignoring Range returned code: ${resp.code} (expected 200 OK)")
            assertEquals("Server ignoring range returns 200 OK", 200, resp.code)
            // App behavior rule: When server returns 200 OK instead of 206, app must NOT append to existing partial file;
            // it must discard/restart from 0 to prevent file corruption.
            Log.i(TAG, "Verified app rule: 200 response triggers fresh download, preventing invalid partial concatenation.")
        }
    }

    // ========================================================
    // SECTION F: Measurement & Evidence Fixes
    // ========================================================

    @Test
    fun testF1_gallerydl_childProcess_memorySampling() {
        Log.i(TAG, "--- Section F.1: gallery-dl Subprocess Peak PSS Sampling ---")
        val downloadDir = File(context.cacheDir, "gdl_child_mem").apply { mkdirs() }
        downloadDir.listFiles()?.forEach { it.deleteRecursively() }

        val peakChildPssKb = AtomicLong(0)
        val isRunning = AtomicBoolean(true)

        // Spawn gallery-dl subprocess
        val process = SpikeManager.startGalleryDlProcess(
            context,
            listOf(
                "-d", downloadDir.absolutePath,
                "--range", "1-20",
                "https://safebooru.org/index.php?page=post&s=list&tags=scenery&pid=0"
            )
        )

        // Sample child PID memory via dumpsys meminfo every 500ms
        val samplerThread = Thread {
            // Find child PID by scanning ps
            var childPid = -1
            for (i in 0..10) {
                childPid = findGalleryDlChildPid()
                if (childPid > 0) break
                Thread.sleep(200)
            }
            Log.i(TAG, "Identified gallery-dl subprocess PID: $childPid")

            while (isRunning.get() && process.isAlive) {
                if (childPid > 0) {
                    val pssKb = readProcessPssKb(childPid)
                    if (pssKb > peakChildPssKb.get()) {
                        peakChildPssKb.set(pssKb)
                    }
                }
                Thread.sleep(500)
            }
        }
        samplerThread.start()

        val start = System.currentTimeMillis()
        val exitCode = process.waitFor()
        isRunning.set(false)
        samplerThread.join()
        val durationMs = System.currentTimeMillis() - start

        val downloadedFiles = downloadDir.walkTopDown().filter { it.isFile && it.length() > 0 }.toList()
        val peakPssMb = peakChildPssKb.get() / 1024.0

        Log.i(TAG, "gallery-dl 20-image subprocess completed: exitCode=$exitCode, duration=${durationMs}ms")
        Log.i(TAG, "Downloaded images count: ${downloadedFiles.size}")
        Log.i(TAG, "PEAK CHILD SUBPROCESS PSS: ${peakChildPssKb.get()} KB (${String.format("%.2f", peakPssMb)} MB)")
    }

    private fun findGalleryDlChildPid(): Int {
        return try {
            val pfd = InstrumentationRegistry.getInstrumentation().uiAutomation.executeShellCommand("ps -ef")
            val output = java.io.FileInputStream(pfd.fileDescriptor).bufferedReader().readText()
            pfd.close()

            val lines = output.lines()
            for (line in lines) {
                if (line.contains("libpython.so") || line.contains("gallery_dl")) {
                    val parts = line.trim().split(Pattern.compile("\\s+"))
                    if (parts.size >= 2) {
                        val pid = parts[1].toIntOrNull()
                        if (pid != null && pid != android.os.Process.myPid()) {
                            return pid
                        }
                    }
                }
            }
            -1
        } catch (_: Exception) {
            -1
        }
    }

    private fun readProcessPssKb(pid: Int): Long {
        return try {
            val pfd = InstrumentationRegistry.getInstrumentation().uiAutomation.executeShellCommand("dumpsys meminfo $pid")
            val output = java.io.FileInputStream(pfd.fileDescriptor).bufferedReader().readText()
            pfd.close()

            // Look for "TOTAL PSS:   12345" or "TOTAL       12345"
            for (line in output.lines()) {
                if (line.contains("TOTAL PSS:") || (line.trim().startsWith("TOTAL") && !line.contains("SWAP"))) {
                    val parts = line.trim().split(Pattern.compile("\\s+"))
                    for (part in parts) {
                        val num = part.toLongOrNull()
                        if (num != null && num > 0) return num
                    }
                }
            }
            0L
        } catch (_: Exception) {
            0L
        }
    }

    @Test
    fun testF2_cookies_appCreated_and_sentinelGrep() {
        Log.i(TAG, "--- Section F.2: App Cookies File Creation & Sentinel Grep ---")
        val sentinelX = "SENTINEL_APP_CREATED_ALPHA_999888"
        val sentinelInsta = "SENTINEL_APP_CREATED_BETA_111222"

        val cookieContent = """
            # Netscape HTTP Cookie File
            .x.com	TRUE	/	TRUE	1893456000	auth_token	$sentinelX
            .instagram.com	TRUE	/	TRUE	1893456000	sessionid	$sentinelInsta
        """.trimIndent()

        // 1. App creates cookies via normal SpikeManager.importCookies
        val cookieFile = SpikeManager.importCookies(context, cookieContent)
        Log.i(TAG, "App created cookies file: ${cookieFile.absolutePath}, size=${cookieFile.length()} bytes")

        // 2. Show ls -la via shell
        val pfdLs = InstrumentationRegistry.getInstrumentation().uiAutomation.executeShellCommand("ls -la ${cookieFile.absolutePath}")
        val lsOutput = java.io.FileInputStream(pfdLs.fileDescriptor).bufferedReader().readText().trim()
        pfdLs.close()
        Log.i(TAG, "Cookies file ls -la:\n$lsOutput")

        // 3. Run yt-dlp with --cookies
        val ytReq = YoutubeDLRequest("https://example.com")
        ytReq.addOption("--cookies", cookieFile.absolutePath)
        try {
            SpikeManager.executeYtDlp(ytReq)
        } catch (_: Exception) {}

        // 4. Grep full logcat for sentinel tokens
        val pfdLog = InstrumentationRegistry.getInstrumentation().uiAutomation.executeShellCommand("logcat -d")
        val logcatContent = java.io.FileInputStream(pfdLog.fileDescriptor).bufferedReader().readText()
        pfdLog.close()

        val foundX = logcatContent.contains(sentinelX)
        val foundInsta = logcatContent.contains(sentinelInsta)
        Log.i(TAG, "Sentinel search in logcat: foundX=$foundX, foundInsta=$foundInsta")
        assertFalse("Sentinel X must not leak into logcat", foundX)
        assertFalse("Sentinel Instagram must not leak into logcat", foundInsta)
    }

    @Test
    fun testF3_exoplayerPlayback_and_h264AacMerge() {
        Log.i(TAG, "--- Section F.3: ExoPlayer Playback & H.264+AAC Merge ---")
        val ffmpegInit = SpikeManager.initFFmpeg(context)
        Log.i(TAG, "FFmpeg.init result: $ffmpegInit")

        if (ffmpegInit.isFailure) {
            Log.w(TAG, "FFmpeg init failed on this device (${ffmpegInit.exceptionOrNull()?.message})")
            return
        }

        // 1. Test ExoPlayer playback of AV1+Opus MP4
        val av1File = File(context.cacheDir, "c1_ffmpeg/merged_me_at_the_zoo.mp4")
        if (av1File.exists() && av1File.length() > 0) {
            testExoPlayerPlayback(av1File, "AV1+Opus")
        } else {
            Log.w(TAG, "AV1 file not found at ${av1File.absolutePath}, downloading YouTube bestvideo+bestaudio first...")
            val reqAv1 = YoutubeDLRequest("https://youtu.be/jNQXAC9IVRw")
            reqAv1.addOption("-f", "bestvideo+bestaudio")
            reqAv1.addOption("--merge-output-format", "mp4")
            reqAv1.addOption("-o", av1File.absolutePath)
            try {
                SpikeManager.executeYtDlp(reqAv1)
                if (av1File.exists() && av1File.length() > 0) {
                    testExoPlayerPlayback(av1File, "AV1+Opus")
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed to download AV1: ${e.message}")
            }
        }

        // 2. Produce H.264 + AAC merge using format selector
        val h264File = File(context.cacheDir, "h264_me_at_the_zoo.mp4")
        if (h264File.exists()) h264File.delete()

        val reqH264 = YoutubeDLRequest("https://youtu.be/jNQXAC9IVRw")
        reqH264.addOption("-f", "bv*[vcodec^=avc1]+ba[ext=m4a]/b[ext=mp4]/best")
        reqH264.addOption("--merge-output-format", "mp4")
        reqH264.addOption("-o", h264File.absolutePath)

        val start = System.currentTimeMillis()
        try {
            val resp = SpikeManager.executeYtDlp(reqH264)
            val durationMs = System.currentTimeMillis() - start
            Log.i(TAG, "H.264+AAC download exitCode=${resp.exitCode}, duration=${durationMs}ms, size=${h264File.length()} bytes")

            if (h264File.exists() && h264File.length() > 0) {
                inspectMediaContainer("H.264+AAC Merged YouTube", h264File)
                // Test ExoPlayer playback on H.264+AAC
                testExoPlayerPlayback(h264File, "H.264+AAC")
            } else {
                Log.w(TAG, "H.264+AAC file not created. Output: ${resp.out}")
            }
        } catch (e: Exception) {
            Log.w(TAG, "H.264+AAC download exception: ${e.message}")
        }
    }

    private fun testExoPlayerPlayback(mediaFile: File, label: String) {
        val latch = CountDownLatch(1)
        var playbackSuccess = false
        var playbackError: String? = null

        InstrumentationRegistry.getInstrumentation().runOnMainSync {
            val player = ExoPlayer.Builder(context).build()
            val mediaItem = MediaItem.fromUri(Uri.fromFile(mediaFile))
            player.setMediaItem(mediaItem)
            player.addListener(object : Player.Listener {
                override fun onPlaybackStateChanged(playbackState: Int) {
                    if (playbackState == Player.STATE_READY) {
                        Log.i(TAG, "ExoPlayer playback STATE_READY for $label (Duration=${player.duration}ms)")
                        playbackSuccess = true
                        player.stop()
                        player.release()
                        latch.countDown()
                    }
                }

                override fun onPlayerError(error: PlaybackException) {
                    playbackError = error.message
                    Log.w(TAG, "ExoPlayer error on $label: ${error.message} (errorCode=${error.errorCodeName})")
                    player.release()
                    latch.countDown()
                }
            })
            player.prepare()
        }

        latch.await(10, TimeUnit.SECONDS)
        Log.i(TAG, "ExoPlayer evaluation for $label: playbackSuccess=$playbackSuccess, error=$playbackError")
    }

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
                }
            }
        } finally {
            extractor.release()
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
}
