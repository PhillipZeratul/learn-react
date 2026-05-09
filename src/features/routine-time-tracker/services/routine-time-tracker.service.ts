import { SyncService } from '@/shared/services/sync.service'
import { routineCardConfig } from '../models/routine-card.model'
import { timeTrackerCardConfig } from '../models/time-tracker-card.model'
import { tagConfig } from '../models/tag.model'
import { useTagStore } from '../stores/tag.store'
import { useAuthStore } from '@/features/auth/stores/auth.store'

export class RoutineTimeTrackerService {
    static registerConfig() {
        SyncService.registerConfig(routineCardConfig);
        SyncService.registerConfig(timeTrackerCardConfig);
        SyncService.registerConfig(tagConfig);
    }

    static async initialize() {
        try {
            const currentUser = useAuthStore.getState().user;
            if (currentUser) {
                await useTagStore.getState().ensureDefault(
                    (tag) => SyncService.save(tagConfig, tag)
                );
            }
        } catch (error) {
            console.error("RoutineTimeTrackerService: Initialization failed:", error);
        }
    }
}
