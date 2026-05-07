import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const SYNC_RETENSION_DAYS = 2

interface SettingsState {
    syncRetentionDays: number
    setSyncRetentionDays: (days: number) => void
    resetSettings: () => void
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            syncRetentionDays: SYNC_RETENSION_DAYS, // Purge soft-deleted items older than 30 days by default
            
            setSyncRetentionDays: (days) => set({ syncRetentionDays: days }),
            resetSettings: () => set({ syncRetentionDays: SYNC_RETENSION_DAYS }),
        }),
        {
            name: 'app-settings',
        }
    )
)
