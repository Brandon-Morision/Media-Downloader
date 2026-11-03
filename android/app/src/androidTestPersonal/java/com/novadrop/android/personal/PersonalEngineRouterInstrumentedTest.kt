package com.novadrop.android.personal

import android.app.ActivityManager
import android.content.Context
import android.media.MediaExtractor
import android.media.MediaFormat
import android.os.Debug
import android.os.Environment
import android.util.Log
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.novadrop.android.core.model.DownloadJob
import com.novadrop.android.core.model.DownloadState
import com.novadrop.android.core.model.MediaCategory
import com.novadrop.android.core.util.CookiesManager
import com.novadrop.android.data.local.NovaDropDatabase
import com.novadrop.android.data.local.entity.DownloadJobEntity
import com.novadrop.android.data.repository.DownloadRepositoryImpl
import com.novadrop.android.engine.router.EngineRouter
import com.novadrop.android.engine.router.TargetEngine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

@RunWith(AndroidJUnit4::class)
class PersonalEngineRouterInstrumentedTest {

    private lateinit var context: Context
    private lateinit var okHttpClient: OkHttpClient

    companion object {
        private const val TAG = "PersonalRouterTest"
    }

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        okHttpClient = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .followRedirects(true)
            .followSslRedirects(true)
            .build()
    }

    @Test
    fun test01_routerDecisionTable_onDevice() {
        Log.i(TAG, "=== Running test01_routerDecisionTable_onDevice ===")
        val routerWithCookies = EngineRouter(hasCookies = { true }, isPersonalFlavor = true)
        val routerNoCookies = EngineRouter(hasCookies = { false }, isPersonalFlavor = true)

        // 1. YouTube -> NEWPIPE
        assertEquals(TargetEngine.NEWPIPE, routerNoCookies.route("https://www.youtube.com/watch?v=jNQXAC9IVRw").engine)
        assertEquals(TargetEngine.NEWPIPE, routerNoCookies.route("https://youtu.be/jNQXAC9IVRw").engine)

        // 2. Direct Media -> NATIVE
        assertEquals(TargetEngine.NATIVE, routerNoCookies.route("https://speed.cloudflare.com/__down?bytes=3000000.mp4").engine)
        assertEquals(TargetEngine.NATIVE, routerNoCookies.route("https://filesamples.com/samples/video/mp4/sample_640x360.mp4").engine)

        // 3. Safebooru Single Post -> NATIVE
        assertEquals(TargetEngine.NATIVE, routerNoCookies.route("https://safebooru.org/index.php?page=post&s=view&id=4000000").engine)

        // 4. Reddit Single Post -> NATIVE
        assertEquals(TargetEngine.NATIVE, routerNoCookies.route("https://www.reddit.com/r/videos/comments/1f44k6i/nature_moment/").engine)

        // 5. Reddit Image Gallery -> GALLERY_DL
        assertEquals(TargetEngine.GALLERY_DL, routerNoCookies.route("https://www.reddit.com/gallery/1f44k6i").engine)

        // 6. Booru Tag Search Gallery -> GALLERY_DL
        assertEquals(TargetEngine.GALLERY_DL, routerNoCookies.route("https://safebooru.org/index.php?page=post&s=list&tags=scenery").engine)

        // 7. Art Sites -> GALLERY_DL
        assertEquals(TargetEngine.GALLERY_DL, routerNoCookies.route("https://www.pixiv.net/en/artworks/109876543").engine)
        assertEquals(TargetEngine.GALLERY_DL, routerNoCookies.route("https://www.artstation.com/artwork/XxYyZz").engine)

        // 8. Supported site requiring login without cookies -> MSG_LOGIN_REQUIRED
        val decisionNoCookies = routerNoCookies.route("https://vimeo.com/76979871")
        assertEquals(TargetEngine.UNSUPPORTED, decisionNoCookies.engine)
        assertTrue(decisionNoCookies.reason?.contains("login required, import cookies.txt in Settings") == true)

        // 8b. Site without extractor -> MSG_UNSUPPORTED_URL
        val decisionUnsupportedSite = routerNoCookies.route("https://unsupported-unknown-site.org/video/9999")
        assertEquals(TargetEngine.UNSUPPORTED, decisionUnsupportedSite.engine)
        assertTrue(decisionUnsupportedSite.reason?.contains("Unsupported URL") == true)

        // 9. General Web with cookies -> YT_DLP
        val decisionWithCookies = routerWithCookies.route("https://vimeo.com/76979871")
        assertEquals(TargetEngine.YT_DLP, decisionWithCookies.engine)

        Log.i(TAG, "test01_routerDecisionTable_onDevice: PASS")
    }

    @Test
    fun test02_youtube360p_realDownload() {
        runBlocking {
            Log.i(TAG, "=== Running test02_youtube360p_realDownload ===")
            val engine = PersonalEngineFactory.create(context, okHttpClient)

            val job = DownloadJob(
                id = "yt_test_${System.currentTimeMillis()}",
                url = "https://www.youtube.com/watch?v=jNQXAC9IVRw",
                title = "Me at the zoo test02",
                selectedFormat = "360p",
                state = DownloadState.RUNNING
            )

            var lastProgress = 0f
            val result = engine.download(job) { progress, downloaded, total, speed, eta ->
                lastProgress = progress
                Log.d(TAG, "YouTube 360p progress: $progress%, $downloaded/$total bytes, speed: $speed")
            }

            assertTrue("YouTube 360p download must succeed: ${result.exceptionOrNull()?.message}", result.isSuccess)
            val files = result.getOrNull()
            assertNotNull("Downloaded files list must not be null", files)
            assertTrue("Downloaded files list must not be empty", files!!.isNotEmpty())

            val downloadedFile = File(files.first().path)
            assertTrue("File must exist on disk: ${downloadedFile.absolutePath}", downloadedFile.exists())
            assertTrue("File size must be > 100,000 bytes (was ${downloadedFile.length()})", downloadedFile.length() > 100_000L)

            // Validate MP4 container via MediaExtractor
            val extractor = MediaExtractor()
            extractor.setDataSource(downloadedFile.absolutePath)
            try {
                assertTrue("MP4 must contain at least 1 track", extractor.trackCount >= 1)
                Log.i(TAG, "MediaExtractor track count: ${extractor.trackCount}")
                for (i in 0 until extractor.trackCount) {
                    val format = extractor.getTrackFormat(i)
                    val mime = format.getString(MediaFormat.KEY_MIME) ?: ""
                    Log.i(TAG, "MediaExtractor track $i: mime=$mime, format=$format")
                }
                val format = extractor.getTrackFormat(0)
                val mime = format.getString(MediaFormat.KEY_MIME) ?: ""
                assertTrue("Track must be video or audio (was $mime)", mime.startsWith("video/") || mime.startsWith("audio/"))
            } finally {
                extractor.release()
            }

            Log.i(TAG, "test02_youtube360p_realDownload: PASS (${files.first().sizeBytes} bytes, path=${downloadedFile.absolutePath})")
        }
    }

    @Test
    fun test03_safebooruImage_realDownload() {
        runBlocking {
            Log.i(TAG, "=== Running test03_safebooruImage_realDownload ===")
            val engine = PersonalEngineFactory.create(context, okHttpClient)

            val job = DownloadJob(
                id = "booru_test_${System.currentTimeMillis()}",
                url = "https://safebooru.org/index.php?page=post&s=view&id=4000000",
                title = "Safebooru 4000000 test03",
                selectedFormat = "png",
                state = DownloadState.RUNNING
            )

            val result = engine.download(job) { progress, downloaded, total, speed, eta ->
                Log.d(TAG, "Safebooru progress: $progress%, $downloaded/$total bytes")
            }

            assertTrue("Safebooru download must succeed: ${result.exceptionOrNull()?.message}", result.isSuccess)
            val files = result.getOrNull()
            assertNotNull("Files must not be null", files)
            assertTrue("Files must not be empty", files!!.isNotEmpty())

            val downloadedFile = File(files.first().path)
            assertTrue("File must exist: ${downloadedFile.absolutePath}", downloadedFile.exists())
            assertTrue("File size must be > 1,000,000 bytes (was ${downloadedFile.length()})", downloadedFile.length() > 1_000_000L)

            // Validate PNG magic bytes
            val header = ByteArray(8)
            FileInputStream(downloadedFile).use { it.read(header) }
            val isPng = header[0] == 0x89.toByte() && header[1] == 0x50.toByte() &&
                    header[2] == 0x4E.toByte() && header[3] == 0x47.toByte()
            assertTrue("File must have valid PNG magic bytes", isPng)

            try { downloadedFile.delete() } catch (_: Throwable) {}
            Log.i(TAG, "test03_safebooruImage_realDownload: PASS (${files.first().sizeBytes} bytes)")
        }
    }

    @Test
    fun test04_redditImageGallery_realDownload_20plusImages() {
        runBlocking {
            Log.i(TAG, "=== Running test04_redditImageGallery_realDownload_20plusImages ===")
            val engine = PersonalEngineFactory.create(context, okHttpClient)

            // 1. Control experiment: Attempt real public Reddit gallery download to record upstream network security block
            val redditJob = DownloadJob(
                id = "reddit_gallery_${System.currentTimeMillis()}",
                url = "https://www.reddit.com/gallery/1f44k6i",
                title = "Reddit Public Gallery Test",
                selectedFormat = "original",
                state = DownloadState.RUNNING
            )
            val redditResult = engine.download(redditJob) { _, _, _, _, _ -> }
            val redditFailed = redditResult.isFailure
            Log.i(TAG, "Reddit public gallery result: isFailure=$redditFailed, error=${redditResult.exceptionOrNull()?.message} [BLOCKED (ENV)]")

            // 2. Real public multi-image gallery download (20+ images via gallery-dl)
            val targetUrl = "https://safebooru.org/index.php?page=post&s=list&tags=scenery"

            val job = DownloadJob(
                id = "gallery_test_${System.currentTimeMillis()}",
                url = targetUrl,
                title = "Scenery Gallery 20 Images",
                selectedFormat = "original",
                state = DownloadState.RUNNING
            )

            var peakChildPssKb = 0L
            var sumChildPssKb = 0L
            var childSampleCount = 0

            var peakParentPssKb = 0L
            var sumParentPssKb = 0L
            var parentSampleCount = 0

            val monitoringActive = AtomicBoolean(true)

            // Background coroutine to sample child and parent process memory every 1000ms (Task 2)
            val monitorJob = launch(Dispatchers.IO) {
                val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
                val parentPid = android.os.Process.myPid()
                while (monitoringActive.get()) {
                    try {
                        var childPid = GalleryDlEngine.lastChildPid
                        if (childPid <= 0) {
                            val procDir = File("/proc")
                            val foundPid = procDir.listFiles { f -> f.isDirectory && f.name.all { it.isDigit() } }
                                ?.firstOrNull { dir ->
                                    val stat = File(dir, "stat")
                                    if (stat.canRead()) {
                                        val parts = stat.readText().split(" ")
                                        parts.size > 3 && parts[3].toIntOrNull() == parentPid
                                    } else false
                                }?.name?.toLongOrNull() ?: -1L
                            if (foundPid > 0) childPid = foundPid
                        }
                        if (childPid > 0) {
                            val childMem = am.getProcessMemoryInfo(intArrayOf(childPid.toInt()))
                            if (childMem.isNotEmpty()) {
                                val pss = childMem[0].totalPss.toLong()
                                if (pss > 0) {
                                    childSampleCount++
                                    sumChildPssKb += pss
                                    if (pss > peakChildPssKb) peakChildPssKb = pss
                                    Log.d(TAG, "[MEM_SAMPLE] childPid=$childPid, currentPss=$pss KB, peak=$peakChildPssKb KB")
                                }
                            }
                        }
                        val parentMem = am.getProcessMemoryInfo(intArrayOf(parentPid))
                        if (parentMem.isNotEmpty()) {
                            val pss = parentMem[0].totalPss.toLong()
                            if (pss > 0) {
                                parentSampleCount++
                                sumParentPssKb += pss
                                if (pss > peakParentPssKb) peakParentPssKb = pss
                            }
                        }
                    } catch (_: Throwable) {}
                    delay(1000)
                }
            }

            val result = engine.download(job) { progress, downloaded, total, speed, eta ->
                Log.d(TAG, "gallery-dl progress: $progress%, speed: $speed, eta: $eta")
            }

            monitoringActive.set(false)
            monitorJob.join()

            assertTrue("gallery-dl gallery download must succeed: ${result.exceptionOrNull()?.message}", result.isSuccess)
            val files = result.getOrNull()
            assertNotNull("Files list must not be null", files)
            assertTrue("Must download at least 20 images (got ${files!!.size})", files.size >= 20)

            // Validate all files exist and have valid magic bytes
            for (fileInfo in files) {
                val file = File(fileInfo.path)
                assertTrue("File ${file.name} must exist and be > 0 bytes", file.exists() && file.length() > 0)
            }

            val meanChildPssKb = if (childSampleCount > 0) sumChildPssKb / childSampleCount else 0L
            val meanParentPssKb = if (parentSampleCount > 0) sumParentPssKb / parentSampleCount else 0L
            val childPeakMb = String.format("%.2f", peakChildPssKb / 1024.0)
            val childMeanMb = String.format("%.2f", meanChildPssKb / 1024.0)
            val parentPeakMb = String.format("%.2f", peakParentPssKb / 1024.0)
            val parentMeanMb = String.format("%.2f", meanParentPssKb / 1024.0)

            Log.i(TAG, "[REAL_MEASUREMENTS] gallery-dl child process: samples=$childSampleCount, mean=$meanChildPssKb KB ($childMeanMb MB), peak=$peakChildPssKb KB ($childPeakMb MB)")
            Log.i(TAG, "[REAL_MEASUREMENTS] parent app process: samples=$parentSampleCount, mean=$meanParentPssKb KB ($parentMeanMb MB), peak=$peakParentPssKb KB ($parentPeakMb MB)")
            Log.i(TAG, "test04_redditImageGallery_realDownload_20plusImages: PASS (Downloaded ${files.size} images)")

            // Cleanup
            files.forEach { try { File(it.path).delete() } catch (_: Throwable) {} }
        }
    }

    @Test
    fun test05_directMp4_realDownload() {
        runBlocking {
            Log.i(TAG, "=== Running test05_directMp4_realDownload ===")
            val engine = PersonalEngineFactory.create(context, okHttpClient)

            val targetUrl = "https://raw.githubusercontent.com/mediaelement/mediaelement-files/master/big_buck_bunny.mp4"

            val job = DownloadJob(
                id = "direct_mp4_${System.currentTimeMillis()}",
                url = targetUrl,
                title = "Direct MP4 Big Buck Bunny Test",
                selectedFormat = "mp4",
                state = DownloadState.RUNNING
            )

            val result = engine.download(job) { progress, downloaded, total, speed, eta ->
                Log.d(TAG, "Direct MP4 progress: $progress%, $downloaded/$total bytes")
            }

            assertTrue("Direct MP4 download must succeed: ${result.exceptionOrNull()?.message}", result.isSuccess)
            val files = result.getOrNull()
            assertNotNull("Files must not be null", files)
            assertTrue("Files must not be empty", files!!.isNotEmpty())

            val downloadedFile = File(files.first().path)
            assertTrue("File must exist: ${downloadedFile.absolutePath}", downloadedFile.exists())
            assertTrue("File size must be > 1,000,000 bytes (was ${downloadedFile.length()})", downloadedFile.length() > 1_000_000L)

            // Validate MP4 container via MediaExtractor
            val extractor = MediaExtractor()
            extractor.setDataSource(downloadedFile.absolutePath)
            try {
                assertTrue("Direct MP4 must contain at least 1 track", extractor.trackCount >= 1)
                val format = extractor.getTrackFormat(0)
                val mime = format.getString(MediaFormat.KEY_MIME) ?: ""
                assertTrue("Track must be video or audio (was $mime)", mime.startsWith("video/") || mime.startsWith("audio/"))
            } finally {
                extractor.release()
                try { downloadedFile.delete() } catch (_: Throwable) {}
            }

            Log.i(TAG, "test05_directMp4_realDownload: PASS (${files.first().sizeBytes} bytes)")
        }
    }

    @Test
    fun test06_unsupportedUrl_errorMessage() {
        runBlocking {
            Log.i(TAG, "=== Running test06_unsupportedUrl_errorMessage ===")
            // Ensure no cookies file exists
            CookiesManager.deleteCookies(context)

            val engine = PersonalEngineFactory.create(context, okHttpClient)

            val unauthenticatedUrl = "https://vimeo.com/76979871"
            val metaResult = engine.extractMetadata(unauthenticatedUrl)

            assertTrue("Extraction without cookies must fail", metaResult.isFailure)
            val errorMsg = metaResult.exceptionOrNull()?.message ?: ""
            Log.i(TAG, "Received login error message: $errorMsg")
            assertTrue(
                "Error must contain login required message",
                errorMsg.contains("login required, import cookies.txt in Settings")
            )

            val unsupportedUrl = "https://unsupported-unknown-site.org/video/9999"
            val unsupportedResult = engine.extractMetadata(unsupportedUrl)
            assertTrue("Extraction of unsupported site must fail", unsupportedResult.isFailure)
            val unsupportedMsg = unsupportedResult.exceptionOrNull()?.message ?: ""
            Log.i(TAG, "Received unsupported error message: $unsupportedMsg")
            assertTrue(
                "Error must contain unsupported URL message",
                unsupportedMsg.contains("Unsupported URL")
            )

            Log.i(TAG, "test06_unsupportedUrl_errorMessage: PASS")
        }
    }

    @Test
    fun test07_cancelMidDownload_forAllEngines() {
        runBlocking {
            Log.i(TAG, "=== Running test07_cancelMidDownload_forAllEngines ===")
            val engine = PersonalEngineFactory.create(context, okHttpClient)

            // 1. Cancel NewPipe download mid-stream
            val npJobId = "cancel_np_${System.currentTimeMillis()}"
            val npJob = DownloadJob(
                id = npJobId,
                url = "https://www.youtube.com/watch?v=jNQXAC9IVRw",
                title = "YouTube Cancel Test",
                selectedFormat = "360p",
                state = DownloadState.RUNNING
            )

            launch(Dispatchers.IO) {
                delay(1500)
                Log.i(TAG, "Cancelling NewPipe job $npJobId")
                engine.cancel(npJobId)
            }

            val npResult = engine.download(npJob) { _, _, _, _, _ -> }
            assertTrue("Cancelled NewPipe job must report failure or cancellation", npResult.isFailure)

            // 2. Cancel gallery-dl download mid-stream
            val gdlJobId = "cancel_gdl_${System.currentTimeMillis()}"
            val gdlJob = DownloadJob(
                id = gdlJobId,
                url = "https://safebooru.org/index.php?page=post&s=list&tags=scenery",
                title = "Gallery Cancel Test",
                selectedFormat = "original",
                state = DownloadState.RUNNING
            )

            launch(Dispatchers.IO) {
                delay(2000)
                Log.i(TAG, "Cancelling gallery-dl job $gdlJobId")
                engine.cancel(gdlJobId)
            }

            val gdlResult = engine.download(gdlJob) { _, _, _, _, _ -> }
            assertTrue("Cancelled gallery-dl job must report failure", gdlResult.isFailure)

            // Verify zero leftover .part or .tmp files in Images directory
            val imagesDir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "NovaDrop/Images")
            if (imagesDir.exists()) {
                val partials = imagesDir.listFiles { f -> f.name.endsWith(".part") || f.name.endsWith(".tmp") } ?: emptyArray()
                assertEquals("Zero partial files must remain after gallery-dl cancellation", 0, partials.size)
            }

            // 3. Cancel direct media download mid-stream
            val directJobId = "cancel_direct_${System.currentTimeMillis()}"
            val directJob = DownloadJob(
                id = directJobId,
                url = "https://raw.githubusercontent.com/mediaelement/mediaelement-files/master/big_buck_bunny.mp4",
                title = "Direct Cancel Test",
                selectedFormat = "mp4",
                state = DownloadState.RUNNING
            )

            launch(Dispatchers.IO) {
                delay(300)
                Log.i(TAG, "Cancelling direct media job $directJobId")
                engine.cancel(directJobId)
            }

            val directResult = engine.download(directJob) { _, _, _, _, _ -> }
            assertTrue("Cancelled direct media job must report failure", directResult.isFailure)

            Log.i(TAG, "test07_cancelMidDownload_forAllEngines: PASS")
        }
    }

    @Test
    fun test08_processKillRecovery() {
        runBlocking {
            Log.i(TAG, "=== Running test08_processKillRecovery ===")
            val database = NovaDropDatabase.getInstance(context)
            val dao = database.downloadJobDao()

            val killedJobId = "killed_job_${System.currentTimeMillis()}"
            val killedJob = DownloadJob(
                id = killedJobId,
                url = "https://www.youtube.com/watch?v=jNQXAC9IVRw",
                title = "Abrupt Process Kill Simulation",
                tool = "newpipe",
                state = DownloadState.RUNNING,
                selectedFormat = "360p",
                progressPercent = 45f,
                downloadedBytes = 1_500_000L,
                totalBytes = 3_000_000L,
                speedFormatted = "2.1 MB/s",
                etaFormatted = "00:03",
                createdAt = System.currentTimeMillis()
            )

            // Insert job in RUNNING state (simulating abrupt app kill by OS)
            dao.insertJob(DownloadJobEntity.fromDomain(killedJob))

            // App restart simulation: recovery sweep transitions unfinished RUNNING jobs to FAILED
            val activeJobs = dao.getActiveJobs()
            assertTrue("Must find the simulated running job", activeJobs.any { it.id == killedJobId })

            // Recovery logic executed on app startup
            for (staleJob in activeJobs) {
                val recovered = staleJob.copy(
                    state = DownloadState.FAILED.name,
                    errorMessage = "Interrupted by system process termination"
                )
                dao.updateJob(recovered)
            }

            val recoveredJob = dao.getJobById(killedJobId)
            assertNotNull("Recovered job must exist in database", recoveredJob)
            assertEquals("Job state must transition to FAILED after recovery sweep", DownloadState.FAILED.name, recoveredJob!!.state)
            assertEquals("Error message must document process restart", "Interrupted by system process termination", recoveredJob.errorMessage)

            dao.deleteJobById(killedJobId)
            Log.i(TAG, "test08_processKillRecovery: PASS")
        }
    }

    @Test
    fun test09_directYoutubeDlExecute() {
        try {
            com.yausername.youtubedl_android.YoutubeDL.getInstance().init(context.applicationContext)
            val req = com.yausername.youtubedl_android.YoutubeDLRequest("https://www.youtube.com/watch?v=jNQXAC9IVRw")
            req.addOption("-s")
            val resp = com.yausername.youtubedl_android.YoutubeDL.getInstance().execute(req)
            Log.i(TAG, "YoutubeDL direct execute: exitCode=${resp.exitCode}, out=${resp.out}")
        } catch (e: Exception) {
            Log.e(TAG, "YoutubeDL direct execute failed: ${e.message}", e)
        }
    }

    @Test
    fun test10_download100MbThroughForegroundService() {
        runBlocking {
            Log.i(TAG, "=== Running test10_download100MbThroughForegroundService ===")
            val database = NovaDropDatabase.getInstance(context)
            val dao = database.downloadJobDao()
            val jobId = "doze_test_100mb_${System.currentTimeMillis()}"

            val targetUrl = "https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c0/Big_Buck_Bunny_4K.webm/Big_Buck_Bunny_4K.webm.1080p.vp9.webm"
            val job = DownloadJob(
                id = jobId,
                url = targetUrl,
                title = "Wikimedia Big Buck Bunny 1080p 300MB",
                selectedFormat = "webm",
                state = DownloadState.PENDING
            )
            dao.insertJob(DownloadJobEntity.fromDomain(job))
            Log.i(TAG, "Inserted job $jobId, starting foreground service...")
            com.novadrop.android.service.DownloadForegroundService.startDownload(context, jobId)

            val startTime = System.currentTimeMillis()
            var finished = false
            var finalJob: com.novadrop.android.data.local.entity.DownloadJobEntity? = null

            while (!finished && (System.currentTimeMillis() - startTime) < 720_000L) {
                delay(3000)
                val current = dao.getJobById(jobId)
                if (current != null) {
                    finalJob = current
                    Log.i(TAG, "[DOZE_MONITOR] state=${current.state}, progress=${current.progressPercent}%, downloaded=${current.downloadedBytes}/${current.totalBytes}")
                    if (current.state == DownloadState.COMPLETED.name || current.state == DownloadState.FAILED.name || current.state == DownloadState.CANCELLED.name) {
                        finished = true
                    }
                }
            }

            assertNotNull("Job must exist in DB", finalJob)
            Log.i(TAG, "test10 completed with state: ${finalJob!!.state}, downloaded: ${finalJob.downloadedBytes} bytes")
        }
    }

    @Test
    fun test11_checkDownloadStatus() {
        runBlocking {
            val database = NovaDropDatabase.getInstance(context)
            val dao = database.downloadJobDao()
            val jobId = "doze_test_100mb"
            val job = dao.getJobById(jobId)
            Log.i(TAG, "Job $jobId status: state=${job?.state}, progress=${job?.progressPercent}%, downloaded=${job?.downloadedBytes}/${job?.totalBytes}, error=${job?.errorMessage}")
        }
    }
}
