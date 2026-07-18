import { Button } from "@/components/ui/Button"
import { HugeiconsIcon } from "@hugeicons/react"
import {
    ArrowLeft01Icon,
    ArrowRight01Icon,
    Calendar03Icon,
} from "@hugeicons/core-free-icons"

interface DateNavigatorProps {
    date: Date
    onNavigate: (days: number) => void
    onGoToToday: () => void
}

export const DateNavigator = ({
    date,
    onNavigate,
    onGoToToday,
}: DateNavigatorProps) => {
    const isToday = new Date().toDateString() === date.toDateString()

    return (
        <div className="sticky top-0 z-40 flex h-[52px] items-center justify-between border-b bg-background px-4">
            <div className="flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onNavigate(-1)}
                    className="size-8"
                >
                    <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onGoToToday}
                    className={`flex h-auto w-28 flex-col py-1 text-xs font-bold ${isToday ? "text-primary" : ""}`}
                    suppressHydrationWarning
                >
                    {isToday ? (
                        <>
                            <span>TODAY</span>
                            <span>
                                {date.toLocaleDateString(undefined, {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                })}
                            </span>
                        </>
                    ) : (
                        date.toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                        })
                    )}
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onNavigate(1)}
                    className="size-8"
                >
                    <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
                </Button>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
                <HugeiconsIcon icon={Calendar03Icon} size={16} />
                <span
                    className="w-8 text-left text-[10px] font-medium tracking-wider uppercase"
                    suppressHydrationWarning
                >
                    {date.toLocaleDateString(undefined, { weekday: "short" })}
                </span>
            </div>
        </div>
    )
}
