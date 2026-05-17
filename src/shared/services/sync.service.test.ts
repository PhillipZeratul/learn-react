import { describe, it, expect, vi, beforeEach, type Mock } from "vitest"
import { SyncService } from "./sync.service"
import { getDatabase } from "@/lib/db/sqlite"
import { useAuthStore } from "@/features/auth/stores/auth.store"
import type {
    BaseModel,
    IsoDateTime,
    ModelConfig,
    UserId,
} from "@/shared/models/base.model"

// Mock dependencies
vi.mock("@/lib/db/sqlite", () => ({
    getDatabase: vi.fn(),
}))

vi.mock("@/features/auth/stores/auth.store", () => ({
    useAuthStore: {
        getState: vi.fn(),
    },
}))

vi.mock("./database-maintenance.service", () => ({
    DatabaseMaintenanceService: {
        purgeOldDeletedRecords: vi.fn(),
    },
}))

interface TestEntity extends BaseModel {
    name: string
}

// Dummy config for testing
const mockConfig: ModelConfig<TestEntity> = {
    tableName: "test_table",
    createTableSql: "CREATE TABLE test_table",
    saveSql: "INSERT INTO test_table",
    toSqlValues: (entity: TestEntity) => [entity.id, entity.name],
    fromDb: (row: Record<string, unknown>) => row as unknown as TestEntity,
    setStore: vi.fn(),
    upsertInStore: vi.fn(),
    removeFromStore: vi.fn(),
}

describe("SyncService", () => {
    let mockDb: { execute: Mock; select: Mock }

    beforeEach(() => {
        vi.clearAllMocks()
        mockDb = {
            execute: vi.fn().mockResolvedValue({ changes: 1 }),
            select: vi.fn().mockResolvedValue([]),
        }
        ;(getDatabase as Mock).mockResolvedValue(mockDb)
        ;(useAuthStore.getState as Mock).mockReturnValue({
            user: { id: "user-123" },
        })

        // Reset configs array for clean tests
        ;(
            SyncService as unknown as { configs: ModelConfig<BaseModel>[] }
        ).configs = []
        SyncService.registerConfig(
            mockConfig as unknown as ModelConfig<BaseModel>
        )
    })

    describe("save", () => {
        it("should execute save SQL and add to sync queue", async () => {
            const entity: TestEntity = {
                id: "1",
                name: "Test",
                user_id: "user-123" as UserId,
                created_at: "2026-01-01T00:00:00Z" as IsoDateTime,
                updated_at: "2026-01-01T00:00:00Z" as IsoDateTime,
                is_deleted: false,
            }
            await SyncService.save(mockConfig, entity)

            expect(mockDb.execute).toHaveBeenCalledWith(mockConfig.saveSql, [
                "1",
                "Test",
            ])
            // Verify sync_queue insertion
            expect(mockDb.execute).toHaveBeenCalledWith(
                expect.stringContaining("INSERT INTO sync_queue"),
                expect.any(Array)
            )
        })
    })

    describe("delete", () => {
        it("should execute soft delete SQL and add to sync queue", async () => {
            // First call for entity lookup returns the record
            // Second call for sync_queue check returns empty
            mockDb.select
                .mockResolvedValueOnce([
                    { id: "1", name: "Test", user_id: "user-123" },
                ])
                .mockResolvedValueOnce([])

            await SyncService.delete(mockConfig, "1")

            expect(mockDb.execute).toHaveBeenCalledWith(
                expect.stringContaining("UPDATE test_table SET is_deleted = 1"),
                expect.any(Array)
            )
            expect(mockDb.execute).toHaveBeenCalledWith(
                expect.stringContaining("INSERT INTO sync_queue"),
                expect.any(Array)
            )
        })
    })

    describe("loadAll", () => {
        it("should load only active records by default", async () => {
            const mockRows = [
                { id: "1", name: "Active", is_deleted: 0, user_id: "user-123" },
            ]
            mockDb.select.mockResolvedValue(mockRows)

            await SyncService.loadAll()

            // Verify the query defaults to is_deleted = 0
            expect(mockDb.select).toHaveBeenCalledWith(
                expect.stringMatching(
                    /SELECT \* FROM test_table WHERE user_id = \? AND is_deleted = 0/
                ),
                ["user-123"]
            )

            expect(mockConfig.setStore).toHaveBeenCalledWith(mockRows)
        })

        it("should respect custom loadFilter", async () => {
            const filteredConfig: ModelConfig<TestEntity> = {
                ...mockConfig,
                tableName: "filtered_table",
                loadFilter: "AND (is_deleted = 0 OR special_flag = 1)",
            }
            ;(
                SyncService as unknown as { configs: ModelConfig<BaseModel>[] }
            ).configs = [filteredConfig as unknown as ModelConfig<BaseModel>]

            const mockRows = [
                { id: "1", is_deleted: 0, user_id: "user-123" },
                {
                    id: "2",
                    is_deleted: 1,
                    special_flag: 1,
                    user_id: "user-123",
                },
            ]
            mockDb.select.mockResolvedValue(mockRows)

            await SyncService.loadAll()

            expect(mockDb.select).toHaveBeenCalledWith(
                expect.stringMatching(
                    /SELECT \* FROM filtered_table WHERE user_id = \? AND \(is_deleted = 0 OR special_flag = 1\)/
                ),
                ["user-123"]
            )

            expect(filteredConfig.setStore).toHaveBeenCalledWith(mockRows)
        })
    })
})
