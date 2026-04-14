import { getDatabase } from '@/lib/db/sqlite'
import { RoutineCard } from '../models/RoutineCard'
import { TimeTrackerCard } from '../models/TimeTrackerCard'
import { useRoutineTimeTrackerStore } from '../store/routineTimeTrackerStore'
import { SyncService } from '@/services/syncService'
import { useAuthStore } from '@/store/authStore'

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

            await this.loadAll()
        } catch (error) {
            console.error("RoutineService Initialization failed:", error)
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

            store.setRoutineCards(routineRows.map(r => new RoutineCard({ ...r, is_deleted: !!r.is_deleted })))
            store.setTimeTrackerCards(timeTrackerRows.map(r => new TimeTrackerCard({ ...r, is_deleted: !!r.is_deleted })))
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

    // DEBUG ONLY: Clear all local data
    static async clearAllData() {
        const db = await getDatabase();
        console.warn("RoutineService: CLEARING ALL LOCAL DATA...");
        
        await db.execute('DROP TABLE IF EXISTS routine_cards');
        await db.execute('DROP TABLE IF EXISTS time_tracker_cards');
        await db.execute('DROP TABLE IF EXISTS sync_queue');
        
        useRoutineTimeTrackerStore.getState().reset();
        
        // Re-initialize to recreate tables
        await this.initialize();
        console.log("RoutineService: Database cleared and re-initialized.");
    }
}
