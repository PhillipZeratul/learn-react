import { v4 as uuidv4 } from "uuid"
import type { TimeTrackerCardId, TagId } from "./routine-time-tracker.model"
import type {
    UserId,
    BaseModel,
    IsoDateTime,
    ModelConfig,
} from "@/shared/models/base.model"
import { DEFAULT_TAG_ID } from "./tag.model"
import { useAuthStore } from "@/features/auth/stores/auth.store"
import { useTimeTrackerCardStore } from "../stores/time-tracker-card.store"
import { getMinuteNow } from "../utils/utils"

export interface TimeTrackerCard extends BaseModel {
    id: TimeTrackerCardId
    title: string
    description?: string
    start_at: IsoDateTime
    end_at: IsoDateTime | null
    tag_id: TagId
}

export const createTimeTrackerCard = (
    data: Partial<TimeTrackerCard> = {}
): TimeTrackerCard => {
    const nowFull = new Date().toISOString() as IsoDateTime
    const nowMin = getMinuteNow()
    const currentUserId = useAuthStore.getState().user?.id as UserId

    return {
        id: data.id || (uuidv4() as TimeTrackerCardId),
        title: data.title ?? "",
        description: data.description === undefined ? "" : data.description,
        start_at: data.start_at || nowMin,
        end_at: data.end_at !== undefined ? data.end_at : null,
        tag_id: data.tag_id || DEFAULT_TAG_ID,
        user_id: data.user_id || currentUserId,
        created_at: data.created_at || nowFull,
        updated_at: data.updated_at || nowFull,
        is_deleted: data.is_deleted || false,
    }
}

export const timeTrackerCardConfig: ModelConfig<TimeTrackerCard> = {
    tableName: "time_tracker_cards",
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
        card.id,
        card.title,
        card.description ?? null,
        card.start_at,
        card.end_at,
        card.tag_id,
        card.user_id,
        card.created_at,
        card.updated_at,
        card.is_deleted ? 1 : 0,
    ],
    fromDb: (row) =>
        createTimeTrackerCard({
            ...(row as unknown as Partial<TimeTrackerCard>),
            is_deleted: !!row.is_deleted,
        }),
    setStore: (items) => useTimeTrackerCardStore.getState().set(items),
    upsertInStore: (item) => useTimeTrackerCardStore.getState().upsert(item),
    removeFromStore: (id) => useTimeTrackerCardStore.getState().remove(id),
}
