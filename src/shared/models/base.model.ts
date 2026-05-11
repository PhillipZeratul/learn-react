export type Brand<K, T> = K & { readonly __brand: T }

// ==========================================
// Id Definitions
// ==========================================
export type UserId = Brand<string, "UserId">
export type QuestId = Brand<string, "QuestId">

// ==========================================
// Type Definitions
// ==========================================
export type Experience = Brand<number, "Experience">
export type HealthPoint = Brand<number, "HealthPoint">
export type Coin = Brand<number, "Coin">

export type IsoDateTime = Brand<string, "ISODateTime">

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

export interface SyncAction<T = any> {
  action_id: string // UUID, the ID of the action itself
  entity_type: "Task" | "Quest" | "UserProfile"
  action_type: SyncActionType
  entity_id: string // Generalized ID, could be TaskId or QuestId
  payload: Partial<T> // Incrementally updated data
  timestamp: string // The exact time the action occurred
}

export interface ModelConfig<T extends BaseModel> {
  tableName: string;
  createTableSql: string;
  saveSql: string;
  toSqlValues: (model: T) => any[];
  fromDb: (row: any) => T;

  // Streamlined store management
  setStore: (items: T[]) => void;
  upsertInStore: (item: T) => void;
  removeFromStore: (id: string) => void;

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
