import { create } from "zustand"
import { immer } from "zustand/middleware/immer"
import { type TimeTrackerCard } from "../models/time-tracker-card.model"

interface TimeTrackerCardState {
    items: TimeTrackerCard[]
    isLoading: boolean
    error: string | null
}

interface TimeTrackerCardActions {
    set: (items: TimeTrackerCard[]) => void
    upsert: (item: TimeTrackerCard) => void
    remove: (id: string) => void
    reset: () => void
}

export const useTimeTrackerCardStore = create<
    TimeTrackerCardState & TimeTrackerCardActions
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
                    if (item.is_deleted) {
                        state.items.splice(index, 1)
                    } else {
                        state.items[index] = item
                    }
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
