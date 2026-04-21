import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
    syncRetentionDays: number
    setSyncRetentionDays: (days: number) => void
    activeTimeTrackerId: string | null
    setActiveTimeTrackerId: (id: string | null) => void
    resetSettings: () => void
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            syncRetentionDays: 30, // Purge soft-deleted items older than 30 days by default
            activeTimeTrackerId: null,
            
            setSyncRetentionDays: (days) => set({ syncRetentionDays: days }),
            setActiveTimeTrackerId: (id) => set({ activeTimeTrackerId: id }),
            resetSettings: () => set({ syncRetentionDays: 30, activeTimeTrackerId: null }),
        }),
        {
            name: 'app-settings',
        }
    )
)
