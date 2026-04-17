import { getDatabase } from '@/lib/db/sqlite'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useRoutineTimeTrackerStore } from '@/features/routine-time-tracker/stores/routine-time-tracker.store'
import { RoutineCard } from '@/features/routine-time-tracker/models/routine-card.model'
import { TimeTrackerCard } from '@/features/routine-time-tracker/models/time-tracker-card.model'
import { RoutineTimeTrackerTag } from '@/features/routine-time-tracker/models/routine-time-tracker-tag.model'

export class SyncService {
    private static isSyncing = false;
    private static debounceTimer: any = null;

    static initialize() {
        if (!isSupabaseConfigured) {
            console.warn("SyncService: Supabase not configured, skipping initialization.");
            return;
        }

        console.log("SyncService: Initializing event-driven sync...");

        // Upstream Lifecycle: Reconnect
        window.addEventListener('online', () => {
            console.log("SyncService: Network online, flushing queue...");
            this.triggerSync(true);
        });
        
        // Upstream Lifecycle: Foreground
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                console.log("SyncService: App foregrounded, flushing queue...");
                this.triggerSync(true);
            }
        });

        // Downstream: Realtime Listener
        this.startRealtimeListener();

        // Safety fallback: slower interval
        setInterval(() => this.triggerSync(), 1000 * 60 * 5); // 5 minutes
    }

    static triggerSync(immediate = false) {
        if (!isSupabaseConfigured) return;
        
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        
        if (immediate) {
            this.sync();
        } else {
            this.debounceTimer = setTimeout(() => this.sync(), 3000);
        }
    }

    static async sync() {
        if (!isSupabaseConfigured || !supabase || this.isSyncing) return;
        this.isSyncing = true;

        try {
            const db = await getDatabase();
            const queue = await db.select<any>('SELECT * FROM sync_queue ORDER BY created_at ASC');
            
            if (queue.length === 0) {
                this.isSyncing = false;
                return;
            }

            console.log(`SyncService: Found ${queue.length} pending actions. Starting bulk push...`);

            // Phase 1: Group by table for Bulk Push
            const tables = Array.from(new Set(queue.map((item: any) => item.table_name)));

            for (const table of tables as string[]) {
                const tableActions = queue.filter((item: any) => item.table_name === table);
                const payloads = tableActions.map((item: any) => JSON.parse(item.payload));
                const actionIds = tableActions.map((item: any) => item.id);

                const { error } = await supabase
                    .from(table)
                    .upsert(payloads);

                if (!error) {
                    // Batch delete from local queue
                    const placeholders = actionIds.map(() => '?').join(',');
                    await db.execute(`DELETE FROM sync_queue WHERE id IN (${placeholders})`, actionIds);
                    console.log(`SyncService: Successfully synced ${tableActions.length} records to ${table}`);
                } else {
                    console.error(`SyncService: Bulk sync error for ${table}:`, error);
                    break; 
                }
            }
        } catch (err) {
            console.error("SyncService: Sync process failed:", err);
        } finally {
            this.isSyncing = false;
        }
    }

    private static async startRealtimeListener() {
        if (!supabase) return;

        console.log("SyncService: Starting realtime listener...");

        supabase
            .channel('public-db-changes')
            .on('postgres_changes', { event: '*', schema: 'public' }, async (payload) => {
                const { table, eventType, new: newRecord, old: oldRecord } = payload;
                const db = await getDatabase();
                const store = useRoutineTimeTrackerStore.getState();

                console.log(`SyncService: Received ${eventType} event from ${table}`);

                if (eventType === 'INSERT' || eventType === 'UPDATE') {
                    // Apply to SQLite
                    if (table === 'routine_cards') {
                        await db.execute(`
                            INSERT OR REPLACE INTO routine_cards 
                            (id, title, description, start_at, end_at, tag_id, user_id, created_at, updated_at, is_deleted)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `, [
                            newRecord.id, newRecord.title, newRecord.description, newRecord.start_at, newRecord.end_at,
                            newRecord.tag_id, newRecord.user_id, newRecord.created_at, newRecord.updated_at, newRecord.is_deleted ? 1 : 0
                        ]);
                        
                        // Hydrate Zustand
                        const card = new RoutineCard({ ...newRecord, is_deleted: !!newRecord.is_deleted });
                        const existing = store.routineCards.find(c => c.id === card.id);
                        if (existing) {
                            store.updateRoutineCard(card.id, card);
                        } else if (!card.is_deleted) {
                            store.addRoutineCard(card);
                        }
                    } else if (table === 'time_tracker_cards') {
                         await db.execute(`
                            INSERT OR REPLACE INTO time_tracker_cards 
                            (id, title, description, start_at, end_at, tag_id, user_id, created_at, updated_at, is_deleted)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `, [
                            newRecord.id, newRecord.title, newRecord.description, newRecord.start_at, newRecord.end_at,
                            newRecord.tag_id, newRecord.user_id, newRecord.created_at, newRecord.updated_at, newRecord.is_deleted ? 1 : 0
                        ]);

                        // Hydrate Zustand
                        const card = new TimeTrackerCard({ ...newRecord, is_deleted: !!newRecord.is_deleted });
                        const existing = store.timeTrackerCards.find(c => c.id === card.id);
                        if (existing) {
                            store.updateTimeTrackerCard(card.id, card);
                        } else if (!card.is_deleted) {
                            store.addTimeTrackerCard(card);
                        }
                    } else if (table === 'routine_tags') {
                        await db.execute(`
                            INSERT OR REPLACE INTO routine_tags 
                            (id, name, color, user_id, created_at, updated_at, is_deleted)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        `, [
                            newRecord.id, newRecord.name, newRecord.color, newRecord.user_id, 
                            newRecord.created_at, newRecord.updated_at, newRecord.is_deleted ? 1 : 0
                        ]);

                        // Hydrate Zustand
                        const tag = new RoutineTimeTrackerTag({ ...newRecord, is_deleted: !!newRecord.is_deleted });
                        const existing = store.tags.find(t => t.id === tag.id);
                        if (existing) {
                            store.updateTag(tag.id, tag);
                        } else if (!tag.is_deleted) {
                            store.addTag(tag);
                        }
                    }
                } else if (eventType === 'DELETE') {
                    // Though we use soft deletes, we handle physical deletes for robustness
                    if (table === 'routine_cards') {
                        await db.execute('DELETE FROM routine_cards WHERE id = ?', [oldRecord.id]);
                        // We don't have a direct remove action, but we can set is_deleted
                        store.deleteRoutineCard(oldRecord.id);
                    } else if (table === 'time_tracker_cards') {
                        await db.execute('DELETE FROM time_tracker_cards WHERE id = ?', [oldRecord.id]);
                        store.deleteTimeTrackerCard(oldRecord.id);
                    } else if (table === 'routine_tags') {
                        await db.execute('DELETE FROM routine_tags WHERE id = ?', [oldRecord.id]);
                        store.deleteTag(oldRecord.id);
                    }
                }
            })
            .subscribe();
    }
}
