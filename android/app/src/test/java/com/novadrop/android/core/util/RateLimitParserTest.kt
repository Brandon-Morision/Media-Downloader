package com.novadrop.android.core.util

import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RateLimitParserTest {

    @Test
    fun testParseNullOrEmpty() {
        assertNull(RateLimitParser.parse(null))
        assertNull(RateLimitParser.parse(""))
        assertNull(RateLimitParser.parse("Normal error message occurred"))
    }

    @Test
    fun testParseRelativeSeconds() {
        val result = RateLimitParser.parse("HTTP 429: Rate limited. Please retry after 300 seconds.")
        assertNotNull(result)
        assertTrue(result!!.isRateLimited)
        assertTrue(result.secondsRemaining >= 300)
    }

    @Test
    fun testParseRelativeMinutes() {
        val result = RateLimitParser.parse("Too Many Requests: Rate limit will reset in 10 minutes")
        assertNotNull(result)
        assertTrue(result!!.isRateLimited)
        assertTrue(result.secondsRemaining >= 600)
    }

    @Test
    fun testParseGeneric429() {
        val result = RateLimitParser.parse("Error fetching URL: 429 Too Many Requests")
        assertNotNull(result)
        assertTrue(result!!.isRateLimited)
        assertTrue(result.secondsRemaining in 800..950)
    }

    @Test
    fun testParseTimeFormat() {
        val result = RateLimitParser.parse("API rate limit exceeded. Reset at 23:59:00")
        assertNotNull(result)
        assertTrue(result!!.isRateLimited)
        assertTrue(result.resetTimestamp > System.currentTimeMillis())
    }
}
