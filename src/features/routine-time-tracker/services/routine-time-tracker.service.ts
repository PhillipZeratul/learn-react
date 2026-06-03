import { SyncService } from "@/shared/services/sync.service"
import { routineCardConfig } from "../models/routine-card.model"
import { timeTrackerCardConfig } from "../models/time-tracker-card.model"
import { tagConfig } from "../models/tag.model"
import { useTagStore } from "../stores/tag.store"
import { useTimeTrackerCardStore } from "../stores/time-tracker-card.store"
import { useAuthStore } from "@/features/auth/stores/auth.store"
import { getNowISO } from "../utils/utils"
import type { TimeTrackerCardId } from "../models/routine-time-tracker.model"
import type { IsoDateTime } from "@/shared/models/base.model"

export class RoutineTimeTrackerService {
    static registerConfig() {
        SyncService.registerConfig(tagConfig)
        SyncService.registerConfig(routineCardConfig)
        SyncService.registerConfig(timeTrackerCardConfig)
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

    static async toggleTracker(id: TimeTrackerCardId, timestamp?: IsoDateTime) {
        const now = timestamp || getNowISO()

        const card = useTimeTrackerCardStore
            .getState()
            .items.find((c) => c.id === id)

        if (!card) return

        if (card.end_at === null) {
            // Stop tracking
            const updatedCard = {
                ...card,
                end_at: now,
                updated_at: now,
            }
            useTimeTrackerCardStore.getState().upsert(updatedCard)
            await SyncService.save(timeTrackerCardConfig, updatedCard)
        } else {
            // Start tracking
            const updatedCard = {
                ...card,
                end_at: null,
                updated_at: now,
            }
            useTimeTrackerCardStore.getState().upsert(updatedCard)
            await SyncService.save(timeTrackerCardConfig, updatedCard)
        }
    }
}
