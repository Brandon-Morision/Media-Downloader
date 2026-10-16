package com.novadrop.android.engine.newpipe

import okhttp3.OkHttpClient
import okhttp3.RequestBody.Companion.toRequestBody
import org.schabi.newpipe.extractor.downloader.Downloader
import org.schabi.newpipe.extractor.downloader.Request
import org.schabi.newpipe.extractor.downloader.Response
import java.io.IOException

class NewPipeDownloaderImpl(
    private val client: OkHttpClient
) : Downloader() {

    @Throws(IOException::class)
    override fun execute(request: Request): Response {
        val httpMethod = request.httpMethod()
        val url = request.url()
        val headers = request.headers()
        val dataToSend = request.dataToSend()

        val reqBuilder = okhttp3.Request.Builder()
            .url(url)

        headers.forEach { (key, values) ->
            if (values.isNotEmpty()) {
                reqBuilder.removeHeader(key)
                values.forEach { v -> reqBuilder.addHeader(key, v) }
            }
        }

        val requestBody = if (dataToSend != null && dataToSend.isNotEmpty()) {
            dataToSend.toRequestBody(null)
        } else if (httpMethod.equals("POST", ignoreCase = true)) {
            ByteArray(0).toRequestBody(null)
        } else {
            null
        }

        reqBuilder.method(httpMethod, requestBody)

        val okCall = client.newCall(reqBuilder.build())
        val okResponse = okCall.execute()

        val responseBody = okResponse.body?.string() ?: ""
        val responseHeaders = okResponse.headers.toMultimap()

        if (url.contains("youtubei/v1/player") || !okResponse.isSuccessful) {
            println("[NewPipe Downloader] $httpMethod $url -> code=${okResponse.code}, bodyLen=${responseBody.length}")
            if (responseBody.contains("playabilityStatus")) {
                val statusSnippet = responseBody.substring(responseBody.indexOf("playabilityStatus").coerceAtLeast(0))
                println("[NewPipe Downloader] playabilityStatus snippet: ${statusSnippet.take(300)}")
            }
        }

        return Response(
            okResponse.code,
            okResponse.message,
            responseHeaders,
            responseBody,
            okResponse.request.url.toString()
        )
    }
}
