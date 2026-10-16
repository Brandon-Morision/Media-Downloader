package com.novadrop.android.core.util

import com.novadrop.android.core.model.RateLimitResult
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.regex.Pattern

object RateLimitParser {

    fun parse(errorText: String?): RateLimitResult? {
        if (errorText.isNullOrBlank()) return null
        val text = errorText.trim()
        val now = System.currentTimeMillis()

        // 1. Full Date + Time: "reset at 2026-10-07 20:05:01"
        val dtPattern = Pattern.compile("reset\\s+(?:will\\s+reset\\s+)?at\\s+(\\d{4}[-/]\\d{2}[-/]\\d{2}\\s+\\d{1,2}:\\d{2}(?::\\d{2})?)", Pattern.CASE_INSENSITIVE)
        val dtMatcher = dtPattern.matcher(text)
        if (dtMatcher.find()) {
            val dtStr = dtMatcher.group(1)?.replace('/', '-') ?: ""
            val fmt = if (dtStr.count { it == ':' } == 2) "yyyy-MM-dd HH:mm:ss" else "yyyy-MM-dd HH:mm"
            try {
                val parsed = SimpleDateFormat(fmt, Locale.US).parse(dtStr)
                if (parsed != null) {
                    val targetTs = parsed.time + 15_000L // 15s grace buffer
                    val remaining = Math.max(0L, (targetTs - now) / 1000L)
                    val timeFmt = SimpleDateFormat("HH:mm:ss", Locale.US).format(Date(targetTs))
                    return RateLimitResult(
                        isRateLimited = true,
                        resetTimestamp = targetTs,
                        resetTimeFormatted = timeFmt,
                        secondsRemaining = remaining,
                        message = "Rate limit will reset at $timeFmt"
                    )
                }
            } catch (_: Exception) {}
        }

        // 2. Time only: "Rate limit will reset at 20:05:01" or "reset at 8:05 PM"
        val timePattern = Pattern.compile("(?:rate\\s+limit.*?reset\\s+(?:will\\s+reset\\s+)?at|reset\\s+at|resets?\\s+at)\\s+(\\d{1,2}:\\d{2}(?::\\d{2})?(?:\\s*[ap]m)?)", Pattern.CASE_INSENSITIVE)
        val timeMatcher = timePattern.matcher(text)
        if (timeMatcher.find()) {
            val tStr = timeMatcher.group(1)?.trim() ?: ""
            try {
                val cal = Calendar.getInstance()
                val isAmPm = tStr.contains("am", ignoreCase = true) || tStr.contains("pm", ignoreCase = true)
                if (isAmPm) {
                    val fmt = if (tStr.count { it == ':' } == 2) "hh:mm:ss a" else "hh:mm a"
                    val parsedTime = SimpleDateFormat(fmt, Locale.US).parse(tStr)
                    if (parsedTime != null) {
                        val parsedCal = Calendar.getInstance().apply { time = parsedTime }
                        cal.set(Calendar.HOUR_OF_DAY, parsedCal.get(Calendar.HOUR_OF_DAY))
                        cal.set(Calendar.MINUTE, parsedCal.get(Calendar.MINUTE))
                        cal.set(Calendar.SECOND, parsedCal.get(Calendar.SECOND))
                    }
                } else {
                    val parts = tStr.split(":")
                    val h = parts[0].toInt()
                    val m = parts[1].toInt()
                    val s = if (parts.size > 2) parts[2].toInt() else 0
                    cal.set(Calendar.HOUR_OF_DAY, h)
                    cal.set(Calendar.MINUTE, m)
                    cal.set(Calendar.SECOND, s)
                }
                cal.set(Calendar.MILLISECOND, 0)

                // If target time is earlier than now, it resets tomorrow
                if (cal.timeInMillis <= now) {
                    cal.add(Calendar.DAY_OF_YEAR, 1)
                }

                val targetTs = cal.timeInMillis + 15_000L
                val remaining = Math.max(0L, (targetTs - now) / 1000L)
                val timeFmt = SimpleDateFormat("HH:mm:ss", Locale.US).format(Date(targetTs))
                return RateLimitResult(
                    isRateLimited = true,
                    resetTimestamp = targetTs,
                    resetTimeFormatted = timeFmt,
                    secondsRemaining = remaining,
                    message = "Rate limit will reset at $timeFmt"
                )
            } catch (_: Exception) {}
        }

        // 3. Relative intervals: "reset in 15 minutes", "retry after 300 seconds", "429 Too Many Requests"
        val relPattern = Pattern.compile("(?:reset\\s+in|retry\\s+after|sleep(?:ing)?\\s+for|wait\\s+for)\\s+(\\d+)\\s*(s(?:ec)?|m(?:in)?|h(?:our)?|seconds?|minutes?|hours?)", Pattern.CASE_INSENSITIVE)
        val relMatcher = relPattern.matcher(text)
        if (relMatcher.find()) {
            val value = relMatcher.group(1)?.toLongOrNull() ?: 60L
            val unit = relMatcher.group(2)?.lowercase(Locale.ROOT) ?: "m"
            val seconds = when {
                unit.startsWith("s") -> value
                unit.startsWith("h") -> value * 3600L
                else -> value * 60L
            }
            val targetTs = now + (seconds * 1000L) + 15_000L
            val timeFmt = SimpleDateFormat("HH:mm:ss", Locale.US).format(Date(targetTs))
            return RateLimitResult(
                isRateLimited = true,
                resetTimestamp = targetTs,
                resetTimeFormatted = timeFmt,
                secondsRemaining = seconds + 15L,
                message = "Rate limit will reset in ${seconds / 60}m"
            )
        }

        // 4. Generic 429 without timestamp -> default to 15-minute standard backoff
        if (text.contains("429", ignoreCase = true) || text.contains("rate limit", ignoreCase = true) || text.contains("too many requests", ignoreCase = true)) {
            val seconds = 900L // 15 minutes
            val targetTs = now + (seconds * 1000L)
            val timeFmt = SimpleDateFormat("HH:mm:ss", Locale.US).format(Date(targetTs))
            return RateLimitResult(
                isRateLimited = true,
                resetTimestamp = targetTs,
                resetTimeFormatted = timeFmt,
                secondsRemaining = seconds,
                message = "Rate limited. Rescheduling in 15m"
            )
        }

        return null
    }
}
