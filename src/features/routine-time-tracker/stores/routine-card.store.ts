import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { type RoutineCard } from '../models/routine-card.model'
import type { IsoDateTime } from '@/models/base.model'

interface RoutineCardState {
    items: RoutineCard[]
    isLoading: boolean
    error: string | null
}

interface RoutineCardActions {
    set: (items: RoutineCard[]) => void
    add: (item: RoutineCard) => void
    update: (id: string, updates: Partial<RoutineCard>) => void
    remove: (id: string) => void
    reset: () => void
}

export const useRoutineCardStore = create<RoutineCardState & RoutineCardActions>()(
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
            const index = state.items.findIndex(c => c.id === id)
            if (index !== -1) {
                state.items[index] = { ...state.items[index], ...updates, updated_at: new Date().toISOString() as IsoDateTime }
            }
        }),

        remove: (id) => set((state) => {
            const index = state.items.findIndex(c => c.id === id)
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
