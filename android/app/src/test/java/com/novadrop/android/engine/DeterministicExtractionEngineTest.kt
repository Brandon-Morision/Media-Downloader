package com.novadrop.android.engine

import android.content.Context
import com.novadrop.android.core.model.DownloadJob
import com.novadrop.android.core.model.DownloadState
import com.novadrop.android.core.model.MediaCategory
import com.novadrop.android.engine.native.NativeExtractorEngine
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.io.FileOutputStream

class DeterministicExtractionEngineTest {

    @get:Rule
    val tempFolder = TemporaryFolder()

    private lateinit var dummyContext: Context
    private lateinit var engine: NativeExtractorEngine

    @Before
    fun setup() {
        dummyContext = object : android.content.ContextWrapper(null) {
            override fun getFilesDir(): File = tempFolder.root
        }
        engine = NativeExtractorEngine(dummyContext, OkHttpClient())
    }

    @Test
    fun testOutputValidationWithValidMp4Header() {
        val file = tempFolder.newFile("test_valid.mp4")
        FileOutputStream(file).use { fos ->
            val data = ByteArray(1024)
            // MP4: offset 4..7 is "ftyp"
            data[4] = 'f'.code.toByte()
            data[5] = 't'.code.toByte()
            data[6] = 'y'.code.toByte()
            data[7] = 'p'.code.toByte()
            fos.write(data)
        }
        assertTrue("Valid MP4 file header must pass validation", engine.validateOutputFile(file, MediaCategory.VIDEO))
    }

    @Test
    fun testOutputValidationWithValidM4aHeader() {
        val file = tempFolder.newFile("test_valid.m4a")
        FileOutputStream(file).use { fos ->
            val data = ByteArray(1024)
            data[4] = 'f'.code.toByte()
            data[5] = 't'.code.toByte()
            data[6] = 'y'.code.toByte()
            data[7] = 'p'.code.toByte()
            fos.write(data)
        }
        assertTrue("Valid M4A audio file header must pass validation", engine.validateOutputFile(file, MediaCategory.MUSIC))
    }

    @Test
    fun testOutputValidationWithValidMp3Id3Header() {
        val file = tempFolder.newFile("test_valid.mp3")
        FileOutputStream(file).use { fos ->
            val data = ByteArray(1024)
            // ID3 tag
            data[0] = 'I'.code.toByte()
            data[1] = 'D'.code.toByte()
            data[2] = '3'.code.toByte()
            fos.write(data)
        }
        assertTrue("Valid MP3 file with ID3 tag must pass validation", engine.validateOutputFile(file, MediaCategory.MUSIC))
    }

    @Test
    fun testOutputValidationWithCorruptSmallFile() {
        val file = tempFolder.newFile("test_corrupt.mp4")
        FileOutputStream(file).use { fos ->
            fos.write(ByteArray(100)) // under 512 bytes minimum
        }
        assertFalse("Small/empty file must fail validation", engine.validateOutputFile(file, MediaCategory.VIDEO))
    }

    @Test
    fun testOutputValidationWithNonMediaTextFile() {
        val file = tempFolder.newFile("test_html_error.mp4")
        FileOutputStream(file).use { fos ->
            fos.write("<html><body>404 Not Found</body></html>".repeat(20).toByteArray())
        }
        assertFalse("HTML/Text error page saved as mp4 must fail validation", engine.validateOutputFile(file, MediaCategory.VIDEO))
    }

    @Test
    fun testDownloadNonExistentUrlFailsWithoutFallback() = runBlocking {
        val job = DownloadJob(
            id = "test-fail-job",
            url = "https://nonexistent-domain-404-invalid.org/media.mp4",
            title = "Nonexistent Media",
            selectedFormat = "video-best"
        )
        val result = engine.download(job) { _, _, _, _, _ -> }
        assertTrue("Download of nonexistent server must fail honestly", result.isFailure)
        val err = result.exceptionOrNull()?.message ?: ""
        assertFalse("Error must not reference sample fallback", err.contains("BigBuckBunny"))
    }

    @Test
    fun testCancellationLifecycle() {
        val jobId = "job-cancel-test"
        // Ensure pause and resume states behave safely
        assertFalse("Pausing non-active job must return false", engine.pause(jobId))
        assertFalse("Resuming non-active job must return false", engine.resume(jobId))

        // Calling cancel on non-existent job must not throw
        engine.cancel(jobId)
    }

    @Test
    fun testOutputValidationWithWebmEbmlHeader() {
        val file = tempFolder.newFile("test_valid.webm")
        FileOutputStream(file).use { fos ->
            val data = ByteArray(1024)
            data[0] = 0x1A.toByte()
            data[1] = 0x45.toByte()
            data[2] = 0xDF.toByte()
            data[3] = 0xA3.toByte()
            fos.write(data)
        }
        assertTrue("WebM file with EBML header must pass validation", engine.validateOutputFile(file, MediaCategory.VIDEO))
    }

    @Test
    fun testOutputValidationWithJpegHeader() {
        val file = tempFolder.newFile("test_valid.jpg")
        FileOutputStream(file).use { fos ->
            val data = ByteArray(1024)
            data[0] = 0xFF.toByte()
            data[1] = 0xD8.toByte()
            fos.write(data)
        }
        assertTrue("JPEG file with magic bytes must pass validation", engine.validateOutputFile(file, MediaCategory.IMAGE))
    }

    @Test
    fun testOutputValidationWithPngHeader() {
        val file = tempFolder.newFile("test_valid.png")
        FileOutputStream(file).use { fos ->
            val data = ByteArray(1024)
            data[0] = 0x89.toByte()
            data[1] = 0x50.toByte()
            fos.write(data)
        }
        assertTrue("PNG file with magic bytes must pass validation", engine.validateOutputFile(file, MediaCategory.IMAGE))
    }

    @Test
    fun testOutputValidationWithWebpHeader() {
        val file = tempFolder.newFile("test_valid.webp")
        FileOutputStream(file).use { fos ->
            val data = ByteArray(1024)
            data[0] = 'R'.code.toByte()
            data[1] = 'I'.code.toByte()
            data[2] = 'F'.code.toByte()
            data[3] = 'F'.code.toByte()
            data[8] = 'W'.code.toByte()
            data[9] = 'E'.code.toByte()
            data[10] = 'B'.code.toByte()
            data[11] = 'P'.code.toByte()
            fos.write(data)
        }
        assertTrue("WEBP file with RIFF-WEBP header must pass validation", engine.validateOutputFile(file, MediaCategory.IMAGE))
    }

    @Test
    fun testOutputValidationWithCorruptFtypHeader() {
        val file = tempFolder.newFile("test_bad_ftyp.mp4")
        FileOutputStream(file).use { fos ->
            val data = ByteArray(1024)
            data[4] = 'b'.code.toByte()
            data[5] = 'a'.code.toByte()
            data[6] = 'd'.code.toByte()
            data[7] = '!'.code.toByte()
            fos.write(data)
        }
        // Since it lacks valid container headers and doesn't exceed 4096 bytes, it fails
        assertFalse("File without valid container header must fail validation", engine.validateOutputFile(file, MediaCategory.VIDEO))
    }

    @Test
    fun testOutputValidationWithNonExistentFile() {
        val nonExistent = File(tempFolder.root, "does_not_exist.mp4")
        assertFalse("Non-existent file must fail validation", engine.validateOutputFile(nonExistent, MediaCategory.VIDEO))
    }

    @Test
    fun testCanHandleSupportedUrls() {
        assertTrue(engine.canHandle("https://www.youtube.com/watch?v=dQw4w9WgXcQ"))
        assertTrue(engine.canHandle("https://youtu.be/jNQXAC9IVRw"))
        assertTrue(engine.canHandle("https://www.reddit.com/r/videos/comments/xyz123/video/"))
        assertTrue(engine.canHandle("https://danbooru.donmai.us/posts/12345"))
        assertTrue(engine.canHandle("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/video.mp4"))
        assertFalse(engine.canHandle("not-a-valid-url"))
    }

    @Test
    fun testOutputValidationWithLargeNonMediaFileFails() {
        val file = tempFolder.newFile("large_html_error_page.mp4")
        FileOutputStream(file).use { fos ->
            // Write a 10KB HTML error page (previously >4096 would incorrectly pass)
            fos.write("<html><body><h1>500 Internal Server Error</h1><p>Error details...</p></body></html>".repeat(150).toByteArray())
        }
        assertTrue("File is >4096 bytes", file.length() > 4096)
        assertFalse("Large non-media file must NEVER pass validation", engine.validateOutputFile(file, MediaCategory.VIDEO))
    }

    @Test
    fun testOutputValidationWithValidFlacHeader() {
        val file = tempFolder.newFile("test_valid.flac")
        FileOutputStream(file).use { fos ->
            val data = ByteArray(1024)
            data[0] = 'f'.code.toByte()
            data[1] = 'L'.code.toByte()
            data[2] = 'a'.code.toByte()
            data[3] = 'C'.code.toByte()
            fos.write(data)
        }
        assertTrue("FLAC file with magic header must pass validation", engine.validateOutputFile(file, MediaCategory.MUSIC))
    }

    @Test
    fun testOutputValidationWithValidOggHeader() {
        val file = tempFolder.newFile("test_valid.ogg")
        FileOutputStream(file).use { fos ->
            val data = ByteArray(1024)
            data[0] = 'O'.code.toByte()
            data[1] = 'g'.code.toByte()
            data[2] = 'g'.code.toByte()
            data[3] = 'S'.code.toByte()
            fos.write(data)
        }
        assertTrue("Ogg/Opus file with magic header must pass validation", engine.validateOutputFile(file, MediaCategory.MUSIC))
    }

    @Test
    fun testOutputValidationWithValidWavHeader() {
        val file = tempFolder.newFile("test_valid.wav")
        FileOutputStream(file).use { fos ->
            val data = ByteArray(1024)
            data[0] = 'R'.code.toByte()
            data[1] = 'I'.code.toByte()
            data[2] = 'F'.code.toByte()
            data[3] = 'F'.code.toByte()
            data[8] = 'W'.code.toByte()
            data[9] = 'A'.code.toByte()
            data[10] = 'V'.code.toByte()
            data[11] = 'E'.code.toByte()
            fos.write(data)
        }
        assertTrue("WAV file with RIFF...WAVE header must pass validation", engine.validateOutputFile(file, MediaCategory.MUSIC))
    }

    @Test
    fun testOutputValidationWithValidGifHeader() {
        val file = tempFolder.newFile("test_valid.gif")
        FileOutputStream(file).use { fos ->
            val data = ByteArray(1024)
            data[0] = 'G'.code.toByte()
            data[1] = 'I'.code.toByte()
            data[2] = 'F'.code.toByte()
            data[3] = '8'.code.toByte()
            data[4] = '9'.code.toByte()
            data[5] = 'a'.code.toByte()
            fos.write(data)
        }
        assertTrue("GIF image with magic header must pass validation", engine.validateOutputFile(file, MediaCategory.IMAGE))
    }

    @Test
    fun testDestinationFileCollisionAvoidance() {
        val baseDir = tempFolder.newFolder("downloads")
        val initialFile = engine.resolveUniqueDestinationFile(baseDir, "test_video", "mp4")
        assertEquals("test_video.mp4", initialFile.name)
        initialFile.createNewFile()

        val secondFile = engine.resolveUniqueDestinationFile(baseDir, "test_video", "mp4")
        assertEquals("test_video (1).mp4", secondFile.name)
        secondFile.createNewFile()

        val thirdFile = engine.resolveUniqueDestinationFile(baseDir, "test_video", "mp4")
        assertEquals("test_video (2).mp4", thirdFile.name)
    }

    @Test
    fun testPartialDownloadFileCleanupOnFailure() = runBlocking {
        val job = DownloadJob(
            id = "test-cleanup-job",
            url = "https://127.0.0.1:59999/unreachable_media.mp4",
            title = "Unreachable Media",
            selectedFormat = "video-best"
        )
        val result = engine.download(job) { _, _, _, _, _ -> }
        assertTrue("Unreachable stream must fail", result.isFailure)

        val remainingFiles = tempFolder.root.walkTopDown().filter { it.isFile && it.name.contains("Unreachable Media") }.toList()
        assertTrue("Partial file must be deleted upon download failure", remainingFiles.isEmpty())
    }
}
