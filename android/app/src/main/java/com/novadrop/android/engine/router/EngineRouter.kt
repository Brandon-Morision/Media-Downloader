package com.novadrop.android.engine.router

import java.util.Locale

/**
 * Routes incoming URLs to their optimal media extraction engine based on proven capabilities:
 * - YouTube -> NewPipeExtractor
 * - Reddit single media, Booru single posts, direct media URLs -> NativeExtractorEngine
 * - Image galleries (Reddit galleries, Booru tag searches/pools) and Art sites (Pixiv, DeviantArt, ArtStation, Imgur) -> gallery-dl
 * - Any other URL -> yt-dlp ONLY if an authentication cookies file is configured; otherwise rejected
 *   with a clear user-readable explanation.
 *
 * @param hasCookies Supplier returning true if a valid cookies.txt file is configured in app storage
 * @param isPersonalFlavor True if running under the personal flavor containing youtubedl-android and gallery-dl
 */
class EngineRouter(
    private val hasCookies: () -> Boolean = { false },
    private val isPersonalFlavor: Boolean = true
) {

    companion object {
        const val MSG_LOGIN_REQUIRED =
            "login required, import cookies.txt in Settings"
        const val MSG_UNSUPPORTED_URL =
            "Unsupported URL"
        const val MSG_UNSUPPORTED_OR_NEEDS_LOGIN =
            MSG_LOGIN_REQUIRED
        const val MSG_PERSONAL_FLAVOR_REQUIRED_GALLERY_DL =
            "Image galleries and art portfolios require the Personal build with gallery-dl."
        const val MSG_PERSONAL_FLAVOR_REQUIRED_YTDLP =
            "General web extraction requires the Personal build with yt-dlp."
        const val MSG_INVALID_URL =
            "Invalid URL provided."
    }

    /**
     * Resolves the [RouteDecision] for the provided [rawUrl].
     */
    fun route(rawUrl: String?): RouteDecision {
        if (rawUrl.isNullOrBlank()) {
            return RouteDecision(TargetEngine.UNSUPPORTED, MSG_INVALID_URL)
        }

        val url = rawUrl.trim()
        if (!url.startsWith("http://", ignoreCase = true) && !url.startsWith("https://", ignoreCase = true)) {
            return RouteDecision(TargetEngine.UNSUPPORTED, MSG_INVALID_URL)
        }

        val lower = url.lowercase(Locale.ROOT)

        // 1. YouTube -> NewPipe
        if (isYouTube(lower)) {
            return RouteDecision(TargetEngine.NEWPIPE)
        }

        // 2. Direct Media -> Native
        if (isDirectMedia(lower)) {
            return RouteDecision(TargetEngine.NATIVE)
        }

        // 3. Reddit: Check whether multi-image gallery vs single post/video
        if (isReddit(lower)) {
            return if (isRedditGallery(lower)) {
                if (isPersonalFlavor) {
                    RouteDecision(TargetEngine.GALLERY_DL)
                } else {
                    RouteDecision(TargetEngine.UNSUPPORTED, MSG_PERSONAL_FLAVOR_REQUIRED_GALLERY_DL)
                }
            } else {
                RouteDecision(TargetEngine.NATIVE)
            }
        }

        // 4. Booru: Check whether tag search / pool gallery vs single post view
        if (isBooru(lower)) {
            return if (isBooruGallery(lower)) {
                if (isPersonalFlavor) {
                    RouteDecision(TargetEngine.GALLERY_DL)
                } else {
                    RouteDecision(TargetEngine.UNSUPPORTED, MSG_PERSONAL_FLAVOR_REQUIRED_GALLERY_DL)
                }
            } else {
                RouteDecision(TargetEngine.NATIVE)
            }
        }

        // 5. Image Galleries and Art Sites (Pixiv, DeviantArt, ArtStation, Imgur albums) -> gallery-dl
        if (isArtOrGallerySite(lower)) {
            return if (isPersonalFlavor) {
                RouteDecision(TargetEngine.GALLERY_DL)
            } else {
                RouteDecision(TargetEngine.UNSUPPORTED, MSG_PERSONAL_FLAVOR_REQUIRED_GALLERY_DL)
            }
        }

        // 6. Any other URL -> yt-dlp ONLY if cookies file is configured
        if (hasCookies()) {
            return if (isPersonalFlavor) {
                RouteDecision(TargetEngine.YT_DLP)
            } else {
                RouteDecision(TargetEngine.UNSUPPORTED, MSG_PERSONAL_FLAVOR_REQUIRED_YTDLP)
            }
        } else {
            return if (isLoginRequiredSite(lower)) {
                RouteDecision(TargetEngine.UNSUPPORTED, MSG_LOGIN_REQUIRED)
            } else {
                RouteDecision(TargetEngine.UNSUPPORTED, MSG_UNSUPPORTED_URL)
            }
        }
    }

    private fun isLoginRequiredSite(lower: String): Boolean {
        return lower.contains("vimeo.com") ||
                lower.contains("x.com") ||
                lower.contains("twitter.com") ||
                lower.contains("instagram.com") ||
                lower.contains("tiktok.com") ||
                lower.contains("reddit.com") ||
                lower.contains("redd.it") ||
                lower.contains("facebook.com") ||
                lower.contains("fb.watch")
    }

    private fun isYouTube(lower: String): Boolean {
        return lower.contains("youtube.com") || lower.contains("youtu.be")
    }

    private fun isDirectMedia(lower: String): Boolean {
        val clean = lower.substringBefore('?').substringBefore('#')
        fun matches(s: String): Boolean =
            s.endsWith(".mp4") || s.endsWith(".mp3") ||
            s.endsWith(".m4a") || s.endsWith(".flac") ||
            s.endsWith(".wav") || s.endsWith(".png") ||
            s.endsWith(".jpg") || s.endsWith(".jpeg") ||
            s.endsWith(".webp") || s.endsWith(".webm") ||
            s.endsWith(".gif")

        return matches(clean) || matches(lower) || lower.contains("speed.cloudflare.com/__down")
    }

    private fun isReddit(lower: String): Boolean {
        return lower.contains("reddit.com") || lower.contains("redd.it")
    }

    private fun isRedditGallery(lower: String): Boolean {
        return lower.contains("/gallery/") || lower.contains("reddit.com/gallery")
    }

    private fun isBooru(lower: String): Boolean {
        return lower.contains("safebooru.org") || lower.contains("danbooru.donmai.us") ||
                lower.contains("gelbooru.com") || lower.contains("yande.re") ||
                lower.contains("konachan.com")
    }

    private fun isBooruGallery(lower: String): Boolean {
        // Single post views on boorus: page=post&s=view or /posts/<id> (without query params)
        val isSinglePost = lower.contains("page=post&s=view") ||
                (lower.contains("/posts/") && !lower.contains("tags=") && !lower.contains("page="))
        return !isSinglePost
    }

    private fun isArtOrGallerySite(lower: String): Boolean {
        return lower.contains("pixiv.net") ||
                lower.contains("deviantart.com") ||
                lower.contains("artstation.com") ||
                lower.contains("imgur.com/a/") ||
                lower.contains("imgur.com/gallery/")
    }
}
