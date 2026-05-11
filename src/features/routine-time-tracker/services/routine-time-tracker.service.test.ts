import { describe, it, expect, vi, beforeEach } from "vitest"
import { RoutineTimeTrackerService } from "./routine-time-tracker.service"
import { getDatabase } from "@/lib/db/sqlite"
import { useAuthStore } from "@/features/auth/stores/auth.store"
import { SyncService } from "@/shared/services/sync.service"
import { routineCardConfig } from "../models/routine-card.model"
import { timeTrackerCardConfig } from "../models/time-tracker-card.model"
import { tagConfig } from "../models/tag.model"
import { routineTimeTrackerStateConfig } from "../models/routine-time-tracker-state.model"
import { useRoutineTimeTrackerStateStore } from "../stores/routine-time-tracker-state.store"

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

vi.mock("../stores/routine-time-tracker-state.store", () => ({
  useRoutineTimeTrackerStateStore: {
    getState: vi.fn(),
  },
}))

describe("RoutineTimeTrackerService", () => {
  let mockDb: any
  let mockStateStore: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb = {
      execute: vi.fn().mockResolvedValue({ changes: 1 }),
      select: vi.fn().mockResolvedValue([]),
    }
    ;(getDatabase as any).mockResolvedValue(mockDb)
    ;(useAuthStore.getState as any).mockReturnValue({
      user: { id: "user-123" },
    })

    mockStateStore = {
      state: null,
      set: vi.fn(),
    }
    ;(useRoutineTimeTrackerStateStore.getState as any).mockReturnValue(
      mockStateStore
    )
  })

  describe("registerConfig", () => {
    it("should register all configs with SyncService", () => {
      RoutineTimeTrackerService.registerConfig()

      expect(SyncService.registerConfig).toHaveBeenCalledWith(routineCardConfig)
      expect(SyncService.registerConfig).toHaveBeenCalledWith(
        timeTrackerCardConfig
      )
      expect(SyncService.registerConfig).toHaveBeenCalledWith(tagConfig)
      expect(SyncService.registerConfig).toHaveBeenCalledWith(
        routineTimeTrackerStateConfig
      )
    })
  })

  describe("initialize", () => {
    it("should create a new state record if none exists", async () => {
      mockStateStore.state = null

      await RoutineTimeTrackerService.initialize()

      expect(mockStateStore.set).toHaveBeenCalled()
      expect(SyncService.save).toHaveBeenCalledWith(
        routineTimeTrackerStateConfig,
        expect.objectContaining({
          id: "user-123",
          user_id: "user-123",
        })
      )
    })

    it("should migrate anonymous state to fixed user ID", async () => {
      mockStateStore.state = {
        id: "random-uuid",
        user_id: null,
        active_time_tracker_id: "tracker-1",
      }

      await RoutineTimeTrackerService.initialize()

      expect(mockStateStore.set).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "user-123",
          user_id: "user-123",
          active_time_tracker_id: "tracker-1",
        })
      )
      expect(SyncService.save).toHaveBeenCalledWith(
        routineTimeTrackerStateConfig,
        expect.objectContaining({
          id: "user-123",
        })
      )
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM routine_time_tracker_states"),
        ["random-uuid"]
      )
    })

    it("should migrate legacy random ID to fixed user ID even if logged in", async () => {
      mockStateStore.state = {
        id: "old-random-id",
        user_id: "user-123",
        active_time_tracker_id: "tracker-1",
      }

      await RoutineTimeTrackerService.initialize()

      expect(mockStateStore.set).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "user-123",
        })
      )
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM routine_time_tracker_states"),
        ["old-random-id"]
      )
    })
  })
})
