import { getDatabase } from '@/lib/db/sqlite'
import { SyncService } from './sync-service'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { useSettingsStore } from '@/features/settings/stores/settings.store'

export class DatabaseMaintenanceService {
    /**
     * Purges soft-deleted records from local SQLite that are older than the retention period.
     * Crucially, it only purges records that have no pending actions in the sync_queue.
     */
    static async purgeOldDeletedRecords() {
        try {
            const db = await getDatabase()
            const retentionDays = useSettingsStore.getState().syncRetentionDays
            const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString()

            console.log(`DatabaseMaintenanceService: Purging soft-deleted records older than ${retentionDays} days (before ${cutoffDate})`)

            const configs = SyncService.getConfigs();
            let totalPurged = 0;
            
            for (const config of configs) {
                // We only delete records that are soft-deleted AND older than cutoff AND NOT in the sync queue.
                const res = await db.execute(`
                    DELETE FROM ${config.tableName} 
                    WHERE is_deleted = 1 
                      AND updated_at < ? 
                      AND id NOT IN (SELECT row_id FROM sync_queue WHERE table_name = ?)
                `, [cutoffDate, config.tableName]);
                
                totalPurged += res.changes || 0;
            }

            if (totalPurged > 0) {
                console.log(`DatabaseMaintenanceService: Purged ${totalPurged} old records.`)
            }
        } catch (error) {
            console.error("DatabaseMaintenanceService: Failed to purge old records:", error)
        }
    }

    /**
     * DEBUG ONLY: Clear specific table data (Local + Cloud) via Soft Delete.
     */
    static async clearTableData(tableName: string) {
        const db = await getDatabase();
        const updatedAt = new Date().toISOString();
        const currentUserId = useAuthStore.getState().user?.id;
        
        if (!currentUserId) {
            console.error("DatabaseMaintenanceService: Cannot clear data - no user logged in.");
            return;
        }

        const configs = SyncService.getConfigs();
        const config = configs.find(c => c.tableName === tableName);
        if (!config) {
            console.error(`DatabaseMaintenanceService: Table ${tableName} not found in configs.`);
            console.log("Available tables:", configs.map(c => c.tableName).join(", "));
            return;
        }

        console.warn(`DatabaseMaintenanceService: INITIATING SOFT-DELETE FOR TABLE: ${tableName}...`);

        try {
            const rows = await db.select<any>(
                `SELECT * FROM ${config.tableName} WHERE is_deleted = 0 AND user_id = ?`,
                [currentUserId]
            );

            if (rows.length > 0) {
                await db.execute(
                    `UPDATE ${config.tableName} SET is_deleted = 1, updated_at = ? WHERE user_id = ?`, 
                    [updatedAt, currentUserId]
                );

                for (const row of rows) {
                    const entity = config.fromDb(row);
                    await SyncService.addToQueue(config.tableName, entity.id, 'SOFT_DELETE', { 
                        ...entity,
                        is_deleted: true, 
                        updated_at: updatedAt 
                    });
                }

                SyncService.triggerSync(true);
            }

            config.updateStore([]);
            console.log(`DatabaseMaintenanceService: Local data for ${tableName} cleared. Sync in progress.`);
        } catch (error) {
            console.error(`DatabaseMaintenanceService: Failed to clear table ${tableName}:`, error);
        }
    }

    /**
     * DEBUG ONLY: Clear all managed table data (Local + Cloud).
     */
    static async clearAllData() {
        console.warn("DatabaseMaintenanceService: INITIATING GLOBAL SOFT-DELETE...");

        try {
            const configs = SyncService.getConfigs();
            for (const config of configs) {
                await this.clearTableData(config.tableName);
            }
            console.log("DatabaseMaintenanceService: All local data cleared. Sync in progress.");
        } catch (error) {
            console.error("DatabaseMaintenanceService: Failed to clear all data:", error);
        }
    }
}
