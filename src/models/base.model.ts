export type Brand<K, T> = K & { readonly __brand: T };

// ==========================================
// Id Definitions
// ==========================================
export type UserId = Brand<string, 'UserId'>;
export type QuestId = Brand<string, 'QuestId'>;

// ==========================================
// Type Definitions
// ==========================================
export type Experience = Brand<number, 'Experience'>;
export type HealthPoint = Brand<number, 'HealthPoint'>;
export type Coin = Brand<number, 'Coin'>;

export type IsoDateTime = Brand<string, 'ISODateTime'>;

// ==========================================
// BaseEntity
// ==========================================
/**
 * All tables requiring synchronization with Supabase must inherit from this interface.
 */
export interface BaseEntity {
    id: string;                    // UUID for this record
    user_id: UserId;               // Resource owner ID
    created_at: IsoDateTime;       // ISO 8601 timestamp
    updated_at: IsoDateTime;       // Used for LWW (Last Write Wins) conflict resolution
    is_deleted: boolean;           // Absolute rule: never physically delete; use soft delete for everything.

    // Local-First specific sync fields (only exists on SQLite client, not synced to cloud)
    _sync_status?: 'synced' | 'pending_insert' | 'pending_update' | 'pending_delete';
}

// ==========================================
// Business Models
// ==========================================

export interface UserProfile extends BaseEntity {
    id: UserId;
    username: string;
    level: number;
    current_exp: Experience;
    current_hp: HealthPoint;
    gold_coins: Coin;
}

export interface Quest extends BaseEntity {
    id: QuestId;
    title: string;
    difficulty: 'EASY' | 'NORMAL' | 'HARD' | 'BOSS';
    reward_exp: Experience;   // Strongly typed: reward experience points
    reward_coins: Coin;       // Strongly typed: reward gold coins
    is_completed: boolean;
}

// ==========================================
// Offline Action Queue Payload
// ==========================================
/**
 * Used to record user operations in offline state, replayed in order when network connectivity is restored.
 */
export type SyncActionType = 'INSERT' | 'UPDATE' | 'SOFT_DELETE';

export interface SyncAction<T = any> {
    action_id: string;        // UUID, the ID of the action itself
    entity_type: 'Task' | 'Quest' | 'UserProfile';
    action_type: SyncActionType;
    entity_id: string;        // Generalized ID, could be TaskId or QuestId
    payload: Partial<T>;      // Incrementally updated data
    timestamp: string;        // The exact time the action occurred
}
