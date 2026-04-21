import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface RoutineTimeTrackerState {
    activeTimeTrackerId: string | null
    setActiveTimeTrackerId: (id: string | null) => void
    resetTracker: () => void
}

export const useRoutineTimeTrackerStore = create<RoutineTimeTrackerState>()(
    persist(
        (set) => ({
            activeTimeTrackerId: null,
            setActiveTimeTrackerId: (id) => set({ activeTimeTrackerId: id }),
            resetTracker: () => set({ activeTimeTrackerId: null }),
        }),
        {
            name: 'routine-time-tracker-storage', // Unique name for persistence
        }
    )
)
