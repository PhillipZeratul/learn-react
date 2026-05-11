import { v4 as uuidv4 } from "uuid"
import type { RoutineCardId, TagId } from "./routine-time-tracker.model"
import { DEFAULT_TAG_ID } from "./tag.model"
import type {
  UserId,
  BaseModel,
  IsoDateTime,
  ModelConfig,
} from "@/shared/models/base.model"
import { useRoutineCardStore } from "../stores/routine-card.store"
import { useAuthStore } from "@/features/auth/stores/auth.store"

export interface RoutineCard extends BaseModel {
  id: RoutineCardId
  title: string
  description?: string
  start_at: IsoDateTime
  end_at: IsoDateTime
  tag_id: TagId
  rrule?: string
  parent_routine_id?: RoutineCardId
  original_recurrence_date?: IsoDateTime
  _isVirtual?: boolean
}

export const createRoutineCard = (
  data: Partial<RoutineCard> = {}
): RoutineCard => {
  const now = new Date().toISOString() as IsoDateTime
  const currentUserId = useAuthStore.getState().user?.id as UserId

  return {
    id: data.id || (uuidv4() as RoutineCardId),
    title: data.title ?? "",
    description: data.description || "",
    start_at: data.start_at || now,
    end_at: data.end_at || now,
    tag_id: data.tag_id || DEFAULT_TAG_ID,
    user_id: data.user_id || currentUserId,
    created_at: data.created_at || now,
    updated_at: data.updated_at || now,
    is_deleted: data.is_deleted || false,
    rrule: data.rrule,
    parent_routine_id: data.parent_routine_id,
    original_recurrence_date: data.original_recurrence_date,
  }
}

export const routineCardConfig: ModelConfig<RoutineCard> = {
  tableName: "routine_cards",
  createTableSql: `
        CREATE TABLE IF NOT EXISTS routine_cards (
            id TEXT PRIMARY KEY,
            title TEXT,
            description TEXT,
            start_at TEXT,
            end_at TEXT,
            tag_id TEXT,
            user_id TEXT,
            created_at TEXT,
            updated_at TEXT,
            is_deleted INTEGER DEFAULT 0,
            rrule TEXT,
            parent_routine_id TEXT,
            original_recurrence_date TEXT
        )
    `,
  saveSql: `
        INSERT OR REPLACE INTO routine_cards 
        (id, title, description, start_at, end_at, tag_id, user_id, created_at, updated_at, is_deleted, rrule, parent_routine_id, original_recurrence_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  toSqlValues: (card) => [
    card.id,
    card.title,
    card.description,
    card.start_at,
    card.end_at,
    card.tag_id,
    card.user_id,
    card.created_at,
    card.updated_at,
    card.is_deleted ? 1 : 0,
    card.rrule,
    card.parent_routine_id,
    card.original_recurrence_date,
  ],
  fromDb: (row) => createRoutineCard({ ...row, is_deleted: !!row.is_deleted }),
  updateStore: (items) => useRoutineCardStore.getState().set(items),
  findInStore: (id) =>
    useRoutineCardStore.getState().items.find((c) => c.id === id),
  addToStore: (item) => useRoutineCardStore.getState().add(item),
  updateInStore: (id, item) => useRoutineCardStore.getState().update(id, item),
  deleteFromStore: (id) => useRoutineCardStore.getState().remove(id),
  loadFilter: "AND (is_deleted = 0 OR parent_routine_id IS NOT NULL)",
  purgeFilter: "AND parent_routine_id IS NULL",
}
