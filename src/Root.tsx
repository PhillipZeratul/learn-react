import { StrictMode, useEffect, useState } from "react"
import App from "./App.tsx"
import { ThemeProvider } from "@/components/ThemeProvider.tsx"
import { RoutineTimeTrackerService } from "@/features/routine-time-tracker/services/routine-time-tracker.service.ts"
import { SyncService } from "@/shared/services/sync.service.ts"
import { DatabaseMaintenanceService } from "@/shared/services/database-maintenance.service.ts"
import { useAuthStore } from "@/features/auth/stores/auth.store.ts"
import { supabase } from "@/lib/supabase"

export function Root() {
    const [initError, setInitError] = useState<string | null>(null)
    const setAuth = useAuthStore((state) => state.setAuth)

    useEffect(() => {
        console.log("Root component mounted, starting initialization...")
        const init = async () => {
            try {
                // Register all configs from feature services.
                RoutineTimeTrackerService.registerConfig()

                // Initialize Database Schema & Infrastructure
                // This must happen first so tables exist before any logic tries to access them
                await SyncService.initialize()

                // Initialize Features (Register models, migrations)
                await RoutineTimeTrackerService.initialize()

                // Supabase Auth Setup
                if (supabase) {
                    const {
                        data: { session: initialSession },
                    } = await supabase.auth.getSession()

                    // Handle initial state
                    if (initialSession?.user) {
                        setAuth(initialSession.user, initialSession)
                        console.log(
                            "Root: Initial user found, triggering hydration..."
                        )
                        SyncService.startRealtimeListener()

                        // Load local SQLite data immediately for fast UI feedback
                        await SyncService.loadAll()

                        // Pull cloud deltas in the background
                        SyncService.pullDeltas()
                    }
                    // Listen for changes (Login/Logout/Refresh)
                    supabase.auth.onAuthStateChange(async (event, session) => {
                        const user = session?.user ?? null
                        setAuth(user, session)

                        if (
                            event === "SIGNED_IN" ||
                            event === "TOKEN_REFRESHED"
                        ) {
                            console.log(
                                `Root: Auth event ${event}, triggering hydration...`
                            )
                            SyncService.startRealtimeListener()

                            // 1. Load local SQLite data immediately
                            await SyncService.loadAll()

                            // 2. Initialize routine time tracker features (default tags, etc.)
                            await RoutineTimeTrackerService.initialize()

                            // 3. Catch up sync from cloud in the background
                            SyncService.pullDeltas()
                        }

                        if (event === "SIGNED_OUT") {
                            SyncService.startRealtimeListener() // Will clear the channel
                        }
                    })
                }

                // Debug helper
                const debugTools = {
                    clearAllData: () =>
                        DatabaseMaintenanceService.clearAllData(),
                    clearTableData: (tableName: string) =>
                        DatabaseMaintenanceService.clearTableData(tableName),
                    clearSyncQueue: () =>
                        DatabaseMaintenanceService.clearSyncQueue(),
                    pullCloud: () => DatabaseMaintenanceService.pullFromCloud(),
                    syncNow: () => SyncService.triggerSync(true),
                }
                ;(window as unknown as Record<string, unknown>).__DEBUG__ =
                    debugTools

                console.log("Initialization complete")
            } catch (err) {
                console.error("Initialization failed:", err)
                setInitError(err instanceof Error ? err.message : String(err))
            }
        }
        init()
    }, [setAuth])

    if (initError) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background p-4">
                <div className="w-full max-w-md rounded-2xl border border-destructive/20 bg-destructive/10 p-6 text-destructive shadow-xl">
                    <h1 className="flex items-center gap-2 text-xl font-semibold">
                        <span className="text-2xl">⚠️</span> Initialization
                        Error
                    </h1>
                    <pre className="mt-4 overflow-auto rounded-lg bg-destructive/5 p-3 font-mono text-sm whitespace-pre-wrap">
                        {initError}
                    </pre>
                    <button
                        onClick={() => window.location.reload()}
                        className="text-destructive-foreground mt-6 w-full rounded-xl bg-destructive py-2 font-medium transition-opacity hover:opacity-90"
                    >
                        Retry Loading
                    </button>
                </div>
            </div>
        )
    }

    return (
        <StrictMode>
            <ThemeProvider>
                <App />
            </ThemeProvider>
        </StrictMode>
    )
}
