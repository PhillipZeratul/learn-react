import type { Tagged } from "type-fest"

// ==========================================
// Id Definitions
// ==========================================
export type UserId = Tagged<string, "UserId">
export type QuestId = Tagged<string, "QuestId">

// ==========================================
// Type Definitions
// ==========================================
export type Experience = Tagged<number, "Experience">
export type HealthPoint = Tagged<number, "HealthPoint">
export type Coin = Tagged<number, "Coin">

export type IsoDateTime = Tagged<string, "ISODateTime">

// ==========================================
// Base Model
// ==========================================
/**
 * All tables requiring synchronization with Supabase must inherit from this interface.
 */
export interface BaseModel {
    id: string // UUID for this record
    user_id: UserId // Resource owner ID
    created_at: IsoDateTime // ISO 8601 timestamp
    updated_at: IsoDateTime // Used for LWW (Last Write Wins) conflict resolution
    is_deleted: boolean // Absolute rule: never physically delete; use soft delete for everything.

    // Local-First specific sync fields (only exists on SQLite client, not synced to cloud)
    _sync_status?:
        | "synced"
        | "pending_insert"
        | "pending_update"
        | "pending_delete"
}

// ==========================================
// Offline Action Queue Payload
// ==========================================
/**
 * Used to record user operations in offline state, replayed in order when network connectivity is restored.
 */
export type SyncActionType = "INSERT" | "UPDATE" | "SOFT_DELETE"

export interface SyncAction<T = unknown> {
    action_id: string // UUID, the ID of the action itself
    entity_type: "Task" | "Quest" | "UserProfile"
    action_type: SyncActionType
    entity_id: string // Generalized ID, could be TaskId or QuestId
    payload: Partial<T> // Incrementally updated data
    timestamp: string // The exact time the action occurred
}

export interface ModelConfig<T extends BaseModel> {
    tableName: string
    createTableSql: string
    saveSql: string
    toSqlValues: (model: T) => (string | number | boolean | null)[]
    fromDb: (row: Record<string, unknown>) => T

    // Streamlined store management
    setStore: (items: T[]) => void
    upsertInStore: (item: T) => void
    removeFromStore: (id: string) => void

    /**
   * Optional SQL filter for loadAll.

   * If provided, it will be used in the WHERE clause after 'user_id = ?'.
   * Example: 'AND (is_deleted = 0 OR parent_routine_id IS NOT NULL)'
   */
    loadFilter?: string
    /**
     * Optional SQL filter for purgeOldDeletedRecords.
     * This filter is used to EXCLUDE records from being physically deleted from local DB.
     * Example: 'AND parent_routine_id IS NULL' (meaning: only purge if NOT a routine exception)
     */
    purgeFilter?: string
    /**
     * Optional column name for Supabase upsert onConflict.
     * Defaults to the primary key ('id') if not provided.
     */
    upsertOnConflict?: string
}
