import { getDatabase } from "@/lib/db/sqlite"
import { SyncService } from "./sync.service"
import { useAuthStore } from "@/features/auth/stores/auth.store"
import { useSettingsStore } from "@/features/settings/stores/settings.store"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import type { IsoDateTime } from "../models/base.model"
import type { Database } from "@/lib/database.types"

type TableName = keyof Database["public"]["Tables"]

export class DatabaseMaintenanceService {
    /**
     * Purges soft-deleted records from local SQLite that are older than the retention period.
     * Crucially, it only purges records that have no pending actions in the sync_queue.
     */
    static async purgeOldDeletedRecords() {
        try {
            const db = await getDatabase()
            const retentionDays = useSettingsStore.getState().syncRetentionDays
            const cutoffDate = new Date(
                Date.now() - retentionDays * 24 * 60 * 60 * 1000
            ).toISOString()

            console.log(
                `DatabaseMaintenanceService: Purging soft-deleted records older than ${retentionDays} days (before ${cutoffDate})`
            )

            const configs = SyncService.getConfigs()

            const results = await Promise.all(
                configs.map((config) => {
                    // We only delete records that are soft-deleted AND older than cutoff AND NOT in the sync queue.
                    // We also respect the model's specific purgeFilter (e.g. protecting routine tombstones).
                    const extraFilter = config.purgeFilter || ""

                    return db.execute(
                        `
                        DELETE FROM ${config.tableName} 
                        WHERE is_deleted = 1 
                          AND updated_at < ? 
                          AND id NOT IN (SELECT row_id FROM sync_queue WHERE table_name = ?)
                          ${extraFilter}
                    `,
                        [cutoffDate, config.tableName]
                    )
                })
            )

            const totalPurged = results.reduce(
                (acc, res) => acc + (res.changes || 0),
                0
            )

            if (totalPurged > 0) {
                console.log(
                    `DatabaseMaintenanceService: Purged ${totalPurged} old records.`
                )
            }
        } catch (error) {
            console.error(
                "DatabaseMaintenanceService: Failed to purge old records:",
                error
            )
        }
    }

    /**
     * DEBUG ONLY: Clear specific table data (Local + Cloud) via Soft Delete.
     */
    static async clearTableData(tableName: string) {
        const db = await getDatabase()
        const updatedAt = new Date().toISOString() as IsoDateTime
        const currentUserId = useAuthStore.getState().user?.id

        if (!currentUserId) {
            console.error(
                "DatabaseMaintenanceService: Cannot clear data - no user logged in."
            )
            return
        }

        const configs = SyncService.getConfigs()
        const config = configs.find((c) => c.tableName === tableName)
        if (!config) {
            console.error(
                `DatabaseMaintenanceService: Table ${tableName} not found in configs.`
            )
            console.log(
                "Available tables:",
                configs.map((c) => c.tableName).join(", ")
            )
            return
        }

        console.warn(
            `DatabaseMaintenanceService: INITIATING SOFT-DELETE FOR TABLE: ${tableName}...`
        )
        useAuthStore.getState().setSyncing(true)

        try {
            const rows = await db.select<Record<string, unknown>>(
                `SELECT * FROM ${config.tableName} WHERE is_deleted = 0 AND user_id = ?`,
                [currentUserId]
            )

            if (rows.length > 0) {
                await db.execute(
                    `UPDATE ${config.tableName} SET is_deleted = 1, updated_at = ? WHERE user_id = ?`,
                    [updatedAt, currentUserId]
                )

                await Promise.all(
                    rows.map((row) => {
                        const entity = config.fromDb(row)
                        return SyncService.addToQueue(
                            config.tableName,
                            entity.id,
                            "SOFT_DELETE",
                            {
                                ...entity,
                                is_deleted: true,
                                updated_at: updatedAt,
                            }
                        )
                    })
                )

                SyncService.triggerSync(true)
            }

            config.setStore([])
            console.log(
                `DatabaseMaintenanceService: Local data for ${tableName} cleared. Sync in progress.`
            )
        } catch (error) {
            console.error(
                `DatabaseMaintenanceService: Failed to clear table ${tableName}:`,
                error
            )
        } finally {
            useAuthStore.getState().setSyncing(false)
        }
    }

    /**
     * DEBUG ONLY: Clear all managed table data (Local + Cloud).
     */
    static async clearAllData() {
        console.warn(
            "DatabaseMaintenanceService: INITIATING GLOBAL SOFT-DELETE..."
        )
        useAuthStore.getState().setSyncing(true)

        try {
            const configs = SyncService.getConfigs()
            await Promise.all(
                configs.map((config) => this.clearTableData(config.tableName))
            )
            console.log(
                "DatabaseMaintenanceService: All local data cleared. Sync in progress."
            )
        } catch (error) {
            console.error(
                "DatabaseMaintenanceService: Failed to clear all data:",
                error
            )
        } finally {
            useAuthStore.getState().setSyncing(false)
        }
    }

    /**
     * DEBUG ONLY: Clears the local sync queue.
     */
    static async clearSyncQueue() {
        try {
            const db = await getDatabase()
            await db.execute("DELETE FROM sync_queue")
            console.log("DatabaseMaintenanceService: Local sync queue cleared.")
        } catch (error) {
            console.error(
                "DatabaseMaintenanceService: Failed to clear sync queue:",
                error
            )
        }
    }

    /**
     * DEBUG ONLY: Force a full pull from Supabase for all registered models.
     * Updates local SQLite and hydrates stores.
     */
    static async pullFromCloud() {
        if (!isSupabaseConfigured || !supabase) return

        const currentUserId = useAuthStore.getState().user?.id
        if (!currentUserId) {
            console.error(
                "DatabaseMaintenanceService: Cannot pull from cloud - no user logged in."
            )
            return
        }

        console.log(
            `DatabaseMaintenanceService: INITIATING FULL CLOUD PULL for user ${currentUserId}...`
        )
        useAuthStore.getState().setSyncing(true)

        try {
            const db = await getDatabase()
            const configs = SyncService.getConfigs()

            await Promise.all(
                configs.map(async (config) => {
                    console.log(
                        `DatabaseMaintenanceService: Pulling ${config.tableName}...`
                    )
                    const { data, error } = await supabase!
                        .from(config.tableName as TableName)
                        .select("*")
                        .eq("user_id", currentUserId)

                    if (error) {
                        console.error(
                            `DatabaseMaintenanceService: Failed to pull ${config.tableName}:`,
                            error
                        )
                        return
                    }

                    if (data && data.length > 0) {
                        // We process saving in parallel as they are independent records
                        await Promise.all(
                            data.map((row) => {
                                const entity = config.fromDb(
                                    row as Record<string, unknown>
                                )
                                return db.execute(
                                    config.saveSql,
                                    config.toSqlValues(entity)
                                )
                            })
                        )
                        console.log(
                            `DatabaseMaintenanceService: Pulled ${data.length} records for ${config.tableName}`
                        )
                    }
                })
            )

            // Re-hydrate stores from the now-updated local DB
            await SyncService.loadAll()
            console.log(
                "DatabaseMaintenanceService: Cloud pull and local hydration complete."
            )
        } catch (err) {
            console.error("DatabaseMaintenanceService: Cloud pull failed:", err)
        } finally {
            useAuthStore.getState().setSyncing(false)
        }
    }
}
