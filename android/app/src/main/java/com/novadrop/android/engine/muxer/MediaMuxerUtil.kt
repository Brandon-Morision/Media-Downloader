package com.novadrop.android.engine.muxer

import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import java.io.File
import java.nio.ByteBuffer

object MediaMuxerUtil {

    private val SUPPORTED_VIDEO_MIMES = setOf(
        MediaFormat.MIMETYPE_VIDEO_AVC,      // video/avc (H.264)
        "video/hevc",                         // video/hevc (H.265)
        "video/mp4v-es"                       // MPEG-4 video
    )

    private val SUPPORTED_AUDIO_MIMES = setOf(
        MediaFormat.MIMETYPE_AUDIO_AAC,      // audio/mp4a-latm
        "audio/mp4a-latm"
    )

    /**
     * Muxes separate MP4 video and M4A audio files into a single destination MP4 file
     * using Android's native MediaMuxer and MediaExtractor (stream-copy, no re-encoding).
     *
     * Samples are written interleaved chronologically by presentation timestamp (sampleTime)
     * to avoid memory buffer overruns and keep audio/video synchronized.
     */
    fun mux(
        videoFile: File,
        audioFile: File,
        outputFile: File,
        onProgress: ((Float) -> Unit)? = null
    ): Result<File> {
        val videoExtractor = MediaExtractor()
        val audioExtractor = MediaExtractor()
        var muxer: MediaMuxer? = null
        var muxerStarted = false

        try {
            videoExtractor.setDataSource(videoFile.absolutePath)
            audioExtractor.setDataSource(audioFile.absolutePath)

            var videoTrackIndex = -1
            var videoFormat: MediaFormat? = null
            var videoMime = ""
            for (i in 0 until videoExtractor.trackCount) {
                val format = videoExtractor.getTrackFormat(i)
                val mime = format.getString(MediaFormat.KEY_MIME) ?: ""
                if (mime.startsWith("video/")) {
                    videoTrackIndex = i
                    videoFormat = format
                    videoMime = mime
                    break
                }
            }
            if (videoTrackIndex == -1 || videoFormat == null) {
                return Result.failure(IllegalStateException("No video track found in ${videoFile.name}"))
            }

            if (!SUPPORTED_VIDEO_MIMES.contains(videoMime)) {
                return Result.failure(
                    IllegalArgumentException("Unsupported video codec '$videoMime' for MP4 container muxing. Supported codecs: ${SUPPORTED_VIDEO_MIMES.joinToString()}")
                )
            }

            var audioTrackIndex = -1
            var audioFormat: MediaFormat? = null
            var audioMime = ""
            for (i in 0 until audioExtractor.trackCount) {
                val format = audioExtractor.getTrackFormat(i)
                val mime = format.getString(MediaFormat.KEY_MIME) ?: ""
                if (mime.startsWith("audio/")) {
                    audioTrackIndex = i
                    audioFormat = format
                    audioMime = mime
                    break
                }
            }
            if (audioTrackIndex == -1 || audioFormat == null) {
                return Result.failure(IllegalStateException("No audio track found in ${audioFile.name}"))
            }

            if (!SUPPORTED_AUDIO_MIMES.contains(audioMime)) {
                return Result.failure(
                    IllegalArgumentException("Unsupported audio codec '$audioMime' for MP4 container muxing. Supported codecs: ${SUPPORTED_AUDIO_MIMES.joinToString()}")
                )
            }

            muxer = MediaMuxer(outputFile.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
            val muxerVideoTrack = muxer.addTrack(videoFormat)
            val muxerAudioTrack = muxer.addTrack(audioFormat)
            muxer.start()
            muxerStarted = true

            videoExtractor.selectTrack(videoTrackIndex)
            audioExtractor.selectTrack(audioTrackIndex)

            val maxVideoBufferSize = videoFormat.getIntegerSafely(MediaFormat.KEY_MAX_INPUT_SIZE, 1024 * 1024)
            val maxAudioBufferSize = audioFormat.getIntegerSafely(MediaFormat.KEY_MAX_INPUT_SIZE, 512 * 1024)

            val videoBuffer = ByteBuffer.allocateDirect(maxVideoBufferSize)
            val audioBuffer = ByteBuffer.allocateDirect(maxAudioBufferSize)
            val videoBufferInfo = MediaCodec.BufferInfo()
            val audioBufferInfo = MediaCodec.BufferInfo()

            val videoDurationUs = videoFormat.getLongSafely(MediaFormat.KEY_DURATION, 0L)
            val audioDurationUs = audioFormat.getLongSafely(MediaFormat.KEY_DURATION, 0L)
            val maxDurationUs = Math.max(videoDurationUs, audioDurationUs)

            var videoDone = false
            var audioDone = false
            var lastReportedProgress = 0f

            // Interleave sample writing by presentation timestamp to ensure proper MP4 interleaving
            while (!videoDone || !audioDone) {
                val videoTime = if (!videoDone) videoExtractor.sampleTime else Long.MAX_VALUE
                val audioTime = if (!audioDone) audioExtractor.sampleTime else Long.MAX_VALUE

                if (!videoDone && (audioDone || videoTime <= audioTime)) {
                    val sampleSize = videoExtractor.readSampleData(videoBuffer, 0)
                    if (sampleSize >= 0) {
                        videoBufferInfo.offset = 0
                        videoBufferInfo.size = sampleSize
                        videoBufferInfo.presentationTimeUs = videoExtractor.sampleTime
                        videoBufferInfo.flags = videoExtractor.sampleFlags

                        muxer.writeSampleData(muxerVideoTrack, videoBuffer, videoBufferInfo)
                        videoExtractor.advance()

                        if (maxDurationUs > 0) {
                            val progress = ((videoTime.toFloat() / maxDurationUs.toFloat()) * 100f).coerceIn(0f, 99f)
                            if (progress - lastReportedProgress >= 5f) {
                                lastReportedProgress = progress
                                onProgress?.invoke(progress)
                            }
                        }
                    } else {
                        videoDone = true
                    }
                } else if (!audioDone) {
                    val sampleSize = audioExtractor.readSampleData(audioBuffer, 0)
                    if (sampleSize >= 0) {
                        audioBufferInfo.offset = 0
                        audioBufferInfo.size = sampleSize
                        audioBufferInfo.presentationTimeUs = audioExtractor.sampleTime
                        audioBufferInfo.flags = audioExtractor.sampleFlags

                        muxer.writeSampleData(muxerAudioTrack, audioBuffer, audioBufferInfo)
                        audioExtractor.advance()
                    } else {
                        audioDone = true
                    }
                }
            }

            onProgress?.invoke(100f)
            return Result.success(outputFile)

        } catch (e: Exception) {
            try {
                if (outputFile.exists()) {
                    outputFile.delete()
                }
            } catch (_: Exception) {}
            return Result.failure(e)
        } finally {
            if (muxerStarted) {
                try {
                    muxer?.stop()
                } catch (_: Exception) {}
            }
            try {
                muxer?.release()
            } catch (_: Exception) {}
            try {
                videoExtractor.release()
            } catch (_: Exception) {}
            try {
                audioExtractor.release()
            } catch (_: Exception) {}
        }
    }

    private fun MediaFormat.getIntegerSafely(key: String, defaultValue: Int): Int {
        return if (containsKey(key)) {
            try {
                getInteger(key)
            } catch (_: Exception) {
                defaultValue
            }
        } else {
            defaultValue
        }
    }

    private fun MediaFormat.getLongSafely(key: String, defaultValue: Long): Long {
        return if (containsKey(key)) {
            try {
                getLong(key)
            } catch (_: Exception) {
                defaultValue
            }
        } else {
            defaultValue
        }
    }
}
