package com.novadrop.android.core.util

import java.util.regex.Pattern

object Validators {

    private val URL_PATTERN = Pattern.compile(
        "^https?://[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}(/.*)?$",
        Pattern.CASE_INSENSITIVE
    )

    private val ILLEGAL_FILENAME_CHARS = Pattern.compile("[\\\\/:*?\"<>|\\x00-\\x1F]")

    fun validateUrl(url: String?): Boolean {
        if (url.isNullOrBlank()) return false
        val trimmed = url.trim()
        if (trimmed.length > 2048) return false
        return URL_PATTERN.matcher(trimmed).matches()
    }

    fun validateSearchQuery(query: String?): Boolean {
        if (query.isNullOrBlank()) return false
        val trimmed = query.trim()
        return trimmed.length in 1..256
    }

    fun validateJobId(jobId: String?): Boolean {
        if (jobId.isNullOrBlank()) return false
        return jobId.length in 3..64 && jobId.all { it.isLetterOrDigit() || it == '-' || it == '_' }
    }

    fun sanitizeFilename(filename: String, fallback: String = "download"): String {
        val sanitized = ILLEGAL_FILENAME_CHARS.matcher(filename).replaceAll("_").trim()
        val cleaned = sanitized.trim('_')
        return if (cleaned.isBlank()) fallback else sanitized.take(120)
    }
}
