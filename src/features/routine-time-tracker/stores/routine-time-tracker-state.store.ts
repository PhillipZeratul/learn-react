import { create } from 'zustand'
import type { RoutineTimeTrackerState } from '../models/routine-time-tracker-state.model'

interface RoutineTimeTrackerStateStore {
    state: RoutineTimeTrackerState | null
    set: (state: RoutineTimeTrackerState | null) => void
}

export const useRoutineTimeTrackerStateStore = create<RoutineTimeTrackerStateStore>((set) => ({
    state: null,
    set: (state) => set({ state }),
}))
