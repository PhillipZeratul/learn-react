import { StrictMode, useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import "@preact/signals-react/runtime";

import "./index.css"
import App from "./App.tsx"
import { ThemeProvider } from "@/components/ThemeProvider.tsx"
import { RoutineTimeTrackerService } from "@/features/routine-time-tracker/services/routine-time-tracker-service.ts"
import { SyncService } from "@/services/sync-service"
import { useAuthStore } from "@/features/auth/stores/auth-store.ts"
import { supabase } from "@/lib/supabase"

function Root() {
    const [isInitializing, setIsInitializing] = useState(true);
    const [initError, setInitError] = useState<string | null>(null);
    const setUser = useAuthStore(state => state.setUser);
    const setSession = useAuthStore(state => state.setSession);
    const setLoading = useAuthStore(state => state.setLoading);

    useEffect(() => {
        console.log("Root component mounted, starting initialization...");
        const init = async () => {
            try {
                // Supabase Auth Listener
                if (supabase) {
                    const { data: { session } } = await supabase.auth.getSession();
                    setSession(session);
                    setUser(session?.user ?? null);
                    
                    supabase.auth.onAuthStateChange((_event, session) => {
                        setSession(session);
                        setUser(session?.user ?? null);
                        setLoading(false);
                    });
                }
                
                // Short delay to allow loading UI to show up
                await new Promise(resolve => setTimeout(resolve, 50));
                
                await RoutineTimeTrackerService.initialize();
                SyncService.initialize();

                // Debug helper
                (window as any).__DEBUG__ = {
                    clearData: () => RoutineTimeTrackerService.clearAllData(),
                    syncNow: () => SyncService.triggerSync(true),
                };

                console.log("Initialization complete");
                setIsInitializing(false);
                setLoading(false);
            } catch (err) {
                console.error("Initialization failed:", err);
                setInitError(err instanceof Error ? err.message : String(err));
                setIsInitializing(false);
                setLoading(false);
            }
        };
        init();
    }, []);

    if (initError) {
        return (
            <div className="h-screen w-full flex items-center justify-center p-4 bg-background">
                <div className="max-w-md w-full p-6 bg-destructive/10 text-destructive rounded-2xl border border-destructive/20 shadow-xl">
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <span className="text-2xl">⚠️</span> Initialization Error
                    </h1>
                    <pre className="mt-4 p-3 bg-destructive/5 rounded-lg text-sm overflow-auto whitespace-pre-wrap font-mono">
                        {initError}
                    </pre>
                    <button 
                        onClick={() => window.location.reload()}
                        className="mt-6 w-full bg-destructive text-destructive-foreground py-2 rounded-xl font-medium hover:opacity-90 transition-opacity"
                    >
                        Retry Loading
                    </button>
                </div>
            </div>
        );
    }

    if (isInitializing) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-background gap-4">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <p className="text-muted-foreground font-medium animate-pulse">Initializing local storage...</p>
            </div>
        );
    }

    return (
        <StrictMode>
            <ThemeProvider>
                <App />
            </ThemeProvider>
        </StrictMode>
    );
}

createRoot(document.getElementById("root")!).render(<Root />)
