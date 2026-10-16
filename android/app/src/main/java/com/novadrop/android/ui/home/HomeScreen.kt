package com.novadrop.android.ui.home

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.novadrop.android.R
import com.novadrop.android.core.model.DownloadJob
import com.novadrop.android.core.model.DownloadState
import com.novadrop.android.core.util.Formatters
import com.novadrop.android.ui.theme.*

@Composable
fun HomeScreen(
    downloads: List<DownloadJob>,
    onAnalyzeUrl: (String) -> Unit,
    onQuickDownload: (String) -> Unit,
    onPlayJob: (DownloadJob) -> Unit,
    onNavigateToDownloader: () -> Unit,
    onNavigateToLibrary: () -> Unit
) {
    var urlInput by remember { mutableStateOf("") }
    var isProcessing by remember { mutableStateOf(false) }
    val clipboardManager = LocalClipboardManager.current

    val activeCount = downloads.count {
        it.state == DownloadState.RUNNING || it.state == DownloadState.PENDING || it.state == DownloadState.PREPARING
    }
    val completedList = downloads.filter { it.state == DownloadState.COMPLETED }

    val platformChips = listOf(
        "YouTube" to BrandYouTube,
        "Reddit" to BrandReddit,
        "Twitter / X" to BrandTwitter,
        "Instagram" to BrandInstagram,
        "Pixiv" to BrandPixiv,
        "Twitch" to BrandTwitch,
        "Direct Links" to BrandDirect
    )

    // Ensure processing state is reset whenever HomeScreen disposes or re-enters
    DisposableEffect(Unit) {
        onDispose {
            isProcessing = false
        }
    }

    // Reset processing state if input is cleared
    LaunchedEffect(urlInput) {
        if (urlInput.isBlank()) {
            isProcessing = false
        }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = NovaDropSpacing.lg),
        contentPadding = PaddingValues(top = NovaDropSpacing.md, bottom = NovaDropSpacing.xl),
        verticalArrangement = Arrangement.spacedBy(NovaDropSpacing.lg)
    ) {
        // 1. App Header Banner with Status Pill
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = NovaDropSpacing.sm),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = stringResource(R.string.app_name),
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onBackground
                    )
                    Text(
                        text = stringResource(R.string.app_tagline),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                // System Status Badge
                Surface(
                    shape = NovaDropShapes.chip,
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    border = BorderStroke(1.dp, SurfaceBorder)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = NovaDropSpacing.md, vertical = NovaDropSpacing.xs),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(NovaDropSpacing.xs)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(6.dp)
                                .clip(CircleShape)
                                .background(StatusSuccess)
                        )
                        Text(
                            text = stringResource(R.string.home_status_ready),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }

        // 2. Primary Quick Input Card
        item {
            Card(
                shape = NovaDropShapes.cardMedium,
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                border = BorderStroke(1.dp, SurfaceBorder),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(NovaDropSpacing.lg),
                    verticalArrangement = Arrangement.spacedBy(NovaDropSpacing.md)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(NovaDropSpacing.sm)
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.Link,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(18.dp)
                        )
                        Text(
                            text = stringResource(R.string.home_quick_extraction_title),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }

                    OutlinedTextField(
                        value = urlInput,
                        onValueChange = {
                            urlInput = it
                            if (isProcessing) isProcessing = false
                        },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = {
                            Text(
                                stringResource(R.string.home_url_input_placeholder),
                                style = MaterialTheme.typography.bodyMedium
                            )
                        },
                        singleLine = true,
                        enabled = !isProcessing,
                        leadingIcon = {
                            Icon(
                                Icons.Outlined.Link,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        },
                        trailingIcon = {
                            if (urlInput.isNotBlank()) {
                                IconButton(
                                    onClick = {
                                        urlInput = ""
                                        isProcessing = false
                                    },
                                    modifier = Modifier.size(48.dp)
                                ) {
                                    Icon(
                                        Icons.Default.Clear,
                                        contentDescription = stringResource(R.string.cd_clear),
                                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            } else {
                                IconButton(
                                    onClick = {
                                        clipboardManager.getText()?.text?.let { text ->
                                            urlInput = text.trim()
                                        }
                                    },
                                    modifier = Modifier.size(48.dp)
                                ) {
                                    Icon(
                                        Icons.Outlined.ContentPaste,
                                        contentDescription = stringResource(R.string.cd_paste),
                                        tint = MaterialTheme.colorScheme.primary
                                    )
                                }
                            }
                        },
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                        keyboardActions = KeyboardActions(
                            onDone = {
                                if (urlInput.isNotBlank() && !isProcessing) {
                                    isProcessing = true
                                    onAnalyzeUrl(urlInput.trim())
                                    isProcessing = false
                                }
                            }
                        ),
                        shape = NovaDropShapes.input
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(NovaDropSpacing.md)
                    ) {
                        Button(
                            onClick = {
                                if (urlInput.isNotBlank() && !isProcessing) {
                                    isProcessing = true
                                    onAnalyzeUrl(urlInput.trim())
                                    isProcessing = false
                                }
                            },
                            enabled = urlInput.isNotBlank() && !isProcessing,
                            modifier = Modifier
                                .weight(1f)
                                .height(44.dp),
                            shape = NovaDropShapes.button
                        ) {
                            if (isProcessing) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(18.dp),
                                    color = MaterialTheme.colorScheme.onPrimary,
                                    strokeWidth = 2.dp
                                )
                            } else {
                                Icon(
                                    Icons.Outlined.Search,
                                    contentDescription = null,
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(Modifier.width(NovaDropSpacing.sm))
                                Text(stringResource(R.string.home_action_analyze))
                            }
                        }

                        FilledTonalButton(
                            onClick = {
                                if (urlInput.isNotBlank() && !isProcessing) {
                                    isProcessing = true
                                    val targetUrl = urlInput.trim()
                                    urlInput = ""
                                    onQuickDownload(targetUrl)
                                    isProcessing = false
                                }
                            },
                            enabled = urlInput.isNotBlank() && !isProcessing,
                            modifier = Modifier
                                .weight(1f)
                                .height(44.dp),
                            shape = NovaDropShapes.button
                        ) {
                            Icon(
                                Icons.Outlined.Download,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(Modifier.width(NovaDropSpacing.sm))
                            Text(stringResource(R.string.home_action_download))
                        }
                    }
                }
            }
        }

        // 3. Queue Metrics Summary Cards
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(NovaDropSpacing.md)
            ) {
                Card(
                    modifier = Modifier
                        .weight(1f)
                        .clickable { onNavigateToDownloader() },
                    shape = NovaDropShapes.cardSmall,
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                    border = BorderStroke(1.dp, SurfaceBorder)
                ) {
                    Column(modifier = Modifier.padding(NovaDropSpacing.lg)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(8.dp)
                                    .clip(CircleShape)
                                    .background(if (activeCount > 0) MaterialTheme.colorScheme.primary else TextMutedDark)
                            )
                            Spacer(Modifier.width(NovaDropSpacing.sm))
                            Text(
                                text = stringResource(R.string.home_active_queue),
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        Spacer(Modifier.height(NovaDropSpacing.xs))
                        Text(
                            text = stringResource(R.string.home_items_count, activeCount),
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }
                }

                Card(
                    modifier = Modifier
                        .weight(1f)
                        .clickable { onNavigateToLibrary() },
                    shape = NovaDropShapes.cardSmall,
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                    border = BorderStroke(1.dp, SurfaceBorder)
                ) {
                    Column(modifier = Modifier.padding(NovaDropSpacing.lg)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Default.CheckCircle,
                                contentDescription = null,
                                tint = StatusSuccess,
                                modifier = Modifier.size(14.dp)
                            )
                            Spacer(Modifier.width(NovaDropSpacing.sm))
                            Text(
                                text = stringResource(R.string.home_downloaded),
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        Spacer(Modifier.height(NovaDropSpacing.xs))
                        Text(
                            text = stringResource(R.string.home_files_count, completedList.size),
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }
                }
            }
        }

        // 4. Supported Sources Section
        item {
            Column(verticalArrangement = Arrangement.spacedBy(NovaDropSpacing.sm)) {
                Text(
                    text = stringResource(R.string.home_supported_sources),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onBackground
                )

                LazyRow(horizontalArrangement = Arrangement.spacedBy(NovaDropSpacing.sm)) {
                    items(platformChips) { (name, brandColor) ->
                        Surface(
                            shape = NovaDropShapes.chip,
                            color = MaterialTheme.colorScheme.surface,
                            border = BorderStroke(1.dp, SurfaceBorder)
                        ) {
                            Row(
                                modifier = Modifier.padding(
                                    horizontal = NovaDropSpacing.md,
                                    vertical = NovaDropSpacing.sm
                                ),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(6.dp)
                                        .clip(CircleShape)
                                        .background(brandColor)
                                )
                                Spacer(Modifier.width(NovaDropSpacing.sm))
                                Text(
                                    text = name,
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                            }
                        }
                    }
                }
            }
        }

        // 5. Recent Downloads Header
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = stringResource(R.string.home_recent_downloads),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onBackground
                )
                if (completedList.isNotEmpty()) {
                    TextButton(
                        onClick = { onNavigateToLibrary() },
                        contentPadding = PaddingValues(horizontal = NovaDropSpacing.sm)
                    ) {
                        Text(
                            stringResource(R.string.home_view_all),
                            style = MaterialTheme.typography.labelLarge
                        )
                    }
                }
            }
        }

        // 6. Recent Downloads Content / Empty State
        if (completedList.isEmpty()) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = NovaDropShapes.cardSmall,
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    border = BorderStroke(1.dp, SurfaceBorder)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = NovaDropSpacing.xxl),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                Icons.Outlined.DownloadDone,
                                contentDescription = null,
                                modifier = Modifier.size(40.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                            )
                            Spacer(Modifier.height(NovaDropSpacing.sm))
                            Text(
                                text = stringResource(R.string.home_empty_downloads),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
        } else {
            items(completedList.take(5), key = { it.id }) { job ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onPlayJob(job) },
                    shape = NovaDropShapes.cardSmall,
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    border = BorderStroke(1.dp, SurfaceBorder)
                ) {
                    Row(
                        modifier = Modifier.padding(NovaDropSpacing.md),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Thumbnail or Category Icon
                        Box(
                            modifier = Modifier
                                .size(56.dp)
                                .clip(NovaDropShapes.thumbnail)
                                .background(MaterialTheme.colorScheme.surfaceVariant),
                            contentAlignment = Alignment.Center
                        ) {
                            if (!job.thumbnail.isNullOrBlank()) {
                                AsyncImage(
                                    model = job.thumbnail,
                                    contentDescription = null,
                                    modifier = Modifier.fillMaxSize(),
                                    contentScale = ContentScale.Crop
                                )
                            } else {
                                Icon(
                                    Icons.Outlined.PlayCircle,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.size(24.dp)
                                )
                            }
                        }

                        Spacer(Modifier.width(NovaDropSpacing.md))

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = job.title,
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.SemiBold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            Spacer(Modifier.height(NovaDropSpacing.xxs))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = Formatters.formatBytes(job.totalBytes.let { if (it > 0) it else job.downloadedBytes }),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Text(
                                    text = " • ${job.selectedFormat.uppercase()}",
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Medium,
                                    color = MaterialTheme.colorScheme.primary
                                )
                            }
                        }

                        IconButton(
                            onClick = { onPlayJob(job) },
                            modifier = Modifier.size(48.dp)
                        ) {
                            Icon(
                                Icons.Outlined.PlayCircle,
                                contentDescription = stringResource(R.string.cd_play),
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(28.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}
