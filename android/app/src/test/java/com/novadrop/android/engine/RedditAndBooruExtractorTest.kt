package com.novadrop.android.engine

import com.novadrop.android.core.util.Formatters
import com.novadrop.android.core.util.Validators
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RedditAndBooruExtractorTest {

    @Test
    fun testToolSelectionForRedditAndBooru() {
        assertEquals("gallery-dl", Formatters.detectTool("https://www.reddit.com/r/EarthPorn/comments/abc123/sunset/"))
        assertEquals("gallery-dl", Formatters.detectTool("https://danbooru.donmai.us/posts/1234567"))
        assertEquals("gallery-dl", Formatters.detectTool("https://safebooru.org/index.php?page=post&s=view&id=999"))
        assertEquals("gallery-dl", Formatters.detectTool("https://imgur.com/gallery/example"))

        assertEquals("yt-dlp", Formatters.detectTool("https://www.youtube.com/watch?v=dQw4w9WgXcQ"))
        assertEquals("yt-dlp", Formatters.detectTool("https://vimeo.com/123456"))
    }

    @Test
    fun testRedditUrlValidation() {
        assertTrue(Validators.validateUrl("https://www.reddit.com/r/pics/comments/12345/my_photo/"))
        assertTrue(Validators.validateUrl("https://redd.it/xyz123"))
    }

    @Test
    fun testDanbooruUrlValidation() {
        assertTrue(Validators.validateUrl("https://danbooru.donmai.us/posts/7654321"))
        assertTrue(Validators.validateUrl("http://safebooru.org/index.php?page=post&s=view&id=555"))
    }

    @Test
    fun testDanbooruIdExtraction() {
        val url = "https://danbooru.donmai.us/posts/8765432?q=landscape"
        val postId = url.substringAfter("posts/").substringBefore("?").substringBefore("/")
        assertEquals("8765432", postId)
    }
}
