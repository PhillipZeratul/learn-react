import { create } from "zustand"
import { immer } from "zustand/middleware/immer"
import { type TimeTrackerCard } from "../models/time-tracker-card.model"
import type { IsoDateTime } from "@/shared/models/base.model"

interface TimeTrackerCardState {
  items: TimeTrackerCard[]
  isLoading: boolean
  error: string | null
}

interface TimeTrackerCardActions {
  set: (items: TimeTrackerCard[]) => void
  add: (item: TimeTrackerCard) => void
  update: (id: string, updates: Partial<TimeTrackerCard>) => void
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

    add: (item) =>
      set((state) => {
        state.items.push(item)
      }),

    update: (id, updates) =>
      set((state) => {
        const index = state.items.findIndex((c) => c.id === id)
        if (index !== -1) {
          state.items[index] = {
            ...state.items[index],
            ...updates,
            updated_at: new Date().toISOString() as IsoDateTime,
          }
        }
      }),

    remove: (id) =>
      set((state) => {
        const index = state.items.findIndex((c) => c.id === id)
        if (index !== -1) {
          state.items[index].is_deleted = true
          state.items[index].updated_at =
            new Date().toISOString() as IsoDateTime
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
