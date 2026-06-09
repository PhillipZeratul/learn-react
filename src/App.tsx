import { useState } from "react"
import RoutineTimeTrackerWidget from "@/features/routine-time-tracker/components/RoutineTimeTrackerWidget"
import { Auth } from "@/features/auth/components/Auth"
import { useAuthStore } from "@/features/auth/stores/auth.store"
import { SettingsMenu } from "@/features/settings/components/SettingsMenu"
import { Button } from "@/components/ui/Button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Settings02Icon, CodeIcon } from "@hugeicons/core-free-icons"
import { WebGLTestPage } from "@/features/webgl-test/components/WebGLTestPage"
export default function App() {
    const user = useAuthStore((state) => state.user)
    const isSyncing = useAuthStore((state) => state.isSyncing)
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const [showTestPage, setShowTestPage] = useState(true)

    if (!user) {
        return (
            <div className="flex h-svh w-full items-center justify-center bg-background p-4">
                <Auth />
            </div>
        )
    }

    if (showTestPage) {
        return <WebGLTestPage onExit={() => setShowTestPage(false)} />
    }

    return (
        <div className="relative flex h-svh w-full justify-center overflow-hidden">
            <RoutineTimeTrackerWidget />

            <div className="absolute top-14 right-4 z-40 flex flex-col gap-3">
                <Button
                    variant="secondary"
                    size="icon"
                    className="size-12 rounded-full border border-border bg-background/80 shadow-lg backdrop-blur-sm transition-transform hover:scale-105"
                    onClick={() => setShowTestPage(true)}
                    title="WebGL Test Page"
                >
                    <HugeiconsIcon icon={CodeIcon} size={24} />
                </Button>
                <Button
                    variant="secondary"
                    size="icon"
                    className="size-12 rounded-full border border-border bg-background/80 shadow-lg backdrop-blur-sm transition-transform hover:scale-105"
                    onClick={() => setIsSettingsOpen(true)}
                >
                    <HugeiconsIcon icon={Settings02Icon} size={24} />
                </Button>
            </div>

            {isSyncing && (
                <div className="fixed bottom-6 left-6 z-[100] flex animate-in items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 shadow-lg backdrop-blur-md duration-300 fade-in slide-in-from-bottom-2">
                    <div className="size-3 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                    <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                        Syncing
                    </span>
                </div>
            )}

            {isSettingsOpen && (
                <SettingsMenu onClose={() => setIsSettingsOpen(false)} />
            )}
        </div>
    )
}
