import { describe, it, expect, vi, beforeEach, type Mock } from "vite-plus/test"
import { RoutineTimeTrackerService } from "./routine-time-tracker.service"
import { getDatabase } from "@/lib/db/sqlite"
import { useAuthStore } from "@/features/auth/stores/auth.store"
import { SyncService } from "@/shared/services/sync.service"
import { routineCardConfig } from "../models/routine-card.model"
import { timeTrackerCardConfig } from "../models/time-tracker-card.model"
import { tagConfig } from "../models/tag.model"

// Mock dependencies
vi.mock("@/lib/db/sqlite", () => ({
    getDatabase: vi.fn(),
}))

vi.mock("@/features/auth/stores/auth.store", () => ({
    useAuthStore: {
        getState: vi.fn(),
    },
}))

vi.mock("@/shared/services/sync.service", () => ({
    SyncService: {
        registerConfig: vi.fn(),
        save: vi.fn(),
    },
}))

vi.mock("../stores/tag.store", () => ({
    useTagStore: {
        getState: vi.fn(() => ({
            ensureDefault: vi.fn(),
        })),
    },
}))

describe("RoutineTimeTrackerService", () => {
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
    })

    describe("registerConfig", () => {
        it("should register all configs with SyncService", () => {
            RoutineTimeTrackerService.registerConfig()

            expect(SyncService.registerConfig).toHaveBeenCalledWith(
                routineCardConfig
            )
            expect(SyncService.registerConfig).toHaveBeenCalledWith(
                timeTrackerCardConfig
            )
            expect(SyncService.registerConfig).toHaveBeenCalledWith(tagConfig)
        })
    })
})
