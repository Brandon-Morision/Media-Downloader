package com.novadrop.android.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.novadrop.android.data.local.dao.DownloadJobDao
import com.novadrop.android.data.local.dao.SearchHistoryDao
import com.novadrop.android.data.local.entity.DownloadJobEntity
import com.novadrop.android.data.local.entity.SearchHistoryEntity

@Database(
    entities = [
        DownloadJobEntity::class,
        SearchHistoryEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class NovaDropDatabase : RoomDatabase() {

    abstract fun downloadJobDao(): DownloadJobDao
    abstract fun searchHistoryDao(): SearchHistoryDao

    companion object {
        @Volatile
        private var INSTANCE: NovaDropDatabase? = null

        fun getInstance(context: Context): NovaDropDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    NovaDropDatabase::class.java,
                    "novadrop_database.db"
                ).fallbackToDestructiveMigration().build()
                INSTANCE = instance
                instance
            }
        }
    }
}
