import { getDatabase } from "@/lib/db/sqlite"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import type { ModelConfig, BaseModel } from "@/shared/models/base.model"
import { useAuthStore } from "@/features/auth/stores/auth.store"
import { DatabaseMaintenanceService } from "./database-maintenance.service"

export class SyncService {
    private static isSyncing = false
    private static debounceTimer: any = null
    private static configs: ModelConfig<any>[] = []

    /**
     * Registers a model config with the sync service.
     * Features should call this in their initialization.
     */
    static registerConfig(config: ModelConfig<any>) {
        if (!this.configs.find((c) => c.tableName === config.tableName)) {
            this.configs.push(config)
        }
    }

    static getConfigs() {
        return this.configs
    }

    /**
     * Generic table initialization for all registered models.
     * Ensures feature-specific tables exist before migrations or hydration.
     */
    static async initializeTables() {
        const db = await getDatabase()
        console.log(
            `SyncService: Initializing tables for ${this.configs.length} registered models...`
        )
        for (const config of this.configs) {
            await db.execute(config.createTableSql)
        }
    }

    static async initialize() {
        if (!isSupabaseConfigured) {
            console.warn(
                "SyncService: Supabase not configured, skipping initialization."
            )
            return
        }

        await SyncService.initializeTables()

        // Infrastructure: Ensure sync queue and metadata tables exist
        const db = await getDatabase()
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

        await db.execute(`
            CREATE TABLE IF NOT EXISTS sync_metadata (
                user_id TEXT PRIMARY KEY,
                last_synced_at TEXT
            )
        `)

        // Load existing local data first for immediate UI response
        await SyncService.loadAll()

        // Perform catch-up sync (Delta Sync)
        await this.pullDeltas()

        console.log("SyncService: Initializing event-driven sync...")

        // Upstream Lifecycle: Reconnect
        window.addEventListener("online", () => {
            console.log(
                "SyncService: Network online, flushing queue and pulling deltas..."
            )
            this.triggerSync(true)
            this.pullDeltas()
        })

        // Upstream Lifecycle: Foreground
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") {
                console.log("SyncService: App foregrounded, pulling deltas...")
                this.pullDeltas()
            }
        })

        // Downstream: Realtime Listener
        this.startRealtimeListener()

        // Safety fallback: slower interval
        setInterval(() => this.triggerSync(), 1000 * 60 * 5) // 5 minutes
    }

    /**
     * Efficient Catch-up Sync: Pulls only modified records from Supabase.
     */
    static async pullDeltas() {
        if (!isSupabaseConfigured || !supabase || this.isSyncing) return

        const currentUserId = useAuthStore.getState().user?.id
        if (!currentUserId) return

        const syncStartTime = Date.now()
        this.isSyncing = true
        useAuthStore.getState().setSyncing(true)
        const db = await getDatabase()

        // 1. Get last sync timestamp
        const meta = await db.select<any>(
            "SELECT last_synced_at FROM sync_metadata WHERE user_id = ?",
            [currentUserId]
        )
        const lastSyncedAt = meta.length > 0 ? meta[0].last_synced_at : null

        console.log(
            `SyncService: Pulling deltas since ${lastSyncedAt || "the beginning of time"}...`
        )

        try {
            // We use a high-water mark timestamp to avoid missing records updated in the same millisecond
            let newHighWaterMark = lastSyncedAt

            for (const config of this.configs) {
                let query = supabase
                    .from(config.tableName as any)
                    .select("*")
                    .eq("user_id", currentUserId)

                if (lastSyncedAt) {
                    query = query.gt("updated_at", lastSyncedAt)
                }

                const { data, error } = await query

                if (error) {
                    console.error(
                        `SyncService: Failed to pull deltas for ${config.tableName}:`,
                        error
                    )
                    continue
                }

                if (data && data.length > 0) {
                    console.log(
                        `SyncService: Processing ${data.length} delta records for ${config.tableName}`
                    )
                    for (const row of data) {
                        const entity = config.fromDb(row)

                        // Protection: Check if this record has a pending local change in the queue
                        const inQueue = await db.select<any>(
                            "SELECT id FROM sync_queue WHERE table_name = ? AND row_id = ? LIMIT 1",
                            [config.tableName, entity.id]
                        )

                        if (inQueue.length > 0) {
                            console.log(
                                `SyncService: Skipping delta for ${config.tableName}:${entity.id} - local change pending.`
                            )
                            continue
                        }

                        await db.execute(
                            config.saveSql,
                            config.toSqlValues(entity)
                        )

                        // Update high-water mark
                        if (
                            !newHighWaterMark ||
                            entity.updated_at > newHighWaterMark
                        ) {
                            newHighWaterMark = entity.updated_at
                        }

                        // Update in-memory store
                        config.upsertInStore(entity)
                    }
                }
            }

            // 2. Update last_synced_at with current high water mark
            if (newHighWaterMark) {
                await db.execute(
                    `
                    INSERT INTO sync_metadata (user_id, last_synced_at)
                    VALUES (?, ?)
                    ON CONFLICT(user_id) DO UPDATE SET last_synced_at = excluded.last_synced_at
                `,
                    [currentUserId, newHighWaterMark]
                )
            }

            console.log("SyncService: Delta sync complete.")
        } catch (err) {
            console.error("SyncService: Delta sync failed:", err)
        } finally {
            const elapsed = Date.now() - syncStartTime
            const remaining = Math.max(0, 1000 - elapsed)
            if (remaining > 0) {
                await new Promise((resolve) => setTimeout(resolve, remaining))
            }
            this.isSyncing = false
            useAuthStore.getState().setSyncing(false)
        }
    }

    static triggerSync(immediate = false) {
        if (!isSupabaseConfigured) return

        if (this.debounceTimer) clearTimeout(this.debounceTimer)

        if (immediate) {
            this.sync()
        } else {
            this.debounceTimer = setTimeout(() => this.sync(), 3000)
        }
    }

    /**
     * Generic save method that handles SQLite persistence and sync queuing.
     */
    static async save<T extends BaseModel>(config: ModelConfig<T>, entity: T) {
        const db = await getDatabase()
        const currentUserId = useAuthStore.getState().user?.id

        // Defensive RLS: ensure user_id is injected
        if (!entity.user_id && currentUserId) {
            ;(entity as any).user_id = currentUserId
        }

        await db.execute(config.saveSql, config.toSqlValues(entity))

        // Only sync to cloud if user_id is present
        if (entity.user_id) {
            await this.addToQueue(config.tableName, entity.id, "UPSERT", entity)
        } else {
            console.warn(
                `SyncService: Item saved locally but skipped cloud sync (no user_id): ${config.tableName}/${entity.id}`
            )
        }
    }

    /**
     * Generic soft-delete method that handles SQLite persistence and sync queuing.
     * Fetches full record first to satisfy RLS requirements.
     */
    static async delete<T extends BaseModel>(
        config: ModelConfig<T>,
        id: string
    ) {
        const db = await getDatabase()
        const updatedAt = new Date().toISOString()

        const rows = await db.select<any>(
            `SELECT * FROM ${config.tableName} WHERE id = ?`,
            [id]
        )
        if (rows.length === 0) return

        const entity = config.fromDb(rows[0])
        const updatedEntity = {
            ...entity,
            is_deleted: true,
            updated_at: updatedAt,
        }

        await db.execute(
            `UPDATE ${config.tableName} SET is_deleted = 1, updated_at = ? WHERE id = ?`,
            [updatedAt, id]
        )
        await this.addToQueue(
            config.tableName,
            id,
            "SOFT_DELETE",
            updatedEntity
        )
    }

    /**
     * Generic loader to hydrate all registered model stores from local SQLite.
     * Also triggers generic maintenance (purging old records) before loading.
     */
    static async loadAll() {
        const db = await getDatabase()
        const currentUserId = useAuthStore.getState().user?.id

        if (!currentUserId) {
            console.warn("SyncService: No user signed in, skipping load.")
            return
        }

        // Generic maintenance: purge local soft-deleted records that have already synced
        await DatabaseMaintenanceService.purgeOldDeletedRecords()

        console.log(
            `SyncService: Hydrating stores for ${this.configs.length} registered models...`
        )

        try {
            for (const config of this.configs) {
                const filter = config.loadFilter || "AND is_deleted = 0"
                const rows = await db.select<any>(
                    `SELECT * FROM ${config.tableName} WHERE user_id = ? ${filter}`,
                    [currentUserId]
                )
                config.setStore(rows.map((row) => config.fromDb(row)))
            }
        } catch (error) {
            console.error(
                "SyncService: Failed to hydrate stores from local DB:",
                error
            )
        }
    }

    /**
     * Adds an action to the local sync queue and triggers a sync.
     * Merges pending actions for the same record to minimize traffic.
     */
    static async addToQueue(
        tableName: string,
        rowId: string,
        action: string,
        payload: any
    ) {
        const db = await getDatabase()

        const existing = await db.select<any>(
            "SELECT id FROM sync_queue WHERE table_name = ? AND row_id = ? LIMIT 1",
            [tableName, rowId]
        )

        if (existing.length > 0) {
            await db.execute(
                `
                UPDATE sync_queue 
                SET action = ?, payload = ?, created_at = ?
                WHERE id = ?
            `,
                [
                    action,
                    JSON.stringify(payload),
                    new Date().toISOString(),
                    existing[0].id,
                ]
            )
        } else {
            await db.execute(
                `
                INSERT INTO sync_queue (table_name, row_id, action, payload, created_at)
                VALUES (?, ?, ?, ?, ?)
            `,
                [
                    tableName,
                    rowId,
                    action,
                    JSON.stringify(payload),
                    new Date().toISOString(),
                ]
            )
        }

        this.triggerSync()
    }

    static async sync() {
        if (!isSupabaseConfigured || !supabase || this.isSyncing) return

        const syncStartTime = Date.now()
        this.isSyncing = true
        useAuthStore.getState().setSyncing(true)

        try {
            // Defensive: Check for authenticated session before syncing
            const {
                data: { session },
            } = await supabase.auth.getSession()
            if (!session) {
                console.log("SyncService: No active session, skipping sync.")
                return
            }

            const db = await getDatabase()
            const queue = await db.select<any>(
                "SELECT * FROM sync_queue ORDER BY created_at ASC"
            )

            if (queue.length === 0) {
                return
            }

            console.log(
                `SyncService: Found ${queue.length} pending actions. Starting bulk push...`
            )

            const tables = Array.from(
                new Set(queue.map((item: any) => item.table_name))
            )

            let highWaterMark: string | null = null

            for (const table of tables as string[]) {
                const tableActions = queue.filter(
                    (item: any) => item.table_name === table
                )
                const payloads = tableActions.map((item: any) =>
                    JSON.parse(item.payload)
                )
                const actionIds = tableActions.map((item: any) => item.id)

                const config = this.configs.find((c) => c.tableName === table)
                const { error } = await supabase
                    .from(table as any)
                    .upsert(
                        payloads,
                        config?.upsertOnConflict
                            ? { onConflict: config.upsertOnConflict }
                            : undefined
                    )

                if (!error) {
                    const placeholders = actionIds.map(() => "?").join(",")
                    await db.execute(
                        `DELETE FROM sync_queue WHERE id IN (${placeholders})`,
                        actionIds
                    )
                    console.log(
                        `SyncService: Successfully synced ${tableActions.length} records to ${table}`
                    )

                    // Track the latest updated_at to advance last_synced_at
                    for (const payload of payloads) {
                        if (
                            payload.updated_at &&
                            (!highWaterMark ||
                                payload.updated_at > highWaterMark)
                        ) {
                            highWaterMark = payload.updated_at
                        }
                    }
                } else {
                    console.error(
                        `SyncService: Bulk sync error for ${table}:`,
                        error
                    )
                    break
                }
            }

            // 2. Update last_synced_at with current high water mark if we pushed successfully
            if (highWaterMark) {
                const currentUserId = session.user.id
                // Fetch current meta to avoid reverting last_synced_at if pullDeltas advanced it further
                const meta = await db.select<any>(
                    "SELECT last_synced_at FROM sync_metadata WHERE user_id = ?",
                    [currentUserId]
                )
                const existingLastSynced =
                    meta.length > 0 ? meta[0].last_synced_at : null

                if (!existingLastSynced || highWaterMark > existingLastSynced) {
                    await db.execute(
                        `
            INSERT INTO sync_metadata (user_id, last_synced_at)
            VALUES (?, ?)
            ON CONFLICT(user_id) DO UPDATE SET last_synced_at = excluded.last_synced_at
          `,
                        [currentUserId, highWaterMark]
                    )
                    console.log(
                        `SyncService: Advanced last_synced_at to ${highWaterMark} after successful push.`
                    )
                }
            }
        } catch (err) {
            console.error("SyncService: Sync process failed:", err)
        } finally {
            const elapsed = Date.now() - syncStartTime
            const remaining = Math.max(0, 1000 - elapsed)
            if (remaining > 0) {
                await new Promise((resolve) => setTimeout(resolve, remaining))
            }
            this.isSyncing = false
            useAuthStore.getState().setSyncing(false)
        }
    }

    private static async startRealtimeListener() {
        if (!supabase) return

        console.log("SyncService: Starting realtime listener...")

        supabase
            .channel("public-db-changes")
            .on(
                "postgres_changes",
                { event: "*", schema: "public" },
                async (payload) => {
                    const {
                        table,
                        eventType,
                        new: newRecord,
                        old: oldRecord,
                    } = payload
                    const db = await getDatabase()

                    const config = this.configs.find(
                        (c) => c.tableName === table
                    )
                    if (!config) {
                        // This is expected if the feature hasn't registered its config yet
                        return
                    }

                    console.log(
                        `SyncService: Received ${eventType} event from ${table}`
                    )

                    if (eventType === "INSERT" || eventType === "UPDATE") {
                        const entity = config.fromDb(newRecord)

                        // Protection: Check if this record has a pending local change in the queue
                        const inQueue = await db.select<any>(
                            "SELECT id FROM sync_queue WHERE table_name = ? AND row_id = ? LIMIT 1",
                            [config.tableName, entity.id]
                        )

                        if (inQueue.length > 0) {
                            console.log(
                                `SyncService: Skipping realtime update for ${config.tableName}:${entity.id} - local change pending.`
                            )
                            return
                        }

                        await db.execute(
                            config.saveSql,
                            config.toSqlValues(entity)
                        )
                        config.upsertInStore(entity)
                    } else if (eventType === "DELETE") {
                        await db.execute(
                            `DELETE FROM ${config.tableName} WHERE id = ?`,
                            [oldRecord.id]
                        )
                        config.removeFromStore(oldRecord.id)
                    }
                }
            )
            .subscribe()
    }
}
