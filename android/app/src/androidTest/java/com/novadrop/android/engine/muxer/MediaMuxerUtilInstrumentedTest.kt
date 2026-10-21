package com.novadrop.android.engine.muxer

import android.graphics.Color
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.nio.ByteBuffer

@RunWith(AndroidJUnit4::class)
class MediaMuxerUtilInstrumentedTest {

    @Test
    fun testAdaptiveVideoAudioMux_assertsBothTracksHaveNonZeroSamplesAndDuration() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val testDir = File(context.cacheDir, "muxer_test").apply { mkdirs() }
        val videoFile = File(testDir, "test_video.mp4")
        val audioFile = File(testDir, "test_audio.m4a")
        val outputFile = File(testDir, "test_muxed_output.mp4")

        try {
            if (videoFile.exists()) videoFile.delete()
            if (audioFile.exists()) audioFile.delete()
            if (outputFile.exists()) outputFile.delete()

            // 1. Generate real synthetic 1-second H.264 video file
            generateH264VideoFile(videoFile, width = 320, height = 240, durationMs = 1000)
            assertTrue("Video test file must exist and be > 0 bytes", videoFile.exists() && videoFile.length() > 0)

            // 2. Generate real synthetic 1-second AAC audio file
            generateAacAudioFile(audioFile, sampleRate = 44100, channelCount = 2, durationMs = 1000)
            assertTrue("Audio test file must exist and be > 0 bytes", audioFile.exists() && audioFile.length() > 0)

            // 3. Mux them using MediaMuxerUtil
            var progressReported = false
            val muxResult = MediaMuxerUtil.mux(videoFile, audioFile, outputFile) { progress ->
                if (progress > 0f) progressReported = true
            }

            assertTrue("Mux result must be success: ${muxResult.exceptionOrNull()}", muxResult.isSuccess)
            assertTrue("Output file must exist", outputFile.exists())
            assertTrue("Output file size must be non-zero", outputFile.length() > 0)

            // 4. Verify container atoms and streams via MediaExtractor
            val extractor = MediaExtractor()
            extractor.setDataSource(outputFile.absolutePath)
            try {
                assertEquals("Muxed container must have exactly 2 tracks", 2, extractor.trackCount)

                var videoTrackIdx = -1
                var audioTrackIdx = -1
                for (i in 0 until extractor.trackCount) {
                    val format = extractor.getTrackFormat(i)
                    val mime = format.getString(MediaFormat.KEY_MIME) ?: ""
                    if (mime.startsWith("video/")) {
                        videoTrackIdx = i
                    } else if (mime.startsWith("audio/")) {
                        audioTrackIdx = i
                    }
                }

                assertTrue("Video track must be found in muxed output", videoTrackIdx >= 0)
                assertTrue("Audio track must be found in muxed output", audioTrackIdx >= 0)

                val videoFormat = extractor.getTrackFormat(videoTrackIdx)
                val audioFormat = extractor.getTrackFormat(audioTrackIdx)

                val videoMime = videoFormat.getString(MediaFormat.KEY_MIME)
                val audioMime = audioFormat.getString(MediaFormat.KEY_MIME)
                assertTrue("Video MIME must be AVC/H.264: $videoMime", videoMime == MediaFormat.MIMETYPE_VIDEO_AVC)
                assertTrue("Audio MIME must be AAC: $audioMime", audioMime == MediaFormat.MIMETYPE_AUDIO_AAC || audioMime == "audio/mp4a-latm")

                val videoDurationUs = videoFormat.getLong(MediaFormat.KEY_DURATION)
                val audioDurationUs = audioFormat.getLong(MediaFormat.KEY_DURATION)

                assertTrue("Video track duration must be > 0 (was $videoDurationUs us)", videoDurationUs > 0)
                assertTrue("Audio track duration must be > 0 (was $audioDurationUs us)", audioDurationUs > 0)

                // 5. Assert video track has non-zero sample count
                extractor.selectTrack(videoTrackIdx)
                val sampleBuffer = ByteBuffer.allocateDirect(1024 * 1024)
                var videoSampleCount = 0
                while (extractor.readSampleData(sampleBuffer, 0) >= 0) {
                    videoSampleCount++
                    extractor.advance()
                }
                extractor.unselectTrack(videoTrackIdx)

                // 6. Assert audio track has non-zero sample count (verifies P0 regression: no 0-byte audio writes!)
                extractor.selectTrack(audioTrackIdx)
                var audioSampleCount = 0
                while (extractor.readSampleData(sampleBuffer, 0) >= 0) {
                    audioSampleCount++
                    extractor.advance()
                }
                extractor.unselectTrack(audioTrackIdx)

                assertTrue("Video sample count must be > 0 (actual: $videoSampleCount)", videoSampleCount > 0)
                assertTrue("Audio sample count must be > 0 (actual: $audioSampleCount)", audioSampleCount > 0)

            } finally {
                extractor.release()
            }

        } finally {
            videoFile.delete()
            audioFile.delete()
            outputFile.delete()
        }
    }

    private fun generateAacAudioFile(outputFile: File, sampleRate: Int, channelCount: Int, durationMs: Long) {
        val format = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, sampleRate, channelCount).apply {
            setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
            setInteger(MediaFormat.KEY_BIT_RATE, 128000)
            setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 16384)
        }

        val encoder = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC)
        encoder.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        encoder.start()

        val muxer = MediaMuxer(outputFile.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
        var audioTrackIndex = -1
        var muxerStarted = false

        val bufferInfo = MediaCodec.BufferInfo()
        val totalSamples = (sampleRate * (durationMs / 1000.0)).toLong()
        var samplesGenerated = 0L
        var inputDone = false
        var outputDone = false

        val pcmChunk = ByteArray(2048) // Silence

        try {
            while (!outputDone) {
                if (!inputDone) {
                    val inputBufIndex = encoder.dequeueInputBuffer(10000)
                    if (inputBufIndex >= 0) {
                        val inputBuf = encoder.getInputBuffer(inputBufIndex)!!
                        inputBuf.clear()

                        if (samplesGenerated >= totalSamples) {
                            encoder.queueInputBuffer(inputBufIndex, 0, 0, (samplesGenerated * 1_000_000L / sampleRate), MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                            inputDone = true
                        } else {
                            val samplesInChunk = (pcmChunk.size / (2 * channelCount)).toLong()
                            inputBuf.put(pcmChunk)
                            val ptsUs = (samplesGenerated * 1_000_000L / sampleRate)
                            encoder.queueInputBuffer(inputBufIndex, 0, pcmChunk.size, ptsUs, 0)
                            samplesGenerated += samplesInChunk
                        }
                    }
                }

                val outIndex = encoder.dequeueOutputBuffer(bufferInfo, 10000)
                if (outIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                    val newFormat = encoder.outputFormat
                    audioTrackIndex = muxer.addTrack(newFormat)
                    muxer.start()
                    muxerStarted = true
                } else if (outIndex >= 0) {
                    val encodedData = encoder.getOutputBuffer(outIndex)!!
                    if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0) {
                        bufferInfo.size = 0
                    }
                    if (bufferInfo.size > 0 && muxerStarted) {
                        muxer.writeSampleData(audioTrackIndex, encodedData, bufferInfo)
                    }
                    encoder.releaseOutputBuffer(outIndex, false)
                    if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
                        outputDone = true
                    }
                }
            }
        } finally {
            encoder.stop()
            encoder.release()
            if (muxerStarted) {
                muxer.stop()
            }
            muxer.release()
        }
    }

    private fun generateH264VideoFile(outputFile: File, width: Int, height: Int, durationMs: Long) {
        val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, width, height).apply {
            setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
            setInteger(MediaFormat.KEY_BIT_RATE, 500000)
            setInteger(MediaFormat.KEY_FRAME_RATE, 30)
            setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
        }

        val encoder = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
        encoder.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        val inputSurface = encoder.createInputSurface()
        encoder.start()

        val muxer = MediaMuxer(outputFile.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
        var videoTrackIndex = -1
        var muxerStarted = false

        val bufferInfo = MediaCodec.BufferInfo()
        val totalFrames = (30 * (durationMs / 1000.0)).toInt()
        var outputDone = false

        try {
            // Draw frames on input surface
            for (i in 0 until totalFrames) {
                val canvas = inputSurface.lockHardwareCanvas()
                canvas.drawColor(if (i % 2 == 0) Color.RED else Color.BLUE)
                inputSurface.unlockCanvasAndPost(canvas)
                Thread.sleep(15) // small pacing

                // Drain any available output
                drainEncoder(encoder, muxer, bufferInfo, false) { trackIndex, started ->
                    videoTrackIndex = trackIndex
                    muxerStarted = started
                }
            }

            encoder.signalEndOfInputStream()

            // Drain until EOS
            while (!outputDone) {
                outputDone = drainEncoder(encoder, muxer, bufferInfo, true) { trackIndex, started ->
                    videoTrackIndex = trackIndex
                    muxerStarted = started
                }
            }
        } finally {
            inputSurface.release()
            encoder.stop()
            encoder.release()
            if (muxerStarted) {
                muxer.stop()
            }
            muxer.release()
        }
    }

    private inline fun drainEncoder(
        encoder: MediaCodec,
        muxer: MediaMuxer,
        bufferInfo: MediaCodec.BufferInfo,
        endOfStream: Boolean,
        onMuxerConfigured: (Int, Boolean) -> Unit
    ): Boolean {
        var videoTrackIndex = 0
        var muxerStarted = false
        while (true) {
            val status = encoder.dequeueOutputBuffer(bufferInfo, 10000)
            if (status == MediaCodec.INFO_TRY_AGAIN_LATER) {
                if (!endOfStream) break
            } else if (status == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                val newFormat = encoder.outputFormat
                videoTrackIndex = muxer.addTrack(newFormat)
                muxer.start()
                muxerStarted = true
                onMuxerConfigured(videoTrackIndex, muxerStarted)
            } else if (status >= 0) {
                val encodedData = encoder.getOutputBuffer(status)!!
                if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0) {
                    bufferInfo.size = 0
                }
                if (bufferInfo.size > 0) {
                    muxer.writeSampleData(videoTrackIndex, encodedData, bufferInfo)
                }
                encoder.releaseOutputBuffer(status, false)
                if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
                    return true
                }
            }
        }
        return false
    }
}
