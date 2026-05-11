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
import { useAuthStore } from "@/features/auth/stores/auth.store"
import type { TimeTrackerCardId } from "../models/routine-time-tracker.model"

export class RoutineTimeTrackerService {
  static registerConfig() {
    SyncService.registerConfig(routineCardConfig)
    SyncService.registerConfig(timeTrackerCardConfig)
    SyncService.registerConfig(tagConfig)
    SyncService.registerConfig(routineTimeTrackerStateConfig)
  }

  static async initialize() {
    try {
      const currentUser = useAuthStore.getState().user
      if (currentUser) {
        await useTagStore
          .getState()
          .ensureDefault((tag) => SyncService.save(tagConfig, tag))
        await this.ensureStateRecord()
      }
    } catch (error) {
      console.error("RoutineTimeTrackerService: Initialization failed:", error)
    }
  }

  private static async ensureStateRecord() {
    const currentUser = useAuthStore.getState().user
    if (!currentUser) return

    let state = useRoutineTimeTrackerStateStore.getState().state

    if (!state) {
      const newState = createRoutineTimeTrackerState()
      useRoutineTimeTrackerStateStore.getState().set(newState)
      await SyncService.save(routineTimeTrackerStateConfig, newState)
    } else if (!state.user_id || state.id !== currentUser.id) {
      // If we have a local state but it's anonymous or has a legacy random ID,
      // migrate it to the fixed ID (user_id) to ensure correct sync behavior.
      const oldId = state.id
      const updatedState = {
        ...state,
        id: currentUser.id,
        user_id: currentUser.id as any,
        updated_at: new Date().toISOString() as any,
      }

      useRoutineTimeTrackerStateStore.getState().set(updatedState)
      await SyncService.save(routineTimeTrackerStateConfig, updatedState)

      // Clean up the old record if the ID changed
      if (oldId !== updatedState.id) {
        const db = await getDatabase()
        await db.execute(
          "DELETE FROM routine_time_tracker_states WHERE id = ?",
          [oldId]
        )
      }
    }
  }

  static async setActiveTrackerId(id: TimeTrackerCardId | null) {
    let state = useRoutineTimeTrackerStateStore.getState().state
    if (!state) {
      state = createRoutineTimeTrackerState({ active_time_tracker_id: id })
    } else {
      state = {
        ...state,
        active_time_tracker_id: id,
        updated_at: new Date().toISOString() as any,
      }
    }

    useRoutineTimeTrackerStateStore.getState().set(state)
    await SyncService.save(routineTimeTrackerStateConfig, state)
  }
}
