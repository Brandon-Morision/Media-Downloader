package com.novadrop.android.core.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class QueueStateTransitionTest {

    @Test
    fun testInitialJobCreation() {
        val job = DownloadJob(
            id = "dl-test01",
            url = "https://example.com/video.mp4",
            title = "Test Video",
            state = DownloadState.PENDING
        )

        assertEquals(DownloadState.PENDING, job.state)
        assertEquals(0f, job.progressPercent, 0.001f)
        assertEquals(0L, job.downloadedBytes)
        assertNull(job.finishedAt)
        assertNull(job.errorMessage)
    }

    @Test
    fun testJobTransitionToRunning() {
        val pendingJob = DownloadJob(
            id = "dl-test02",
            url = "https://example.com/video.mp4",
            title = "Test Video",
            state = DownloadState.PENDING
        )

        val runningJob = pendingJob.copy(
            state = DownloadState.RUNNING,
            progressPercent = 25.5f,
            downloadedBytes = 2500L,
            totalBytes = 10000L,
            speedFormatted = "1.2 MB/s",
            etaFormatted = "00:08"
        )

        assertEquals(DownloadState.RUNNING, runningJob.state)
        assertEquals(25.5f, runningJob.progressPercent, 0.001f)
        assertEquals("1.2 MB/s", runningJob.speedFormatted)
    }

    @Test
    fun testJobPauseAndResume() {
        val running = DownloadJob(
            id = "dl-test03",
            url = "https://example.com/song.mp3",
            title = "Song",
            state = DownloadState.RUNNING,
            progressPercent = 50f
        )

        val paused = running.copy(state = DownloadState.PAUSED)
        assertEquals(DownloadState.PAUSED, paused.state)
        assertEquals(50f, paused.progressPercent, 0.001f)

        val resumed = paused.copy(state = DownloadState.RUNNING)
        assertEquals(DownloadState.RUNNING, resumed.state)
    }

    @Test
    fun testJobCompletion() {
        val running = DownloadJob(
            id = "dl-test04",
            url = "https://example.com/image.png",
            title = "Image",
            state = DownloadState.RUNNING
        )

        val fileInfo = DownloadedFileInfo(
            name = "image.png",
            path = "/storage/emulated/0/Download/NovaDrop/Images/image.png",
            sizeBytes = 500_000L,
            mimeType = "image/png"
        )

        val completed = running.copy(
            state = DownloadState.COMPLETED,
            progressPercent = 100f,
            downloadedBytes = 500_000L,
            totalBytes = 500_000L,
            files = listOf(fileInfo),
            outputFilePath = fileInfo.path,
            finishedAt = System.currentTimeMillis()
        )

        assertEquals(DownloadState.COMPLETED, completed.state)
        assertEquals(100f, completed.progressPercent, 0.001f)
        assertEquals(1, completed.files.size)
        assertEquals(fileInfo.path, completed.outputFilePath)
        assertTrue(completed.finishedAt!! > 0)
    }

    @Test
    fun testJobRateLimitScheduling() {
        val running = DownloadJob(
            id = "dl-test05",
            url = "https://example.com/api/post",
            title = "Post Media",
            state = DownloadState.RUNNING
        )

        val resetTs = System.currentTimeMillis() + 600_000L
        val scheduled = running.copy(
            state = DownloadState.SCHEDULED,
            scheduledTimestamp = resetTs,
            scheduledTimeFormatted = "20:30:00",
            errorMessage = "Rate limited. Rescheduling in 10m"
        )

        assertEquals(DownloadState.SCHEDULED, scheduled.state)
        assertEquals(resetTs, scheduled.scheduledTimestamp)
        assertTrue(scheduled.errorMessage!!.contains("Rate limited"))
    }

    @Test
    fun testJobRetryResetsProgress() {
        val failed = DownloadJob(
            id = "dl-test06",
            url = "https://example.com/failed.mp4",
            title = "Failed Download",
            state = DownloadState.FAILED,
            progressPercent = 40f,
            errorMessage = "Connection reset"
        )

        val retried = failed.copy(
            state = DownloadState.PENDING,
            progressPercent = 0f,
            downloadedBytes = 0L,
            errorMessage = null,
            createdAt = System.currentTimeMillis()
        )

        assertEquals(DownloadState.PENDING, retried.state)
        assertEquals(0f, retried.progressPercent, 0.001f)
        assertNull(retried.errorMessage)
    }

    @Test
    fun testJobCancellationFromRunning() {
        val running = DownloadJob(
            id = "dl-test07",
            url = "https://example.com/stream.mp4",
            title = "Stream",
            state = DownloadState.RUNNING,
            progressPercent = 75f
        )

        val cancelled = running.copy(
            state = DownloadState.CANCELLED,
            errorMessage = "Cancelled by user"
        )

        assertEquals(DownloadState.CANCELLED, cancelled.state)
        assertEquals("Cancelled by user", cancelled.errorMessage)
    }

    @Test
    fun testJobCancellationFromPending() {
        val pending = DownloadJob(
            id = "dl-test08",
            url = "https://example.com/queued.mp4",
            title = "Queued Video",
            state = DownloadState.PENDING
        )

        val cancelled = pending.copy(
            state = DownloadState.CANCELLED,
            errorMessage = "Cancelled by user"
        )

        assertEquals(DownloadState.CANCELLED, cancelled.state)
    }

    @Test
    fun testMultipleQueuedJobsIntegrity() {
        val jobs = (1..5).map { index ->
            DownloadJob(
                id = "dl-batch-$index",
                url = "https://example.com/item$index.mp4",
                title = "Batch Item #$index",
                state = if (index == 1) DownloadState.RUNNING else DownloadState.PENDING
            )
        }

        assertEquals(5, jobs.size)
        assertEquals(1, jobs.count { it.state == DownloadState.RUNNING })
        assertEquals(4, jobs.count { it.state == DownloadState.PENDING })
        // All IDs must be distinct
        assertEquals(5, jobs.map { it.id }.distinct().size)
    }
}
