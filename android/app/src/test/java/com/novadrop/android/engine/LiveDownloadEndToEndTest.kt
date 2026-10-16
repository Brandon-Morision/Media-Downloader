package com.novadrop.android.engine

import android.content.Context
import com.novadrop.android.core.model.DownloadJob
import com.novadrop.android.core.model.MediaCategory
import com.novadrop.android.engine.native.NativeExtractorEngine
import com.novadrop.android.engine.newpipe.NewPipeDownloaderImpl
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.BeforeClass
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.schabi.newpipe.extractor.NewPipe
import java.io.File

class LiveDownloadEndToEndTest {

    @get:Rule
    val tempFolder = TemporaryFolder()

    companion object {
        @JvmStatic
        @BeforeClass
        fun setupGlobal() {
            NewPipe.init(NewPipeDownloaderImpl(OkHttpClient()))
        }
    }

    private fun createEngine(): NativeExtractorEngine {
        val dummyContext = object : android.content.ContextWrapper(null) {
            override fun getFilesDir(): File = tempFolder.root
        }
        return NativeExtractorEngine(dummyContext, OkHttpClient())
    }

    @Test
    fun testRealEndToEndYouTubeVideoDownload() = runBlocking {
        val engine = createEngine()
        val testUrl = "https://www.youtube.com/watch?v=jNQXAC9IVRw"

        val job = DownloadJob(
            id = "e2e-video-test",
            url = testUrl,
            title = "Me at the zoo - Test Video",
            selectedFormat = "auto"
        )

        var lastProgress = 0f
        var bytesDownloaded = 0L

        val result = engine.download(job) { progress, downloaded, total, speed, eta ->
            lastProgress = progress
            bytesDownloaded = downloaded
            println("[E2E Video Download] progress=$progress%, downloaded=$downloaded / $total bytes, speed=$speed, eta=$eta")
        }

        assertTrue("End-to-end video download must succeed: ${result.exceptionOrNull()?.message}", result.isSuccess)
        val files = result.getOrNull()
        assertNotNull(files)
        assertTrue("At least one file must be produced", files!!.isNotEmpty())

        val downloadedFile = File(files[0].path)
        assertTrue("Downloaded file must physically exist", downloadedFile.exists())
        println("[E2E Video Result] File path: ${downloadedFile.absolutePath}, Size: ${downloadedFile.length()} bytes")
        assertTrue("File size should be > 50KB for genuine media", downloadedFile.length() > 50_000L)

        // Validate genuine MP4 container magic header
        assertTrue("Output file must pass integrity validation", engine.validateOutputFile(downloadedFile, MediaCategory.VIDEO))

        val header = ByteArray(12)
        downloadedFile.inputStream().use { it.read(header) }
        val ftyp = String(header, 4, 4)
        assertEquals("ftyp", ftyp)
        assertEquals(100f, lastProgress, 0.01f)
    }

    @Test
    fun testRealEndToEndYouTubeAudioDownload() = runBlocking {
        val engine = createEngine()
        val testUrl = "https://www.youtube.com/watch?v=jNQXAC9IVRw"

        val job = DownloadJob(
            id = "e2e-audio-test",
            url = testUrl,
            title = "Me at the zoo - Test Audio",
            selectedFormat = "audio-best"
        )

        var lastProgress = 0f
        var bytesDownloaded = 0L

        val result = engine.download(job) { progress, downloaded, total, speed, eta ->
            lastProgress = progress
            bytesDownloaded = downloaded
            println("[E2E Audio Download] progress=$progress%, downloaded=$downloaded / $total bytes, speed=$speed, eta=$eta")
        }

        assertTrue("End-to-end audio download must succeed: ${result.exceptionOrNull()?.message}", result.isSuccess)
        val files = result.getOrNull()
        assertNotNull(files)
        assertTrue("At least one audio file must be produced", files!!.isNotEmpty())

        val downloadedFile = File(files[0].path)
        assertTrue("Downloaded audio file must physically exist", downloadedFile.exists())
        println("[E2E Audio Result] File path: ${downloadedFile.absolutePath}, Size: ${downloadedFile.length()} bytes")
        assertTrue("File size should be > 20KB for genuine audio", downloadedFile.length() > 20_000L)

        // Validate genuine M4A container magic header
        assertTrue("Audio file must pass integrity validation", engine.validateOutputFile(downloadedFile, MediaCategory.MUSIC))

        val header = ByteArray(12)
        downloadedFile.inputStream().use { it.read(header) }
        val ftyp = String(header, 4, 4)
        assertEquals("ftyp", ftyp)
        assertEquals(100f, lastProgress, 0.01f)
    }

    @Test
    fun testRealEndToEndYouTubeWebmAudioDownload() = runBlocking {
        val engine = createEngine()
        val testUrl = "https://www.youtube.com/watch?v=jNQXAC9IVRw"

        val job = DownloadJob(
            id = "e2e-webm-audio-test",
            url = testUrl,
            title = "Me at the zoo - Test WebM Audio",
            selectedFormat = "audio-webm-160k"
        )

        var lastProgress = 0f
        var bytesDownloaded = 0L

        val result = engine.download(job) { progress, downloaded, total, speed, eta ->
            lastProgress = progress
            bytesDownloaded = downloaded
            println("[E2E WebM Audio] progress=$progress%, downloaded=$downloaded / $total bytes, speed=$speed, eta=$eta")
        }

        assertTrue("End-to-end WebM audio download must succeed: ${result.exceptionOrNull()?.message}", result.isSuccess)
        val files = result.getOrNull()
        assertNotNull(files)
        assertTrue("At least one audio file must be produced", files!!.isNotEmpty())

        val downloadedFile = File(files[0].path)
        assertTrue("Downloaded WebM audio file must physically exist", downloadedFile.exists())
        println("[E2E WebM Audio Result] File path: ${downloadedFile.absolutePath}, Size: ${downloadedFile.length()} bytes")
        assertTrue("File size should be > 20KB for genuine audio", downloadedFile.length() > 20_000L)

        // Validate genuine WebM container magic header (EBML)
        assertTrue("Audio file must pass integrity validation", engine.validateOutputFile(downloadedFile, MediaCategory.MUSIC))

        val header = ByteArray(12)
        downloadedFile.inputStream().use { it.read(header) }
        assertEquals(0x1A.toByte(), header[0])
        assertEquals(0x45.toByte(), header[1])
        assertEquals(0xDF.toByte(), header[2])
        assertEquals(0xA3.toByte(), header[3])
        assertEquals(100f, lastProgress, 0.01f)
    }
}
