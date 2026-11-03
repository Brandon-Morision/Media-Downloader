package com.novadrop.android.engine.router

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class EngineRouterTest {

    data class RouterTestCase(
        val url: String?,
        val hasCookies: Boolean,
        val isPersonalFlavor: Boolean,
        val expectedEngine: TargetEngine,
        val expectedReasonSubstring: String? = null
    )

    @Test
    fun testRouterWithTableOfUrls() {
        val testCases = listOf(
            // 1. YouTube URLs -> NEWPIPE
            RouterTestCase(
                url = "https://www.youtube.com/watch?v=jNQXAC9IVRw",
                hasCookies = false,
                isPersonalFlavor = true,
                expectedEngine = TargetEngine.NEWPIPE
            ),
            RouterTestCase(
                url = "https://youtu.be/jNQXAC9IVRw",
                hasCookies = false,
                isPersonalFlavor = true,
                expectedEngine = TargetEngine.NEWPIPE
            ),
            RouterTestCase(
                url = "https://www.youtube.com/shorts/abcdef12345",
                hasCookies = false,
                isPersonalFlavor = true,
                expectedEngine = TargetEngine.NEWPIPE
            ),
            RouterTestCase(
                url = "https://www.youtube.com/playlist?list=PLrAXtmErZgOdP_8GztsuKi9nvjyJR2VvE",
                hasCookies = false,
                isPersonalFlavor = true,
                expectedEngine = TargetEngine.NEWPIPE
            ),
            RouterTestCase(
                url = "https://music.youtube.com/watch?v=5qap5aO4i9A",
                hasCookies = false,
                isPersonalFlavor = true,
                expectedEngine = TargetEngine.NEWPIPE
            ),

            // 2. Direct Media URLs -> NATIVE
            RouterTestCase(
                url = "https://speed.cloudflare.com/__down?bytes=5000000.mp4",
                hasCookies = false,
                isPersonalFlavor = true,
                expectedEngine = TargetEngine.NATIVE
            ),
            RouterTestCase(
                url = "https://filesamples.com/samples/video/mp4/sample_640x360.mp4",
                hasCookies = false,
                isPersonalFlavor = true,
                expectedEngine = TargetEngine.NATIVE
            ),
            RouterTestCase(
                url = "https://example.com/audio/podcast_episode_1.mp3",
                hasCookies = false,
                isPersonalFlavor = true,
                expectedEngine = TargetEngine.NATIVE
            ),
            RouterTestCase(
                url = "https://example.com/images/wallpaper_4k.png",
                hasCookies = false,
                isPersonalFlavor = true,
                expectedEngine = TargetEngine.NATIVE
            ),
            RouterTestCase(
                url = "https://example.com/media/clip.webm?raw=true#fragment",
                hasCookies = false,
                isPersonalFlavor = true,
                expectedEngine = TargetEngine.NATIVE
            ),

            // 3. Reddit single posts -> NATIVE
            RouterTestCase(
                url = "https://www.reddit.com/r/videos/comments/1f44k6i/amazing_nature_moment/",
                hasCookies = false,
                isPersonalFlavor = true,
                expectedEngine = TargetEngine.NATIVE
            ),
            RouterTestCase(
                url = "https://redd.it/1f44k6i",
                hasCookies = false,
                isPersonalFlavor = true,
                expectedEngine = TargetEngine.NATIVE
            ),

            // 4. Reddit multi-image galleries -> GALLERY_DL (personal) or UNSUPPORTED (standard)
            RouterTestCase(
                url = "https://www.reddit.com/gallery/1f44k6i",
                hasCookies = false,
                isPersonalFlavor = true,
                expectedEngine = TargetEngine.GALLERY_DL
            ),
            RouterTestCase(
                url = "https://www.reddit.com/r/EarthPorn/comments/12345/gallery/mountain_views/",
                hasCookies = false,
                isPersonalFlavor = true,
                expectedEngine = TargetEngine.GALLERY_DL
            ),
            RouterTestCase(
                url = "https://www.reddit.com/gallery/1f44k6i",
                hasCookies = false,
                isPersonalFlavor = false,
                expectedEngine = TargetEngine.UNSUPPORTED,
                expectedReasonSubstring = "Personal build with gallery-dl"
            ),

            // 5. Booru single post views -> NATIVE
            RouterTestCase(
                url = "https://safebooru.org/index.php?page=post&s=view&id=4000000",
                hasCookies = false,
                isPersonalFlavor = true,
                expectedEngine = TargetEngine.NATIVE
            ),
            RouterTestCase(
                url = "https://danbooru.donmai.us/posts/5000000",
                hasCookies = false,
                isPersonalFlavor = true,
                expectedEngine = TargetEngine.NATIVE
            ),
            RouterTestCase(
                url = "https://gelbooru.com/index.php?page=post&s=view&id=6000000",
                hasCookies = false,
                isPersonalFlavor = true,
                expectedEngine = TargetEngine.NATIVE
            ),

            // 6. Booru tag searches / pools -> GALLERY_DL (personal) or UNSUPPORTED (standard)
            RouterTestCase(
                url = "https://safebooru.org/index.php?page=post&s=list&tags=landscape",
                hasCookies = false,
                isPersonalFlavor = true,
                expectedEngine = TargetEngine.GALLERY_DL
            ),
            RouterTestCase(
                url = "https://danbooru.donmai.us/posts?tags=order%3Arank",
                hasCookies = false,
                isPersonalFlavor = true,
                expectedEngine = TargetEngine.GALLERY_DL
            ),
            RouterTestCase(
                url = "https://safebooru.org/index.php?page=post&s=list&tags=scenery",
                hasCookies = false,
                isPersonalFlavor = false,
                expectedEngine = TargetEngine.UNSUPPORTED,
                expectedReasonSubstring = "Personal build with gallery-dl"
            ),

            // 7. Art sites (Pixiv, DeviantArt, ArtStation, Imgur album) -> GALLERY_DL (personal) or UNSUPPORTED (standard)
            RouterTestCase(
                url = "https://www.pixiv.net/en/artworks/109876543",
                hasCookies = false,
                isPersonalFlavor = true,
                expectedEngine = TargetEngine.GALLERY_DL
            ),
            RouterTestCase(
                url = "https://www.deviantart.com/artistname/art/Epic-Digital-Painting-987654321",
                hasCookies = false,
                isPersonalFlavor = true,
                expectedEngine = TargetEngine.GALLERY_DL
            ),
            RouterTestCase(
                url = "https://www.artstation.com/artwork/XxYyZz",
                hasCookies = false,
                isPersonalFlavor = true,
                expectedEngine = TargetEngine.GALLERY_DL
            ),
            RouterTestCase(
                url = "https://imgur.com/a/ABC1234",
                hasCookies = false,
                isPersonalFlavor = true,
                expectedEngine = TargetEngine.GALLERY_DL
            ),
            RouterTestCase(
                url = "https://www.pixiv.net/en/artworks/109876543",
                hasCookies = false,
                isPersonalFlavor = false,
                expectedEngine = TargetEngine.UNSUPPORTED,
                expectedReasonSubstring = "Personal build with gallery-dl"
            ),

            // 8. Supported sites requiring login WITHOUT cookies -> "login required, import cookies.txt in Settings"
            RouterTestCase(
                url = "https://vimeo.com/76979871",
                hasCookies = false,
                isPersonalFlavor = true,
                expectedEngine = TargetEngine.UNSUPPORTED,
                expectedReasonSubstring = "login required, import cookies.txt in Settings"
            ),
            RouterTestCase(
                url = "https://twitter.com/jack/status/20",
                hasCookies = false,
                isPersonalFlavor = true,
                expectedEngine = TargetEngine.UNSUPPORTED,
                expectedReasonSubstring = "login required, import cookies.txt in Settings"
            ),
            RouterTestCase(
                url = "https://x.com/jack/status/20",
                hasCookies = false,
                isPersonalFlavor = true,
                expectedEngine = TargetEngine.UNSUPPORTED,
                expectedReasonSubstring = "login required, import cookies.txt in Settings"
            ),
            RouterTestCase(
                url = "https://www.tiktok.com/@tiktok/video/7106594312292453678",
                hasCookies = false,
                isPersonalFlavor = true,
                expectedEngine = TargetEngine.UNSUPPORTED,
                expectedReasonSubstring = "login required, import cookies.txt in Settings"
            ),
            RouterTestCase(
                url = "https://www.instagram.com/p/CGgX8Z_jM_n/",
                hasCookies = false,
                isPersonalFlavor = true,
                expectedEngine = TargetEngine.UNSUPPORTED,
                expectedReasonSubstring = "login required, import cookies.txt in Settings"
            ),

            // 8b. Site without extractor -> "Unsupported URL"
            RouterTestCase(
                url = "https://example.com/some/article/or/unsupported-page",
                hasCookies = false,
                isPersonalFlavor = true,
                expectedEngine = TargetEngine.UNSUPPORTED,
                expectedReasonSubstring = "Unsupported URL"
            ),
            RouterTestCase(
                url = "https://unsupported-unknown-site.org/video/9999",
                hasCookies = false,
                isPersonalFlavor = true,
                expectedEngine = TargetEngine.UNSUPPORTED,
                expectedReasonSubstring = "Unsupported URL"
            ),

            // 9. General Web / Other URL WITH cookies -> YT_DLP (personal) or UNSUPPORTED (standard)
            RouterTestCase(
                url = "https://vimeo.com/76979871",
                hasCookies = true,
                isPersonalFlavor = true,
                expectedEngine = TargetEngine.YT_DLP
            ),
            RouterTestCase(
                url = "https://twitter.com/jack/status/20",
                hasCookies = true,
                isPersonalFlavor = true,
                expectedEngine = TargetEngine.YT_DLP
            ),
            RouterTestCase(
                url = "https://www.tiktok.com/@tiktok/video/7106594312292453678",
                hasCookies = true,
                isPersonalFlavor = true,
                expectedEngine = TargetEngine.YT_DLP
            ),
            RouterTestCase(
                url = "https://vimeo.com/76979871",
                hasCookies = true,
                isPersonalFlavor = false,
                expectedEngine = TargetEngine.UNSUPPORTED,
                expectedReasonSubstring = "Personal build"
            ),

            // 10. Blank or Invalid URLs
            RouterTestCase(
                url = "",
                hasCookies = false,
                isPersonalFlavor = true,
                expectedEngine = TargetEngine.UNSUPPORTED,
                expectedReasonSubstring = "Invalid URL"
            ),
            RouterTestCase(
                url = "   ",
                hasCookies = false,
                isPersonalFlavor = true,
                expectedEngine = TargetEngine.UNSUPPORTED,
                expectedReasonSubstring = "Invalid URL"
            ),
            RouterTestCase(
                url = null,
                hasCookies = false,
                isPersonalFlavor = true,
                expectedEngine = TargetEngine.UNSUPPORTED,
                expectedReasonSubstring = "Invalid URL"
            ),
            RouterTestCase(
                url = "ftp://invalid-protocol.com/file.mp4",
                hasCookies = false,
                isPersonalFlavor = true,
                expectedEngine = TargetEngine.UNSUPPORTED,
                expectedReasonSubstring = "Invalid URL"
            )
        )

        testCases.forEachIndexed { index, tc ->
            val router = EngineRouter(
                hasCookies = { tc.hasCookies },
                isPersonalFlavor = tc.isPersonalFlavor
            )
            val decision = router.route(tc.url)

            assertEquals(
                "Test case #$index failed for url='${tc.url}', hasCookies=${tc.hasCookies}, isPersonal=${tc.isPersonalFlavor}",
                tc.expectedEngine,
                decision.engine
            )

            if (tc.expectedReasonSubstring != null) {
                assertNotNull(
                    "Test case #$index expected non-null reason for '${tc.url}'",
                    decision.reason
                )
                assertTrue(
                    "Test case #$index reason '${decision.reason}' should contain '${tc.expectedReasonSubstring}'",
                    decision.reason!!.contains(tc.expectedReasonSubstring)
                )
            }
        }
    }
}
