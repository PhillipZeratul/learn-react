import { create } from "zustand"
import { immer } from "zustand/middleware/immer"
import { type Tag } from "../models/tag.model"

interface TagState {
    items: Tag[]
    isLoading: boolean
    error: string | null
}

interface TagActions {
    set: (items: Tag[]) => void
    upsert: (item: Tag) => void
    remove: (id: string) => void
    reset: () => void
    ensureDefault: (saveFn: (tag: Tag) => Promise<void>) => Promise<void>
}

export const useTagStore = create<TagState & TagActions>()(
    immer((set, get) => ({
        items: [],
        isLoading: false,
        error: null,

        set: (items) =>
            set((state) => {
                state.items = items
            }),

        upsert: (item) =>
            set((state) => {
                const index = state.items.findIndex((t) => t.id === item.id)
                if (index !== -1) {
                    state.items[index] = item
                } else if (!item.is_deleted) {
                    state.items.push(item)
                }
            }),

        remove: (id) =>
            set((state) => {
                const index = state.items.findIndex((t) => t.id === id)
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

        ensureDefault: async (saveFn) => {
            const { items } = get()
            // Ensure exactly one "Default" tag exists by checking the name
            const hasDefault = items.some(
                (t) => t.name === "Default" && !t.is_deleted
            )

            if (!hasDefault) {
                const { createTag, DEFAULT_TAG_ID } =
                    await import("../models/tag.model")
                const defaultTag = createTag({
                    id: DEFAULT_TAG_ID,
                    name: "Default",
                    color: "#787878",
                })

                await saveFn(defaultTag)

                set((state) => {
                    // Double check to prevent race conditions
                    if (
                        !state.items.some(
                            (t) => t.name === "Default" && !t.is_deleted
                        )
                    ) {
                        state.items.push(defaultTag)
                    }
                })
            }
        },
    }))
)
