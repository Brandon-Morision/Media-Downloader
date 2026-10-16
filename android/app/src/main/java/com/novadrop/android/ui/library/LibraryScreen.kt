package com.novadrop.android.ui.library

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import coil.compose.AsyncImage
import com.novadrop.android.core.model.DownloadedFileInfo
import com.novadrop.android.core.model.DownloadJob
import com.novadrop.android.core.model.DownloadState
import com.novadrop.android.core.model.MediaCategory
import com.novadrop.android.core.util.Formatters
import com.novadrop.android.ui.theme.SurfaceBorder
import java.io.File

@Composable
fun LibraryScreen(
    downloads: List<DownloadJob>,
    onPlayJob: (DownloadJob) -> Unit,
    onDeleteJob: (String) -> Unit
) {
    var selectedCategory by remember { mutableStateOf("all") } // all, video, music, image
    var isGridView by remember { mutableStateOf(true) }
    var searchQuery by remember { mutableStateOf("") }
    val context = LocalContext.current

    val completedJobs = downloads.filter { it.state == DownloadState.COMPLETED || it.files.isNotEmpty() }

    val filteredList = remember(completedJobs, selectedCategory, searchQuery) {
        completedJobs.filter { job ->
            val cat = Formatters.detectCategory(job.title, job.files)
            val matchesCategory = when (selectedCategory) {
                "video" -> cat == MediaCategory.VIDEO
                "music" -> cat == MediaCategory.MUSIC
                "image" -> cat == MediaCategory.IMAGE || cat == MediaCategory.GALLERY
                else -> true
            }
            val matchesSearch = searchQuery.isBlank() || job.title.contains(searchQuery, ignoreCase = true)
            matchesCategory && matchesSearch
        }
    }

    val categories = listOf(
        "all" to "All Media",
        "video" to "Videos",
        "music" to "Music",
        "image" to "Images"
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp)
    ) {
        Spacer(Modifier.height(16.dp))

        // Title Row with View Mode Switcher
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "Media Library",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onBackground
                )
                Text(
                    text = "${filteredList.size} items cataloged",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            IconButton(onClick = { isGridView = !isGridView }) {
                Icon(
                    if (isGridView) Icons.Default.ViewList else Icons.Default.GridView,
                    contentDescription = "Toggle View"
                )
            }
        }

        Spacer(Modifier.height(12.dp))

        // Search Bar
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text("Search downloaded media...") },
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

        Spacer(Modifier.height(10.dp))

        // Category Filter Row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            categories.forEach { (key, label) ->
                FilterChip(
                    selected = selectedCategory == key,
                    onClick = { selectedCategory = key },
                    label = { Text(label, fontSize = 12.sp) }
                )
            }
        }

        Spacer(Modifier.height(14.dp))

        if (filteredList.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        Icons.Default.FolderOpen,
                        contentDescription = null,
                        modifier = Modifier.size(48.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "No media found in this category",
                        fontSize = 14.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        } else if (isGridView) {
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(bottom = 100.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(filteredList) { job ->
                    val fileToShare = job.files.firstOrNull() ?: job.outputFilePath?.let {
                        DownloadedFileInfo(name = job.title, path = it, sizeBytes = job.totalBytes)
                    }
                    LibraryGridCard(
                        job = job,
                        onPlay = { onPlayJob(job) },
                        onShare = { shareMediaFile(context, fileToShare) },
                        onDelete = { onDeleteJob(job.id) }
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(bottom = 100.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(filteredList) { job ->
                    val fileToShare = job.files.firstOrNull() ?: job.outputFilePath?.let {
                        DownloadedFileInfo(name = job.title, path = it, sizeBytes = job.totalBytes)
                    }
                    LibraryListRow(
                        job = job,
                        onPlay = { onPlayJob(job) },
                        onShare = { shareMediaFile(context, fileToShare) },
                        onDelete = { onDeleteJob(job.id) }
                    )
                }
            }
        }
    }
}

@Composable
fun LibraryGridCard(
    job: DownloadJob,
    onPlay: () -> Unit,
    onShare: () -> Unit,
    onDelete: () -> Unit
) {
    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = androidx.compose.foundation.BorderStroke(1.dp, SurfaceBorder),
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onPlay() }
    ) {
        Column {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(110.dp)
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
                        Icons.Default.PlayArrow,
                        contentDescription = null,
                        modifier = Modifier.size(32.dp),
                        tint = MaterialTheme.colorScheme.primary
                    )
                }

                if (job.files.size > 1) {
                    Surface(
                        shape = RoundedCornerShape(4.dp),
                        color = Color.Black.copy(alpha = 0.7f),
                        modifier = Modifier
                            .align(Alignment.BottomEnd)
                            .padding(6.dp)
                    ) {
                        Text(
                            text = "${job.files.size} files",
                            fontSize = 10.sp,
                            color = Color.White,
                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                        )
                    }
                }
            }

            Column(modifier = Modifier.padding(10.dp)) {
                Text(
                    text = job.title,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(Modifier.height(4.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = Formatters.formatBytes(job.totalBytes.let { if (it > 0) it else job.downloadedBytes }),
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    Row {
                        IconButton(onClick = onShare, modifier = Modifier.size(24.dp)) {
                            Icon(Icons.Default.Share, contentDescription = "Share", modifier = Modifier.size(16.dp))
                        }
                        Spacer(Modifier.width(4.dp))
                        IconButton(onClick = onDelete, modifier = Modifier.size(24.dp)) {
                            Icon(Icons.Default.DeleteOutline, contentDescription = "Delete", modifier = Modifier.size(16.dp))
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun LibraryListRow(
    job: DownloadJob,
    onPlay: () -> Unit,
    onShare: () -> Unit,
    onDelete: () -> Unit
) {
    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = androidx.compose.foundation.BorderStroke(1.dp, SurfaceBorder),
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onPlay() }
    ) {
        Row(
            modifier = Modifier.padding(10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(64.dp, 44.dp)
                    .clip(RoundedCornerShape(6.dp))
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
                    Icon(Icons.Default.PlayArrow, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                }
            }

            Spacer(Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(job.title, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(2.dp))
                Text(
                    "${Formatters.formatBytes(job.totalBytes.let { if (it > 0) it else job.downloadedBytes })} • ${job.selectedFormat.uppercase()}",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            IconButton(onClick = onShare) {
                Icon(Icons.Default.Share, contentDescription = "Share", modifier = Modifier.size(18.dp))
            }
            IconButton(onClick = onDelete) {
                Icon(Icons.Default.DeleteOutline, contentDescription = "Delete", modifier = Modifier.size(18.dp))
            }
        }
    }
}

private fun shareMediaFile(context: android.content.Context, file: DownloadedFileInfo?) {
    if (file == null) return
    try {
        val targetFile = File(file.path)
        val uri = if (file.path.startsWith("content://")) {
            Uri.parse(file.path)
        } else {
            FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", targetFile)
        }
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = if (file.mimeType.isNotBlank()) file.mimeType else "video/*"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(intent, "Open media with"))
    } catch (_: Exception) {}
}
