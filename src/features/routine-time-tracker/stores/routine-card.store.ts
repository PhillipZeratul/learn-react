import { create } from "zustand"
import { immer } from "zustand/middleware/immer"
import { type RoutineCard } from "../models/routine-card.model"
import type { IsoDateTime } from "@/shared/models/base.model"

interface RoutineCardState {
    items: RoutineCard[]
    isLoading: boolean
    error: string | null
}

interface RoutineCardActions {
    set: (items: RoutineCard[]) => void
    upsert: (item: RoutineCard) => void
    remove: (id: string) => void
    reset: () => void
}

export const useRoutineCardStore = create<
    RoutineCardState & RoutineCardActions
>()(
    immer((set) => ({
        items: [],
        isLoading: false,
        error: null,

        set: (items) =>
            set((state) => {
                state.items = items
            }),

        upsert: (item) =>
            set((state) => {
                const index = state.items.findIndex((c) => c.id === item.id)
                if (index !== -1) {
                    state.items[index] = item
                } else if (!item.is_deleted) {
                    state.items.push(item)
                }
            }),

        remove: (id) =>
            set((state) => {
                const index = state.items.findIndex((c) => c.id === id)
                if (index !== -1) {
                    state.items.splice(index, 1)
                }
            }),

        reset: () =>
            set((state) => {
                state.items = []
                state.isLoading = false
                state.error = null
            }),
    }))
)
