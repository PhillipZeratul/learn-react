import { getDatabase } from '@/lib/db/sqlite'
import { routineCardConfig } from '../models/routine-card.model'
import { timeTrackerCardConfig } from '../models/time-tracker-card.model'
import { routineTimeTrackerTagConfig } from '../models/routine-time-tracker-tag.model'
import { useRoutineTimeTrackerStore } from '../stores/routine-time-tracker.store'
import { SyncService } from '@/services/sync-service'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { useSettingsStore } from '@/stores/settings.store'
import type { ModelConfig } from '../models/routine-time-tracker.model'
import type { BaseEntity } from '@/models/base.model'

export class RoutineTimeTrackerService {
    private static configs: ModelConfig<any>[] = [
        routineCardConfig,
        timeTrackerCardConfig,
        routineTimeTrackerTagConfig
    ];

    static async initialize() {
        try {
            const db = await getDatabase()
            
            // Initialize tables from configs
            for (const config of this.configs) {
                await db.execute(config.createTableSql);
            }
            
            // Action Queue table for Local-First sync
            await db.execute(`
                CREATE TABLE IF NOT EXISTS sync_queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    table_name TEXT,
                    row_id TEXT,
                    action TEXT, -- 'UPSERT', 'SOFT_DELETE'
                    payload TEXT,
                    created_at TEXT
                )
            `)

            await this.purgeOldDeletedRecords()
            await this.loadAll()
        } catch (error) {
            console.error("RoutineService Initialization failed:", error)
        }
    }

    static async purgeOldDeletedRecords() {
        try {
            const db = await getDatabase()
            const retentionDays = useSettingsStore.getState().syncRetentionDays
            const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString()

            console.log(`RoutineService: Purging soft-deleted records older than ${retentionDays} days (before ${cutoffDate})`)

            let totalPurged = 0;
            for (const config of this.configs) {
                const res = await db.execute(
                    `DELETE FROM ${config.tableName} WHERE is_deleted = 1 AND updated_at < ?`,
                    [cutoffDate]
                );
                totalPurged += res.changes || 0;
            }

            if (totalPurged > 0) {
                console.log(`RoutineService: Purged ${totalPurged} old records.`)
            }
        } catch (error) {
            console.error("RoutineService: Failed to purge old records:", error)
        }
    }

    static async loadAll() {
        const db = await getDatabase()
        const currentUserId = useAuthStore.getState().user?.id;

        if (!currentUserId) {
            console.warn("RoutineService: No user signed in, skipping load.");
            return;
        }
        
        try {
            for (const config of this.configs) {
                const rows = await db.select<any>(
                    `SELECT * FROM ${config.tableName} WHERE is_deleted = 0 AND user_id = ?`, 
                    [currentUserId]
                );
                config.updateStore(rows.map(row => config.fromDb(row)));
            }

            // Ensure at least one tag exists for the user
            const tags = useRoutineTimeTrackerStore.getState().tags;
            if (tags.length === 0) {
                const { TEST_TAG_ID } = await import('@/test/test-consts');
                const { createRoutineTimeTrackerTag } = await import('../models/routine-time-tracker-tag.model');
                
                const defaultTag = createRoutineTimeTrackerTag({
                    id: TEST_TAG_ID,
                    name: 'Default',
                    color: '#787878'
                });
                
                await this.save(routineTimeTrackerTagConfig, defaultTag);
                useRoutineTimeTrackerStore.getState().addTag(defaultTag);
            }
        } catch (error) {
            console.error("Failed to load cards from DB:", error)
        }
    }

    private static async addToSyncQueue(tableName: string, rowId: string, action: string, payload: any) {
        const db = await getDatabase()
        
        // Check if there's already a pending action for this record to merge
        const existing = await db.select<any>(
            'SELECT id FROM sync_queue WHERE table_name = ? AND row_id = ? LIMIT 1',
            [tableName, rowId]
        )

        if (existing.length > 0) {
            await db.execute(`
                UPDATE sync_queue 
                SET action = ?, payload = ?, created_at = ?
                WHERE id = ?
            `, [action, JSON.stringify(payload), new Date().toISOString(), existing[0].id])
        } else {
            await db.execute(`
                INSERT INTO sync_queue (table_name, row_id, action, payload, created_at)
                VALUES (?, ?, ?, ?, ?)
            `, [tableName, rowId, action, JSON.stringify(payload), new Date().toISOString()])
        }
        
        // Trigger event-driven sync
        SyncService.triggerSync();
    }

    static async save<T extends BaseEntity>(config: ModelConfig<T>, entity: T) {
        const db = await getDatabase()
        await db.execute(config.saveSql, config.toSqlValues(entity))
        await this.addToSyncQueue(config.tableName, entity.id, 'UPSERT', entity)
    }

    static async delete<T extends BaseEntity>(config: ModelConfig<T>, id: string) {
        const db = await getDatabase()
        const updatedAt = new Date().toISOString()
        await db.execute(`UPDATE ${config.tableName} SET is_deleted = 1, updated_at = ? WHERE id = ?`, [updatedAt, id])
        await this.addToSyncQueue(config.tableName, id, 'SOFT_DELETE', { id, is_deleted: 1, updated_at: updatedAt })
    }

    // DEBUG ONLY: Clear all data (Local + Cloud) via Soft Delete
    static async clearAllData() {
        const db = await getDatabase();
        const updatedAt = new Date().toISOString();
        console.warn("RoutineService: INITIATING GLOBAL SOFT-DELETE...");

        try {
            for (const config of this.configs) {
                // 1. Fetch all record IDs that aren't already deleted
                const ids = await db.select<{id: string}>(`SELECT id FROM ${config.tableName} WHERE is_deleted = 0`);

                // 2. Batch update local records
                await db.execute(`UPDATE ${config.tableName} SET is_deleted = 1, updated_at = ?`, [updatedAt]);

                // 3. Add to sync queue for each record to propagate to Supabase
                for (const row of ids) {
                    await this.addToSyncQueue(config.tableName, row.id, 'SOFT_DELETE', { id: row.id, is_deleted: 1, updated_at: updatedAt });
                }
            }

            // 4. Reset Zustand store
            useRoutineTimeTrackerStore.getState().reset();

            // 5. Force immediate sync
            console.log("RoutineService: Triggering immediate cloud sync for clear operation...");
            SyncService.triggerSync(true);

            console.log("RoutineService: Local data cleared. Sync in progress.");
        } catch (error) {
            console.error("RoutineService: Failed to clear all data:", error);
        }
    }
}
