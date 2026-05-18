import { useEffect, useRef } from "react"
import { effect } from "@preact/signals-react"
import { TOP_MARGIN } from "../utils/utils"
import { pixelsPerMinuteSignal } from "../stores/zoom.store"

interface TimeTrackerActionButtonProps {
    activeTimeTrackerId: string | null
    onAction: () => void
    isCurrentDay: boolean
    currentTime: Date
}

export const TimeTrackerActionButton = ({
    activeTimeTrackerId,
    onAction,
    isCurrentDay,
    currentTime,
}: TimeTrackerActionButtonProps) => {
    const buttonRef = useRef<HTMLDivElement>(null)

    const currentMinutes =
        currentTime.getHours() * 60 + currentTime.getMinutes()

    useEffect(() => {
        if (!isCurrentDay || !buttonRef.current) return

        const dispose = effect(() => {
            const ppm = pixelsPerMinuteSignal.value
            if (buttonRef.current) {
                buttonRef.current.style.top = `${currentMinutes * ppm + TOP_MARGIN + 24}px`
            }
        })

        return () => dispose()
    }, [isCurrentDay, currentMinutes])

    if (!isCurrentDay) return null

    return (
        <div
            ref={buttonRef}
            className="pointer-events-none absolute right-0 left-0 z-30 flex justify-center"
        >
            <button
                onClick={(e) => {
                    e.stopPropagation()
                    onAction()
                }}
                className={`pointer-events-auto flex items-center gap-1.5 rounded-full px-4 py-2 text-[10px] font-bold shadow-lg transition-[background-color,color,transform] active:scale-95 ${
                    activeTimeTrackerId
                        ? "text-destructive-foreground bg-destructive shadow-destructive/20 hover:bg-destructive/90"
                        : "bg-primary text-primary-foreground shadow-primary/20 hover:bg-primary/90"
                }`}
            >
                <div
                    className={`h-2 w-2 rounded-full ${activeTimeTrackerId ? "animate-pulse bg-white" : "bg-white/50"}`}
                />
                {activeTimeTrackerId ? "FINISH" : "BEGIN"}
            </button>
        </div>
    )
}
