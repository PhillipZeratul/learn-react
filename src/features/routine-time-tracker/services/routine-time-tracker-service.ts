import { getDatabase } from '@/lib/db/sqlite'
import { RoutineCard } from '../models/routine-card.model'
import { TimeTrackerCard } from '../models/time-tracker-card.model'
import { RoutineTimeTrackerTag } from '../models/routine-time-tracker-tag.model'
import { useRoutineTimeTrackerStore } from '../stores/routine-time-tracker.store'
import { SyncService } from '@/services/sync-service'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { useSettingsStore } from '@/stores/settings.store'

export class RoutineTimeTrackerService {
    static async initialize() {
        try {
            const db = await getDatabase()
            
            // Initialize tables
            await db.execute(`
                CREATE TABLE IF NOT EXISTS routine_cards (
                    id TEXT PRIMARY KEY,
                    title TEXT,
                    description TEXT,
                    start_at TEXT,
                    end_at TEXT,
                    tag_id TEXT,
                    user_id TEXT,
                    created_at TEXT,
                    updated_at TEXT,
                    is_deleted INTEGER DEFAULT 0
                )
            `)
            
            await db.execute(`
                CREATE TABLE IF NOT EXISTS time_tracker_cards (
                    id TEXT PRIMARY KEY,
                    title TEXT,
                    description TEXT,
                    start_at TEXT,
                    end_at TEXT,
                    tag_id TEXT,
                    user_id TEXT,
                    created_at TEXT,
                    updated_at TEXT,
                    is_deleted INTEGER DEFAULT 0
                )
            `)

            await db.execute(`
                CREATE TABLE IF NOT EXISTS routine_time_tracker_tags (
                    id TEXT PRIMARY KEY,
                    name TEXT,
                    color TEXT,
                    user_id TEXT,
                    created_at TEXT,
                    updated_at TEXT,
                    is_deleted INTEGER DEFAULT 0
                )
            `)

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

            const res1 = await db.execute(
                'DELETE FROM routine_cards WHERE is_deleted = 1 AND updated_at < ?',
                [cutoffDate]
            )
            const res2 = await db.execute(
                'DELETE FROM time_tracker_cards WHERE is_deleted = 1 AND updated_at < ?',
                [cutoffDate]
            )
            const res3 = await db.execute(
                'DELETE FROM routine_time_tracker_tags WHERE is_deleted = 1 AND updated_at < ?',
                [cutoffDate]
            )

            if ((res1.changes || 0) > 0 || (res2.changes || 0) > 0 || (res3.changes || 0) > 0) {
                console.log(`RoutineService: Purged ${(res1.changes || 0) + (res2.changes || 0) + (res3.changes || 0)} old records.`)
            }
        } catch (error) {
            console.error("RoutineService: Failed to purge old records:", error)
        }
    }

    static async loadAll() {
        const db = await getDatabase()
        const store = useRoutineTimeTrackerStore.getState()
        const currentUserId = useAuthStore.getState().user?.id;

        if (!currentUserId) {
            console.warn("RoutineService: No user signed in, skipping load.");
            return;
        }
        
        try {
            const routineRows = await db.select<any>(
                'SELECT * FROM routine_cards WHERE is_deleted = 0 AND user_id = ?', 
                [currentUserId]
            )
            const timeTrackerRows = await db.select<any>(
                'SELECT * FROM time_tracker_cards WHERE is_deleted = 0 AND user_id = ?', 
                [currentUserId]
            )
            const tagRows = await db.select<any>(
                'SELECT * FROM routine_time_tracker_tags WHERE is_deleted = 0 AND user_id = ?',
                [currentUserId]
            )

            store.setRoutineCards(routineRows.map(r => new RoutineCard({ ...r, is_deleted: !!r.is_deleted })))
            store.setTimeTrackerCards(timeTrackerRows.map(r => new TimeTrackerCard({ ...r, is_deleted: !!r.is_deleted })))
            store.setTags(tagRows.map(t => new RoutineTimeTrackerTag({ ...t, is_deleted: !!t.is_deleted })))
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

    static async saveRoutineCard(card: RoutineCard) {
        const db = await getDatabase()
        await db.execute(`
            INSERT OR REPLACE INTO routine_cards 
            (id, title, description, start_at, end_at, tag_id, user_id, created_at, updated_at, is_deleted)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            card.id, card.title, card.description, card.start_at, card.end_at, 
            card.tag_id, card.user_id, card.created_at, card.updated_at, card.is_deleted ? 1 : 0
        ])
        
        await this.addToSyncQueue('routine_cards', card.id, 'UPSERT', card)
    }

    static async saveTimeTrackerCard(card: TimeTrackerCard) {
        const db = await getDatabase()
        await db.execute(`
            INSERT OR REPLACE INTO time_tracker_cards 
            (id, title, description, start_at, end_at, tag_id, user_id, created_at, updated_at, is_deleted)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            card.id, card.title, card.description, card.start_at, card.end_at, 
            card.tag_id, card.user_id, card.created_at, card.updated_at, card.is_deleted ? 1 : 0
        ])

        await this.addToSyncQueue('time_tracker_cards', card.id, 'UPSERT', card)
    }

    static async saveTag(tag: RoutineTimeTrackerTag) {
        const db = await getDatabase()
        await db.execute(`
            INSERT OR REPLACE INTO routine_time_tracker_tags 
            (id, name, color, user_id, created_at, updated_at, is_deleted)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            tag.id, tag.name, tag.color, tag.user_id, tag.created_at, tag.updated_at, tag.is_deleted ? 1 : 0
        ])

        await this.addToSyncQueue('routine_time_tracker_tags', tag.id, 'UPSERT', tag)
    }

    static async deleteRoutineCard(id: string) {
        const db = await getDatabase()
        const updatedAt = new Date().toISOString()
        await db.execute('UPDATE routine_cards SET is_deleted = 1, updated_at = ? WHERE id = ?', [updatedAt, id])
        
        await this.addToSyncQueue('routine_cards', id, 'SOFT_DELETE', { id, is_deleted: 1, updated_at: updatedAt })
    }

    static async deleteTimeTrackerCard(id: string) {
        const db = await getDatabase()
        const updatedAt = new Date().toISOString()
        await db.execute('UPDATE time_tracker_cards SET is_deleted = 1, updated_at = ? WHERE id = ?', [updatedAt, id])
        
        await this.addToSyncQueue('time_tracker_cards', id, 'SOFT_DELETE', { id, is_deleted: 1, updated_at: updatedAt })
    }

    static async deleteTag(id: string) {
        const db = await getDatabase()
        const updatedAt = new Date().toISOString()
        await db.execute('UPDATE routine_time_tracker_tags SET is_deleted = 1, updated_at = ? WHERE id = ?', [updatedAt, id])

        await this.addToSyncQueue('routine_time_tracker_tags', id, 'SOFT_DELETE', { id, is_deleted: 1, updated_at: updatedAt })
    }

    // DEBUG ONLY: Clear all data (Local + Cloud) via Soft Delete
    static async clearAllData() {
        const db = await getDatabase();
        const updatedAt = new Date().toISOString();
        console.warn("RoutineService: INITIATING GLOBAL SOFT-DELETE...");

        try {
            // 1. Fetch all record IDs that aren't already deleted
            const routineIds = await db.select<{id: string}>('SELECT id FROM routine_cards WHERE is_deleted = 0');
            const trackerIds = await db.select<{id: string}>('SELECT id FROM time_tracker_cards WHERE is_deleted = 0');
            const tagIds = await db.select<{id: string}>('SELECT id FROM routine_time_tracker_tags WHERE is_deleted = 0');

            // 2. Batch update local records
            await db.execute('UPDATE routine_cards SET is_deleted = 1, updated_at = ?', [updatedAt]);
            await db.execute('UPDATE time_tracker_cards SET is_deleted = 1, updated_at = ?', [updatedAt]);
            await db.execute('UPDATE routine_time_tracker_tags SET is_deleted = 1, updated_at = ?', [updatedAt]);

            // 3. Add to sync queue for each record to propagate to Supabase
            for (const row of routineIds) {
                await this.addToSyncQueue('routine_cards', row.id, 'SOFT_DELETE', { id: row.id, is_deleted: 1, updated_at: updatedAt });
            }
            for (const row of trackerIds) {
                await this.addToSyncQueue('time_tracker_cards', row.id, 'SOFT_DELETE', { id: row.id, is_deleted: 1, updated_at: updatedAt });
            }
            for (const row of tagIds) {
                await this.addToSyncQueue('routine_time_tracker_tags', row.id, 'SOFT_DELETE', { id: row.id, is_deleted: 1, updated_at: updatedAt });
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
