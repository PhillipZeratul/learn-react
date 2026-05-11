import { describe, it, expect, vi, beforeEach } from "vitest"
import { createRoutineTimeTrackerState } from "./routine-time-tracker-state.model"
import { useAuthStore } from "@/features/auth/stores/auth.store"

vi.mock("@/features/auth/stores/auth.store", () => ({
  useAuthStore: {
    getState: vi.fn(),
  },
}))

describe("RoutineTimeTrackerState Model", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should use user_id as id when user is logged in", () => {
    const userId = "user-123"
    ;(useAuthStore.getState as any).mockReturnValue({ user: { id: userId } })

    const state = createRoutineTimeTrackerState()
    expect(state.user_id).toBe(userId)
    expect(state.id).toBe(userId)
  })

  it("should use random uuid if user is not logged in", () => {
    ;(useAuthStore.getState as any).mockReturnValue({ user: null })

    const state = createRoutineTimeTrackerState()
    expect(state.user_id).toBeUndefined()
    expect(state.id).toBeDefined()
    expect(state.id).not.toBeNull()
    expect(state.id.length).toBeGreaterThan(0)
  })

  it("should respect provided id and user_id", () => {
    const customId = "custom-id"
    const customUserId = "custom-user-id" as any

    const state = createRoutineTimeTrackerState({
      id: customId,
      user_id: customUserId,
    })
    expect(state.id).toBe(customId)
    expect(state.user_id).toBe(customUserId)
  })
})
