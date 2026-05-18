import { useEffect, useRef } from "react"
import { effect } from "@preact/signals-react"
import { TOP_MARGIN } from "../utils/utils"
import { pixelsPerMinuteSignal, zoomLevelSignal } from "../stores/zoom.store"

export const TimelineGrid = () => {
    const containerRef = useRef<HTMLDivElement>(null)
    const elementsRef = useRef<{
        hourLines: HTMLElement[]
        hourLabels: HTMLElement[]
        halfLines: HTMLElement[]
        halfLabels: HTMLElement[]
        tenLines: HTMLElement[]
        tenLabels: HTMLElement[]
    } | null>(null)

    useEffect(() => {
        if (!containerRef.current) return

        // Initial cache
        const container = containerRef.current
        elementsRef.current = {
            hourLines: Array.from(
                container.querySelectorAll<HTMLElement>(".grid-line-hour")
            ),
            hourLabels: Array.from(
                container.querySelectorAll<HTMLElement>(".grid-time-label-hour")
            ),
            halfLines: Array.from(
                container.querySelectorAll<HTMLElement>(".grid-line-half")
            ),
            halfLabels: Array.from(
                container.querySelectorAll<HTMLElement>(".grid-time-label-half")
            ),
            tenLines: Array.from(
                container.querySelectorAll<HTMLElement>(".grid-line-ten")
            ),
            tenLabels: Array.from(
                container.querySelectorAll<HTMLElement>(".grid-time-label-ten")
            ),
        }

        const dispose = effect(() => {
            const ppm = pixelsPerMinuteSignal.value
            const zoom = zoomLevelSignal.value
            const cached = elementsRef.current
            if (!cached) return

            // 1. Update Hour Markers (Always visible)
            cached.hourLines.forEach((line, hour) => {
                line.style.top = `${hour * 60 * ppm + TOP_MARGIN}px`
            })
            cached.hourLabels.forEach((label, hour) => {
                label.style.top = `${hour * 60 * ppm + TOP_MARGIN}px`
            })

            // 2. Update Half-Hour Markers (Visible if zoom > 2x)
            const halfOpacity = Math.max(0, Math.min(1, (zoom - 2) * 2))
            cached.halfLines.forEach((line, i) => {
                const hour = Math.floor(i)
                line.style.top = `${(hour * 60 + 30) * ppm + TOP_MARGIN}px`
                line.style.opacity = halfOpacity.toString()
                line.style.display = halfOpacity > 0 ? "block" : "none"
            })
            cached.halfLabels.forEach((label, i) => {
                const hour = Math.floor(i)
                label.style.top = `${(hour * 60 + 30) * ppm + TOP_MARGIN}px`
                label.style.opacity = halfOpacity.toString()
                label.style.display = halfOpacity > 0 ? "block" : "none"
            })

            // 3. Update 10-Minute Markers (Visible if zoom > 4x)
            const tenOpacity = Math.max(0, Math.min(1, (zoom - 4) * 2))
            cached.tenLines.forEach((line, i) => {
                const hour = Math.floor(i / 5)
                const tenMin = ((i % 5) + 1) * 10
                if (tenMin === 30) {
                    line.style.display = "none"
                    return
                }
                line.style.top = `${(hour * 60 + tenMin) * ppm + TOP_MARGIN}px`
                line.style.opacity = tenOpacity.toString()
                line.style.display = tenOpacity > 0 ? "block" : "none"
            })
            cached.tenLabels.forEach((label, i) => {
                const hour = Math.floor(i / 5)
                const tenMin = ((i % 5) + 1) * 10
                if (tenMin === 30) {
                    label.style.display = "none"
                    return
                }
                label.style.top = `${(hour * 60 + tenMin) * ppm + TOP_MARGIN}px`
                label.style.opacity = tenOpacity.toString()
                label.style.display = tenOpacity > 0 ? "block" : "none"
            })
        })

        return () => dispose()
    }, [])

    return (
        <div
            ref={containerRef}
            className="pointer-events-none absolute inset-0"
        >
            {/* Grid Lines */}
            {[...Array(25)].map((_, hour) => (
                <div
                    key={`grid-line-hour-${hour}`}
                    className="grid-line-hour absolute right-0 left-0 -translate-y-1/2 border-t border-dashed border-muted-foreground/30"
                />
            ))}

            {[...Array(24)].map((_, hour) => (
                <div
                    key={`grid-line-half-${hour}`}
                    className="grid-line-half absolute right-0 left-0 -translate-y-1/2 border-t border-dotted border-muted-foreground/20"
                />
            ))}

            {[...Array(24 * 6)].map((_, i) => (
                <div
                    key={`grid-line-ten-${i}`}
                    className="grid-line-ten absolute right-0 left-0 -translate-y-1/2 border-t border-dotted border-muted-foreground/10"
                />
            ))}

            {/* Time Labels */}
            <div className="absolute inset-0 flex">
                <div className="flex-1" /> {/* Left spacer */}
                <div className="relative flex h-full w-fit flex-col items-center">
                    <div className="invisible px-2 font-mono text-xs select-none">
                        00:00
                    </div>

                    {/* Hour Labels */}
                    {[...Array(25)].map((_, hour) => (
                        <div
                            key={`grid-time-label-hour-${hour}`}
                            className="grid-time-label-hour absolute left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground"
                        >
                            <span className="pointer-events-auto bg-background px-2 tabular-nums">
                                {String(hour).padStart(2, "0")}:00
                            </span>
                        </div>
                    ))}

                    {/* Half-Hour Labels */}
                    {[...Array(24)].map((_, hour) => (
                        <div
                            key={`grid-time-label-half-${hour}`}
                            className="grid-time-label-half absolute left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 font-mono text-[9px] text-muted-foreground/70"
                        >
                            <span className="pointer-events-auto bg-background px-1.5 tabular-nums">
                                {String(hour).padStart(2, "0")}:30
                            </span>
                        </div>
                    ))}

                    {/* 10-Minute Labels */}
                    {[...Array(24 * 6)].map((_, i) => {
                        const hour = Math.floor(i / 5)
                        const tenMin = ((i % 5) + 1) * 10
                        if (tenMin === 30) return null
                        return (
                            <div
                                key={`grid-time-label-ten-${i}`}
                                className="grid-time-label-ten absolute left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 font-mono text-[8px] text-muted-foreground/50"
                            >
                                <span className="pointer-events-auto bg-background px-1 tabular-nums">
                                    {String(hour).padStart(2, "0")}:
                                    {String(tenMin).padStart(2, "0")}
                                </span>
                            </div>
                        )
                    })}
                </div>
                <div className="flex-1" /> {/* Right spacer */}
            </div>
        </div>
    )
}
