import { v4 as uuidv4 } from 'uuid';
import type { TagId, ModelConfig } from './routine-time-tracker.model';
import type { UserId, BaseEntity, IsoDateTime } from '@/models/base.model';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { useRoutineTimeTrackerStore } from '../stores/routine-time-tracker.store';

export const DEFAULT_TAG_ID = 'b0ec7c88-ddd7-40ad-8fdd-478f02ac1941' as TagId;

export interface RoutineTimeTrackerTag extends BaseEntity {
    id: TagId;
    name: string;
    color: string;
}

export const createRoutineTimeTrackerTag = (data: Partial<RoutineTimeTrackerTag> = {}): RoutineTimeTrackerTag => {
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

export const routineTimeTrackerTagConfig: ModelConfig<RoutineTimeTrackerTag> = {
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
    fromDb: (row) => createRoutineTimeTrackerTag({ ...row, is_deleted: !!row.is_deleted }),
    updateStore: (items) => useRoutineTimeTrackerStore.getState().setTags(items),
    findInStore: (id) => useRoutineTimeTrackerStore.getState().tags.find(t => t.id === id),
    addToStore: (item) => useRoutineTimeTrackerStore.getState().addTag(item),
    updateInStore: (id, item) => useRoutineTimeTrackerStore.getState().updateTag(id, item),
    deleteFromStore: (id) => useRoutineTimeTrackerStore.getState().deleteTag(id),
};
