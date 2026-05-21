import { TagManager } from "./TagManager"
import { Button } from "@/components/ui/Button"
import { HugeiconsIcon } from "@hugeicons/react"
import {
    Cancel01Icon,
    Sun01Icon,
    Moon02Icon,
    ComputerIcon,
    Logout01Icon,
} from "@hugeicons/core-free-icons"
import { useBackAction } from "@/hooks/useBackAction"
import { useTheme } from "@/components/ThemeProvider"
import { useAuthStore } from "@/features/auth/stores/auth.store"
import { supabase } from "@/lib/supabase"

interface SettingsMenuProps {
    onClose: () => void
}

export const SettingsMenu = ({ onClose }: SettingsMenuProps) => {
    useBackAction(onClose, true)
    const { theme, setTheme } = useTheme()
    const user = useAuthStore((state) => state.user)
    const signOut = useAuthStore((state) => state.signOut)

    const handleLogout = async () => {
        try {
            if (supabase) {
                await supabase.auth.signOut()
            }
        } catch (err) {
            console.error("Failed to sign out from Supabase:", err)
        }
        signOut()
        onClose()
    }

    return (
        <div className="fixed inset-0 z-[100] flex animate-in items-center justify-center bg-background/85 p-4 backdrop-blur-md duration-200 fade-in">
            <div className="flex max-h-[90vh] w-full max-w-lg animate-in flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl duration-200 zoom-in-95">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border/80 bg-muted/20 px-6 py-4">
                    <h2 className="font-heading text-xl font-semibold text-foreground">
                        Settings
                    </h2>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="rounded-full hover:bg-muted"
                    >
                        <HugeiconsIcon icon={Cancel01Icon} size={20} />
                    </Button>
                </div>

                {/* Content */}
                <div className="flex-1 space-y-6 overflow-y-auto p-6">
                    {/* Section: Theme */}
                    <div className="space-y-3">
                        <div>
                            <h3 className="text-sm font-semibold tracking-wide text-foreground uppercase">
                                Theme
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                Personalize your workspace appearance.
                            </p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border/40 bg-muted/40 p-1.5">
                            {(["light", "dark", "system"] as const).map((t) => {
                                const isActive = theme === t
                                const label =
                                    t.charAt(0).toUpperCase() + t.slice(1)
                                const icon =
                                    t === "light"
                                        ? Sun01Icon
                                        : t === "dark"
                                          ? Moon02Icon
                                          : ComputerIcon

                                return (
                                    <button
                                        key={t}
                                        onClick={() => setTheme(t)}
                                        className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition-all duration-200 ${
                                            isActive
                                                ? "scale-[1.02] border border-border/30 bg-background text-primary shadow-sm"
                                                : "text-muted-foreground hover:bg-background/40 hover:text-foreground"
                                        }`}
                                    >
                                        <HugeiconsIcon icon={icon} size={16} />
                                        <span>{label}</span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <hr className="border-border/40" />

                    {/* Section: Tags */}
                    <div className="space-y-3">
                        <div>
                            <h3 className="text-sm font-semibold tracking-wide text-foreground uppercase">
                                Tags Management
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                Manage and customize your routine classification
                                tags.
                            </p>
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
                            <TagManager />
                        </div>
                    </div>

                    <hr className="border-border/40" />

                    {/* Section: Account */}
                    {user && (
                        <div className="space-y-3">
                            <div>
                                <h3 className="text-sm font-semibold tracking-wide text-foreground uppercase">
                                    Account
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    Manage your active session.
                                </p>
                            </div>
                            <div className="flex flex-col justify-between gap-4 rounded-2xl border border-border/60 bg-muted/10 p-5 sm:flex-row sm:items-center">
                                <div className="space-y-0.5">
                                    <span className="text-xs font-medium text-muted-foreground">
                                        Logged in as
                                    </span>
                                    <p className="truncate text-sm font-bold text-foreground">
                                        {user.email}
                                    </p>
                                </div>
                                <Button
                                    variant="destructive"
                                    onClick={handleLogout}
                                    className="flex items-center justify-center gap-2 rounded-xl px-4 py-2 shadow-md transition-transform hover:scale-[1.02]"
                                >
                                    <HugeiconsIcon
                                        icon={Logout01Icon}
                                        size={18}
                                    />
                                    <span>Log Out</span>
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
