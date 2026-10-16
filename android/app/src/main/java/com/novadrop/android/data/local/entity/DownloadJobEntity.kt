package com.novadrop.android.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.novadrop.android.core.model.DownloadedFileInfo
import com.novadrop.android.core.model.DownloadJob
import com.novadrop.android.core.model.DownloadState
import org.json.JSONArray
import org.json.JSONObject

@Entity(tableName = "download_jobs")
data class DownloadJobEntity(
    @PrimaryKey
    val id: String,
    val url: String,
    val title: String,
    val tool: String,
    val state: String,
    val selectedFormat: String,
    val outputDir: String,
    val outputFilePath: String?,
    val outputUri: String?,
    val progressPercent: Float,
    val downloadedBytes: Long,
    val totalBytes: Long,
    val speedFormatted: String,
    val etaFormatted: String,
    val itemsDone: Int,
    val totalItems: Int,
    val filesJson: String,
    val thumbnail: String?,
    val errorMessage: String?,
    val scheduledTimestamp: Long?,
    val scheduledTimeFormatted: String?,
    val createdAt: Long,
    val finishedAt: Long?
) {
    fun toDomain(): DownloadJob {
        val parsedFiles = mutableListOf<DownloadedFileInfo>()
        try {
            if (filesJson.isNotBlank()) {
                val array = JSONArray(filesJson)
                for (i in 0 until array.length()) {
                    val obj = array.getJSONObject(i)
                    parsedFiles.add(
                        DownloadedFileInfo(
                            name = obj.optString("name"),
                            path = obj.optString("path"),
                            sizeBytes = obj.optLong("sizeBytes", 0L),
                            mimeType = obj.optString("mimeType")
                        )
                    )
                }
            }
        } catch (_: Exception) {}

        val stateEnum = try {
            DownloadState.valueOf(state)
        } catch (_: Exception) {
            DownloadState.FAILED
        }

        return DownloadJob(
            id = id,
            url = url,
            title = title,
            tool = tool,
            state = stateEnum,
            selectedFormat = selectedFormat,
            outputDir = outputDir,
            outputFilePath = outputFilePath,
            outputUri = outputUri,
            progressPercent = progressPercent,
            downloadedBytes = downloadedBytes,
            totalBytes = totalBytes,
            speedFormatted = speedFormatted,
            etaFormatted = etaFormatted,
            itemsDone = itemsDone,
            totalItems = totalItems,
            files = parsedFiles,
            thumbnail = thumbnail,
            errorMessage = errorMessage,
            scheduledTimestamp = scheduledTimestamp,
            scheduledTimeFormatted = scheduledTimeFormatted,
            createdAt = createdAt,
            finishedAt = finishedAt
        )
    }

    companion object {
        fun fromDomain(job: DownloadJob): DownloadJobEntity {
            val array = JSONArray()
            job.files.forEach { file ->
                val obj = JSONObject().apply {
                    put("name", file.name)
                    put("path", file.path)
                    put("sizeBytes", file.sizeBytes)
                    put("mimeType", file.mimeType)
                }
                array.put(obj)
            }

            return DownloadJobEntity(
                id = job.id,
                url = job.url,
                title = job.title,
                tool = job.tool,
                state = job.state.name,
                selectedFormat = job.selectedFormat,
                outputDir = job.outputDir,
                outputFilePath = job.outputFilePath,
                outputUri = job.outputUri,
                progressPercent = job.progressPercent,
                downloadedBytes = job.downloadedBytes,
                totalBytes = job.totalBytes,
                speedFormatted = job.speedFormatted,
                etaFormatted = job.etaFormatted,
                itemsDone = job.itemsDone,
                totalItems = job.totalItems,
                filesJson = array.toString(),
                thumbnail = job.thumbnail,
                errorMessage = job.errorMessage,
                scheduledTimestamp = job.scheduledTimestamp,
                scheduledTimeFormatted = job.scheduledTimeFormatted,
                createdAt = job.createdAt,
                finishedAt = job.finishedAt
            )
        }
    }
}
