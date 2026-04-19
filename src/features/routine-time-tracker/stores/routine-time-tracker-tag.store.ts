import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { type RoutineTimeTrackerTag } from '../models/routine-time-tracker-tag.model'
import type { IsoDateTime } from '@/models/base.model'

interface TagState {
    items: RoutineTimeTrackerTag[]
    isLoading: boolean
    error: string | null
}

interface TagActions {
    set: (items: RoutineTimeTrackerTag[]) => void
    add: (item: RoutineTimeTrackerTag) => void
    update: (id: string, updates: Partial<RoutineTimeTrackerTag>) => void
    remove: (id: string) => void
    reset: () => void
}

export const useRoutineTimeTrackerTagStore = create<TagState & TagActions>()(
    immer((set) => ({
        items: [],
        isLoading: false,
        error: null,

        set: (items) => set((state) => {
            state.items = items
        }),

        add: (item) => set((state) => {
            state.items.push(item)
        }),

        update: (id, updates) => set((state) => {
            const index = state.items.findIndex(t => t.id === id)
            if (index !== -1) {
                state.items[index] = { ...state.items[index], ...updates, updated_at: new Date().toISOString() as IsoDateTime }
            }
        }),

        remove: (id) => set((state) => {
            const index = state.items.findIndex(t => t.id === id)
            if (index !== -1) {
                state.items[index].is_deleted = true
                state.items[index].updated_at = new Date().toISOString() as IsoDateTime
            }
        }),

        reset: () => set((state) => {
            state.items = []
            state.isLoading = false
            state.error = null
        }),
    }))
)
