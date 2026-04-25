import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoutineTimeTrackerService } from './routine-time-tracker.service';
import { getDatabase } from '@/lib/db/sqlite';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { useSettingsStore } from '@/features/settings/stores/settings.store';
import { SyncService } from '@/shared/services/sync.service';
import { routineCardConfig } from '../models/routine-card.model';

// Mock dependencies
vi.mock('@/lib/db/sqlite', () => ({
    getDatabase: vi.fn(),
}));

vi.mock('@/features/auth/stores/auth.store', () => ({
    useAuthStore: {
        getState: vi.fn(),
    },
}));

vi.mock('@/features/settings/stores/settings.store', () => ({
    useSettingsStore: {
        getState: vi.fn(),
    },
}));

vi.mock('@/shared/services/sync-service', () => ({
    SyncService: {
        triggerSync: vi.fn(),
    },
}));

vi.mock('../stores/routine-card.store', () => ({
    useRoutineCardStore: { getState: vi.fn() },
}));

vi.mock('../stores/time-tracker-card.store', () => ({
    useTimeTrackerCardStore: { getState: vi.fn() },
}));

vi.mock('../stores/tag.store', () => ({
    useTagStore: { 
        getState: vi.fn(() => ({
            ensureDefault: vi.fn(),
            reset: vi.fn()
        }))
    },
}));

describe('RoutineTimeTrackerService', () => {
    let mockDb: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockDb = {
            execute: vi.fn().mockResolvedValue({ changes: 1 }),
            select: vi.fn().mockResolvedValue([]),
        };
        (getDatabase as any).mockResolvedValue(mockDb);
        (useSettingsStore.getState as any).mockReturnValue({ syncRetentionDays: 30 });
        (useAuthStore.getState as any).mockReturnValue({ user: { id: 'user-123' } });
    });

    describe('initialize', () => {
        it('should execute table creation SQLs', async () => {
            await RoutineTimeTrackerService.initialize();
            expect(mockDb.execute).toHaveBeenCalled();
            // Verify sync_queue table creation
            expect(mockDb.execute).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS sync_queue'));
        });
    });

    describe('purgeOldDeletedRecords', () => {
        it('should execute delete query with correct cutoff date', async () => {
            const now = new Date('2026-04-22T10:00:00Z').getTime();
            vi.useFakeTimers();
            vi.setSystemTime(now);

            await RoutineTimeTrackerService.purgeOldDeletedRecords();

            const retentionDays = 30;
            const expectedCutoff = new Date(now - retentionDays * 24 * 60 * 60 * 1000).toISOString();
            
            expect(mockDb.execute).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM'),
                expect.arrayContaining([expectedCutoff])
            );

            vi.useRealTimers();
        });
    });

    describe('loadAll', () => {
        it('should skip loading if no user is signed in', async () => {
            (useAuthStore.getState as any).mockReturnValue({ user: null });
            await RoutineTimeTrackerService.loadAll();
            expect(mockDb.select).not.toHaveBeenCalled();
        });

        it('should fetch records for the logged-in user', async () => {
            await RoutineTimeTrackerService.loadAll();
            expect(mockDb.select).toHaveBeenCalledWith(
                expect.stringContaining('SELECT * FROM'),
                ['user-123']
            );
        });
    });

    describe('save', () => {
        it('should execute save SQL and add to sync queue', async () => {
            const entity = { id: '1', updated_at: '2026-01-01', user_id: 'user-123' };
            // Mocking config.saveSql and config.toSqlValues is tricky because they are imported
            // But RoutineTimeTrackerService.save uses them. 
            // We can check if mockDb.execute was called and if triggerSync was fired.
            
            await RoutineTimeTrackerService.save(routineCardConfig as any, entity as any);
            
            expect(mockDb.execute).toHaveBeenCalled();
            expect(SyncService.triggerSync).toHaveBeenCalled();
        });
    });

    describe('delete', () => {
        it('should execute soft delete SQL and add to sync queue', async () => {
            await RoutineTimeTrackerService.delete(routineCardConfig as any, 'id-to-delete');
            
            expect(mockDb.execute).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE routine_cards SET is_deleted = 1'),
                expect.arrayContaining(['id-to-delete'])
            );
            expect(SyncService.triggerSync).toHaveBeenCalled();
        });
    });
});
