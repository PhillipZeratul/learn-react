import { useEffect, useRef } from "react"
import { effect } from "@preact/signals-react"
import { TOP_MARGIN } from "../utils/utils"
import { pixelsPerMinuteSignal } from "../stores/zoom.store"

interface TimeTrackerActionButtonProps {
    onAction: () => void
    isCurrentDay: boolean
    currentTime: Date
}

export const TimeTrackerActionButton = ({
    onAction,
    isCurrentDay,
    currentTime,
}: TimeTrackerActionButtonProps) => {
    const buttonRef = useRef<HTMLDivElement>(null)

    const currentMinutes =
        currentTime.getHours() * 60 +
        currentTime.getMinutes() +
        currentTime.getSeconds() / 60 +
        currentTime.getMilliseconds() / 60000

    useEffect(() => {
        if (!isCurrentDay || !buttonRef.current) return

        const dispose = effect(() => {
            const ppm = pixelsPerMinuteSignal.value
            if (buttonRef.current) {
                // Positioned below the 60px ghost extension (60 + 24 spacing)
                buttonRef.current.style.top = `${currentMinutes * ppm + TOP_MARGIN + 84}px`
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
                className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[10px] font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-[background-color,color,transform] hover:bg-primary/90 active:scale-95"
            >
                <div className="h-2 w-2 rounded-full bg-white/50" />
                BEGIN
            </button>
        </div>
    )
}
