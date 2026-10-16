package com.novadrop.android.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

@Composable
fun NovaDropTheme(
    themeAccent: String = "ocean",
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val (primaryColor, primaryContainer) = when (themeAccent.lowercase()) {
        "emerald" -> EmeraldMint to EmeraldMintDark
        "violet" -> VioletGlow to VioletGlowDark
        "amber" -> SolarAmber to SolarAmberDark
        "rose" -> CrimsonRose to CrimsonRoseDark
        else -> OceanBlue to OceanBlueDark
    }

    val darkColors = darkColorScheme(
        primary = primaryColor,
        onPrimary = Color.Black,
        primaryContainer = primaryContainer,
        onPrimaryContainer = Color.White,
        secondary = primaryColor,
        onSecondary = Color.Black,
        background = BgDark,
        onBackground = TextPrimaryDark,
        surface = SurfaceDark,
        onSurface = TextPrimaryDark,
        surfaceVariant = SurfaceCard,
        onSurfaceVariant = TextSecondaryDark,
        outline = SurfaceBorder,
        error = StatusError,
        onError = Color.White
    )

    val lightColors = lightColorScheme(
        primary = primaryContainer,
        onPrimary = Color.White,
        primaryContainer = primaryColor.copy(alpha = 0.2f),
        onPrimaryContainer = primaryContainer,
        background = Color(0xFFF8FAFC),
        onBackground = Color(0xFF0F172A),
        surface = Color.White,
        onSurface = Color(0xFF0F172A),
        surfaceVariant = Color(0xFFF1F5F9),
        onSurfaceVariant = Color(0xFF475569),
        outline = Color(0xFFE2E8F0)
    )

    val colorScheme = if (darkTheme) darkColors else lightColors

    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}
