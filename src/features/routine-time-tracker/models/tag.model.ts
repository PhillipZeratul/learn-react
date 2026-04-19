import { v4 as uuidv4 } from 'uuid';
import type { TagId, ModelConfig } from './routine-time-tracker.model';
import type { UserId, BaseEntity, IsoDateTime } from '@/models/base.model';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { useTagStore } from '../stores/tag.store';

export const DEFAULT_TAG_ID = 'b0ec7c88-ddd7-40ad-8fdd-478f02ac1941' as TagId;

export interface Tag extends BaseEntity {
    id: TagId;
    name: string;
    color: string;
}

export const createTag = (data: Partial<Tag> = {}): Tag => {
    const now = new Date().toISOString() as IsoDateTime;
    const currentUserId = useAuthStore.getState().user?.id as UserId;

    return {
        id: data.id || uuidv4() as TagId,
        name: data.name || "Default",
        color: data.color || "#787878",
        user_id: data.user_id || currentUserId,
        created_at: data.created_at || now,
        updated_at: data.updated_at || now,
        is_deleted: data.is_deleted || false,
    };
};

export const tagConfig: ModelConfig<Tag> = {
    tableName: 'routine_time_tracker_tags',
    createTableSql: `
        CREATE TABLE IF NOT EXISTS routine_time_tracker_tags (
            id TEXT PRIMARY KEY,
            name TEXT,
            color TEXT,
            user_id TEXT,
            created_at TEXT,
            updated_at TEXT,
            is_deleted INTEGER DEFAULT 0
        )
    `,
    saveSql: `
        INSERT OR REPLACE INTO routine_time_tracker_tags 
        (id, name, color, user_id, created_at, updated_at, is_deleted)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    toSqlValues: (tag) => [
        tag.id, tag.name, tag.color, tag.user_id, tag.created_at, tag.updated_at, tag.is_deleted ? 1 : 0
    ],
    fromDb: (row) => createTag({ ...row, is_deleted: !!row.is_deleted }),
    updateStore: (items) => useTagStore.getState().set(items),
    findInStore: (id) => useTagStore.getState().items.find(t => t.id === id),
    addToStore: (item) => useTagStore.getState().add(item),
    updateInStore: (id, item) => useTagStore.getState().update(id, item),
    deleteFromStore: (id) => useTagStore.getState().remove(id),
};
