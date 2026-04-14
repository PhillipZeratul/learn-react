import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
    syncRetentionDays: number
    setSyncRetentionDays: (days: number) => void
    resetSettings: () => void
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            syncRetentionDays: 30, // Purge soft-deleted items older than 30 days by default
            
            setSyncRetentionDays: (days) => set({ syncRetentionDays: days }),
            resetSettings: () => set({ syncRetentionDays: 30 }),
        }),
        {
            name: 'app-settings',
        }
    )
)
