import { useEffect, useRef } from "react"
import { effect } from "@preact/signals-react"
import { TOP_MARGIN } from "../utils/utils"
import { pixelsPerMinuteSignal } from "../stores/zoom.store"

interface TimeTrackerActionButtonProps {
    onAction: () => void
    isCurrentDay: boolean
    currentTime: Date
    baseDate: Date
    hasActiveTasks: boolean
}

export const TimeTrackerActionButton = ({
    onAction,
    isCurrentDay,
    currentTime,
    baseDate,
    hasActiveTasks,
}: TimeTrackerActionButtonProps) => {
    const buttonRef = useRef<HTMLDivElement>(null)

    const currentMinutes = (currentTime.getTime() - baseDate.getTime()) / 60000

    useEffect(() => {
        if (!isCurrentDay || !buttonRef.current) return

        const dispose = effect(() => {
            const ppm = pixelsPerMinuteSignal.value
            if (buttonRef.current) {
                // Positioned below the 60px ghost extension (60 + 24 spacing)
                buttonRef.current.style.top = `${currentMinutes * ppm + TOP_MARGIN + 80}px`
            }
        })

        return () => dispose()
    }, [isCurrentDay, currentMinutes])

    if (!isCurrentDay) return null

    return (
        <div
            ref={buttonRef}
            className="pointer-events-none absolute right-0 left-0 z-30 flex justify-center"
            style={{
                transform: "scaleY(var(--inverse-preview-scale-y, 1))",
                transformOrigin: "center",
            }}
        >
            <button
                onClick={(e) => {
                    e.stopPropagation()
                    onAction()
                }}
                className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[10px] font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-[background-color,color,transform] hover:bg-primary/90 active:scale-95"
            >
                <div className="h-2 w-2 rounded-full bg-white/50" />
                {hasActiveTasks ? "PARALLEL" : "BEGIN"}
            </button>
        </div>
    )
}
