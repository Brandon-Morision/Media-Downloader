package com.novadrop.android.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.ui.platform.LocalContext
import com.novadrop.android.core.model.UserPreferences
import com.novadrop.android.core.util.CookiesManager
import com.novadrop.android.core.util.EngineInfoProvider
import com.novadrop.android.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun SettingsScreen(
    preferences: UserPreferences,
    onSetThemeAccent: (String) -> Unit,
    onSetDarkMode: (Boolean) -> Unit,
    onSetDefaultFormat: (String) -> Unit,
    onSetCompletionAction: (String) -> Unit,
    onSetExitPlayerAudio: (String) -> Unit,
    onSetExitPlayerVideo: (String) -> Unit,
    onSetNightOwl: (Boolean, String, String, String) -> Unit,
    onSetNotificationsEnabled: (Boolean) -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    var expandedSection by remember { mutableStateOf<String?>("downloads") }
    var showTermsDialog by remember { mutableStateOf(false) }

    var engineVersions by remember { mutableStateOf(EngineInfoProvider.getEngineVersions(context)) }
    var hasCookies by remember { mutableStateOf(CookiesManager.hasCookies(context)) }
    var cookiesSizeBytes by remember { mutableStateOf(CookiesManager.getCookiesSizeBytes(context)) }
    var isUpdatingEngines by remember { mutableStateOf(false) }
    var engineUpdateMessage by remember { mutableStateOf<String?>(null) }

    val cookiePickerLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            val result = CookiesManager.importCookies(context, uri)
            if (result.isSuccess) {
                hasCookies = true
                cookiesSizeBytes = result.getOrNull() ?: 0L
            }
        }
    }

    val themes = listOf(
        "ocean" to ("Ocean Blue" to OceanBlue),
        "emerald" to ("Emerald Mint" to EmeraldMint),
        "violet" to ("Violet Glow" to VioletGlow),
        "amber" to ("Solar Amber" to SolarAmber),
        "rose" to ("Crimson Rose" to CrimsonRose)
    )

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(top = 16.dp, bottom = 100.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Column {
                Text(
                    text = "Settings",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onBackground
                )
                Text(
                    text = "Preferences, media storage, player lifecycle & updates",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        // 1. Downloads Section
        item {
            SettingsAccordionCard(
                title = "Downloads & Formats",
                subtitle = "Default extraction format & queue behavior",
                icon = Icons.Default.Download,
                isExpanded = expandedSection == "downloads",
                onToggle = { expandedSection = if (expandedSection == "downloads") null else "downloads" }
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Default Download Format", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    val formats = listOf("auto" to "Auto (Best)", "1080p" to "1080p Full HD", "720p" to "720p HD", "mp3" to "MP3 Audio (320k)", "m4a" to "M4A Audio")
                    formats.forEach { (fmt, label) ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onSetDefaultFormat(fmt) }
                                .padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            RadioButton(
                                selected = preferences.defaultFormat == fmt,
                                onClick = { onSetDefaultFormat(fmt) }
                            )
                            Spacer(Modifier.width(8.dp))
                            Text(label, fontSize = 13.sp)
                        }
                    }

                    HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp), color = SurfaceBorder)

                    Text("On Queue Finished Action", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    val actions = listOf("nothing" to "Do nothing", "chime" to "Play completion sound", "open_folder" to "Open library")
                    actions.forEach { (action, label) ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onSetCompletionAction(action) }
                                .padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            RadioButton(
                                selected = preferences.completionAction == action,
                                onClick = { onSetCompletionAction(action) }
                            )
                            Spacer(Modifier.width(8.dp))
                            Text(label, fontSize = 13.sp)
                        }
                    }
                }
            }
        }

        // 2. Storage Section
        item {
            SettingsAccordionCard(
                title = "Storage & Scoped Media",
                subtitle = "Public Downloads / NovaDrop folder hierarchy",
                icon = Icons.Default.Storage,
                isExpanded = expandedSection == "storage",
                onToggle = { expandedSection = if (expandedSection == "storage") null else "storage" }
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Media Directory Organization", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    Text(
                        "Downloads are stored in Scoped Public Storage:\n• /storage/emulated/0/Download/NovaDrop/Videos\n• /storage/emulated/0/Download/NovaDrop/Music\n• /storage/emulated/0/Download/NovaDrop/Images",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        // 3. Appearance Section
        item {
            SettingsAccordionCard(
                title = "Appearance & Theming",
                subtitle = "Accent color palette & Dark Mode",
                icon = Icons.Default.Palette,
                isExpanded = expandedSection == "appearance",
                onToggle = { expandedSection = if (expandedSection == "appearance") null else "appearance" }
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Accent Theme", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        items(themes) { (id, pair) ->
                            val (label, color) = pair
                            val isSelected = preferences.themeAccent == id
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                modifier = Modifier.clickable { onSetThemeAccent(id) }
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(36.dp)
                                        .clip(CircleShape)
                                        .background(color)
                                        .border(
                                            if (isSelected) 3.dp else 1.dp,
                                            if (isSelected) MaterialTheme.colorScheme.onBackground else Color.Transparent,
                                            CircleShape
                                        )
                                )
                                Spacer(Modifier.height(4.dp))
                                Text(label, fontSize = 10.sp, color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }

                    HorizontalDivider(color = SurfaceBorder)

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Dark Mode", fontSize = 14.sp)
                        Switch(
                            checked = preferences.isDarkMode,
                            onCheckedChange = { onSetDarkMode(it) }
                        )
                    }
                }
            }
        }

        // 4. Notifications Section
        item {
            SettingsAccordionCard(
                title = "Notifications",
                subtitle = "Download progress & status notifications",
                icon = Icons.Default.Notifications,
                isExpanded = expandedSection == "notifications",
                onToggle = { expandedSection = if (expandedSection == "notifications") null else "notifications" }
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text("Download Notifications", fontSize = 14.sp)
                        Text("Show ongoing notification bar with speed & ETA", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Switch(
                        checked = preferences.nativeNotificationsEnabled,
                        onCheckedChange = { onSetNotificationsEnabled(it) }
                    )
                }
            }
        }

        // 5. Player Behavior Section (v0.5.2 Overhaul Parity)
        item {
            SettingsAccordionCard(
                title = "Player Behavior (v0.5.2)",
                subtitle = "Fullscreen exit transitions for audio & video",
                icon = Icons.Default.PlayCircleOutline,
                isExpanded = expandedSection == "player",
                onToggle = { expandedSection = if (expandedSection == "player") null else "player" }
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("For Audio Files & Songs", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    listOf("mini" to "Switch to Mini-Player (recommended)", "exit" to "Exit player").forEach { (valKey, label) ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onSetExitPlayerAudio(valKey) }
                                .padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            RadioButton(
                                selected = preferences.exitPlayerAudio == valKey,
                                onClick = { onSetExitPlayerAudio(valKey) }
                            )
                            Spacer(Modifier.width(8.dp))
                            Text(label, fontSize = 13.sp)
                        }
                    }

                    HorizontalDivider(color = SurfaceBorder)

                    Text("For Video Files", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    listOf("ask" to "Ask every time (default)", "mini" to "Switch to Mini-Player", "exit" to "Exit player").forEach { (valKey, label) ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onSetExitPlayerVideo(valKey) }
                                .padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            RadioButton(
                                selected = preferences.exitPlayerVideo == valKey,
                                onClick = { onSetExitPlayerVideo(valKey) }
                            )
                            Spacer(Modifier.width(8.dp))
                            Text(label, fontSize = 13.sp)
                        }
                    }
                }
            }
        }

        // 6. Engines & Updates Section
        item {
            SettingsAccordionCard(
                title = "Engines & Tools",
                subtitle = "Active extractor engine status",
                icon = Icons.Default.Engineering,
                isExpanded = expandedSection == "engines",
                onToggle = { expandedSection = if (expandedSection == "engines") null else "engines" }
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Active Media Extraction Engine", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text("NovaDrop Native Extractor", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            Text("Version: 2026.10.14 • Status: Ready", fontSize = 12.sp, color = MaterialTheme.colorScheme.primary)
                            Text("Extractor: YouTube (DASH/HLS), Reddit, Galleries, Direct Streams", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
        }

        // 7. Advanced & Scheduling (Night-Owl)
        item {
            SettingsAccordionCard(
                title = "Rate Limit & Night-Owl",
                subtitle = "Off-peak scheduler & rate limit recovery",
                icon = Icons.Default.NightlightRound,
                isExpanded = expandedSection == "advanced",
                onToggle = { expandedSection = if (expandedSection == "advanced") null else "advanced" }
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("Night-Owl Scheduler", fontSize = 14.sp)
                            Text("Download during off-peak hours (02:00 - 06:00)", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Switch(
                            checked = preferences.nightOwlEnabled,
                            onCheckedChange = {
                                onSetNightOwl(it, preferences.nightOwlStartTime, preferences.nightOwlEndTime, preferences.nightOwlRateLimit)
                            }
                        )
                    }

                    Text(
                        "Automatic Rate Limit Recovery: Enabled\nHTTP 429 errors from platforms like Twitter and Tumblr are automatically parsed and scheduled for resume after rate limit windows expire.",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        // 8. Engines & Credentials Section
        item {
            SettingsAccordionCard(
                title = "Media Engines & Authentication",
                subtitle = "Engine versions, OTA updates & cookies.txt",
                icon = Icons.Default.Tune,
                isExpanded = expandedSection == "engines",
                onToggle = { expandedSection = if (expandedSection == "engines") null else "engines" }
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Configured Media Engines", fontSize = 13.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold)

                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
                            .padding(10.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text("• YouTube Engine: ${engineVersions.newPipeVersion}", fontSize = 12.sp)
                        Text("• Gallery Engine: ${engineVersions.galleryDlVersion}", fontSize = 12.sp)
                        Text("• FFmpeg Status: ${engineVersions.ffmpegStatus}", fontSize = 12.sp)
                        Text("• yt-dlp Engine: ${engineVersions.ytDlpVersion}", fontSize = 12.sp)
                    }

                    if (engineVersions.isPersonalFlavor) {
                        OutlinedButton(
                            onClick = {
                                if (!isUpdatingEngines) {
                                    isUpdatingEngines = true
                                    engineUpdateMessage = "Updating yt-dlp..."
                                    coroutineScope.launch {
                                        val result = EngineInfoProvider.updateEngines(context)
                                        isUpdatingEngines = false
                                        engineUpdateMessage = result.fold(
                                            onSuccess = { it },
                                            onFailure = { it.message ?: "Update failed" }
                                        )
                                        engineVersions = EngineInfoProvider.getEngineVersions(context)
                                    }
                                }
                            },
                            enabled = !isUpdatingEngines,
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(6.dp))
                            Text(if (isUpdatingEngines) "Updating..." else "Update Engines (OTA)")
                        }

                        engineUpdateMessage?.let { msg ->
                            Text(
                                text = msg,
                                fontSize = 11.sp,
                                color = if (msg.contains("failed", ignoreCase = true)) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
                            )
                        }
                    }

                    HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp), color = SurfaceBorder)

                    Text("Authentication Cookies (cookies.txt)", fontSize = 13.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold)
                    Text(
                        "Enables extraction for sites requiring authentication (X, Instagram, Pixiv). Stored securely with mode 600 in app-private storage. Values are never logged.",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = if (hasCookies) "Cookies Active ($cookiesSizeBytes bytes)" else "No cookies imported",
                            fontSize = 12.sp,
                            fontWeight = androidx.compose.ui.text.font.FontWeight.Medium,
                            color = if (hasCookies) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
                        )

                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            if (hasCookies) {
                                OutlinedButton(
                                    onClick = {
                                        CookiesManager.deleteCookies(context)
                                        hasCookies = false
                                        cookiesSizeBytes = 0L
                                    },
                                    shape = RoundedCornerShape(8.dp),
                                    colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error)
                                ) {
                                    Text("Delete", fontSize = 11.sp)
                                }
                            }

                            Button(
                                onClick = {
                                    cookiePickerLauncher.launch(arrayOf("text/*", "*/*"))
                                },
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Icon(Icons.Default.FileOpen, contentDescription = null, modifier = Modifier.size(14.dp))
                                Spacer(Modifier.width(4.dp))
                                Text(if (hasCookies) "Replace" else "Import cookies.txt", fontSize = 11.sp)
                            }
                        }
                    }
                }
            }
        }

        // 9. About & Legal
        item {
            SettingsAccordionCard(
                title = "About & Legal",
                subtitle = "NovaDrop v0.5.2 Android Edition",
                icon = Icons.Default.Info,
                isExpanded = expandedSection == "about",
                onToggle = { expandedSection = if (expandedSection == "about") null else "about" }
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("NovaDrop for Android", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Text("Version 0.5.2 (Build 50200)", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("Author: Brandon", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("GitHub: Brandon-Morision/Media-Downloader", fontSize = 12.sp, color = MaterialTheme.colorScheme.primary)

                    Spacer(Modifier.height(6.dp))

                    OutlinedButton(
                        onClick = { showTermsDialog = true },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Icon(Icons.Default.Gavel, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Terms of Use & License")
                    }
                }
            }
        }
    }

    if (showTermsDialog) {
        AlertDialog(
            onDismissRequest = { showTermsDialog = false },
            title = { Text("Terms of Use") },
            text = {
                Text(
                    "NovaDrop is provided for personal, private, educational, and backup media extraction purposes only. Users are responsible for complying with the terms of service of source media providers and applicable copyright legislation.",
                    fontSize = 13.sp
                )
            },
            confirmButton = {
                Button(onClick = { showTermsDialog = false }) {
                    Text("I Understand")
                }
            }
        )
    }
}

@Composable
fun SettingsAccordionCard(
    title: String,
    subtitle: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    isExpanded: Boolean,
    onToggle: () -> Unit,
    content: @Composable () -> Unit
) {
    Card(
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = androidx.compose.foundation.BorderStroke(1.dp, SurfaceBorder),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onToggle() }
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.1f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
                }

                Spacer(Modifier.width(14.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Text(title, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface)
                    Text(subtitle, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }

                Icon(
                    if (isExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            if (isExpanded) {
                HorizontalDivider(color = SurfaceBorder)
                Box(modifier = Modifier.padding(16.dp)) {
                    content()
                }
            }
        }
    }
}
