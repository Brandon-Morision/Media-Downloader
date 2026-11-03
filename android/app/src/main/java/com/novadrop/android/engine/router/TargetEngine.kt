package com.novadrop.android.engine.router

/**
 * Declares the target media extraction engine to which a given URL should be routed.
 */
enum class TargetEngine {
    /** NewPipeExtractor for native YouTube / streaming media extraction */
    NEWPIPE,

    /** Native HTTP / OkHttp / JSON extractors for Reddit single media, Booru single posts, and direct media */
    NATIVE,

    /** gallery-dl via Python 3.12 wheel runtime for multi-image galleries and art portfolios */
    GALLERY_DL,

    /** yt-dlp via youtubedl-android library for general web media (requires configured cookies) */
    YT_DLP,

    /** URL is not supported or requires authentication cookies that have not been configured */
    UNSUPPORTED
}

/**
 * The routing decision returned by [EngineRouter].
 *
 * @param engine The resolved [TargetEngine]
 * @param reason Human-readable explanation when [engine] is [TargetEngine.UNSUPPORTED], or extra context
 */
data class RouteDecision(
    val engine: TargetEngine,
    val reason: String? = null
)
