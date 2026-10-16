package com.novadrop.android.data.local.entity

import com.novadrop.android.core.model.DownloadedFileInfo
import com.novadrop.android.core.model.DownloadJob
import com.novadrop.android.core.model.DownloadState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class DownloadJobEntityTest {

    @Test
    fun testDomainToEntityRoundTrip() {
        val files = listOf(
            DownloadedFileInfo("video.mp4", "/storage/NovaDrop/Videos/video.mp4", 102400L, "video/mp4"),
            DownloadedFileInfo("thumb.jpg", "/storage/NovaDrop/Videos/thumb.jpg", 2048L, "image/jpeg")
        )

        val domain = DownloadJob(
            id = "dl-roundtrip-01",
            url = "https://example.com/video.mp4",
            title = "Test Video Roundtrip",
            tool = "yt-dlp",
            state = DownloadState.COMPLETED,
            selectedFormat = "1080p",
            outputDir = "/storage/NovaDrop/Videos",
            outputFilePath = "/storage/NovaDrop/Videos/video.mp4",
            progressPercent = 100f,
            downloadedBytes = 102400L,
            totalBytes = 102400L,
            speedFormatted = "2.5 MB/s",
            etaFormatted = "00:00",
            files = files,
            thumbnail = "https://example.com/thumb.jpg",
            createdAt = 1700000000000L,
            finishedAt = 1700000060000L
        )

        val entity = DownloadJobEntity.fromDomain(domain)
        val reconstructed = entity.toDomain()

        assertEquals(domain.id, reconstructed.id)
        assertEquals(domain.url, reconstructed.url)
        assertEquals(domain.title, reconstructed.title)
        assertEquals(domain.tool, reconstructed.tool)
        assertEquals(domain.state, reconstructed.state)
        assertEquals(domain.selectedFormat, reconstructed.selectedFormat)
        assertEquals(domain.outputFilePath, reconstructed.outputFilePath)
        assertEquals(domain.progressPercent, reconstructed.progressPercent, 0.001f)
        assertEquals(domain.downloadedBytes, reconstructed.downloadedBytes)
        assertEquals(domain.totalBytes, reconstructed.totalBytes)
        assertEquals(2, reconstructed.files.size)
        assertEquals("video.mp4", reconstructed.files[0].name)
        assertEquals(102400L, reconstructed.files[0].sizeBytes)
        assertEquals("thumb.jpg", reconstructed.files[1].name)
        assertEquals(domain.createdAt, reconstructed.createdAt)
        assertEquals(domain.finishedAt, reconstructed.finishedAt)
    }

    @Test
    fun testEntityHandlesCorruptedOrEmptyFilesJson() {
        val entity = DownloadJobEntity(
            id = "dl-corrupt",
            url = "https://example.com",
            title = "Test",
            tool = "yt-dlp",
            state = "RUNNING",
            selectedFormat = "auto",
            outputDir = "",
            outputFilePath = null,
            outputUri = null,
            progressPercent = 0f,
            downloadedBytes = 0L,
            totalBytes = 0L,
            speedFormatted = "",
            etaFormatted = "",
            itemsDone = 0,
            totalItems = 0,
            filesJson = "NOT_A_VALID_JSON_STRING",
            thumbnail = null,
            errorMessage = null,
            scheduledTimestamp = null,
            scheduledTimeFormatted = null,
            createdAt = System.currentTimeMillis(),
            finishedAt = null
        )

        val domain = entity.toDomain()
        assertNotNull(domain.files)
        assertEquals(0, domain.files.size)
        assertEquals(DownloadState.RUNNING, domain.state)
    }

    @Test
    fun testEntityHandlesInvalidStateGracefully() {
        val entity = DownloadJobEntity(
            id = "dl-invalid-state",
            url = "https://example.com",
            title = "Test",
            tool = "yt-dlp",
            state = "NON_EXISTENT_STATE",
            selectedFormat = "auto",
            outputDir = "",
            outputFilePath = null,
            outputUri = null,
            progressPercent = 0f,
            downloadedBytes = 0L,
            totalBytes = 0L,
            speedFormatted = "",
            etaFormatted = "",
            itemsDone = 0,
            totalItems = 0,
            filesJson = "",
            thumbnail = null,
            errorMessage = null,
            scheduledTimestamp = null,
            scheduledTimeFormatted = null,
            createdAt = System.currentTimeMillis(),
            finishedAt = null
        )

        val domain = entity.toDomain()
        assertEquals(DownloadState.FAILED, domain.state)
    }
}
