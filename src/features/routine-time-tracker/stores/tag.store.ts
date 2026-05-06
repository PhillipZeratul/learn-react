import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { type Tag } from '../models/tag.model'
import type { IsoDateTime } from '@/shared/models/base.model'

interface TagState {
    items: Tag[]
    isLoading: boolean
    error: string | null
}

interface TagActions {
    set: (items: Tag[]) => void
    add: (item: Tag) => void
    update: (id: string, updates: Partial<Tag>) => void
    remove: (id: string) => void
    reset: () => void
    ensureDefault: (saveFn: (tag: Tag) => Promise<void>) => Promise<void>
}

export const useTagStore = create<TagState & TagActions>()(
    immer((set, get) => ({
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

        ensureDefault: async (saveFn) => {
            const { items } = get()
            // Ensure exactly one "Default" tag exists by checking the name
            const hasDefault = items.some(t => t.name === "Default" && !t.is_deleted)
            
            if (!hasDefault) {
                const { createTag, DEFAULT_TAG_ID } = await import('../models/tag.model')
                const defaultTag = createTag({ 
                    id: DEFAULT_TAG_ID,
                    name: "Default",
                    color: "#787878"
                })
                
                await saveFn(defaultTag)
                
                set((state) => {
                    // Double check to prevent race conditions
                    if (!state.items.some(t => t.name === "Default" && !t.is_deleted)) {
                        state.items.push(defaultTag)
                    }
                })
            }
        }
    }))
)
