package com.novadrop.android.data.preferences

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.novadrop.android.core.model.UserPreferences
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "novadrop_preferences")

class UserPreferencesRepository(private val context: Context) {

    private object PreferencesKeys {
        val THEME_ACCENT = stringPreferencesKey("theme_accent")
        val IS_DARK_MODE = booleanPreferencesKey("is_dark_mode")
        val DEFAULT_FORMAT = stringPreferencesKey("default_format")
        val OUTPUT_FOLDER_URI = stringPreferencesKey("output_folder_uri")
        val COMPLETION_ACTION = stringPreferencesKey("completion_action")
        val EXIT_PLAYER_AUDIO = stringPreferencesKey("exit_player_audio")
        val EXIT_PLAYER_VIDEO = stringPreferencesKey("exit_player_video")
        val NIGHT_OWL_ENABLED = booleanPreferencesKey("night_owl_enabled")
        val NIGHT_OWL_START = stringPreferencesKey("night_owl_start")
        val NIGHT_OWL_END = stringPreferencesKey("night_owl_end")
        val NIGHT_OWL_LIMIT = stringPreferencesKey("night_owl_limit")
        val NOTIFICATIONS_ENABLED = booleanPreferencesKey("notifications_enabled")
    }

    val preferencesFlow: Flow<UserPreferences> = context.dataStore.data.map { pref ->
        UserPreferences(
            themeAccent = pref[PreferencesKeys.THEME_ACCENT] ?: "ocean",
            isDarkMode = pref[PreferencesKeys.IS_DARK_MODE] ?: true,
            defaultFormat = pref[PreferencesKeys.DEFAULT_FORMAT] ?: "auto",
            outputFolderUri = pref[PreferencesKeys.OUTPUT_FOLDER_URI],
            completionAction = pref[PreferencesKeys.COMPLETION_ACTION] ?: "nothing",
            exitPlayerAudio = pref[PreferencesKeys.EXIT_PLAYER_AUDIO] ?: "mini",
            exitPlayerVideo = pref[PreferencesKeys.EXIT_PLAYER_VIDEO] ?: "ask",
            nightOwlEnabled = pref[PreferencesKeys.NIGHT_OWL_ENABLED] ?: false,
            nightOwlStartTime = pref[PreferencesKeys.NIGHT_OWL_START] ?: "02:00",
            nightOwlEndTime = pref[PreferencesKeys.NIGHT_OWL_END] ?: "06:00",
            nightOwlRateLimit = pref[PreferencesKeys.NIGHT_OWL_LIMIT] ?: "500",
            nativeNotificationsEnabled = pref[PreferencesKeys.NOTIFICATIONS_ENABLED] ?: true
        )
    }

    suspend fun setThemeAccent(accent: String) {
        context.dataStore.edit { pref -> pref[PreferencesKeys.THEME_ACCENT] = accent }
    }

    suspend fun setDarkMode(enabled: Boolean) {
        context.dataStore.edit { pref -> pref[PreferencesKeys.IS_DARK_MODE] = enabled }
    }

    suspend fun setDefaultFormat(format: String) {
        context.dataStore.edit { pref -> pref[PreferencesKeys.DEFAULT_FORMAT] = format }
    }

    suspend fun setCompletionAction(action: String) {
        context.dataStore.edit { pref -> pref[PreferencesKeys.COMPLETION_ACTION] = action }
    }

    suspend fun setExitPlayerAudio(behavior: String) {
        context.dataStore.edit { pref -> pref[PreferencesKeys.EXIT_PLAYER_AUDIO] = behavior }
    }

    suspend fun setExitPlayerVideo(behavior: String) {
        context.dataStore.edit { pref -> pref[PreferencesKeys.EXIT_PLAYER_VIDEO] = behavior }
    }

    suspend fun setNightOwl(enabled: Boolean, start: String, end: String, limit: String) {
        context.dataStore.edit { pref ->
            pref[PreferencesKeys.NIGHT_OWL_ENABLED] = enabled
            pref[PreferencesKeys.NIGHT_OWL_START] = start
            pref[PreferencesKeys.NIGHT_OWL_END] = end
            pref[PreferencesKeys.NIGHT_OWL_LIMIT] = limit
        }
    }

    suspend fun setNotificationsEnabled(enabled: Boolean) {
        context.dataStore.edit { pref -> pref[PreferencesKeys.NOTIFICATIONS_ENABLED] = enabled }
    }
}
