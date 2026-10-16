package com.novadrop.android.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

object NovaDropSpacing {
    val xxs: Dp = 2.dp
    val xs: Dp = 4.dp
    val sm: Dp = 8.dp
    val md: Dp = 12.dp
    val lg: Dp = 16.dp
    val xl: Dp = 20.dp
    val xxl: Dp = 24.dp
    val xxxl: Dp = 32.dp
}

object NovaDropShapes {
    val chip = RoundedCornerShape(8.dp)
    val cardSmall = RoundedCornerShape(12.dp)
    val cardMedium = RoundedCornerShape(16.dp)
    val cardLarge = RoundedCornerShape(20.dp)
    val input = RoundedCornerShape(12.dp)
    val button = RoundedCornerShape(10.dp)
    val thumbnail = RoundedCornerShape(8.dp)
}

object NovaDropElevations {
    val none: Dp = 0.dp
    val card: Dp = 2.dp
    val overlay: Dp = 8.dp
}
