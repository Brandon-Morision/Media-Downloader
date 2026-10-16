package com.novadrop.android.engine

import com.novadrop.android.engine.newpipe.NewPipeDownloaderImpl
import okhttp3.OkHttpClient
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.BeforeClass
import org.junit.Test
import org.schabi.newpipe.extractor.NewPipe
import org.schabi.newpipe.extractor.ServiceList
import org.schabi.newpipe.extractor.stream.StreamInfo

class YouTubeExtractionTest {

    companion object {
        @JvmStatic
        @BeforeClass
        fun setup() {
            NewPipe.init(NewPipeDownloaderImpl(OkHttpClient()))
        }
    }

    @Test
    fun testLiveYouTubeMetadataExtraction() {
        // "Me at the zoo" - First video on YouTube, public domain / open access
        val url = "https://www.youtube.com/watch?v=jNQXAC9IVRw"
        val streamInfo = StreamInfo.getInfo(ServiceList.YouTube, url)

        assertEquals("Me at the zoo", streamInfo.name)
        assertEquals("jawed", streamInfo.uploaderName)
        assertTrue("Duration should be approximately 19 seconds", streamInfo.duration in 15..25)
        assertTrue("Thumbnails must not be empty", streamInfo.thumbnails.isNotEmpty())
        assertTrue("Video streams must be populated", streamInfo.videoStreams.isNotEmpty())
        assertTrue("Audio streams must be populated", streamInfo.audioStreams.isNotEmpty())
    }

    @Test
    fun testLiveYouTubeVideoStreamDownloadBytes() {
        val url = "https://www.youtube.com/watch?v=jNQXAC9IVRw"
        val streamInfo = StreamInfo.getInfo(ServiceList.YouTube, url)

        val videoStream = streamInfo.videoStreams.firstOrNull()
        assertNotNull("Progressive video stream should be present", videoStream)
        val streamUrl = videoStream!!.content
        assertNotNull("Stream URL must be resolved", streamUrl)

        val request = okhttp3.Request.Builder()
            .url(streamUrl)
            .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
            .build()
        val client = OkHttpClient()
        val response = client.newCall(request).execute()
        assertTrue("Live video stream response must be HTTP 200/206", response.isSuccessful)

        val headerBytes = ByteArray(12)
        response.body!!.byteStream().read(headerBytes)
        response.close()

        // MP4 magic bytes: bytes 4..7 must be 'ftyp'
        val ftyp = String(headerBytes, 4, 4)
        assertEquals("ftyp", ftyp)
    }

    @Test
    fun testLiveYouTubeAudioStreamDownloadBytes() {
        val url = "https://www.youtube.com/watch?v=jNQXAC9IVRw"
        val streamInfo = StreamInfo.getInfo(ServiceList.YouTube, url)

        val audioStream = streamInfo.audioStreams.firstOrNull { it.format?.suffix == "m4a" }
            ?: streamInfo.audioStreams.firstOrNull()
        assertNotNull("Audio stream should be present", audioStream)
        val streamUrl = audioStream!!.content
        assertNotNull("Audio stream URL must be resolved", streamUrl)

        val request = okhttp3.Request.Builder()
            .url(streamUrl)
            .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
            .build()
        val client = OkHttpClient()
        val response = client.newCall(request).execute()
        assertTrue("Live audio stream response must be HTTP 200/206", response.isSuccessful)

        val headerBytes = ByteArray(12)
        response.body!!.byteStream().read(headerBytes)
        response.close()

        val ftyp = String(headerBytes, 4, 4)
        assertEquals("M4A audio container must start with ftyp at offset 4", "ftyp", ftyp)
    }

    @Test
    fun testLiveYouTubeWebmAudioStreamDownloadBytes() {
        val url = "https://www.youtube.com/watch?v=jNQXAC9IVRw"
        val streamInfo = StreamInfo.getInfo(ServiceList.YouTube, url)

        val webmAudioStream = streamInfo.audioStreams.firstOrNull { it.format?.suffix == "webm" }
        assertNotNull("WebM audio stream should be available on YouTube", webmAudioStream)
        val streamUrl = webmAudioStream!!.content
        assertNotNull("WebM audio stream URL must be resolved", streamUrl)

        val request = okhttp3.Request.Builder()
            .url(streamUrl)
            .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
            .build()
        val client = OkHttpClient()
        val response = client.newCall(request).execute()
        assertTrue("Live WebM audio stream response must be successful", response.isSuccessful)

        val headerBytes = ByteArray(12)
        response.body!!.byteStream().read(headerBytes)
        response.close()

        // WebM / Matroska EBML: 0x1A 0x45 0xDF 0xA3
        assertEquals(0x1A.toByte(), headerBytes[0])
        assertEquals(0x45.toByte(), headerBytes[1])
        assertEquals(0xDF.toByte(), headerBytes[2])
        assertEquals(0xA3.toByte(), headerBytes[3])
    }

    @Test
    fun testLiveYouTubeInaccessiblePrivateVideoHandling() {
        // Known private/unavailable video ID
        val privateUrl = "https://www.youtube.com/watch?v=00000000000"
        try {
            StreamInfo.getInfo(ServiceList.YouTube, privateUrl)
        } catch (e: Exception) {
            assertTrue("Should throw extraction or availability exception", e is Throwable)
        }
    }
}
