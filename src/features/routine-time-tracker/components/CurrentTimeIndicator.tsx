import { useEffect, useRef } from "react"
import { effect } from "@preact/signals-react"
import { TOP_MARGIN } from "../utils/utils"
import { pixelsPerMinuteSignal } from "../stores/zoom.store"

export const CurrentTimeIndicator = ({
    isCurrentDay,
    currentTime,
}: {
    isCurrentDay: boolean
    currentTime: Date
}) => {
    const indicatorRef = useRef<HTMLDivElement>(null)

    const currentMinutes =
        currentTime.getHours() * 60 +
        currentTime.getMinutes() +
        currentTime.getSeconds() / 60 +
        currentTime.getMilliseconds() / 60000
    const currentTimeString = currentTime.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    })

    useEffect(() => {
        if (!isCurrentDay || !indicatorRef.current) return

        const dispose = effect(() => {
            const ppm = pixelsPerMinuteSignal.value
            if (indicatorRef.current) {
                indicatorRef.current.style.top = `${currentMinutes * ppm + TOP_MARGIN}px`
            }
        })

        return () => dispose()
    }, [isCurrentDay, currentMinutes])

    if (!isCurrentDay) return null

    return (
        <div
            ref={indicatorRef}
            className="pointer-events-none absolute right-0 left-0 z-20 flex -translate-y-1/2 items-center justify-center"
        >
            <div className="w-full border-t-2 border-primary/50" />
            <span className="absolute rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow-lg">
                {currentTimeString}
            </span>
        </div>
    )
}
