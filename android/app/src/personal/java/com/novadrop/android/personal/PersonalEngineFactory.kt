package com.novadrop.android.personal

import android.content.Context
import com.novadrop.android.core.util.CookiesManager
import com.novadrop.android.core.util.FFmpegCapabilityManager
import com.novadrop.android.domain.engine.MediaExtractorEngine
import com.novadrop.android.engine.native.NativeExtractorEngine
import com.novadrop.android.engine.router.EngineRouter
import com.novadrop.android.engine.router.RoutedExtractorEngine
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient

/**
 * Instantiates the routed multi-engine architecture for the Personal flavor.
 * Dispatches startup capability checks and wires together NewPipe, Native, gallery-dl, and yt-dlp.
 */
object PersonalEngineFactory {

    @JvmStatic
    fun create(context: Context, okHttpClient: OkHttpClient): MediaExtractorEngine {
        val appContext = context.applicationContext

        // Run capability check at startup asynchronously to catch 16 KB page-size or linker issues without blocking main thread
        kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.IO).launch {
            try {
                FFmpegCapabilityManager.getCapability(appContext)
            } catch (_: Throwable) {}
        }

        val newPipeEngine = NativeExtractorEngine(appContext, okHttpClient)
        val nativeEngine = NativeExtractorEngine(appContext, okHttpClient)
        val galleryDlEngine = GalleryDlEngine(appContext)
        val ytDlpEngine = YtDlpEngine(appContext)

        val router = EngineRouter(
            hasCookies = { CookiesManager.hasCookies(appContext) },
            isPersonalFlavor = true
        )

        return RoutedExtractorEngine(
            router = router,
            newPipeEngine = newPipeEngine,
            nativeEngine = nativeEngine,
            galleryDlEngine = galleryDlEngine,
            ytDlpEngine = ytDlpEngine
        )
    }
}
