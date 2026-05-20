import { v4 as uuidv4 } from "uuid"
import type { TagId } from "./routine-time-tracker.model"
import type {
    UserId,
    BaseModel,
    IsoDateTime,
    ModelConfig,
} from "@/shared/models/base.model"
import { useAuthStore } from "@/features/auth/stores/auth.store"
import { useTagStore } from "../stores/tag.store"
import { findNearestPresetAndShade } from "../utils/utils"

export const DEFAULT_TAG_ID = "b0ec7c88-ddd7-40ad-8fdd-478f02ac1941" as TagId

export interface Tag extends BaseModel {
    id: TagId
    name: string
    color: string
    parent_id?: TagId
    sort_order: number
}

export const createTag = (data: Partial<Tag> = {}): Tag => {
    const now = new Date().toISOString() as IsoDateTime
    const currentUserId = useAuthStore.getState().user?.id as UserId

    let tagColor = data.color || "17-5"
    if (tagColor.startsWith("#")) {
        tagColor = findNearestPresetAndShade(tagColor)
    }

    return {
        id: data.id || (uuidv4() as TagId),
        name: data.name || "Default",
        color: tagColor,
        parent_id: data.parent_id || undefined,
        sort_order: data.sort_order ?? 0,
        user_id: data.user_id || currentUserId,
        created_at: data.created_at || now,
        updated_at: data.updated_at || now,
        is_deleted: data.is_deleted || false,
    }
}

export const tagConfig: ModelConfig<Tag> = {
    tableName: "routine_time_tracker_tags",
    createTableSql: `
        CREATE TABLE IF NOT EXISTS routine_time_tracker_tags (
            id TEXT PRIMARY KEY,
            name TEXT,
            color TEXT,
            parent_id TEXT,
            sort_order REAL DEFAULT 0,
            user_id TEXT,
            created_at TEXT,
            updated_at TEXT,
            is_deleted INTEGER DEFAULT 0
        )
    `,
    saveSql: `
        INSERT OR REPLACE INTO routine_time_tracker_tags 
        (id, name, color, parent_id, sort_order, user_id, created_at, updated_at, is_deleted)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    toSqlValues: (tag) => [
        tag.id,
        tag.name,
        tag.color,
        tag.parent_id || null,
        tag.sort_order,
        tag.user_id,
        tag.created_at,
        tag.updated_at,
        tag.is_deleted ? 1 : 0,
    ],
    fromDb: (row) =>
        createTag({
            ...(row as unknown as Partial<Tag>),
            is_deleted: !!row.is_deleted,
        }),
    setStore: (items) => useTagStore.getState().set(items),
    upsertInStore: (item) => useTagStore.getState().upsert(item),
    removeFromStore: (id) => useTagStore.getState().remove(id),
}
