import { getDatabase } from '@/lib/db/sqlite'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { routineCardConfig } from '@/features/routine-time-tracker/models/routine-card.model'
import { timeTrackerCardConfig } from '@/features/routine-time-tracker/models/time-tracker-card.model'
import { routineTimeTrackerTagConfig } from '@/features/routine-time-tracker/models/routine-time-tracker-tag.model'
import type { ModelConfig } from '@/features/routine-time-tracker/models/routine-time-tracker.model'

export class SyncService {
    private static isSyncing = false;
    private static debounceTimer: any = null;

    private static configs: ModelConfig<any>[] = [
        routineCardConfig,
        timeTrackerCardConfig,
        routineTimeTrackerTagConfig
    ];

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

                const config = this.configs.find(c => c.tableName === table);
                if (!config) {
                    console.warn(`SyncService: No config found for table ${table}`);
                    return;
                }

                console.log(`SyncService: Received ${eventType} event from ${table}`);

                if (eventType === 'INSERT' || eventType === 'UPDATE') {
                    // Apply to SQLite
                    await db.execute(config.saveSql, config.toSqlValues(config.fromDb(newRecord)));
                    
                    // Hydrate Zustand
                    const entity = config.fromDb(newRecord);
                    const existing = config.findInStore(entity.id);
                    if (existing) {
                        config.updateInStore(entity.id, entity);
                    } else if (!entity.is_deleted) {
                        config.addToStore(entity);
                    }
                } else if (eventType === 'DELETE') {
                    // Though we use soft deletes, we handle physical deletes for robustness
                    await db.execute(`DELETE FROM ${config.tableName} WHERE id = ?`, [oldRecord.id]);
                    config.deleteFromStore(oldRecord.id);
                }
            })
            .subscribe();
    }
}
