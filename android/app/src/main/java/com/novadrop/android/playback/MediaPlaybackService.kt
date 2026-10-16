package com.novadrop.android.playback

import android.content.Intent
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

class MediaPlaybackService : MediaSessionService() {

    private var mediaSession: MediaSession? = null

    override fun onCreate() {
        super.onCreate()
        val playbackManager = PlaybackManager.getInstance(this)
        mediaSession = MediaSession.Builder(this, playbackManager.exoPlayer).build()
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? {
        return mediaSession
    }

    override fun onDestroy() {
        mediaSession?.run {
            player.release()
            release()
            mediaSession = null
        }
        super.onDestroy()
    }
}
