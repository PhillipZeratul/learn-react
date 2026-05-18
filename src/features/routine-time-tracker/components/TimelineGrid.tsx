import { useEffect, useRef } from "react"
import { effect } from "@preact/signals-react"
import { TOP_MARGIN } from "../utils/utils"
import { pixelsPerMinuteSignal } from "../stores/zoom.store"

export const TimelineGrid = () => {
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!containerRef.current) return

        const dispose = effect(() => {
            const ppm = pixelsPerMinuteSignal.value
            const container = containerRef.current
            if (!container) return

            const lines = container.querySelectorAll<HTMLElement>(".grid-line")
            const labels =
                container.querySelectorAll<HTMLElement>(".grid-time-label")

            lines.forEach((line, hour) => {
                line.style.top = `${hour * 60 * ppm + TOP_MARGIN}px`
            })

            labels.forEach((label, hour) => {
                label.style.top = `${hour * 60 * ppm + TOP_MARGIN}px`
            })
        })

        return () => dispose()
    }, [])

    return (
        <div
            ref={containerRef}
            className="pointer-events-none absolute inset-0"
        >
            {[...Array(25)].map((_, hour) => (
                <div
                    key={`grid-line-hour-${hour}`}
                    className="grid-line absolute right-0 left-0 -translate-y-1/2 border-t border-dashed border-border"
                />
            ))}
            <div className="absolute inset-0 flex">
                <div className="flex-1" /> {/* Left spacer */}
                <div className="relative flex h-full w-fit flex-col items-center">
                    <div className="invisible px-2 font-mono text-xs select-none">
                        00:00
                    </div>
                    {[...Array(25)].map((_, hour) => (
                        <div
                            key={`grid-time-hour-${hour}`}
                            className="grid-time-label absolute left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground"
                        >
                            <span className="pointer-events-auto bg-background px-2 tabular-nums">
                                {String(hour).padStart(2, "0")}:00
                            </span>
                        </div>
                    ))}
                </div>
                <div className="flex-1" /> {/* Right spacer */}
            </div>
        </div>
    )
}
