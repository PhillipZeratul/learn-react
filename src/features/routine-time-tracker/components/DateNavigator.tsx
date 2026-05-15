import { Button } from "@/components/ui/Button"
import { HugeiconsIcon } from "@hugeicons/react"
import {
    ArrowLeft01Icon,
    ArrowRight01Icon,
    Calendar03Icon,
} from "@hugeicons/core-free-icons"

interface DateNavigatorProps {
    date: Date
    onDateChange: (d: Date) => void
}

export const DateNavigator = ({ date, onDateChange }: DateNavigatorProps) => {
    const isToday = new Date().toDateString() === date.toDateString()

    const changeDate = (days: number) => {
        const newDate = new Date(date)
        newDate.setDate(date.getDate() + days)
        onDateChange(newDate)
    }

    return (
        <div className="sticky top-0 z-40 flex items-center justify-between border-b bg-background px-4 py-2">
            <div className="flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => changeDate(-1)}
                    className="h-8 w-8"
                >
                    <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDateChange(new Date())}
                    className={`text-xs font-bold ${isToday ? "text-primary" : ""}`}
                >
                    {isToday
                        ? "TODAY"
                        : date.toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                          })}
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => changeDate(1)}
                    className="h-8 w-8"
                >
                    <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
                </Button>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
                <HugeiconsIcon icon={Calendar03Icon} size={16} />
                <span className="text-[10px] font-medium tracking-wider uppercase">
                    {date.toLocaleDateString(undefined, { weekday: "short" })}
                </span>
            </div>
        </div>
    )
}
