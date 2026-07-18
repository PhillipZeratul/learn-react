import { useEffect, useRef } from "react"
import { effect } from "@preact/signals-react"
import { TOP_MARGIN } from "../utils/utils"
import { pixelsPerMinuteSignal, zoomLevelSignal } from "../stores/zoom.store"

interface TimelineGridProps {
    daysToRender: number
    baseDate?: Date
}

export const TimelineGrid = ({ daysToRender, baseDate }: TimelineGridProps) => {
    const containerRef = useRef<HTMLDivElement>(null)

    const totalHours = daysToRender * 24

    // Refs to avoid heavy querySelectors on every zoom
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
            cached.hourLines.forEach((line, i) => {
                line.style.top = `${i * 60 * ppm + TOP_MARGIN}px`
            })
            cached.hourLabels.forEach((label, i) => {
                label.style.top = `${i * 60 * ppm + TOP_MARGIN}px`
            })

            // 2. Update Half-Hour Markers (Visible if zoom > 2x)
            const halfOpacity = Math.max(0, Math.min(1, (zoom - 2) * 2))
            cached.halfLines.forEach((line, i) => {
                line.style.top = `${(i * 60 + 30) * ppm + TOP_MARGIN}px`
                line.style.opacity = halfOpacity.toString()
                line.style.display = halfOpacity > 0 ? "block" : "none"
            })
            cached.halfLabels.forEach((label, i) => {
                label.style.top = `${(i * 60 + 30) * ppm + TOP_MARGIN}px`
                label.style.opacity = halfOpacity.toString()
                label.style.display = halfOpacity > 0 ? "block" : "none"
            })

            // 3. Update 10-Minute Markers (Visible if zoom > 4x)
            const tenOpacity = Math.max(0, Math.min(1, (zoom - 4) * 2))
            const tenMins = [10, 20, 40, 50]
            cached.tenLines.forEach((line, i) => {
                const hour = Math.floor(i / 4)
                const minute = tenMins[i % 4]
                line.style.top = `${(hour * 60 + minute) * ppm + TOP_MARGIN}px`
                line.style.opacity = tenOpacity.toString()
                line.style.display = tenOpacity > 0 ? "block" : "none"
            })
            cached.tenLabels.forEach((label, i) => {
                const hour = Math.floor(i / 4)
                const minute = tenMins[i % 4]
                label.style.top = `${(hour * 60 + minute) * ppm + TOP_MARGIN}px`
                label.style.opacity = tenOpacity.toString()
                label.style.display = tenOpacity > 0 ? "block" : "none"
            })
        })

        return () => dispose()
    }, [daysToRender])

    return (
        <div
            ref={containerRef}
            className="pointer-events-none absolute inset-0"
        >
            {/* Grid Lines */}
            {[...Array(totalHours + 1)].map((_, i) => (
                <div
                    key={`grid-line-hour-${i}`}
                    className="grid-line-hour absolute right-0 left-0 -translate-y-1/2 border-t border-dashed border-muted-foreground/30"
                />
            ))}

            {[...Array(totalHours)].map((_, i) => (
                <div
                    key={`grid-line-half-${i}`}
                    className="grid-line-half absolute right-0 left-0 -translate-y-1/2 border-t border-dotted border-muted-foreground/25"
                />
            ))}

            {[...Array(totalHours * 4)].map((_, i) => (
                <div
                    key={`grid-line-ten-${i}`}
                    className="grid-line-ten absolute right-0 left-0 -translate-y-1/2 border-t border-dotted border-muted-foreground/20"
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
                    {[...Array(totalHours + 1)].map((_, i) => {
                        const localHour = i % 24
                        const isMidnight = localHour === 0

                        let dateStr = ""
                        let isTodayGrid = false
                        if (isMidnight && baseDate) {
                            const d = new Date(baseDate)
                            d.setDate(d.getDate() + Math.floor(i / 24))
                            dateStr = d.toLocaleDateString(undefined, {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                            })
                            isTodayGrid =
                                d.toDateString() === new Date().toDateString()
                        }

                        return (
                            <div
                                key={`grid-time-label-hour-${i}`}
                                className="grid-time-label-hour absolute left-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center font-mono text-xs text-muted-foreground"
                            >
                                {isMidnight && dateStr && (
                                    <span
                                        className={`pointer-events-auto absolute -top-5 rounded-md px-2 py-0.5 font-sans text-[10px] whitespace-nowrap backdrop-blur-sm ${
                                            isTodayGrid
                                                ? "bg-primary/20 font-bold text-primary"
                                                : "bg-background/80 font-semibold text-primary/80"
                                        }`}
                                    >
                                        {isTodayGrid
                                            ? `TODAY • ${dateStr}`
                                            : dateStr}
                                    </span>
                                )}
                                <span className="pointer-events-auto bg-background px-2 tabular-nums">
                                    {String(localHour).padStart(2, "0")}:00
                                </span>
                            </div>
                        )
                    })}

                    {/* Half-Hour Labels */}
                    {[...Array(totalHours)].map((_, i) => {
                        const localHour = i % 24
                        return (
                            <div
                                key={`grid-time-label-half-${i}`}
                                className="grid-time-label-half absolute left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground/80"
                            >
                                <span className="pointer-events-auto bg-background px-1.5 tabular-nums">
                                    {String(localHour).padStart(2, "0")}:30
                                </span>
                            </div>
                        )
                    })}

                    {/* 10-Minute Labels */}
                    {[...Array(totalHours * 4)].map((_, i) => {
                        const hour = Math.floor(i / 4)
                        const localHour = hour % 24
                        const minute = [10, 20, 40, 50][i % 4]
                        return (
                            <div
                                key={`grid-time-label-ten-${i}`}
                                className="grid-time-label-ten absolute left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground/60"
                            >
                                <span className="pointer-events-auto bg-background px-1 tabular-nums">
                                    {String(localHour).padStart(2, "0")}:
                                    {String(minute).padStart(2, "0")}
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
