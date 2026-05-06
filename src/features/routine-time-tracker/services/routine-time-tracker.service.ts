import { getDatabase } from '@/lib/db/sqlite'
import { SyncService } from '@/shared/services/sync.service'
import { routineCardConfig } from '../models/routine-card.model'
import { timeTrackerCardConfig } from '../models/time-tracker-card.model'
import { tagConfig } from '../models/tag.model'
import { useTagStore } from '../stores/tag.store'
import { useAuthStore } from '@/features/auth/stores/auth.store'

export class RoutineTimeTrackerService {
    /**
     * Initializes the routine-time-tracker feature.
     * Registers models with the generic SyncService.
     */
    static async initialize() {
        try {
            SyncService.registerConfig(routineCardConfig);
            SyncService.registerConfig(timeTrackerCardConfig);
            SyncService.registerConfig(tagConfig);

            await this.migrateSchema();

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

    /**
     * Feature-specific migration logic for Routine Cards.
     */
    private static async migrateSchema() {
        const db = await getDatabase();
        try {
            const tableInfo = await db.select<any>("PRAGMA table_info(routine_cards)");
            const columns = tableInfo.map((c: any) => c.name);

            const migrations = [
                { name: 'rrule', sql: 'ALTER TABLE routine_cards ADD COLUMN rrule TEXT' },
                { name: 'parent_routine_id', sql: 'ALTER TABLE routine_cards ADD COLUMN parent_routine_id TEXT' },
                { name: 'original_recurrence_date', sql: 'ALTER TABLE routine_cards ADD COLUMN original_recurrence_date TEXT' }
            ];

            for (const m of migrations) {
                if (!columns.includes(m.name)) {
                    console.log(`RoutineTimeTrackerService: Migrating local DB - Adding column ${m.name}`);
                    await db.execute(m.sql);
                }
            }
        } catch (err) {
            console.error("RoutineTimeTrackerService: Migration failed", err);
        }
    }
}
