import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncService } from './sync.service';
import { getDatabase } from '@/lib/db/sqlite';
import { useAuthStore } from '@/features/auth/stores/auth.store';

// Mock dependencies
vi.mock('@/lib/db/sqlite', () => ({
    getDatabase: vi.fn(),
}));

vi.mock('@/features/auth/stores/auth.store', () => ({
    useAuthStore: {
        getState: vi.fn(),
    },
}));

vi.mock('./database-maintenance.service', () => ({
    DatabaseMaintenanceService: {
        purgeOldDeletedRecords: vi.fn(),
    },
}));

// Dummy config for testing
const mockConfig: any = {
    tableName: 'test_table',
    createTableSql: 'CREATE TABLE test_table',
    saveSql: 'INSERT INTO test_table',
    toSqlValues: (entity: any) => [entity.id, entity.name],
    fromDb: (row: any) => row,
    updateStore: vi.fn(),
};

describe('SyncService', () => {
    let mockDb: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockDb = {
            execute: vi.fn().mockResolvedValue({ changes: 1 }),
            select: vi.fn().mockResolvedValue([]),
        };
        (getDatabase as any).mockResolvedValue(mockDb);
        (useAuthStore.getState as any).mockReturnValue({ user: { id: 'user-123' } });
        
        // Reset configs array for clean tests
        (SyncService as any).configs = [];
        SyncService.registerConfig(mockConfig);
    });

    describe('save', () => {
        it('should execute save SQL and add to sync queue', async () => {
            const entity = { id: '1', name: 'Test', user_id: 'user-123' };
            await SyncService.save(mockConfig, entity);
            
            expect(mockDb.execute).toHaveBeenCalledWith(mockConfig.saveSql, ['1', 'Test']);
            // Verify sync_queue insertion
            expect(mockDb.execute).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO sync_queue'),
                expect.any(Array)
            );
        });
    });

    describe('delete', () => {
        it('should execute soft delete SQL and add to sync queue', async () => {
            // First call for entity lookup returns the record
            // Second call for sync_queue check returns empty
            mockDb.select
                .mockResolvedValueOnce([{ id: '1', name: 'Test', user_id: 'user-123' }])
                .mockResolvedValueOnce([]);
            
            await SyncService.delete(mockConfig, '1');
            
            expect(mockDb.execute).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE test_table SET is_deleted = 1'),
                expect.any(Array)
            );
            expect(mockDb.execute).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO sync_queue'),
                expect.any(Array)
            );
        });
    });

    describe('loadAll', () => {
        it('should load only active records by default', async () => {
            const mockRows = [
                { id: '1', name: 'Active', is_deleted: 0, user_id: 'user-123' }
            ];
            mockDb.select.mockResolvedValue(mockRows);

            await SyncService.loadAll();

            // Verify the query defaults to is_deleted = 0
            expect(mockDb.select).toHaveBeenCalledWith(
                expect.stringMatching(/SELECT \* FROM test_table WHERE user_id = \? AND is_deleted = 0/),
                ['user-123']
            );
            
            expect(mockConfig.updateStore).toHaveBeenCalledWith(mockRows);
        });

        it('should respect custom loadFilter', async () => {
            const filteredConfig = {
                ...mockConfig,
                tableName: 'filtered_table',
                loadFilter: 'AND (is_deleted = 0 OR special_flag = 1)'
            };
            (SyncService as any).configs = [filteredConfig];
            
            const mockRows = [
                { id: '1', is_deleted: 0, user_id: 'user-123' },
                { id: '2', is_deleted: 1, special_flag: 1, user_id: 'user-123' }
            ];
            mockDb.select.mockResolvedValue(mockRows);

            await SyncService.loadAll();

            expect(mockDb.select).toHaveBeenCalledWith(
                expect.stringMatching(/SELECT \* FROM filtered_table WHERE user_id = \? AND \(is_deleted = 0 OR special_flag = 1\)/),
                ['user-123']
            );
            
            expect(filteredConfig.updateStore).toHaveBeenCalledWith(mockRows);
        });
    });
});
