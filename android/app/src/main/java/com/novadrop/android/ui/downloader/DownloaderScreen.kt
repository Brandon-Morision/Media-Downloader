package com.novadrop.android.ui.downloader

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.novadrop.android.core.model.DownloadJob
import com.novadrop.android.core.model.DownloadState
import com.novadrop.android.core.util.Formatters
import com.novadrop.android.ui.theme.StatusError
import com.novadrop.android.ui.theme.StatusSuccess
import com.novadrop.android.ui.theme.StatusWarning
import com.novadrop.android.ui.theme.SurfaceBorder
import kotlinx.coroutines.delay

@Composable
fun DownloaderScreen(
    downloads: List<DownloadJob>,
    onPauseJob: (String) -> Unit,
    onResumeJob: (String) -> Unit,
    onCancelJob: (String) -> Unit,
    onRetryJob: (String) -> Unit,
    onDeleteJob: (String) -> Unit,
    onClearFinished: () -> Unit,
    onPlayJob: (DownloadJob) -> Unit
) {
    var selectedFilter by remember { mutableStateOf("all") } // all, active, completed, failed, cancelled, scheduled
    var searchQuery by remember { mutableStateOf("") }

    val filterOptions = listOf(
        "all" to "All (${downloads.size})",
        "active" to "Active (${downloads.count { it.state == DownloadState.RUNNING || it.state == DownloadState.PENDING || it.state == DownloadState.PAUSED }})",
        "completed" to "Completed (${downloads.count { it.state == DownloadState.COMPLETED }})",
        "scheduled" to "Scheduled (${downloads.count { it.state == DownloadState.SCHEDULED }})",
        "failed" to "Failed (${downloads.count { it.state == DownloadState.FAILED }})",
        "cancelled" to "Cancelled (${downloads.count { it.state == DownloadState.CANCELLED }})"
    )

    val filteredJobs = remember(downloads, selectedFilter, searchQuery) {
        downloads.filter { job ->
            val matchesFilter = when (selectedFilter) {
                "active" -> job.state == DownloadState.RUNNING || job.state == DownloadState.PENDING || job.state == DownloadState.PAUSED
                "completed" -> job.state == DownloadState.COMPLETED
                "scheduled" -> job.state == DownloadState.SCHEDULED
                "failed" -> job.state == DownloadState.FAILED
                "cancelled" -> job.state == DownloadState.CANCELLED
                else -> true
            }
            val matchesQuery = searchQuery.isBlank() ||
                job.title.contains(searchQuery, ignoreCase = true) ||
                job.url.contains(searchQuery, ignoreCase = true)
            matchesFilter && matchesQuery
        }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(top = 16.dp, bottom = 100.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Sticky Header: Title & Actions
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Download Queue",
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onBackground
                    )
                    Text(
                        text = "${filteredJobs.size} task(s) listed",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                if (downloads.any { it.state == DownloadState.COMPLETED || it.state == DownloadState.FAILED || it.state == DownloadState.CANCELLED }) {
                    OutlinedButton(
                        onClick = onClearFinished,
                        shape = RoundedCornerShape(8.dp),
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp)
                    ) {
                        Icon(Icons.Default.DeleteSweep, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Clear finished", fontSize = 12.sp)
                    }
                }
            }
        }

        // Live Search Bar
        item {
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("Filter queue items...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                trailingIcon = {
                    if (searchQuery.isNotBlank()) {
                        IconButton(onClick = { searchQuery = "" }) {
                            Icon(Icons.Default.Clear, contentDescription = "Clear")
                        }
                    }
                },
                singleLine = true,
                shape = RoundedCornerShape(12.dp)
            )
        }

        // Filter Pills
        item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(filterOptions) { (key, label) ->
                    val isSelected = selectedFilter == key
                    FilterChip(
                        selected = isSelected,
                        onClick = { selectedFilter = key },
                        label = { Text(label, fontSize = 12.sp) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                            selectedLabelColor = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    )
                }
            }
        }

        if (filteredJobs.isEmpty()) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 40.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.HourglassEmpty,
                            contentDescription = null,
                            modifier = Modifier.size(48.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                        )
                        Spacer(Modifier.height(12.dp))
                        Text(
                            "No downloads found in this filter",
                            fontSize = 14.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        } else {
            items(filteredJobs, key = { it.id }) { job ->
                DownloadJobCard(
                    job = job,
                    onPause = { onPauseJob(job.id) },
                    onResume = { onResumeJob(job.id) },
                    onCancel = { onCancelJob(job.id) },
                    onRetry = { onRetryJob(job.id) },
                    onDelete = { onDeleteJob(job.id) },
                    onPlay = { onPlayJob(job) }
                )
            }
        }
    }
}

@Composable
fun DownloadJobCard(
    job: DownloadJob,
    onPause: () -> Unit,
    onResume: () -> Unit,
    onCancel: () -> Unit,
    onRetry: () -> Unit,
    onDelete: () -> Unit,
    onPlay: () -> Unit
) {
    Card(
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, SurfaceBorder, RoundedCornerShape(14.dp))
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                // Thumbnail
                Box(
                    modifier = Modifier
                        .size(52.dp)
                        .clip(RoundedCornerShape(8.dp))
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
                            imageVector = when (job.state) {
                                DownloadState.COMPLETED -> Icons.Default.CheckCircle
                                DownloadState.FAILED -> Icons.Default.Error
                                DownloadState.SCHEDULED -> Icons.Default.Schedule
                                else -> Icons.Default.Download
                            },
                            contentDescription = null,
                            tint = when (job.state) {
                                DownloadState.COMPLETED -> StatusSuccess
                                DownloadState.FAILED -> StatusError
                                DownloadState.SCHEDULED -> StatusWarning
                                else -> MaterialTheme.colorScheme.primary
                            }
                        )
                    }
                }

                Spacer(Modifier.width(12.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = job.title,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Spacer(Modifier.height(4.dp))
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Surface(
                            shape = RoundedCornerShape(4.dp),
                            color = MaterialTheme.colorScheme.surfaceVariant
                        ) {
                            Text(
                                text = job.tool,
                                fontSize = 10.sp,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }

                        Text(
                            text = "• ${job.state.name}",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium,
                            color = when (job.state) {
                                DownloadState.RUNNING -> MaterialTheme.colorScheme.primary
                                DownloadState.COMPLETED -> StatusSuccess
                                DownloadState.SCHEDULED -> StatusWarning
                                DownloadState.FAILED -> StatusError
                                else -> MaterialTheme.colorScheme.onSurfaceVariant
                            }
                        )
                    }
                }
            }

            // Progress or Error Message
            when (job.state) {
                DownloadState.RUNNING, DownloadState.PAUSED, DownloadState.PENDING -> {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        LinearProgressIndicator(
                            progress = { (job.progressPercent / 100f).coerceIn(0f, 1f) },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(6.dp)
                                .clip(RoundedCornerShape(3.dp)),
                            color = if (job.state == DownloadState.PAUSED) StatusWarning else MaterialTheme.colorScheme.primary,
                            trackColor = MaterialTheme.colorScheme.surfaceVariant
                        )
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "${job.progressPercent.toInt()}% • ${Formatters.formatBytes(job.downloadedBytes)}",
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            if (job.speedFormatted.isNotBlank()) {
                                Text(
                                    text = "${job.speedFormatted} • ETA ${job.etaFormatted}",
                                    fontSize = 11.sp,
                                    color = MaterialTheme.colorScheme.primary
                                )
                            }
                        }
                    }
                }
                DownloadState.SCHEDULED -> {
                    ScheduledCountdownRow(
                        scheduledTs = job.scheduledTimestamp,
                        timeFormatted = job.scheduledTimeFormatted,
                        onResumeNow = onResume,
                        onCancel = onCancel
                    )
                }
                DownloadState.FAILED -> {
                    Text(
                        text = job.errorMessage ?: "Unknown extraction error",
                        fontSize = 12.sp,
                        color = StatusError,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                DownloadState.COMPLETED -> {
                    Text(
                        text = "Saved • ${Formatters.formatBytes(job.totalBytes.let { if (it > 0) it else job.downloadedBytes })}",
                        fontSize = 12.sp,
                        color = StatusSuccess
                    )
                }
                else -> {}
            }

            // Action Buttons Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically
            ) {
                when (job.state) {
                    DownloadState.RUNNING -> {
                        IconButton(onClick = onPause) {
                            Icon(Icons.Default.Pause, contentDescription = "Pause", tint = StatusWarning)
                        }
                        IconButton(onClick = onCancel) {
                            Icon(Icons.Default.Close, contentDescription = "Cancel", tint = StatusError)
                        }
                    }
                    DownloadState.PAUSED -> {
                        IconButton(onClick = onResume) {
                            Icon(Icons.Default.PlayArrow, contentDescription = "Resume", tint = MaterialTheme.colorScheme.primary)
                        }
                        IconButton(onClick = onCancel) {
                            Icon(Icons.Default.Close, contentDescription = "Cancel", tint = StatusError)
                        }
                    }
                    DownloadState.FAILED, DownloadState.CANCELLED -> {
                        IconButton(onClick = onRetry) {
                            Icon(Icons.Default.Refresh, contentDescription = "Retry", tint = MaterialTheme.colorScheme.primary)
                        }
                        IconButton(onClick = onDelete) {
                            Icon(Icons.Default.DeleteOutline, contentDescription = "Delete", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                    DownloadState.COMPLETED -> {
                        Button(
                            onClick = onPlay,
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Icon(Icons.Default.PlayArrow, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Play", fontSize = 12.sp)
                        }
                        Spacer(Modifier.width(6.dp))
                        IconButton(onClick = onDelete) {
                            Icon(Icons.Default.DeleteOutline, contentDescription = "Delete", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                    else -> {}
                }
            }
        }
    }
}

@Composable
fun ScheduledCountdownRow(
    scheduledTs: Long?,
    timeFormatted: String?,
    onResumeNow: () -> Unit,
    onCancel: () -> Unit
) {
    var timeLeft by remember { mutableStateOf("") }

    LaunchedEffect(scheduledTs) {
        while (true) {
            if (scheduledTs == null || scheduledTs <= 0) {
                timeLeft = timeFormatted ?: "Pending"
                break
            }
            val diff = Math.max(0L, (scheduledTs - System.currentTimeMillis()) / 1000L)
            if (diff <= 0) {
                timeLeft = "Resuming shortly..."
                break
            }
            val h = diff / 3600L
            val m = (diff % 3600L) / 60L
            val s = diff % 60L
            timeLeft = if (h > 0) String.format("%02d:%02d:%02d", h, m, s) else String.format("%02d:%02d", m, s)
            delay(1000)
        }
    }

    Surface(
        shape = RoundedCornerShape(8.dp),
        color = StatusWarning.copy(alpha = 0.1f),
        border = androidx.compose.foundation.BorderStroke(1.dp, StatusWarning.copy(alpha = 0.3f)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Schedule, contentDescription = null, tint = StatusWarning, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(8.dp))
                Column {
                    Text("Rate limit reset in $timeLeft", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = StatusWarning)
                    Text("Auto-resumes at ${timeFormatted ?: ""}", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            Row {
                TextButton(onClick = onResumeNow) {
                    Text("Resume now", fontSize = 11.sp, color = MaterialTheme.colorScheme.primary)
                }
            }
        }
    }
}
