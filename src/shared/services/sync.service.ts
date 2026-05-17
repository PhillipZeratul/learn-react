import { getDatabase } from "@/lib/db/sqlite"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import type {
    ModelConfig,
    BaseModel,
    UserId,
    IsoDateTime,
} from "@/shared/models/base.model"
import { useAuthStore } from "@/features/auth/stores/auth.store"
import { DatabaseMaintenanceService } from "./database-maintenance.service"
import type { Database } from "@/lib/database.types"

type TableName = keyof Database["public"]["Tables"]

interface QueueItem {
    id: number
    table_name: string
    row_id: string
    action: "INSERT" | "UPDATE" | "SOFT_DELETE"
    payload: string
    created_at: string
}

interface SyncMetadata {
    user_id: string
    last_synced_at: string
}

export class SyncService {
    private static isSyncing = false
    private static debounceTimer: ReturnType<typeof setTimeout> | null = null
    // Internal registry of model configurations.
    // We use BaseModel here and cast during registration to bypass variance issues.
    private static configs: ModelConfig<BaseModel>[] = []

    /**
     * Registers a model config with the sync service.
     * Features should call this in their initialization.
     */
    static registerConfig<T extends BaseModel>(config: ModelConfig<T>) {
        if (!this.configs.find((c) => c.tableName === config.tableName)) {
            // Bypass variance issues by casting to unknown then to BaseModel config.
            // This is safe because the sync service only interacts with BaseModel properties.
            this.configs.push(config as unknown as ModelConfig<BaseModel>)
        }
    }

    static getConfigs() {
        return this.configs
    }

    /**
     * Generic table initialization for all registered models.
     * Ensures feature-specific tables exist and have the correct schema.
     * Automatically adds missing columns to existing tables.
     */
    static async initializeTables() {
        const db = await getDatabase()
        console.log(
            `SyncService: Initializing tables for ${this.configs.length} registered models...`
        )

        // Parallelize table existence checks and initial creation
        await Promise.all(
            this.configs.map((config) => db.execute(config.createTableSql))
        )

        // Schema Migration: Add missing columns
        // Migration is potentially sequential if it involves ALTER TABLE,
        // but we can still parallelize the PRAGMA checks.
        await Promise.all(
            this.configs.map(async (config) => {
                try {
                    // Get current columns
                    const tableInfo = await db.select<{ name: string }>(
                        `PRAGMA table_info(${config.tableName})`
                    )
                    const existingColumns = tableInfo.map((col) => col.name)

                    // Extract column definitions from createTableSql
                    // Simple regex to match "column_name TYPE" patterns
                    const columnMatches = Array.from(
                        config.createTableSql.matchAll(
                            /\b(\w+)\s+(TEXT|INTEGER|REAL|BLOB)\b/gi
                        )
                    )

                    for (const match of columnMatches) {
                        const columnName = match[1]
                        const columnType = match[2]

                        if (!existingColumns.includes(columnName)) {
                            console.log(
                                `SyncService: Adding missing column '${columnName}' to '${config.tableName}'`
                            )
                            await db.execute(
                                `ALTER TABLE ${config.tableName} ADD COLUMN ${columnName} ${columnType}`
                            )
                        }
                    }
                } catch (err) {
                    console.error(
                        `SyncService: Schema migration failed for ${config.tableName}:`,
                        err
                    )
                }
            })
        )
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
        await Promise.all([
            db.execute(`
                CREATE TABLE IF NOT EXISTS sync_queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    table_name TEXT,
                    row_id TEXT,
                    action TEXT, -- 'INSERT', 'UPDATE', 'SOFT_DELETE'
                    payload TEXT,
                    created_at TEXT
                )
            `),
            db.execute(`
                CREATE TABLE IF NOT EXISTS sync_metadata (
                    user_id TEXT PRIMARY KEY,
                    last_synced_at TEXT
                )
            `),
        ])

        // V2 Migration: Clear old full-payload queues to avoid patch logic crash
        const migrationCheck = await db.select(
            "SELECT * FROM sync_metadata WHERE user_id = 'v2_migration'"
        )
        if (migrationCheck.length === 0) {
            console.log(
                "SyncService: Performing V2 migration, clearing legacy queue..."
            )
            await db.execute("DELETE FROM sync_queue")
            await db.execute(
                "INSERT INTO sync_metadata (user_id, last_synced_at) VALUES ('v2_migration', ?)",
                [new Date().toISOString()]
            )
        }

        // Load existing local data first for immediate UI response
        await SyncService.loadAll()

        // Perform catch-up sync (Delta Sync)
        await this.pullDeltas()

        console.log("SyncService: Initializing event-driven sync...")

        // Upstream Lifecycle: Reconnect
        window.addEventListener("online", () => {
            console.log(
                "SyncService: [EVENT] Network online, triggering sync..."
            )
            this.triggerSync(true)
        })

        // Upstream Lifecycle: Foreground
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") {
                console.log(
                    "SyncService: [EVENT] App foregrounded, pulling deltas..."
                )
                this.triggerSync(true)
            }
        })

        // Downstream: Realtime Listener (will be called again on user change)
        this.startRealtimeListener()

        // Safety fallback: slower interval
        setInterval(() => this.triggerSync(), 1000 * 60 * 5) // 5 minutes
    }

    private static realtimeChannel: ReturnType<
        NonNullable<typeof supabase>["channel"]
    > | null = null

    /**
     * Efficient Catch-up Sync: Pulls only modified records from Supabase.
     */
    static async pullDeltas() {
        if (!isSupabaseConfigured || !supabase) return
        if (this.isSyncing) {
            console.log("SyncService: pullDeltas skipped (already syncing)")
            return
        }

        console.log("SyncService: Starting pullDeltas...")
        this.isSyncing = true
        useAuthStore.getState().setSyncing(true)
        try {
            await this.internalPullDeltas()
        } finally {
            this.isSyncing = false
            useAuthStore.getState().setSyncing(false)
        }
    }

    private static async internalPullDeltas() {
        const currentUserId = useAuthStore.getState().user?.id
        if (!currentUserId) return

        const db = await getDatabase()

        // 1. Get last sync timestamp
        const meta = await db.select<SyncMetadata>(
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

            const results = await Promise.all(
                this.configs.map(async (config) => {
                    let query = supabase!
                        .from(config.tableName as TableName)
                        .select("*")
                        .eq("user_id", currentUserId)

                    if (lastSyncedAt) {
                        query = query.gt("updated_at", lastSyncedAt)
                    }

                    const { data, error } = await query

                    if (error) {
                        return { config, data: null, error }
                    }

                    return {
                        config,
                        data: data as Record<string, unknown>[],
                        error: null,
                    }
                })
            )

            // Prioritize routine_time_tracker_states so that the "active ID" is updated
            // before we process card deltas. This ensures card conflict resolution
            // uses the freshest authoritative state.
            const sortedResults = results.sort((a, b) => {
                const isAState =
                    a.config.tableName === "routine_time_tracker_states"
                const isBState =
                    b.config.tableName === "routine_time_tracker_states"
                if (isAState && !isBState) return -1
                if (!isAState && isBState) return 1
                return 0
            })

            for (const { config, data, error } of sortedResults) {
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

                    // Bulk-check sync queue for all row IDs in this batch
                    const rowIds = data.map((r) => r.id)
                    const placeholders = rowIds.map(() => "?").join(",")
                    const inQueueResults = await db.select<{
                        row_id: string
                        payload: string
                    }>(
                        `SELECT row_id, payload FROM sync_queue WHERE table_name = ? AND row_id IN (${placeholders})`,
                        [config.tableName, ...rowIds]
                    )
                    const inQueueMap = new Map(
                        inQueueResults.map((q) => [q.row_id, q])
                    )

                    for (const row of data) {
                        const entity = config.fromDb(row)
                        const inQueue = inQueueMap.get(entity.id)
                        let finalEntity = entity

                        // Update high-water mark AS EARLY AS POSSIBLE
                        // If we received this from server, we are definitely synced up to this point.
                        if (
                            !newHighWaterMark ||
                            entity.updated_at > newHighWaterMark
                        ) {
                            newHighWaterMark = entity.updated_at
                        }

                        if (inQueue) {
                            const pendingPatch = JSON.parse(
                                inQueue.payload
                            ) as Partial<BaseModel>

                            // Server Reconciliation: Apply local patch on top of authoritative cloud state
                            // We MUST ensure the resulting updated_at is at least as new as the cloud's
                            // to avoid an infinite loop where we keep pulling the same "stale" version.
                            const cloudUpdatedAt = entity.updated_at
                            const localUpdatedAt =
                                pendingPatch.updated_at || entity.updated_at

                            finalEntity = {
                                ...entity,
                                ...pendingPatch,
                                updated_at:
                                    cloudUpdatedAt > localUpdatedAt
                                        ? cloudUpdatedAt
                                        : localUpdatedAt,
                            } as typeof entity

                            console.log(
                                `SyncService: [RECONCILE] ${config.tableName}:${entity.id}`
                            )
                        } else {
                            // Check if local DB already has same or newer version (for non-queued items)
                            const localRows = await db.select<{
                                updated_at: string
                            }>(
                                `SELECT updated_at FROM ${config.tableName} WHERE id = ?`,
                                [entity.id]
                            )
                            if (
                                localRows.length > 0 &&
                                localRows[0].updated_at >= entity.updated_at
                            ) {
                                continue
                            }
                            console.log(
                                `SyncService: [APPLY] ${config.tableName}:${entity.id} (Cloud is newer: ${entity.updated_at})`
                            )
                        }

                        await db.execute(
                            config.saveSql,
                            config.toSqlValues(finalEntity)
                        )

                        // Update in-memory store
                        config.upsertInStore(finalEntity)
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
        }
    }

    static triggerSync(immediate = false) {
        if (!isSupabaseConfigured) return

        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer)
            this.debounceTimer = null
        }

        if (immediate) {
            console.log("SyncService: triggerSync(immediate)")
            this.sync()
        } else {
            console.log("SyncService: triggerSync(debounced 3s)")
            this.debounceTimer = setTimeout(() => this.sync(), 3000)
        }
    }

    /**
     * Generic save method that handles SQLite persistence and sync queuing.
     */
    static async save<T extends BaseModel>(config: ModelConfig<T>, entity: T) {
        const db = await getDatabase()
        const currentUserId = useAuthStore.getState().user?.id as UserId
        const now = new Date().toISOString() as IsoDateTime

        // Defensive RLS: ensure user_id is injected
        if (!entity.user_id && currentUserId) {
            ;(entity as BaseModel).user_id = currentUserId
        }

        // 1. Fetch old record to compute patch
        const rows = await db.select<Record<string, unknown>>(
            `SELECT * FROM ${config.tableName} WHERE id = ?`,
            [entity.id]
        )

        const patch: Record<string, unknown> = {}
        const finalEntity = { ...entity }

        if (rows.length > 0) {
            const oldEntity = config.fromDb(rows[0])
            let hasChanges = false
            for (const key in entity) {
                // Skip _sync_status and other local-only fields
                if (key.startsWith("_")) continue

                if (entity[key as keyof T] !== oldEntity[key as keyof T]) {
                    patch[key] = entity[key as keyof T]
                    hasChanges = true
                }
            }

            if (!hasChanges) {
                console.log(
                    `SyncService: No changes detected for ${config.tableName}:${entity.id}, skipping save.`
                )
                return
            }

            // Always refresh updated_at on save to ensure LWW works correctly
            finalEntity.updated_at = now
            patch.updated_at = now
            patch.id = entity.id
        } else {
            // It's an insert, patch is the full entity
            finalEntity.updated_at = now
            Object.assign(patch, finalEntity)
        }

        await db.execute(config.saveSql, config.toSqlValues(finalEntity))
        console.log(
            `SyncService: [LOCAL SAVE] ${config.tableName}:${entity.id} (updated_at: ${finalEntity.updated_at})`
        )

        // Only sync to cloud if user_id is present
        if (finalEntity.user_id) {
            await this.addToQueue(
                config.tableName,
                finalEntity.id,
                rows.length > 0 ? "UPDATE" : "INSERT",
                patch as Partial<BaseModel>
            )
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
        const updatedAt = new Date().toISOString() as IsoDateTime

        const rows = await db.select<Record<string, unknown>>(
            `SELECT * FROM ${config.tableName} WHERE id = ?`,
            [id]
        )
        if (rows.length === 0) return

        await db.execute(
            `UPDATE ${config.tableName} SET is_deleted = 1, updated_at = ? WHERE id = ?`,
            [updatedAt, id]
        )
        await this.addToQueue(config.tableName, id, "SOFT_DELETE", {
            id,
            is_deleted: true,
            updated_at: updatedAt,
        } as Partial<BaseModel>)
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
            await Promise.all(
                this.configs.map(async (config) => {
                    const filter = config.loadFilter || "AND is_deleted = 0"
                    const rows = await db.select<Record<string, unknown>>(
                        `SELECT * FROM ${config.tableName} WHERE user_id = ? ${filter}`,
                        [currentUserId]
                    )
                    config.setStore(rows.map((row) => config.fromDb(row)))
                })
            )
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
        action: "INSERT" | "UPDATE" | "SOFT_DELETE",
        patch: Partial<BaseModel>
    ) {
        const db = await getDatabase()

        const existing = await db.select<{
            id: number
            action: string
            payload: string
        }>(
            "SELECT id, action, payload FROM sync_queue WHERE table_name = ? AND row_id = ? LIMIT 1",
            [tableName, rowId]
        )

        if (existing.length > 0) {
            const oldAction = existing[0].action
            // If it was previously INSERT, keep it as INSERT, but merge the patch.
            // If it was SOFT_DELETE, keep it.
            const finalAction = oldAction === "INSERT" ? "INSERT" : action

            const oldPayload = JSON.parse(existing[0].payload)
            const mergedPayload = { ...oldPayload, ...patch }

            await db.execute(
                `
                UPDATE sync_queue 
                SET action = ?, payload = ?, created_at = ?
                WHERE id = ?
            `,
                [
                    finalAction,
                    JSON.stringify(mergedPayload),
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
                    JSON.stringify(patch),
                    new Date().toISOString(),
                ]
            )
        }

        this.triggerSync()
    }

    static async sync() {
        if (!isSupabaseConfigured || !supabase) return
        if (this.isSyncing) {
            console.log("SyncService: sync skipped (already syncing)")
            return
        }

        console.log("SyncService: Starting full sync (pull + push)...")
        const syncStartTime = Date.now()
        this.isSyncing = true
        useAuthStore.getState().setSyncing(true)

        try {
            // Pull deltas before push to resolve conflicts locally and ensure FK consistency
            await this.internalPullDeltas()
            await this.internalSync()
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
            console.log("SyncService: Sync process complete.")
        }
    }

    private static async internalSync() {
        // Parallelize session check and DB acquisition
        const [
            {
                data: { session },
            },
            db,
        ] = await Promise.all([supabase!.auth.getSession(), getDatabase()])

        if (!session) {
            console.log("SyncService: No active session, skipping push.")
            return
        }

        const queue = await db.select<QueueItem>(
            "SELECT * FROM sync_queue ORDER BY created_at ASC"
        )

        if (queue.length === 0) {
            return
        }

        console.log(
            `SyncService: Found ${queue.length} pending actions. Starting bulk push...`
        )

        const tables = Array.from(new Set(queue.map((item) => item.table_name)))

        // Define table priority to satisfy foreign key constraints during push.
        // Tags must be synced before cards that reference them.
        const tablePriority: Record<string, number> = {
            routine_time_tracker_tags: 1,
            routine_cards: 2,
            time_tracker_cards: 2,
            routine_time_tracker_states: 3,
        }

        const sortedTables = (tables as string[]).sort((a, b) => {
            const priorityA = tablePriority[a] || 99
            const priorityB = tablePriority[b] || 99
            return priorityA - priorityB
        })

        const configMap = new Map(this.configs.map((c) => [c.tableName, c]))

        for (const table of sortedTables) {
            console.log(`SyncService: Processing push for table ${table}...`)
            const tableActions = queue.filter(
                (item) => item.table_name === table
            )

            const latestActionsMap = new Map<string, QueueItem>()
            const actionIds = tableActions.map((item) => item.id)

            for (const action of tableActions) {
                const payload = JSON.parse(action.payload) as Partial<BaseModel>
                latestActionsMap.set(payload.id as string, action)
            }

            const config = configMap.get(table)
            let hasError = false

            // Process actions in parallel for this table
            await Promise.all(
                Array.from(latestActionsMap.values()).map(async (action) => {
                    const payload = JSON.parse(
                        action.payload
                    ) as Partial<BaseModel>
                    const { _sync_status, id, ...rest } =
                        payload as Partial<BaseModel> & {
                            _sync_status?: string
                        }

                    try {
                        let error
                        let serverRecord: Record<string, unknown> | null = null

                        if (action.action === "INSERT") {
                            // For INSERT, we have the full payload, so upsert is safe.
                            const { _sync_status: _, ...upsertPayload } =
                                payload as Record<string, unknown>
                            const { data, error: err } = await supabase!
                                .from(table as TableName)
                                .upsert(
                                    upsertPayload as unknown as Record<
                                        string,
                                        unknown
                                    >,
                                    config?.upsertOnConflict
                                        ? {
                                              onConflict:
                                                  config.upsertOnConflict,
                                          }
                                        : undefined
                                )
                                .select()
                                .single()
                            error = err
                            serverRecord = data as Record<string, unknown>
                        } else {
                            // For UPDATE and SOFT_DELETE, we push the patch including updated_at.
                            // Although server triggers usually handle this, including it ensures
                            // that the record is seen as "newer" by any other processes or
                            // triggers that might be relying on LWW at the SQL level.
                            const { data, error: err } = await supabase!
                                .from(table as TableName)
                                .update(rest)
                                .eq("id", id as string)
                                .select()
                                .single()
                            error = err
                            serverRecord = data as Record<string, unknown>
                        }

                        if (error) {
                            console.error(
                                `SyncService: Sync error for ${table}:${id} (${action.action}):`,
                                error
                            )
                            hasError = true
                        } else if (serverRecord && config) {
                            const entity = config.fromDb(serverRecord)
                            console.log(
                                `SyncService: [PUSH SUCCESS] ${table}:${id} (${action.action})`
                            )
                            console.log(
                                `  Local updated_at:  ${payload.updated_at}`
                            )
                            console.log(
                                `  Server updated_at: ${entity.updated_at}`
                            )

                            // Update local DB with authoritative server state (specifically the final updated_at)
                            await db.execute(
                                config.saveSql,
                                config.toSqlValues(entity)
                            )
                            config.upsertInStore(entity)
                        }
                    } catch (err) {
                        console.error(
                            `SyncService: Sync exception for ${table}:${id}:`,
                            err
                        )
                        hasError = true
                    }
                })
            )

            if (!hasError) {
                const placeholders = actionIds.map(() => "?").join(",")
                await db.execute(
                    `DELETE FROM sync_queue WHERE id IN (${placeholders})`,
                    actionIds
                )
                console.log(
                    `SyncService: Successfully synced ${tableActions.length} records to ${table}`
                )
            } else {
                console.warn(
                    `SyncService: Some records failed to sync for ${table}. Keeping them in queue.`
                )
                break
            }
        }
    }

    /**
     * Downstream Sync: Listens for changes from other devices via Supabase Realtime.
     */
    static startRealtimeListener() {
        if (!supabase) return
        const currentUserId = useAuthStore.getState().user?.id
        if (!currentUserId) {
            console.log(
                "SyncService: No user found, skipping realtime listener."
            )
            if (this.realtimeChannel) {
                console.log(
                    "SyncService: Cleaning up realtime listener (user signed out)..."
                )
                supabase.removeChannel(this.realtimeChannel)
                this.realtimeChannel = null
            }
            return
        }

        // Clean up existing channel if any
        if (this.realtimeChannel) {
            console.log("SyncService: Restarting realtime listener...")
            supabase.removeChannel(this.realtimeChannel)
        }

        console.log(
            `SyncService: Starting realtime listener for user ${currentUserId} on ${this.configs.length} tables...`
        )

        // Create a unique channel for this user's session
        this.realtimeChannel = supabase.channel(`user-sync:${currentUserId}`)

        // We register a separate handler for each table to allow specific user_id filtering.
        // Supabase Realtime only supports 'filter' when a 'table' is specified.
        for (const config of this.configs) {
            this.realtimeChannel.on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: config.tableName,
                    filter: `user_id=eq.${currentUserId}`,
                },
                async (payload) => {
                    const {
                        table,
                        eventType,
                        new: newRecord,
                        old: oldRecord,
                    } = payload as {
                        table: string
                        eventType: string
                        new: Record<string, unknown>
                        old: Record<string, unknown>
                    }

                    const db = await getDatabase()
                    console.log(
                        `SyncService: Received ${eventType} event for ${table}`
                    )

                    if (eventType === "INSERT" || eventType === "UPDATE") {
                        const entity = config.fromDb(newRecord)

                        // 1. Conflict Check: is there a local pending change in the queue?
                        const inQueue = await db.select<{
                            id: number
                            payload: string
                        }>(
                            "SELECT id, payload FROM sync_queue WHERE table_name = ? AND row_id = ? LIMIT 1",
                            [config.tableName, entity.id]
                        )

                        let finalEntity = entity

                        if (inQueue.length > 0) {
                            const pendingPatch = JSON.parse(
                                inQueue[0].payload
                            ) as Partial<BaseModel>

                            // Server Reconciliation: Apply local patch on top of authoritative cloud state
                            const cloudUpdatedAt = entity.updated_at
                            const localUpdatedAt =
                                pendingPatch.updated_at || entity.updated_at

                            finalEntity = {
                                ...entity,
                                ...pendingPatch,
                                updated_at:
                                    cloudUpdatedAt > localUpdatedAt
                                        ? cloudUpdatedAt
                                        : localUpdatedAt,
                            } as typeof entity
                            console.log(
                                `SyncService: [REALTIME RECONCILE] ${table}:${entity.id}`
                            )
                        } else {
                            // 2. Freshness Check: is the record in DB already the same or newer?
                            const localRows = await db.select<{
                                updated_at: string
                            }>(
                                `SELECT updated_at FROM ${config.tableName} WHERE id = ?`,
                                [entity.id]
                            )
                            if (
                                localRows.length > 0 &&
                                localRows[0].updated_at >= entity.updated_at
                            ) {
                                return
                            }
                            console.log(
                                `SyncService: [REALTIME APPLY] ${table}:${entity.id}`
                            )
                        }

                        // 3. Apply Update
                        await db.execute(
                            config.saveSql,
                            config.toSqlValues(finalEntity)
                        )
                        config.upsertInStore(finalEntity)
                        console.log(
                            `SyncService: Applied realtime ${eventType} for ${table}:${entity.id}`
                        )
                    } else if (eventType === "DELETE") {
                        const id = oldRecord.id as string
                        await db.execute(
                            `DELETE FROM ${config.tableName} WHERE id = ?`,
                            [id]
                        )
                        config.removeFromStore(id)
                        console.log(
                            `SyncService: Applied realtime DELETE for ${table}:${id}`
                        )
                    }
                }
            )
        }

        this.realtimeChannel.subscribe((status) => {
            console.log(`SyncService: Realtime subscription status: ${status}`)
            if (status === "CHANNEL_ERROR") {
                console.error(
                    "SyncService: Realtime subscription failed. Check if Realtime is enabled for your tables in the Supabase Dashboard."
                )
            }
        })
    }
}
