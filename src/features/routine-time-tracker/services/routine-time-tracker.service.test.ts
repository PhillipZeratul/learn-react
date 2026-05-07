import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoutineTimeTrackerService } from './routine-time-tracker.service';
import { getDatabase } from '@/lib/db/sqlite';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { SyncService } from '@/shared/services/sync.service';
import { routineCardConfig } from '../models/routine-card.model';
import { timeTrackerCardConfig } from '../models/time-tracker-card.model';
import { tagConfig } from '../models/tag.model';

// Mock dependencies
vi.mock('@/lib/db/sqlite', () => ({
    getDatabase: vi.fn(),
}));

vi.mock('@/features/auth/stores/auth.store', () => ({
    useAuthStore: {
        getState: vi.fn(),
    },
}));

vi.mock('@/shared/services/sync.service', () => ({
    SyncService: {
        registerConfig: vi.fn(),
        save: vi.fn(),
    },
}));

vi.mock('../stores/tag.store', () => ({
    useTagStore: { 
        getState: vi.fn(() => ({
            ensureDefault: vi.fn(),
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
        (useAuthStore.getState as any).mockReturnValue({ user: { id: 'user-123' } });
    });

    describe('initialize', () => {
        it('should register configs with SyncService', async () => {
            await RoutineTimeTrackerService.initialize();
            
            expect(SyncService.registerConfig).toHaveBeenCalledWith(routineCardConfig);
            expect(SyncService.registerConfig).toHaveBeenCalledWith(timeTrackerCardConfig);
            expect(SyncService.registerConfig).toHaveBeenCalledWith(tagConfig);
        });

        it('should execute migrations if columns are missing', async () => {
            // Mock table info showing no columns exist yet
            mockDb.select.mockResolvedValue([]);
            
            await RoutineTimeTrackerService.initialize();
            
            expect(mockDb.execute).toHaveBeenCalledWith(expect.stringContaining('ALTER TABLE routine_cards ADD COLUMN rrule'));
            expect(mockDb.execute).toHaveBeenCalledWith(expect.stringContaining('ALTER TABLE routine_cards ADD COLUMN parent_routine_id'));
            expect(mockDb.execute).toHaveBeenCalledWith(expect.stringContaining('ALTER TABLE routine_cards ADD COLUMN original_recurrence_date'));
        });

        it('should skip migrations if columns already exist', async () => {
            // Mock table info showing all columns exist
            mockDb.select.mockResolvedValue([
                { name: 'rrule' },
                { name: 'parent_routine_id' },
                { name: 'original_recurrence_date' }
            ]);
            
            await RoutineTimeTrackerService.initialize();
            
            expect(mockDb.execute).not.toHaveBeenCalledWith(expect.stringContaining('ALTER TABLE'));
        });
    });
});
