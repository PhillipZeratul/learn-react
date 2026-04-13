import { getDatabase } from '@/lib/db/sqlite'
import { RoutineCard } from '@/features/routine-time-tracker/models/RoutineCard'
import { TimeTrackerCard } from '@/features/routine-time-tracker/models/TimeTrackerCard'
import { useRoutineStore } from '@/store/routineStore'

export class RoutineService {
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
                    tag TEXT,
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
                    action TEXT, -- 'INSERT', 'UPDATE', 'DELETE'
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
        const store = useRoutineStore.getState()
        
        try {
            const routineRows = await db.select<any>('SELECT * FROM routine_cards WHERE is_deleted = 0')
            const trackerRows = await db.select<any>('SELECT * FROM time_tracker_cards WHERE is_deleted = 0')

            store.setRoutineCards(routineRows.map(r => new RoutineCard({ ...r, is_deleted: !!r.is_deleted })))
            store.setTimeTrackerCards(trackerRows.map(r => new TimeTrackerCard({ ...r, is_deleted: !!r.is_deleted })))
        } catch (error) {
            console.error("Failed to load cards from DB:", error)
        }
    }

    private static async addToSyncQueue(tableName: string, rowId: string, action: string, payload: any) {
        const db = await getDatabase()
        await db.execute(`
            INSERT INTO sync_queue (table_name, row_id, action, payload, created_at)
            VALUES (?, ?, ?, ?, ?)
        `, [tableName, rowId, action, JSON.stringify(payload), new Date().toISOString()])
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
            (id, title, description, start_at, end_at, tag, user_id, created_at, updated_at, is_deleted)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            card.id, card.title, card.description, card.start_at, card.end_at, 
            card.tag, card.user_id, card.created_at, card.updated_at, card.is_deleted ? 1 : 0
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
}
