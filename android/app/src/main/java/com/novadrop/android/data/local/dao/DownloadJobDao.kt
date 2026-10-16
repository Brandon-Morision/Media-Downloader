package com.novadrop.android.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.novadrop.android.data.local.entity.DownloadJobEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface DownloadJobDao {

    @Query("SELECT * FROM download_jobs ORDER BY createdAt DESC")
    fun getAllJobsFlow(): Flow<List<DownloadJobEntity>>

    @Query("SELECT * FROM download_jobs WHERE id = :id LIMIT 1")
    suspend fun getJobById(id: String): DownloadJobEntity?

    @Query("SELECT * FROM download_jobs WHERE state IN ('PENDING', 'RUNNING', 'PREPARING')")
    suspend fun getActiveJobs(): List<DownloadJobEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertJob(job: DownloadJobEntity)

    @Update
    suspend fun updateJob(job: DownloadJobEntity)

    @Query("DELETE FROM download_jobs WHERE id = :id")
    suspend fun deleteJobById(id: String)

    @Query("DELETE FROM download_jobs WHERE state IN ('COMPLETED', 'FAILED', 'CANCELLED')")
    suspend fun clearFinishedJobs()

    @Query("DELETE FROM download_jobs")
    suspend fun clearAll()
}
