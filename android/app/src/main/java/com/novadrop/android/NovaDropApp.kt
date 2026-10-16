package com.novadrop.android

import android.app.Application
import com.novadrop.android.data.local.NovaDropDatabase
import com.novadrop.android.data.preferences.UserPreferencesRepository
import com.novadrop.android.data.repository.DownloadRepositoryImpl
import com.novadrop.android.domain.engine.MediaExtractorEngine
import com.novadrop.android.domain.repository.DownloadRepository
import com.novadrop.android.engine.native.NativeExtractorEngine
import com.novadrop.android.playback.PlaybackManager
import com.novadrop.android.service.NotificationHelper

import com.novadrop.android.engine.newpipe.NewPipeDownloaderImpl
import okhttp3.OkHttpClient
import org.schabi.newpipe.extractor.NewPipe
import java.util.concurrent.TimeUnit

class NovaDropApp : Application() {

    lateinit var database: NovaDropDatabase
        private set

    lateinit var extractorEngine: MediaExtractorEngine
        private set

    lateinit var downloadRepository: DownloadRepository
        private set

    lateinit var preferencesRepository: UserPreferencesRepository
        private set

    lateinit var playbackManager: PlaybackManager
        private set

    lateinit var okHttpClient: OkHttpClient
        private set

    override fun onCreate() {
        super.onCreate()

        NotificationHelper.createChannels(this)

        okHttpClient = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .followRedirects(true)
            .followSslRedirects(true)
            .build()

        NewPipe.init(NewPipeDownloaderImpl(okHttpClient))

        database = NovaDropDatabase.getInstance(this)
        extractorEngine = NativeExtractorEngine(this, okHttpClient)
        downloadRepository = DownloadRepositoryImpl(this, database.downloadJobDao(), extractorEngine)
        preferencesRepository = UserPreferencesRepository(this)
        playbackManager = PlaybackManager.getInstance(this)
    }
}
