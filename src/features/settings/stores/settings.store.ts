import { create } from "zustand"
import { persist } from "zustand/middleware"

const SYNC_RETENSION_DAYS = 2
export const AUTO_SWITCH_TO_TODAY_MS = 60 * 60 * 1000 // 1 hour

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
            resetSettings: () =>
                set({ syncRetentionDays: SYNC_RETENSION_DAYS }),
        }),
        {
            name: "app-settings",
        }
    )
)
