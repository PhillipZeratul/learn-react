import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { RoutineCard } from '../models/routine-card.model'
import { TimeTrackerCard } from '../models/time-tracker-card.model'
import { RoutineTimeTrackerTag } from '../models/routine-time-tracker-tag.model'
import type { IsoDateTime } from '@/models/base.model'

interface RoutineTimeTrackerState {
    timeTrackerCards: TimeTrackerCard[]
    routineCards: RoutineCard[]
    tags: RoutineTimeTrackerTag[]
    isLoading: boolean
    error: string | null
}

interface RoutineTimeTrackerActions {
    setTimeTrackerCards: (cards: TimeTrackerCard[]) => void
    addTimeTrackerCard: (card: TimeTrackerCard) => void
    updateTimeTrackerCard: (id: string, updates: Partial<TimeTrackerCard>) => void
    deleteTimeTrackerCard: (id: string) => void
    
    setRoutineCards: (cards: RoutineCard[]) => void
    addRoutineCard: (card: RoutineCard) => void
    updateRoutineCard: (id: string, updates: Partial<RoutineCard>) => void
    deleteRoutineCard: (id: string) => void

    setTags: (tags: RoutineTimeTrackerTag[]) => void
    addTag: (tag: RoutineTimeTrackerTag) => void
    updateTag: (id: string, updates: Partial<RoutineTimeTrackerTag>) => void
    deleteTag: (id: string) => void

    reset: () => void
}

export const useRoutineTimeTrackerStore = create<RoutineTimeTrackerState & RoutineTimeTrackerActions>()(
    immer((set) => ({
        timeTrackerCards: [],
        routineCards: [],
        tags: [],
        isLoading: false,
        error: null,

        reset: () => set((state) => {
            state.timeTrackerCards = []
            state.routineCards = []
            state.tags = []
            state.isLoading = false
            state.error = null
        }),

        setTimeTrackerCards: (cards) => set((state) => {
            state.timeTrackerCards = cards
        }),

        addTimeTrackerCard: (card) => set((state) => {
            state.timeTrackerCards.push(card)
        }),

        updateTimeTrackerCard: (id, updates) => set((state) => {
            const index = state.timeTrackerCards.findIndex(c => c.id === id)
            if (index !== -1) {
                state.timeTrackerCards[index] = { ...state.timeTrackerCards[index], ...updates, 
                    updated_at: new Date().toISOString() as IsoDateTime }
            }
        }),

        deleteTimeTrackerCard: (id) => set((state) => {
            const index = state.timeTrackerCards.findIndex(c => c.id === id)
            if (index !== -1) {
                state.timeTrackerCards[index].is_deleted = true
                state.timeTrackerCards[index].updated_at = new Date().toISOString() as IsoDateTime
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
                state.routineCards[index] = { ...state.routineCards[index], ...updates, updated_at: new Date().toISOString() as IsoDateTime}
            }
        }),

        deleteRoutineCard: (id) => set((state) => {
            const index = state.routineCards.findIndex(c => c.id === id)
            if (index !== -1) {
                state.routineCards[index].is_deleted = true
                state.routineCards[index].updated_at = new Date().toISOString() as IsoDateTime
            }
        }),

        setTags: (tags) => set((state) => {
            state.tags = tags
        }),

        addTag: (tag) => set((state) => {
            state.tags.push(tag)
        }),

        updateTag: (id, updates) => set((state) => {
            const index = state.tags.findIndex(t => t.id === id)
            if (index !== -1) {
                state.tags[index] = { ...state.tags[index], ...updates, updated_at: new Date().toISOString() as IsoDateTime}
            }
        }),

        deleteTag: (id) => set((state) => {
            const index = state.tags.findIndex(t => t.id === id)
            if (index !== -1) {
                state.tags[index].is_deleted = true
                state.tags[index].updated_at = new Date().toISOString() as IsoDateTime
            }
        }),
    }))
)
