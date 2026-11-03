package com.novadrop.android.engine.router

import android.content.Context
import android.util.Log
import com.novadrop.android.domain.engine.MediaExtractorEngine
import com.novadrop.android.engine.native.NativeExtractorEngine
import okhttp3.OkHttpClient

/**
 * Provides the active [MediaExtractorEngine] instance for the application.
 *
 * In the personal flavor, discovers and instantiates `PersonalEngineFactory` via reflection.
 * In the standard flavor, cleanly instantiates [NativeExtractorEngine] without external C/Python dependencies.
 */
object EngineProvider {

    private const val TAG = "EngineProvider"

    fun createEngine(context: Context, okHttpClient: OkHttpClient): MediaExtractorEngine {
        return try {
            val factoryClass = Class.forName("com.novadrop.android.personal.PersonalEngineFactory")
            val createMethod = factoryClass.getMethod("create", Context::class.java, OkHttpClient::class.java)
            val engine = createMethod.invoke(null, context, okHttpClient) as MediaExtractorEngine
            Log.i(TAG, "Initialized Personal multi-engine router: ${engine.engineName}")
            engine
        } catch (_: ClassNotFoundException) {
            Log.i(TAG, "Standard flavor active: using NativeExtractorEngine")
            NativeExtractorEngine(context, okHttpClient)
        } catch (e: Exception) {
            Log.w(TAG, "Could not initialize PersonalEngineFactory (${e.message}), falling back to NativeExtractorEngine", e)
            NativeExtractorEngine(context, okHttpClient)
        }
    }
}
