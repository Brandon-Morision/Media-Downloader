package com.novadrop.android.ui

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import com.novadrop.android.core.util.Validators

class ShareReceiverActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val intent = intent
        val action = intent?.action
        val type = intent?.type

        if (Intent.ACTION_SEND == action && type != null) {
            if ("text/plain" == type) {
                val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT)
                if (!sharedText.isNullOrBlank()) {
                    val extractedUrl = extractUrl(sharedText)
                    val targetUrl = extractedUrl ?: sharedText.trim()

                    val mainIntent = Intent(this, MainActivity::class.java).apply {
                        putExtra("shared_url", targetUrl)
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    }
                    startActivity(mainIntent)
                }
            }
        }

        finish()
    }

    private fun extractUrl(text: String): String? {
        val urlRegex = "(https?://[\\w\\-\\.\\?\\&\\=\\%\\#\\/\\~]+)".toRegex()
        val match = urlRegex.find(text)
        return match?.value
    }
}
