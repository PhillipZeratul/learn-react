import { SyncService } from '@/shared/services/sync.service'
import { routineCardConfig } from '../models/routine-card.model'
import { timeTrackerCardConfig } from '../models/time-tracker-card.model'
import { tagConfig } from '../models/tag.model'
import { routineTimeTrackerStateConfig, createRoutineTimeTrackerState } from '../models/routine-time-tracker-state.model'
import { useTagStore } from '../stores/tag.store'
import { useRoutineTimeTrackerStateStore } from '../stores/routine-time-tracker-state.store'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import type { TimeTrackerCardId } from '../models/routine-time-tracker.model'

export class RoutineTimeTrackerService {
    static registerConfig() {
        SyncService.registerConfig(routineCardConfig);
        SyncService.registerConfig(timeTrackerCardConfig);
        SyncService.registerConfig(tagConfig);
        SyncService.registerConfig(routineTimeTrackerStateConfig);
    }

    static async initialize() {
        try {
            const currentUser = useAuthStore.getState().user;
            if (currentUser) {
                await useTagStore.getState().ensureDefault(
                    (tag) => SyncService.save(tagConfig, tag)
                );
                await this.ensureStateRecord();
            }
        } catch (error) {
            console.error("RoutineTimeTrackerService: Initialization failed:", error);
        }
    }

    private static async ensureStateRecord() {
        const state = useRoutineTimeTrackerStateStore.getState().state;
        if (!state) {
            const newState = createRoutineTimeTrackerState();
            useRoutineTimeTrackerStateStore.getState().set(newState);
            await SyncService.save(routineTimeTrackerStateConfig, newState);
        }
    }

    static async setActiveTrackerId(id: TimeTrackerCardId | null) {
        let state = useRoutineTimeTrackerStateStore.getState().state;
        if (!state) {
            state = createRoutineTimeTrackerState({ active_time_tracker_id: id });
        } else {
            state = {
                ...state,
                active_time_tracker_id: id,
                updated_at: new Date().toISOString() as any
            }
        }
        
        useRoutineTimeTrackerStateStore.getState().set(state);
        await SyncService.save(routineTimeTrackerStateConfig, state);
    }
}
