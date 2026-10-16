package com.novadrop.android.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.novadrop.android.NovaDropApp
import com.novadrop.android.core.model.UserPreferences
import com.novadrop.android.data.local.entity.SearchHistoryEntity
import com.novadrop.android.ui.downloader.DownloaderScreen
import com.novadrop.android.ui.explore.ExploreScreen
import com.novadrop.android.ui.home.HomeScreen
import com.novadrop.android.ui.library.LibraryScreen
import com.novadrop.android.ui.navigation.Screen
import com.novadrop.android.ui.player.PlayerOverlay
import com.novadrop.android.ui.settings.SettingsScreen
import com.novadrop.android.ui.theme.NovaDropTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private var sharedUrlState = mutableStateOf<String?>(null)

    private val requestNotificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { _ ->
            // Notification permission handled
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)

        handleIntent(intent)
        checkNotificationPermission()

        val app = application as NovaDropApp

        setContent {
            val preferences by app.preferencesRepository.preferencesFlow.collectAsState(
                initial = UserPreferences()
            )
            val downloads by app.downloadRepository.getAllJobsFlow().collectAsState(
                initial = emptyList()
            )
            val searchEntities by app.database.searchHistoryDao().getRecentSearchesFlow().collectAsState(
                initial = emptyList()
            )
            val recentSearches = remember(searchEntities) { searchEntities.map { it.query } }

            NovaDropTheme(
                themeAccent = preferences.themeAccent,
                darkTheme = preferences.isDarkMode
            ) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    NovaDropAppScaffold(
                        app = app,
                        preferences = preferences,
                        downloads = downloads,
                        recentSearches = recentSearches,
                        sharedUrl = sharedUrlState.value,
                        onClearSharedUrl = { sharedUrlState.value = null }
                    )
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        if (intent == null) return
        val url = intent.getStringExtra("shared_url")
            ?: intent.getStringExtra(Intent.EXTRA_TEXT)
        if (!url.isNullOrBlank()) {
            sharedUrlState.value = url
        }
    }

    private fun checkNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(
                    this,
                    Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                requestNotificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }
}

@Composable
fun NovaDropAppScaffold(
    app: NovaDropApp,
    preferences: UserPreferences,
    downloads: List<com.novadrop.android.core.model.DownloadJob>,
    recentSearches: List<String>,
    sharedUrl: String?,
    onClearSharedUrl: () -> Unit
) {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route ?: Screen.Home.route
    val coroutineScope = rememberCoroutineScope()

    var activeInitialExploreUrl by remember { mutableStateOf("") }

    // If a shared URL was passed in, immediately route to Explore
    LaunchedEffect(sharedUrl) {
        if (!sharedUrl.isNullOrBlank()) {
            activeInitialExploreUrl = sharedUrl
            navController.navigate(Screen.Explore.route) {
                popUpTo(navController.graph.findStartDestination().id) {
                    saveState = true
                }
                launchSingleTop = true
                restoreState = true
            }
            onClearSharedUrl()
        }
    }

    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val isWideScreen = maxWidth >= 600.dp

        if (isWideScreen) {
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .windowInsetsPadding(WindowInsets.systemBars)
            ) {
                NavigationRail(
                    containerColor = MaterialTheme.colorScheme.surface,
                    contentColor = MaterialTheme.colorScheme.onSurface
                ) {
                    Spacer(Modifier.height(16.dp))
                    Screen.items.forEach { screen ->
                        NavigationRailItem(
                            selected = currentRoute == screen.route,
                            onClick = {
                                navController.navigate(screen.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = { Icon(screen.icon, contentDescription = screen.title) },
                            label = { Text(screen.title) }
                        )
                    }
                }

                Box(modifier = Modifier.weight(1f).fillMaxHeight()) {
                    AppNavigationGraph(
                        navController = navController,
                        app = app,
                        preferences = preferences,
                        downloads = downloads,
                        recentSearches = recentSearches,
                        initialExploreUrl = activeInitialExploreUrl,
                        onExploreUrlHandled = { activeInitialExploreUrl = "" },
                        onSetExploreUrl = { activeInitialExploreUrl = it }
                    )

                    PlayerOverlay(
                        playbackManager = app.playbackManager,
                        preferences = preferences,
                        onSaveVideoExitPreference = { behavior ->
                            coroutineScope.launch {
                                app.preferencesRepository.setExitPlayerVideo(behavior)
                            }
                        }
                    )
                }
            }
        } else {
            Scaffold(
                contentWindowInsets = WindowInsets.systemBars,
                bottomBar = {
                    NavigationBar(
                        containerColor = MaterialTheme.colorScheme.surface,
                        contentColor = MaterialTheme.colorScheme.onSurface
                    ) {
                        Screen.items.forEach { screen ->
                            NavigationBarItem(
                                selected = currentRoute == screen.route,
                                onClick = {
                                    navController.navigate(screen.route) {
                                        popUpTo(navController.graph.findStartDestination().id) {
                                            saveState = true
                                        }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                },
                                icon = { Icon(screen.icon, contentDescription = screen.title) },
                                label = { Text(screen.title) }
                            )
                        }
                    }
                }
            ) { paddingValues ->
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                ) {
                    AppNavigationGraph(
                        navController = navController,
                        app = app,
                        preferences = preferences,
                        downloads = downloads,
                        recentSearches = recentSearches,
                        initialExploreUrl = activeInitialExploreUrl,
                        onExploreUrlHandled = { activeInitialExploreUrl = "" },
                        onSetExploreUrl = { activeInitialExploreUrl = it }
                    )

                    PlayerOverlay(
                        playbackManager = app.playbackManager,
                        preferences = preferences,
                        onSaveVideoExitPreference = { behavior ->
                            coroutineScope.launch {
                                app.preferencesRepository.setExitPlayerVideo(behavior)
                            }
                        }
                    )
                }
            }
        }
    }
}

@Composable
fun AppNavigationGraph(
    navController: androidx.navigation.NavHostController,
    app: NovaDropApp,
    preferences: UserPreferences,
    downloads: List<com.novadrop.android.core.model.DownloadJob>,
    recentSearches: List<String>,
    initialExploreUrl: String,
    onExploreUrlHandled: () -> Unit,
    onSetExploreUrl: (String) -> Unit = {}
) {
    val coroutineScope = rememberCoroutineScope()

    NavHost(
        navController = navController,
        startDestination = Screen.Home.route
    ) {
        composable(Screen.Home.route) {
            HomeScreen(
                downloads = downloads,
                onAnalyzeUrl = { url ->
                    onSetExploreUrl(url)
                    navController.navigate(Screen.Explore.route)
                },
                onQuickDownload = { url ->
                    coroutineScope.launch {
                        val metaResult = app.extractorEngine.extractMetadata(url)
                        val title = metaResult.getOrNull()?.title ?: "Quick Download"
                        app.downloadRepository.enqueueJob(
                            url = url,
                            title = title,
                            format = preferences.defaultFormat
                        )
                        navController.navigate(Screen.Downloader.route)
                    }
                },
                onPlayJob = { job ->
                    app.playbackManager.playJob(job)
                },
                onNavigateToDownloader = {
                    navController.navigate(Screen.Downloader.route)
                },
                onNavigateToLibrary = {
                    navController.navigate(Screen.Library.route)
                }
            )
        }

        composable(Screen.Downloader.route) {
            DownloaderScreen(
                downloads = downloads,
                onPauseJob = { id ->
                    coroutineScope.launch { app.downloadRepository.pauseJob(id) }
                },
                onResumeJob = { id ->
                    coroutineScope.launch { app.downloadRepository.resumeJob(id) }
                },
                onCancelJob = { id ->
                    coroutineScope.launch { app.downloadRepository.cancelJob(id) }
                },
                onRetryJob = { id ->
                    coroutineScope.launch { app.downloadRepository.retryJob(id) }
                },
                onDeleteJob = { id ->
                    coroutineScope.launch { app.downloadRepository.deleteJob(id) }
                },
                onClearFinished = {
                    coroutineScope.launch { app.downloadRepository.clearFinishedJobs() }
                },
                onPlayJob = { job ->
                    app.playbackManager.playJob(job)
                }
            )
        }

        composable(Screen.Explore.route) {
            ExploreScreen(
                initialUrl = initialExploreUrl,
                onInitialUrlHandled = onExploreUrlHandled,
                recentSearches = recentSearches,
                onAnalyzeUrl = { url ->
                    app.extractorEngine.extractMetadata(url)
                },
                onSearchYouTube = { query ->
                    app.extractorEngine.search(query)
                },
                onSaveSearchQuery = { query ->
                    coroutineScope.launch {
                        app.database.searchHistoryDao().insertSearch(
                            SearchHistoryEntity(query = query)
                        )
                    }
                },
                onDeleteSearchQuery = { query ->
                    coroutineScope.launch {
                        app.database.searchHistoryDao().deleteSearch(query)
                    }
                },
                onStartDownload = { url, title, format ->
                    coroutineScope.launch {
                        app.downloadRepository.enqueueJob(
                            url = url,
                            title = title,
                            format = format
                        )
                        navController.navigate(Screen.Downloader.route)
                    }
                },
                onOpenPlaylistInspector = { playlistUrl ->
                    coroutineScope.launch {
                        val result = app.extractorEngine.inspectPlaylist(playlistUrl).getOrNull()
                        if (result != null && result.entries.isNotEmpty()) {
                            result.entries.forEach { track ->
                                app.downloadRepository.enqueueJob(
                                    url = track.webpageUrl,
                                    title = track.title,
                                    format = preferences.defaultFormat
                                )
                            }
                            navController.navigate(Screen.Downloader.route)
                        }
                    }
                }
            )
            DisposableEffect(initialExploreUrl) {
                if (initialExploreUrl.isNotEmpty()) {
                    onExploreUrlHandled()
                }
                onDispose { }
            }
        }

        composable(Screen.Library.route) {
            LibraryScreen(
                downloads = downloads,
                onPlayJob = { job ->
                    app.playbackManager.playJob(job)
                },
                onDeleteJob = { id ->
                    coroutineScope.launch {
                        app.downloadRepository.deleteJob(id)
                    }
                }
            )
        }

        composable(Screen.Settings.route) {
            SettingsScreen(
                preferences = preferences,
                onSetThemeAccent = { accent ->
                    coroutineScope.launch { app.preferencesRepository.setThemeAccent(accent) }
                },
                onSetDarkMode = { dark ->
                    coroutineScope.launch { app.preferencesRepository.setDarkMode(dark) }
                },
                onSetDefaultFormat = { format ->
                    coroutineScope.launch { app.preferencesRepository.setDefaultFormat(format) }
                },
                onSetCompletionAction = { action ->
                    coroutineScope.launch { app.preferencesRepository.setCompletionAction(action) }
                },
                onSetExitPlayerAudio = { behavior ->
                    coroutineScope.launch { app.preferencesRepository.setExitPlayerAudio(behavior) }
                },
                onSetExitPlayerVideo = { behavior ->
                    coroutineScope.launch { app.preferencesRepository.setExitPlayerVideo(behavior) }
                },
                onSetNightOwl = { enabled, start, end, limit ->
                    coroutineScope.launch {
                        app.preferencesRepository.setNightOwl(enabled, start, end, limit)
                    }
                },
                onSetNotificationsEnabled = { enabled ->
                    coroutineScope.launch {
                        app.preferencesRepository.setNotificationsEnabled(enabled)
                    }
                }
            )
        }
    }
}
