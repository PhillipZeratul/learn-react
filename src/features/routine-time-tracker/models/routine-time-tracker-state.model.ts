import { v4 as uuidv4 } from 'uuid';
import type { TimeTrackerCardId } from './routine-time-tracker.model';
import type { UserId, BaseModel, IsoDateTime, ModelConfig } from '@/shared/models/base.model';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { useRoutineTimeTrackerStateStore } from '../stores/routine-time-tracker-state.store';

export interface RoutineTimeTrackerState extends BaseModel {
    active_time_tracker_id: TimeTrackerCardId | null;
}

export const createRoutineTimeTrackerState = (data: Partial<RoutineTimeTrackerState> = {}): RoutineTimeTrackerState => {
    const now = new Date().toISOString() as IsoDateTime;
    const currentUserId = useAuthStore.getState().user?.id as UserId;

    return {
        id: data.id || uuidv4(),
        user_id: data.user_id || currentUserId,
        active_time_tracker_id: data.active_time_tracker_id || null,
        created_at: data.created_at || now,
        updated_at: data.updated_at || now,
        is_deleted: data.is_deleted || false,
    };
};

export const routineTimeTrackerStateConfig: ModelConfig<RoutineTimeTrackerState> = {
    tableName: 'routine_time_tracker_states',
    createTableSql: `
        CREATE TABLE IF NOT EXISTS routine_time_tracker_states (
            id TEXT PRIMARY KEY,
            user_id TEXT UNIQUE,
            active_time_tracker_id TEXT,
            created_at TEXT,
            updated_at TEXT,
            is_deleted INTEGER DEFAULT 0
        )
    `,
    saveSql: `
        INSERT OR REPLACE INTO routine_time_tracker_states 
        (id, user_id, active_time_tracker_id, created_at, updated_at, is_deleted)
        VALUES (?, ?, ?, ?, ?, ?)
    `,
    toSqlValues: (state) => [
        state.id, state.user_id, state.active_time_tracker_id, 
        state.created_at, state.updated_at, state.is_deleted ? 1 : 0
    ],
    fromDb: (row) => createRoutineTimeTrackerState({ ...row, is_deleted: !!row.is_deleted }),
    updateStore: (items) => {
        if (items.length > 0) {
            useRoutineTimeTrackerStateStore.getState().set(items[0]);
        }
    },
    findInStore: (id) => {
        const state = useRoutineTimeTrackerStateStore.getState().state;
        return state?.id === id ? state : undefined;
    },
    addToStore: (item) => useRoutineTimeTrackerStateStore.getState().set(item),
    updateInStore: (_, item) => useRoutineTimeTrackerStateStore.getState().set(item),
    deleteFromStore: (_) => useRoutineTimeTrackerStateStore.getState().set(null),
};
