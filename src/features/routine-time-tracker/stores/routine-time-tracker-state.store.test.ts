import { describe, it, expect, beforeEach } from "vitest"
import { useRoutineTimeTrackerStateStore } from "./routine-time-tracker-state.store"
import { createRoutineTimeTrackerState } from "../models/routine-time-tracker-state.model"
import type { TimeTrackerCardId } from "../models/routine-time-tracker.model"

describe("useRoutineTimeTrackerStateStore", () => {
  beforeEach(() => {
    useRoutineTimeTrackerStateStore.getState().set(null)
  })

  it("should have a default state", () => {
    const state = useRoutineTimeTrackerStateStore.getState().state
    expect(state).toBe(null)
  })

  it("should set the state", () => {
    const testState = createRoutineTimeTrackerState({
      active_time_tracker_id: "test-id" as TimeTrackerCardId,
    })
    useRoutineTimeTrackerStateStore.getState().set(testState)
    expect(
      useRoutineTimeTrackerStateStore.getState().state?.active_time_tracker_id
    ).toBe("test-id")
  })
})
