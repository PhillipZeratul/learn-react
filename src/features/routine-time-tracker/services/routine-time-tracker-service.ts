import { getDatabase } from '@/lib/db/sqlite'
import { SyncService } from '@/shared/services/sync-service'
import { DatabaseMaintenanceService } from '@/shared/services/database-maintenance.service'
import { routineCardConfig } from '../models/routine-card.model'
import { timeTrackerCardConfig } from '../models/time-tracker-card.model'
import { tagConfig } from '../models/tag.model'
import { useTagStore } from '../stores/tag.store'

export class RoutineTimeTrackerService {
    /**
     * Initializes the routine-time-tracker feature.
     * Registers models with the generic SyncService.
     */
    static async initialize() {
        try {
            const db = await getDatabase();
            
            // 1. Register feature models with SyncService
            SyncService.registerConfig(routineCardConfig);
            SyncService.registerConfig(timeTrackerCardConfig);
            SyncService.registerConfig(tagConfig);

            // 2. Initialize feature-specific tables
            const configs = [routineCardConfig, timeTrackerCardConfig, tagConfig];
            for (const config of configs) {
                await db.execute(config.createTableSql);
            }

            // 3. Run feature-specific migrations
            await this.migrateSchema();

            // 4. Run generic maintenance (purge old local records)
            await DatabaseMaintenanceService.purgeOldDeletedRecords();

            // 5. Hydrate stores from local database via SyncService
            await SyncService.loadAll();

            // 6. Feature-specific defaults
            await useTagStore.getState().ensureDefault(
                (tag) => SyncService.save(tagConfig, tag)
            );
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
