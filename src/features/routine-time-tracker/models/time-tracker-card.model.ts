import { v4 as uuidv4 } from 'uuid';
import type { TimeTrackerCardId, TagId, ModelConfig } from './routine-time-tracker.model';
import type { UserId, BaseEntity, IsoDateTime} from '@/models/base.model'
import {TEST_TAG_ID} from "@/test/test-consts";
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { useRoutineTimeTrackerStore } from '../stores/routine-time-tracker.store';

export interface TimeTrackerCard extends BaseEntity {
    id: TimeTrackerCardId;
    title: string;
    description?: string;
    start_at: IsoDateTime;
    end_at: IsoDateTime;
    tag_id: TagId;
}

export const createTimeTrackerCard = (data: Partial<TimeTrackerCard> = {}): TimeTrackerCard => {
    const now = new Date().toISOString() as IsoDateTime;
    const currentUserId = useAuthStore.getState().user?.id as UserId;

    return {
        id: data.id || uuidv4() as TimeTrackerCardId,
        title: data.title || "New TimeTracker Card",
        description: data.description || "New TimeTracker Card Description.",
        start_at: data.start_at || now,
        end_at: data.end_at || now,
        tag_id: data.tag_id || TEST_TAG_ID,
        user_id: data.user_id || currentUserId,
        created_at: data.created_at || now,
        updated_at: data.updated_at || now,
        is_deleted: data.is_deleted || false,
    };
};

export const timeTrackerCardConfig: ModelConfig<TimeTrackerCard> = {
    tableName: 'time_tracker_cards',
    createTableSql: `
        CREATE TABLE IF NOT EXISTS time_tracker_cards (
            id TEXT PRIMARY KEY,
            title TEXT,
            description TEXT,
            start_at TEXT,
            end_at TEXT,
            tag_id TEXT,
            user_id TEXT,
            created_at TEXT,
            updated_at TEXT,
            is_deleted INTEGER DEFAULT 0
        )
    `,
    saveSql: `
        INSERT OR REPLACE INTO time_tracker_cards 
        (id, title, description, start_at, end_at, tag_id, user_id, created_at, updated_at, is_deleted)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    toSqlValues: (card) => [
        card.id, card.title, card.description, card.start_at, card.end_at, 
        card.tag_id, card.user_id, card.created_at, card.updated_at, card.is_deleted ? 1 : 0
    ],
    fromDb: (row) => createTimeTrackerCard({ ...row, is_deleted: !!row.is_deleted }),
    updateStore: (items) => useRoutineTimeTrackerStore.getState().setTimeTrackerCards(items),
    findInStore: (id) => useRoutineTimeTrackerStore.getState().timeTrackerCards.find(c => c.id === id),
    addToStore: (item) => useRoutineTimeTrackerStore.getState().addTimeTrackerCard(item),
    updateInStore: (id, item) => useRoutineTimeTrackerStore.getState().updateTimeTrackerCard(id, item),
    deleteFromStore: (id) => useRoutineTimeTrackerStore.getState().deleteTimeTrackerCard(id),
};
