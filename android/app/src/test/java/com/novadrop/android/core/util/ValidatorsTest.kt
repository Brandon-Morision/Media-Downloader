package com.novadrop.android.core.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ValidatorsTest {

    @Test
    fun testValidateUrl() {
        assertTrue(Validators.validateUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"))
        assertTrue(Validators.validateUrl("http://danbooru.donmai.us/posts/12345"))
        assertTrue(Validators.validateUrl("https://reddit.com/r/pics/comments/xyz123"))

        assertFalse(Validators.validateUrl(null))
        assertFalse(Validators.validateUrl(""))
        assertFalse(Validators.validateUrl("not a url"))
        assertFalse(Validators.validateUrl("ftp://invalid-protocol.com"))
        assertFalse(Validators.validateUrl("https://"))
    }

    @Test
    fun testValidateSearchQuery() {
        assertTrue(Validators.validateSearchQuery("lofi hip hop radio"))
        assertTrue(Validators.validateSearchQuery("A"))

        assertFalse(Validators.validateSearchQuery(null))
        assertFalse(Validators.validateSearchQuery(""))
        assertFalse(Validators.validateSearchQuery("   "))
        assertFalse(Validators.validateSearchQuery("a".repeat(300)))
    }

    @Test
    fun testValidateJobId() {
        assertTrue(Validators.validateJobId("job-12345"))
        assertTrue(Validators.validateJobId("job_abc_999"))
        assertTrue(Validators.validateJobId("abc12345"))

        assertFalse(Validators.validateJobId(null))
        assertFalse(Validators.validateJobId(""))
        assertFalse(Validators.validateJobId("ab")) // too short (<3)
        assertFalse(Validators.validateJobId("job!@#$%"))
        assertFalse(Validators.validateJobId("a".repeat(70))) // too long (>64)
    }

    @Test
    fun testSanitizeFilename() {
        assertEquals("valid_file_name.mp4", Validators.sanitizeFilename("valid_file_name.mp4"))
        assertEquals("bad_name_here.mp3", Validators.sanitizeFilename("bad/name:here.mp3"))
        assertEquals("quotes_and_stars.png", Validators.sanitizeFilename("quotes\"and*stars.png"))
        assertEquals("download", Validators.sanitizeFilename("???:::"))
        assertEquals("fallback_custom", Validators.sanitizeFilename("   ", fallback = "fallback_custom"))
    }
}
