package com.novadrop.android.core.util

import com.novadrop.android.core.model.DownloadedFileInfo
import com.novadrop.android.core.model.MediaCategory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class FormattersTest {

    @Test
    fun testFormatBytes() {
        assertEquals("0 B", Formatters.formatBytes(0))
        assertEquals("0 B", Formatters.formatBytes(-50))
        assertEquals("500.0 B", Formatters.formatBytes(500))
        assertEquals("1.0 KB", Formatters.formatBytes(1024))
        assertEquals("1.5 MB", Formatters.formatBytes((1.5 * 1024 * 1024).toLong()))
        assertEquals("2.0 GB", Formatters.formatBytes(2L * 1024 * 1024 * 1024))
    }

    @Test
    fun testFormatDuration() {
        assertEquals("00:00", Formatters.formatDuration(null))
        assertEquals("00:00", Formatters.formatDuration(0))
        assertEquals("00:45", Formatters.formatDuration(45))
        assertEquals("03:25", Formatters.formatDuration(205))
        assertEquals("1:01:05", Formatters.formatDuration(3665))
    }

    @Test
    fun testFormatViews() {
        assertEquals("0 views", Formatters.formatViews(null))
        assertEquals("0 views", Formatters.formatViews(0))
        assertEquals("450 views", Formatters.formatViews(450))
        assertEquals("1.5K views", Formatters.formatViews(1500))
        assertEquals("2.4M views", Formatters.formatViews(2400000))
        assertEquals("1.2B views", Formatters.formatViews(1200000000))
    }

    @Test
    fun testDetectTool() {
        assertEquals("yt-dlp", Formatters.detectTool("https://www.youtube.com/watch?v=123"))
        assertEquals("yt-dlp", Formatters.detectTool("https://vimeo.com/456"))
        assertEquals("gallery-dl", Formatters.detectTool("https://danbooru.donmai.us/posts/789"))
        assertEquals("gallery-dl", Formatters.detectTool("https://reddit.com/r/pics/comments/abc"))
        assertEquals("gallery-dl", Formatters.detectTool("https://imgur.com/gallery/def"))
    }

    @Test
    fun testDetectCategory() {
        assertEquals(MediaCategory.VIDEO, Formatters.detectCategory("video.mp4"))
        assertEquals(MediaCategory.VIDEO, Formatters.detectCategory("movie.mkv"))
        assertEquals(MediaCategory.MUSIC, Formatters.detectCategory("song.mp3"))
        assertEquals(MediaCategory.MUSIC, Formatters.detectCategory("audio.flac"))
        assertEquals(MediaCategory.IMAGE, Formatters.detectCategory("picture.jpg"))
        assertEquals(MediaCategory.IMAGE, Formatters.detectCategory("photo.png"))

        val multiFiles = listOf(
            DownloadedFileInfo("img1.png", "/path/img1.png", 1000, "image/png"),
            DownloadedFileInfo("img2.png", "/path/img2.png", 1000, "image/png")
        )
        assertEquals(MediaCategory.IMAGE, Formatters.detectCategory("gallery_job", multiFiles))
    }

    @Test
    fun testNormalizeUrl() {
        assertEquals("https://youtube.com", Formatters.normalizeUrl("youtube.com"))
        assertEquals("https://www.google.com", Formatters.normalizeUrl("https://www.google.com"))
        assertEquals("http://example.com", Formatters.normalizeUrl("http://example.com"))
    }

    @Test
    fun testIsLikelyUrl() {
        assertTrue(Formatters.isLikelyUrl("https://youtube.com"))
        assertTrue(Formatters.isLikelyUrl("http://sub.domain.org/path?query=1"))
        assertTrue(Formatters.isLikelyUrl("example.com"))

        assertFalse(Formatters.isLikelyUrl("not a url"))
        assertFalse(Formatters.isLikelyUrl(""))
        assertFalse(Formatters.isLikelyUrl("hello world"))
    }
}
