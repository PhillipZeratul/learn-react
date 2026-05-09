import { getDatabase } from '@/lib/db/sqlite'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { ModelConfig, BaseEntity } from '@/shared/models/base.model'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { DatabaseMaintenanceService } from './database-maintenance.service'

export class SyncService {
    private static isSyncing = false;
    private static debounceTimer: any = null;
    private static configs: ModelConfig<any>[] = [];

    /**
     * Registers a model config with the sync service.
     * Features should call this in their initialization.
     */
    static registerConfig(config: ModelConfig<any>) {
        if (!this.configs.find(c => c.tableName === config.tableName)) {
            this.configs.push(config);
        }
    }

    static getConfigs() {
        return this.configs;
    }

    /**
     * Generic table initialization for all registered models.
     * Ensures feature-specific tables exist before migrations or hydration.
     */
    static async initializeTables() {
        const db = await getDatabase();
        console.log(`SyncService: Initializing tables for ${this.configs.length} registered models...`);
        for (const config of this.configs) {
            await db.execute(config.createTableSql);
        }
    }

    static async initialize() {
        if (!isSupabaseConfigured) {
            console.warn("SyncService: Supabase not configured, skipping initialization.");
            return;
        }

        await SyncService.initializeTables();
        await SyncService.loadAll();

        console.log("SyncService: Initializing event-driven sync...");

        // Infrastructure: Ensure sync queue exists
        const db = await getDatabase();
        await db.execute(`
            CREATE TABLE IF NOT EXISTS sync_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                table_name TEXT,
                row_id TEXT,
                action TEXT, -- 'UPSERT', 'SOFT_DELETE'
                payload TEXT,
                created_at TEXT
            )
        `);

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

    /**
     * Generic save method that handles SQLite persistence and sync queuing.
     */
    static async save<T extends BaseEntity>(config: ModelConfig<T>, entity: T) {
        const db = await getDatabase();
        const currentUserId = useAuthStore.getState().user?.id;
        
        // Defensive RLS: ensure user_id is injected
        if (!entity.user_id && currentUserId) {
            (entity as any).user_id = currentUserId;
        }

        await db.execute(config.saveSql, config.toSqlValues(entity));
        
        // Only sync to cloud if user_id is present
        if (entity.user_id) {
            await this.addToQueue(config.tableName, entity.id, 'UPSERT', entity);
        } else {
            console.warn(`SyncService: Item saved locally but skipped cloud sync (no user_id): ${config.tableName}/${entity.id}`);
        }
    }

    /**
     * Generic soft-delete method that handles SQLite persistence and sync queuing.
     * Fetches full record first to satisfy RLS requirements.
     */
    static async delete<T extends BaseEntity>(config: ModelConfig<T>, id: string) {
        const db = await getDatabase();
        const updatedAt = new Date().toISOString();
        
        const rows = await db.select<any>(`SELECT * FROM ${config.tableName} WHERE id = ?`, [id]);
        if (rows.length === 0) return;

        const entity = config.fromDb(rows[0]);
        const updatedEntity = { 
            ...entity, 
            is_deleted: true, 
            updated_at: updatedAt 
        };

        await db.execute(`UPDATE ${config.tableName} SET is_deleted = 1, updated_at = ? WHERE id = ?`, [updatedAt, id]);
        await this.addToQueue(config.tableName, id, 'SOFT_DELETE', updatedEntity);
    }

    /**
     * Generic loader to hydrate all registered model stores from local SQLite.
     * Also triggers generic maintenance (purging old records) before loading.
     */
    static async loadAll() {
        const db = await getDatabase();
        const currentUserId = useAuthStore.getState().user?.id;

        if (!currentUserId) {
            console.warn("SyncService: No user signed in, skipping load.");
            return;
        }

        // Generic maintenance: purge local soft-deleted records that have already synced
        await DatabaseMaintenanceService.purgeOldDeletedRecords();
        
        console.log(`SyncService: Hydrating stores for ${this.configs.length} registered models...`);

        try {
            for (const config of this.configs) {
                const filter = config.loadFilter || 'AND is_deleted = 0';
                const rows = await db.select<any>(
                    `SELECT * FROM ${config.tableName} WHERE user_id = ? ${filter}`, 
                    [currentUserId]
                );
                config.updateStore(rows.map(row => config.fromDb(row)));
            }
        } catch (error) {
            console.error("SyncService: Failed to hydrate stores from local DB:", error);
        }
    }

    /**
     * Adds an action to the local sync queue and triggers a sync.
     * Merges pending actions for the same record to minimize traffic.
     */
    static async addToQueue(tableName: string, rowId: string, action: string, payload: any) {
        const db = await getDatabase();
        
        const existing = await db.select<any>(
            'SELECT id FROM sync_queue WHERE table_name = ? AND row_id = ? LIMIT 1',
            [tableName, rowId]
        );

        if (existing.length > 0) {
            await db.execute(`
                UPDATE sync_queue 
                SET action = ?, payload = ?, created_at = ?
                WHERE id = ?
            `, [action, JSON.stringify(payload), new Date().toISOString(), existing[0].id]);
        } else {
            await db.execute(`
                INSERT INTO sync_queue (table_name, row_id, action, payload, created_at)
                VALUES (?, ?, ?, ?, ?)
            `, [tableName, rowId, action, JSON.stringify(payload), new Date().toISOString()]);
        }
        
        this.triggerSync();
    }

    static async sync() {
        if (!isSupabaseConfigured || !supabase || this.isSyncing) return;
        
        this.isSyncing = true;

        try {
            // Defensive: Check for authenticated session before syncing
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                console.log("SyncService: No active session, skipping sync.");
                this.isSyncing = false;
                return;
            }

            const db = await getDatabase();
            const queue = await db.select<any>('SELECT * FROM sync_queue ORDER BY created_at ASC');
            
            if (queue.length === 0) {
                this.isSyncing = false;
                return;
            }

            console.log(`SyncService: Found ${queue.length} pending actions. Starting bulk push...`);

            const tables = Array.from(new Set(queue.map((item: any) => item.table_name)));

            for (const table of tables as string[]) {
                const tableActions = queue.filter((item: any) => item.table_name === table);
                const payloads = tableActions.map((item: any) => JSON.parse(item.payload));
                const actionIds = tableActions.map((item: any) => item.id);

                const { error } = await supabase
                    .from(table as any)
                    .upsert(payloads);

                if (!error) {
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
                    // This is expected if the feature hasn't registered its config yet
                    return;
                }

                console.log(`SyncService: Received ${eventType} event from ${table}`);

                if (eventType === 'INSERT' || eventType === 'UPDATE') {
                    await db.execute(config.saveSql, config.toSqlValues(config.fromDb(newRecord)));
                    
                    const entity = config.fromDb(newRecord);
                    const existing = config.findInStore(entity.id);
                    if (existing) {
                        config.updateInStore(entity.id, entity);
                    } else {
                        config.addToStore(entity);
                    }
                } else if (eventType === 'DELETE') {
                    await db.execute(`DELETE FROM ${config.tableName} WHERE id = ?`, [oldRecord.id]);
                    config.deleteFromStore(oldRecord.id);
                }
            })
            .subscribe();
    }
}
