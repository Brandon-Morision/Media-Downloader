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
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
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
        extractorEngine = com.novadrop.android.engine.router.EngineProvider.createEngine(this, okHttpClient)
        downloadRepository = DownloadRepositoryImpl(this, database.downloadJobDao(), extractorEngine)
        preferencesRepository = UserPreferencesRepository(this)
        playbackManager = PlaybackManager.getInstance(this)

        // Process-kill recovery sweep: recover any stale running/preparing jobs interrupted by OS termination
        kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.IO).launch {
            try {
                val activeJobs = database.downloadJobDao().getActiveJobs()
                for (job in activeJobs) {
                    database.downloadJobDao().updateJob(
                        job.copy(
                            state = com.novadrop.android.core.model.DownloadState.FAILED.name,
                            errorMessage = "Interrupted by system process termination"
                        )
                    )
                }
            } catch (_: Throwable) {}
        }
    }
}
