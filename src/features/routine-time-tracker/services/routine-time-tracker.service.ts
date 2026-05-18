import { SyncService } from "@/shared/services/sync.service"
import { getDatabase } from "@/lib/db/sqlite"
import { routineCardConfig } from "../models/routine-card.model"
import { timeTrackerCardConfig } from "../models/time-tracker-card.model"
import { tagConfig } from "../models/tag.model"
import {
    routineTimeTrackerStateConfig,
    createRoutineTimeTrackerState,
} from "../models/routine-time-tracker-state.model"
import { useTagStore } from "../stores/tag.store"
import { useRoutineTimeTrackerStateStore } from "../stores/routine-time-tracker-state.store"
import { useTimeTrackerCardStore } from "../stores/time-tracker-card.store"
import { useAuthStore } from "@/features/auth/stores/auth.store"
import { getNowISO } from "../utils/utils"
import type { TimeTrackerCardId } from "../models/routine-time-tracker.model"
import type { IsoDateTime, UserId } from "@/shared/models/base.model"

export class RoutineTimeTrackerService {
    static registerConfig() {
        SyncService.registerConfig(tagConfig)
        SyncService.registerConfig(routineCardConfig)
        SyncService.registerConfig(timeTrackerCardConfig)
        SyncService.registerConfig(routineTimeTrackerStateConfig)
    }

    static async initialize() {
        try {
            const currentUser = useAuthStore.getState().user
            if (currentUser) {
                await useTagStore
                    .getState()
                    .ensureDefault((tag) => SyncService.save(tagConfig, tag))
                // We don't call ensureStateRecord here anymore to avoid race conditions
                // with SyncService hydration. The record will be hydrated from cloud
                // or created on the first active tracker change.
            }
        } catch (error) {
            console.error(
                "RoutineTimeTrackerService: Initialization failed:",
                error
            )
        }
    }

    private static async ensureStateRecord() {
        const currentUser = useAuthStore.getState().user
        if (!currentUser) return

        let state = useRoutineTimeTrackerStateStore.getState().state

        if (!state) {
            // Check local DB before creating a new one, as store hydration might be async or delayed
            const db = await getDatabase()
            const rows = await db.select<Record<string, unknown>>(
                "SELECT * FROM routine_time_tracker_states WHERE user_id = ?",
                [currentUser.id]
            )

            if (rows.length > 0) {
                state = routineTimeTrackerStateConfig.fromDb(rows[0])
                useRoutineTimeTrackerStateStore.getState().set(state)
            } else {
                state = createRoutineTimeTrackerState()
                useRoutineTimeTrackerStateStore.getState().set(state)
                await SyncService.save(routineTimeTrackerStateConfig, state)
                return
            }
        }

        if (state && (!state.user_id || state.id !== currentUser.id)) {
            // Migration logic for older versions where id wasn't user_id
            const oldId = state.id
            const updatedState = {
                ...state,
                id: currentUser.id,
                user_id: currentUser.id as UserId,
                updated_at: new Date().toISOString() as IsoDateTime,
            }

            useRoutineTimeTrackerStateStore.getState().set(updatedState)
            await SyncService.save(routineTimeTrackerStateConfig, updatedState)

            if (oldId !== updatedState.id) {
                const db = await getDatabase()
                await db.execute(
                    "DELETE FROM routine_time_tracker_states WHERE id = ?",
                    [oldId]
                )
            }
        }
    }

    static async toggleTracker(id: TimeTrackerCardId) {
        await this.ensureStateRecord()
        const nowFull = new Date().toISOString() as IsoDateTime
        const nowIso = getNowISO()

        const card = useTimeTrackerCardStore
            .getState()
            .items.find((c) => c.id === id)

        if (!card) return

        if (card.end_at === null) {
            // Stop tracking
            const updatedCard = {
                ...card,
                end_at: nowIso,
                updated_at: nowFull,
            }
            useTimeTrackerCardStore.getState().upsert(updatedCard)
            await SyncService.save(timeTrackerCardConfig, updatedCard)
        } else {
            // Start tracking
            const updatedCard = {
                ...card,
                end_at: null,
                updated_at: nowFull,
            }
            useTimeTrackerCardStore.getState().upsert(updatedCard)
            await SyncService.save(timeTrackerCardConfig, updatedCard)
        }
    }
}
