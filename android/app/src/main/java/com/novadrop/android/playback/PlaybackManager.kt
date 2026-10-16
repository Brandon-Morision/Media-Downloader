package com.novadrop.android.playback

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.novadrop.android.core.model.DownloadedFileInfo
import com.novadrop.android.core.model.DownloadJob
import com.novadrop.android.core.model.MediaCategory
import com.novadrop.android.core.util.Formatters
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.File

class PlaybackManager private constructor(private val context: Context) {

    val exoPlayer: ExoPlayer = ExoPlayer.Builder(context.applicationContext).build()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private val _isPlaying = MutableStateFlow(false)
    val isPlaying: StateFlow<Boolean> = _isPlaying.asStateFlow()

    private val _currentTitle = MutableStateFlow("")
    val currentTitle: StateFlow<String> = _currentTitle.asStateFlow()

    private val _currentPositionMs = MutableStateFlow(0L)
    val currentPositionMs: StateFlow<Long> = _currentPositionMs.asStateFlow()

    private val _durationMs = MutableStateFlow(0L)
    val durationMs: StateFlow<Long> = _durationMs.asStateFlow()

    private val _isAudioOnly = MutableStateFlow(false)
    val isAudioOnly: StateFlow<Boolean> = _isAudioOnly.asStateFlow()

    private val _isPlayerActive = MutableStateFlow(false)
    val isPlayerActive: StateFlow<Boolean> = _isPlayerActive.asStateFlow()

    private val _isMiniPlayer = MutableStateFlow(false)
    val isMiniPlayer: StateFlow<Boolean> = _isMiniPlayer.asStateFlow()

    private val _showExitConfirmDialog = MutableStateFlow(false)
    val showExitConfirmDialog: StateFlow<Boolean> = _showExitConfirmDialog.asStateFlow()

    init {
        exoPlayer.addListener(object : Player.Listener {
            override fun onIsPlayingChanged(playing: Boolean) {
                _isPlaying.value = playing
            }

            override fun onPlaybackStateChanged(state: Int) {
                if (state == Player.STATE_READY) {
                    _durationMs.value = exoPlayer.duration.coerceAtLeast(0L)
                } else if (state == Player.STATE_ENDED) {
                    _isPlaying.value = false
                }
            }
        })

        // Position ticker
        scope.launch {
            while (true) {
                if (exoPlayer.isPlaying) {
                    _currentPositionMs.value = exoPlayer.currentPosition.coerceAtLeast(0L)
                    _durationMs.value = exoPlayer.duration.coerceAtLeast(0L)
                }
                delay(500)
            }
        }
    }

    fun playFile(file: DownloadedFileInfo, title: String? = null) {
        val uri = if (file.path.startsWith("content://") || file.path.startsWith("http")) {
            Uri.parse(file.path)
        } else {
            Uri.fromFile(File(file.path))
        }

        val mediaItem = MediaItem.fromUri(uri)
        _currentTitle.value = title ?: file.name
        val ext = file.name.substringAfterLast('.', "").lowercase()
        _isAudioOnly.value = file.mimeType.startsWith("audio/") || ext in listOf("mp3", "m4a", "flac", "wav", "ogg", "opus", "aac")

        exoPlayer.setMediaItem(mediaItem)
        exoPlayer.prepare()
        exoPlayer.play()
        _isPlayerActive.value = true
        _isMiniPlayer.value = false
        try {
            context.startService(Intent(context, MediaPlaybackService::class.java))
        } catch (_: Exception) {}
    }

    fun playUrl(url: String, title: String, isAudio: Boolean = false) {
        val mediaItem = MediaItem.fromUri(Uri.parse(url))
        _currentTitle.value = title
        _isAudioOnly.value = isAudio

        exoPlayer.setMediaItem(mediaItem)
        exoPlayer.prepare()
        exoPlayer.play()
        _isPlayerActive.value = true
        _isMiniPlayer.value = false
        try {
            context.startService(Intent(context, MediaPlaybackService::class.java))
        } catch (_: Exception) {}
    }

    fun playJob(job: DownloadJob) {
        val category = Formatters.detectCategory(job.outputFilePath ?: job.title, job.files)
        val file = job.files.firstOrNull()
        if (file != null) {
            playFile(file, job.title)
        } else if (job.outputFilePath != null) {
            val f = DownloadedFileInfo(
                name = job.title,
                path = job.outputFilePath,
                sizeBytes = job.totalBytes,
                mimeType = if (category == MediaCategory.MUSIC) "audio/*" else "video/*"
            )
            playFile(f, job.title)
        } else {
            playUrl(job.url, job.title, isAudio = category == MediaCategory.MUSIC)
        }
    }

    fun togglePlayPause() {
        if (exoPlayer.isPlaying) {
            exoPlayer.pause()
        } else {
            exoPlayer.play()
        }
    }

    fun seekTo(positionMs: Long) {
        exoPlayer.seekTo(positionMs)
        _currentPositionMs.value = positionMs
    }

    fun forward30() {
        seekTo((exoPlayer.currentPosition + 30_000L).coerceAtMost(exoPlayer.duration))
    }

    fun rewind10() {
        seekTo((exoPlayer.currentPosition - 10_000L).coerceAtLeast(0L))
    }

    fun setPlaybackSpeed(speed: Float) {
        exoPlayer.setPlaybackSpeed(speed)
    }

    fun handleFullscreenExit(userAudioSetting: String, userVideoSetting: String) {
        if (_isAudioOnly.value) {
            // Audio files always transition to mini-player by default
            if (userAudioSetting == "exit") {
                stopAndClose()
            } else {
                _isMiniPlayer.value = true
            }
        } else {
            // Video files check setting
            when (userVideoSetting) {
                "mini" -> _isMiniPlayer.value = true
                "exit" -> stopAndClose()
                else -> _showExitConfirmDialog.value = true // ask
            }
        }
    }

    fun dismissExitDialog() {
        _showExitConfirmDialog.value = false
    }

    fun switchToMiniPlayer() {
        _showExitConfirmDialog.value = false
        _isMiniPlayer.value = true
    }

    fun expandMiniPlayer() {
        _isMiniPlayer.value = false
    }

    fun stopAndClose() {
        _showExitConfirmDialog.value = false
        _isMiniPlayer.value = false
        _isPlayerActive.value = false
        exoPlayer.stop()
        exoPlayer.clearMediaItems()
    }

    companion object {
        @Volatile
        private var INSTANCE: PlaybackManager? = null

        fun getInstance(context: Context): PlaybackManager {
            return INSTANCE ?: synchronized(this) {
                val instance = PlaybackManager(context.applicationContext)
                INSTANCE = instance
                instance
            }
        }
    }
}
