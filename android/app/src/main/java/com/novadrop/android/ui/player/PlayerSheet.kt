package com.novadrop.android.ui.player

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.ui.PlayerView
import com.novadrop.android.core.model.UserPreferences
import com.novadrop.android.core.util.Formatters
import com.novadrop.android.playback.PlaybackManager
import com.novadrop.android.ui.theme.BgDark
import com.novadrop.android.ui.theme.SurfaceCard

@Composable
fun PlayerOverlay(
    playbackManager: PlaybackManager,
    preferences: UserPreferences,
    onSaveVideoExitPreference: (String) -> Unit
) {
    val isPlayerActive by playbackManager.isPlayerActive.collectAsState()
    val isMiniPlayer by playbackManager.isMiniPlayer.collectAsState()
    val isPlaying by playbackManager.isPlaying.collectAsState()
    val currentTitle by playbackManager.currentTitle.collectAsState()
    val currentPositionMs by playbackManager.currentPositionMs.collectAsState()
    val durationMs by playbackManager.durationMs.collectAsState()
    val isAudioOnly by playbackManager.isAudioOnly.collectAsState()
    val showExitDialog by playbackManager.showExitConfirmDialog.collectAsState()

    var rememberChoice by remember { mutableStateOf(false) }

    if (!isPlayerActive) return

    // 1. Exit Confirmation Dialog for Video
    if (showExitDialog) {
        AlertDialog(
            onDismissRequest = { playbackManager.dismissExitDialog() },
            title = { Text("Continue watching?", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        "Your video is still playing. Would you like to switch to the mini-player or exit the player?",
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { rememberChoice = !rememberChoice }
                    ) {
                        Checkbox(
                            checked = rememberChoice,
                            onCheckedChange = { rememberChoice = it }
                        )
                        Spacer(Modifier.width(6.dp))
                        Text("Remember my choice", fontSize = 12.sp)
                    }
                }
            },
            confirmButton = {
                Button(onClick = {
                    if (rememberChoice) onSaveVideoExitPreference("mini")
                    playbackManager.switchToMiniPlayer()
                }) {
                    Text("Switch to Mini-Player")
                }
            },
            dismissButton = {
                TextButton(onClick = {
                    if (rememberChoice) onSaveVideoExitPreference("exit")
                    playbackManager.stopAndClose()
                }) {
                    Text("Exit Player")
                }
            }
        )
    }

    // 2. Mini-Player Bottom Bar
    if (isMiniPlayer) {
        Surface(
            color = SurfaceCard,
            shape = RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp),
            shadowElevation = 8.dp,
            modifier = Modifier
                .fillMaxWidth()
                .clickable { playbackManager.expandMiniPlayer() }
        ) {
            Column {
                // Mini progress line
                val progress = if (durationMs > 0) (currentPositionMs.toFloat() / durationMs.toFloat()) else 0f
                LinearProgressIndicator(
                    progress = { progress },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(3.dp),
                    color = MaterialTheme.colorScheme.primary,
                    trackColor = Color.Transparent
                )

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 14.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = if (isAudioOnly) Icons.Default.MusicNote else Icons.Default.Videocam,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(24.dp)
                    )

                    Spacer(Modifier.width(10.dp))

                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = currentTitle,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Text(
                            text = "${Formatters.formatDuration(currentPositionMs / 1000)} / ${Formatters.formatDuration(durationMs / 1000)}",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    IconButton(onClick = { playbackManager.togglePlayPause() }) {
                        Icon(
                            if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                            contentDescription = if (isPlaying) "Pause" else "Play"
                        )
                    }

                    IconButton(onClick = { playbackManager.expandMiniPlayer() }) {
                        Icon(Icons.Default.Fullscreen, contentDescription = "Expand")
                    }

                    IconButton(onClick = { playbackManager.stopAndClose() }) {
                        Icon(Icons.Default.Close, contentDescription = "Close")
                    }
                }
            }
        }
    } else {
        // 3. Fullscreen Player Surface
        Surface(
            color = BgDark,
            modifier = Modifier.fillMaxSize()
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                // Top Action Bar
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(onClick = {
                        playbackManager.handleFullscreenExit(
                            userAudioSetting = preferences.exitPlayerAudio,
                            userVideoSetting = preferences.exitPlayerVideo
                        )
                    }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = Color.White)
                    }

                    Text(
                        text = currentTitle,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color.White,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f).padding(horizontal = 8.dp)
                    )

                    Row {
                        IconButton(onClick = { playbackManager.switchToMiniPlayer() }) {
                            Icon(Icons.Default.PictureInPicture, contentDescription = "Mini-Player", tint = Color.White)
                        }
                        IconButton(onClick = { playbackManager.stopAndClose() }) {
                            Icon(Icons.Default.Close, contentDescription = "Close", tint = Color.White)
                        }
                    }
                }

                // Media Video Area or Audio Canvas
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .background(Color.Black),
                    contentAlignment = Alignment.Center
                ) {
                    if (!isAudioOnly) {
                        AndroidView(
                            factory = { ctx ->
                                PlayerView(ctx).apply {
                                    player = playbackManager.exoPlayer
                                    useController = false
                                }
                            },
                            modifier = Modifier.fillMaxSize()
                        )
                    } else {
                        // Audio Player Vinyl / Disc Graphic
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Box(
                                modifier = Modifier
                                    .size(160.dp)
                                    .clip(RoundedCornerShape(80.dp))
                                    .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.2f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    Icons.Default.MusicNote,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.size(72.dp)
                                )
                            }
                            Spacer(Modifier.height(20.dp))
                            Text(currentTitle, color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                            Text("NovaDrop High-Fidelity Audio", color = Color.Gray, fontSize = 12.sp)
                        }
                    }
                }

                // Bottom Controls Area
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    // Seek Bar
                    Column {
                        Slider(
                            value = currentPositionMs.toFloat(),
                            onValueChange = { playbackManager.seekTo(it.toLong()) },
                            valueRange = 0f..durationMs.toFloat().coerceAtLeast(1f),
                            colors = SliderDefaults.colors(
                                thumbColor = MaterialTheme.colorScheme.primary,
                                activeTrackColor = MaterialTheme.colorScheme.primary,
                                inactiveTrackColor = Color.DarkGray
                            )
                        )
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(Formatters.formatDuration(currentPositionMs / 1000), color = Color.LightGray, fontSize = 12.sp)
                            Text(Formatters.formatDuration(durationMs / 1000), color = Color.LightGray, fontSize = 12.sp)
                        }
                    }

                    // Transport Buttons
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(onClick = { playbackManager.rewind10() }, modifier = Modifier.size(48.dp)) {
                            Icon(Icons.Default.Replay10, contentDescription = "Rewind 10s", tint = Color.White)
                        }
                        Spacer(Modifier.width(20.dp))
                        FloatingActionButton(
                            onClick = { playbackManager.togglePlayPause() },
                            containerColor = MaterialTheme.colorScheme.primary,
                            shape = RoundedCornerShape(28.dp),
                            modifier = Modifier.size(56.dp)
                        ) {
                            Icon(
                                if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                                contentDescription = if (isPlaying) "Pause" else "Play",
                                tint = Color.Black,
                                modifier = Modifier.size(32.dp)
                            )
                        }
                        Spacer(Modifier.width(20.dp))
                        IconButton(onClick = { playbackManager.forward30() }, modifier = Modifier.size(48.dp)) {
                            Icon(Icons.Default.Forward30, contentDescription = "Forward 30s", tint = Color.White)
                        }
                    }

                    // Playback Speeds
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.Center
                    ) {
                        listOf(0.75f, 1.0f, 1.25f, 1.5f, 2.0f).forEach { speed ->
                            TextButton(onClick = { playbackManager.setPlaybackSpeed(speed) }) {
                                Text("${speed}x", color = Color.Gray, fontSize = 11.sp)
                            }
                        }
                    }
                }
            }
        }
    }
}
