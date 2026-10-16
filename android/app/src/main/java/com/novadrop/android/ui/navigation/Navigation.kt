package com.novadrop.android.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.VideoLibrary
import androidx.compose.ui.graphics.vector.ImageVector

sealed class Screen(val route: String, val title: String, val icon: ImageVector) {
    data object Home : Screen("home", "Home", Icons.Default.Home)
    data object Downloader : Screen("downloader", "Downloader", Icons.Default.Download)
    data object Explore : Screen("explore", "Explore", Icons.Default.Explore)
    data object Library : Screen("library", "Library", Icons.Default.VideoLibrary)
    data object Settings : Screen("settings", "Settings", Icons.Default.Settings)

    companion object {
        val items: List<Screen>
            get() = listOf(Home, Downloader, Explore, Library, Settings)
    }
}
