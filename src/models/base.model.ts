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
 * 所有需要与 Supabase 同步的表必须继承此接口
 */
export interface BaseEntity {
    id: string;                    // UUID for this record
    user_id: UserId;               // 资源所有者 ID
    created_at: IsoDateTime;       // ISO 8601 时间戳
    updated_at: IsoDateTime;       // 用于 LWW (Last Write Wins) 冲突解决
    is_deleted: boolean;           // 铁律：绝不物理删除，全部使用软删除

    // Local-First 专属同步字段 (仅在 SQLite 客户端存在，不同步到云端)
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
    reward_exp: Experience;   // 强类型：奖励的经验值
    reward_coins: Coin;       // 强类型：奖励的金币
    is_completed: boolean;
}

// ==========================================
// Offline Action Queue Payload
// ==========================================
/**
 * 用于记录用户在离线状态下的操作，网络恢复时按序回放
 */
export type SyncActionType = 'INSERT' | 'UPDATE' | 'SOFT_DELETE';

export interface SyncAction<T = any> {
    action_id: string;        // UUID，动作本身的 ID
    entity_type: 'Task' | 'Quest' | 'UserProfile';
    action_type: SyncActionType;
    entity_id: string;        // 泛化 ID，因为可能是 TaskId 也可能是 QuestId
    payload: Partial<T>;      // 增量更新的数据
    timestamp: string;        // 动作发生的准确时间
}