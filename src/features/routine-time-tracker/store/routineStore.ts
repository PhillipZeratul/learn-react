import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { RoutineCard } from '../models/RoutineCard'
import { TimeTrackerCard } from '../models/TimeTrackerCard'

interface RoutineState {
    timeTrackerCards: TimeTrackerCard[]
    routineCards: RoutineCard[]
    isLoading: boolean
    error: string | null
}

interface RoutineActions {
    setTimeTrackerCards: (cards: TimeTrackerCard[]) => void
    addTimeTrackerCard: (card: TimeTrackerCard) => void
    updateTimeTrackerCard: (id: string, updates: Partial<TimeTrackerCard>) => void
    deleteTimeTrackerCard: (id: string) => void
    
    setRoutineCards: (cards: RoutineCard[]) => void
    addRoutineCard: (card: RoutineCard) => void
    updateRoutineCard: (id: string, updates: Partial<RoutineCard>) => void
    deleteRoutineCard: (id: string) => void
}

export const useRoutineStore = create<RoutineState & RoutineActions>()(
    immer((set) => ({
        timeTrackerCards: [],
        routineCards: [],
        isLoading: false,
        error: null,

        setTimeTrackerCards: (cards) => set((state) => {
            state.timeTrackerCards = cards
        }),

        addTimeTrackerCard: (card) => set((state) => {
            state.timeTrackerCards.push(card)
        }),

        updateTimeTrackerCard: (id, updates) => set((state) => {
            const index = state.timeTrackerCards.findIndex(c => c.id === id)
            if (index !== -1) {
                state.timeTrackerCards[index] = { ...state.timeTrackerCards[index], ...updates, updated_at: new Date().toISOString() }
            }
        }),

        deleteTimeTrackerCard: (id) => set((state) => {
            const index = state.timeTrackerCards.findIndex(c => c.id === id)
            if (index !== -1) {
                state.timeTrackerCards[index].is_deleted = true
                state.timeTrackerCards[index].updated_at = new Date().toISOString()
            }
        }),

        setRoutineCards: (cards) => set((state) => {
            state.routineCards = cards
        }),

        addRoutineCard: (card) => set((state) => {
            state.routineCards.push(card)
        }),

        updateRoutineCard: (id, updates) => set((state) => {
            const index = state.routineCards.findIndex(c => c.id === id)
            if (index !== -1) {
                state.routineCards[index] = { ...state.routineCards[index], ...updates, updated_at: new Date().toISOString() }
            }
        }),

        deleteRoutineCard: (id) => set((state) => {
            const index = state.routineCards.findIndex(c => c.id === id)
            if (index !== -1) {
                state.routineCards[index].is_deleted = true
                state.routineCards[index].updated_at = new Date().toISOString()
            }
        }),
    }))
)
