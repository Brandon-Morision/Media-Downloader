package com.novadrop.android.ui.explore

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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.novadrop.android.core.model.ExtractionMetadata
import com.novadrop.android.core.model.FormatPreset
import com.novadrop.android.core.model.SearchResultItem
import com.novadrop.android.core.util.Formatters
import com.novadrop.android.ui.theme.SurfaceBorder
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExploreScreen(
    initialUrl: String = "",
    onInitialUrlHandled: () -> Unit = {},
    recentSearches: List<String>,
    onAnalyzeUrl: suspend (String) -> Result<ExtractionMetadata>,
    onSearchYouTube: suspend (String) -> Result<List<SearchResultItem>>,
    onSaveSearchQuery: (String) -> Unit,
    onDeleteSearchQuery: (String) -> Unit,
    onStartDownload: (url: String, title: String, format: String) -> Unit,
    onOpenPlaylistInspector: (String) -> Unit
) {
    var queryInput by remember { mutableStateOf(initialUrl) }
    var isAnalyzing by remember { mutableStateOf(false) }
    var analyzedMetadata by remember { mutableStateOf<ExtractionMetadata?>(null) }
    var analyzeError by remember { mutableStateOf<String?>(null) }

    var isSearching by remember { mutableStateOf(false) }
    var searchResults by remember { mutableStateOf<List<SearchResultItem>>(emptyList()) }
    var searchError by remember { mutableStateOf<String?>(null) }

    var selectedFormatSheetItem by remember { mutableStateOf<SearchResultItem?>(null) }
    val scope = rememberCoroutineScope()
    val clipboardManager = LocalClipboardManager.current

    LaunchedEffect(initialUrl) {
        if (initialUrl.isNotBlank()) {
            queryInput = initialUrl
            if (Formatters.isLikelyUrl(initialUrl)) {
                isAnalyzing = true
                val res = onAnalyzeUrl(initialUrl)
                isAnalyzing = false
                res.fold(
                    onSuccess = { analyzedMetadata = it; analyzeError = null },
                    onFailure = { analyzeError = it.message }
                )
            }
            onInitialUrlHandled()
        }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(top = 16.dp, bottom = 100.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Column {
                Text(
                    text = "Explore & Search",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onBackground
                )
                Text(
                    text = "Analyze media URLs or search YouTube directly",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        // Search & URL Input Bar
        item {
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, SurfaceBorder, RoundedCornerShape(16.dp))
            ) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    OutlinedTextField(
                        value = queryInput,
                        onValueChange = { queryInput = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Paste link or search query...") },
                        leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                        trailingIcon = {
                            if (queryInput.isNotBlank()) {
                                IconButton(onClick = { queryInput = "" }) {
                                    Icon(Icons.Default.Clear, contentDescription = "Clear")
                                }
                            } else {
                                IconButton(onClick = {
                                    clipboardManager.getText()?.text?.let { text ->
                                        queryInput = text.trim()
                                    }
                                }) {
                                    Icon(Icons.Default.ContentPaste, contentDescription = "Paste")
                                }
                            }
                        },
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp)
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Button(
                            onClick = {
                                val text = queryInput.trim()
                                if (text.isNotBlank()) {
                                    if (Formatters.isLikelyUrl(text)) {
                                        scope.launch {
                                            isAnalyzing = true
                                            analyzeError = null
                                            val res = onAnalyzeUrl(text)
                                            isAnalyzing = false
                                            res.fold(
                                                onSuccess = { analyzedMetadata = it },
                                                onFailure = { analyzeError = it.message }
                                            )
                                        }
                                    } else {
                                        scope.launch {
                                            isSearching = true
                                            searchError = null
                                            onSaveSearchQuery(text)
                                            val res = onSearchYouTube(text)
                                            isSearching = false
                                            res.fold(
                                                onSuccess = { searchResults = it },
                                                onFailure = { searchError = it.message }
                                            )
                                        }
                                    }
                                }
                            },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            if (isAnalyzing || isSearching) {
                                CircularProgressIndicator(modifier = Modifier.size(18.dp), color = MaterialTheme.colorScheme.onPrimary, strokeWidth = 2.dp)
                            } else {
                                Icon(Icons.Default.Search, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(Modifier.width(6.dp))
                                Text(if (Formatters.isLikelyUrl(queryInput)) "Analyze Link" else "Search")
                            }
                        }
                    }
                }
            }
        }

        // Recent Searches Chips
        if (recentSearches.isNotEmpty()) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Recent Searches", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(recentSearches) { query ->
                            InputChip(
                                selected = false,
                                onClick = {
                                    queryInput = query
                                    scope.launch {
                                        isSearching = true
                                        searchError = null
                                        val res = onSearchYouTube(query)
                                        isSearching = false
                                        res.fold(
                                            onSuccess = { searchResults = it },
                                            onFailure = { searchError = it.message }
                                        )
                                    }
                                },
                                label = { Text(query, fontSize = 12.sp) },
                                trailingIcon = {
                                    IconButton(
                                        onClick = { onDeleteSearchQuery(query) },
                                        modifier = Modifier.size(16.dp)
                                    ) {
                                        Icon(Icons.Default.Close, contentDescription = "Delete", modifier = Modifier.size(12.dp))
                                    }
                                }
                            )
                        }
                    }
                }
            }
        }

        // Analyzed Metadata Card Preview
        analyzedMetadata?.let { meta ->
            item {
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.5f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.AutoAwesome, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
                            Spacer(Modifier.width(8.dp))
                            Text("Analyzed Media", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                        }

                        Row(modifier = Modifier.fillMaxWidth()) {
                            meta.thumbnailUrl?.let { thumb ->
                                AsyncImage(
                                    model = thumb,
                                    contentDescription = null,
                                    modifier = Modifier
                                        .size(90.dp, 60.dp)
                                        .clip(RoundedCornerShape(8.dp)),
                                    contentScale = ContentScale.Crop
                                )
                                Spacer(Modifier.width(12.dp))
                            }

                            Column(modifier = Modifier.weight(1f)) {
                                Text(meta.title, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                Spacer(Modifier.height(4.dp))
                                Text(meta.uploader, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }

                        // Formats Chips Row
                        Text("Available Streams & Presets", fontSize = 12.sp, fontWeight = FontWeight.Medium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            items(meta.availableFormats) { preset ->
                                Button(
                                    onClick = {
                                        onStartDownload(meta.originalUrl, meta.title, preset.id)
                                        analyzedMetadata = null
                                    },
                                    shape = RoundedCornerShape(8.dp),
                                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp)
                                ) {
                                    Icon(Icons.Default.Download, contentDescription = null, modifier = Modifier.size(14.dp))
                                    Spacer(Modifier.width(4.dp))
                                    Text(preset.label, fontSize = 11.sp)
                                }
                            }
                        }

                        if (meta.isPlaylist) {
                            OutlinedButton(
                                onClick = { onOpenPlaylistInspector(meta.originalUrl) },
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Icon(Icons.Default.PlaylistPlay, contentDescription = null)
                                Spacer(Modifier.width(6.dp))
                                Text("Inspect Playlist Tracks")
                            }
                        }
                    }
                }
            }
        }

        analyzeError?.let { err ->
            item {
                Surface(
                    color = MaterialTheme.colorScheme.errorContainer,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(err, color = MaterialTheme.colorScheme.onErrorContainer, fontSize = 12.sp, modifier = Modifier.padding(12.dp))
                }
            }
        }

        // Search Results List
        if (searchResults.isNotEmpty()) {
            item {
                Text("Search Results", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onBackground)
            }

            items(searchResults) { item ->
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    border = androidx.compose.foundation.BorderStroke(1.dp, SurfaceBorder),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { selectedFormatSheetItem = item }
                ) {
                    Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        AsyncImage(
                            model = item.thumbnailUrl,
                            contentDescription = null,
                            modifier = Modifier
                                .size(90.dp, 56.dp)
                                .clip(RoundedCornerShape(8.dp)),
                            contentScale = ContentScale.Crop
                        )

                        Spacer(Modifier.width(12.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Text(item.title, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                            Spacer(Modifier.height(4.dp))
                            Text("${item.uploader} • ${item.durationFormatted}", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }

                        IconButton(onClick = { selectedFormatSheetItem = item }) {
                            Icon(Icons.Default.Download, contentDescription = "Download", tint = MaterialTheme.colorScheme.primary)
                        }
                    }
                }
            }
        }
    }

    // Format selection bottom sheet
    selectedFormatSheetItem?.let { searchItem ->
        ModalBottomSheet(
            onDismissRequest = { selectedFormatSheetItem = null },
            sheetState = rememberModalBottomSheetState()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text("Select Download Format", fontSize = 18.sp, fontWeight = FontWeight.Bold)
                Text(searchItem.title, fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)

                val presets = listOf(
                    FormatPreset("video-best", "Best Video (MP4)", "Highest resolution stream", com.novadrop.android.core.model.MediaCategory.VIDEO, "best", "mp4"),
                    FormatPreset("video-1080", "1080p Full HD", "Standard 1080p MP4 container", com.novadrop.android.core.model.MediaCategory.VIDEO, "1080", "mp4"),
                    FormatPreset("video-720", "720p HD", "High quality 720p MP4 stream", com.novadrop.android.core.model.MediaCategory.VIDEO, "720", "mp4"),
                    FormatPreset("audio-mp3", "MP3 Audio (320kbps)", "High Quality MP3 Audio", com.novadrop.android.core.model.MediaCategory.MUSIC, "320k", "mp3"),
                    FormatPreset("audio-m4a", "M4A Audio", "Apple AAC Audio stream", com.novadrop.android.core.model.MediaCategory.MUSIC, "best", "m4a")
                )

                presets.forEach { preset ->
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                onStartDownload(searchItem.webpageUrl, searchItem.title, preset.id)
                                selectedFormatSheetItem = null
                            },
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(preset.label, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                                Text(preset.subLabel, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            Icon(Icons.Default.Download, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                        }
                    }
                }
                Spacer(Modifier.height(16.dp))
            }
        }
    }
}
