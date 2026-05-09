import { useState } from 'react'
import RoutineTimeTrackerWidget from "@/features/routine-time-tracker/components/RoutineTimeTrackerWidget"
import { Auth } from "@/features/auth/components/Auth"
import { useAuthStore } from "@/features/auth/stores/auth.store"
import { SettingsMenu } from "@/features/settings/components/SettingsMenu"
import { Button } from "@/components/ui/Button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Settings02Icon } from "@hugeicons/core-free-icons"

export function App() {
    const user = useAuthStore(state => state.user);
    const isSyncing = useAuthStore(state => state.isSyncing);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    if (!user) {
        return (
            <div className="h-svh w-full flex items-center justify-center bg-background p-4">
                <Auth />
            </div>
        );
    }

    return (
        <div className="h-svh w-full overflow-hidden flex justify-center relative">
            <RoutineTimeTrackerWidget/>
            
            <div className="absolute top-14 right-4 z-40">
                <Button 
                    variant="secondary" 
                    size="icon" 
                    className="rounded-full shadow-lg h-12 w-12 hover:scale-105 transition-transform bg-background/80 backdrop-blur-sm border border-border"
                    onClick={() => setIsSettingsOpen(true)}
                >
                    <HugeiconsIcon icon={Settings02Icon} size={24} />
                </Button>
            </div>

            {isSyncing && (
                <div className="fixed bottom-6 left-6 z-50 flex items-center gap-2 bg-background/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-border shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="w-3 h-3 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Syncing</span>
                </div>
            )}

            {isSettingsOpen && (
                <SettingsMenu onClose={() => setIsSettingsOpen(false)} />
            )}
        </div>
    )
}

export default App
