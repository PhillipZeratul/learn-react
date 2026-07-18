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
    const tenMins = [10, 20, 40, 50]

    useEffect(() => {
        if (!containerRef.current) return

        const dispose = effect(() => {
            const ppm = pixelsPerMinuteSignal.value
            const zoom = zoomLevelSignal.value

            const halfOpacity = Math.max(0, Math.min(1, (zoom - 2) * 2))
            const tenOpacity = Math.max(0, Math.min(1, (zoom - 4) * 2))

            if (containerRef.current) {
                const style = containerRef.current.style
                style.setProperty("--ppm", ppm.toString())
                style.setProperty("--half-opacity", halfOpacity.toString())
                style.setProperty(
                    "--half-display",
                    halfOpacity > 0 ? "block" : "none"
                )
                style.setProperty("--ten-opacity", tenOpacity.toString())
                style.setProperty(
                    "--ten-display",
                    tenOpacity > 0 ? "block" : "none"
                )
            }
        })

        return () => dispose()
    }, [daysToRender])

    return (
        <div
            ref={containerRef}
            className="pointer-events-none absolute inset-0"
            // Set initial variables so it renders correctly before effect runs
            style={
                {
                    "--ppm": pixelsPerMinuteSignal.peek().toString(),
                    "--half-opacity": Math.max(
                        0,
                        Math.min(1, (zoomLevelSignal.peek() - 2) * 2)
                    ).toString(),
                    "--half-display":
                        zoomLevelSignal.peek() > 2 ? "block" : "none",
                    "--ten-opacity": Math.max(
                        0,
                        Math.min(1, (zoomLevelSignal.peek() - 4) * 2)
                    ).toString(),
                    "--ten-display":
                        zoomLevelSignal.peek() > 4 ? "block" : "none",
                } as React.CSSProperties
            }
        >
            <GridLines />

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
                        if (isMidnight && i > 0 && i < totalHours) {
                            const d = new Date(baseDate || new Date())
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
                                key={`grid-label-hour-${i}`}
                                className="grid-time-label-hour absolute left-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center font-mono text-xs text-muted-foreground select-none"
                                style={{
                                    top: `calc(${i * 60} * var(--ppm) * 1px + ${TOP_MARGIN}px)`,
                                }}
                            >
                                {isMidnight && dateStr && i < totalHours && (
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
                                key={`grid-label-half-${i}`}
                                className="grid-time-label-half absolute left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 font-mono text-[10px] text-muted-foreground/60 select-none"
                                style={{
                                    top: `calc(${i * 60 + 30} * var(--ppm) * 1px + ${TOP_MARGIN}px)`,
                                    opacity: "var(--half-opacity)",
                                    display: "var(--half-display)",
                                }}
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
                        const minute = tenMins[i % 4]
                        const localHour = hour % 24
                        return (
                            <div
                                key={`grid-label-ten-${i}`}
                                className="grid-time-label-ten absolute left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 font-mono text-[9px] text-muted-foreground/40 select-none"
                                style={{
                                    top: `calc(${hour * 60 + minute} * var(--ppm) * 1px + ${TOP_MARGIN}px)`,
                                    opacity: "var(--ten-opacity)",
                                    display: "var(--ten-display)",
                                }}
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

const GridLines = () => {
    const ppm = pixelsPerMinuteSignal.value
    const zoom = zoomLevelSignal.value

    const halfOpacity = Math.max(0, Math.min(1, (zoom - 2) * 2))
    const tenOpacity = Math.max(0, Math.min(1, (zoom - 4) * 2))

    return (
        <svg
            className="pointer-events-none absolute inset-x-0 h-full w-full"
            style={{
                top: `${TOP_MARGIN}px`,
                height: `calc(100% - ${TOP_MARGIN}px)`,
            }}
        >
            <defs>
                <pattern
                    id="grid-hour"
                    width="8"
                    height={60 * ppm}
                    patternUnits="userSpaceOnUse"
                >
                    <line
                        x1="0"
                        y1="0"
                        x2="100%"
                        y2="0"
                        stroke="currentColor"
                        strokeDasharray="4 4"
                        strokeWidth="1"
                        className="text-muted-foreground/30"
                    />
                </pattern>
                <pattern
                    id="grid-half"
                    width="4"
                    height={60 * ppm}
                    patternUnits="userSpaceOnUse"
                >
                    <line
                        x1="0"
                        y1={30 * ppm}
                        x2="100%"
                        y2={30 * ppm}
                        stroke="currentColor"
                        strokeDasharray="2 2"
                        strokeWidth="1"
                        className="text-muted-foreground/25"
                    />
                </pattern>
                <pattern
                    id="grid-ten"
                    width="4"
                    height={60 * ppm}
                    patternUnits="userSpaceOnUse"
                >
                    <line
                        x1="0"
                        y1={10 * ppm}
                        x2="100%"
                        y2={10 * ppm}
                        stroke="currentColor"
                        strokeDasharray="2 2"
                        strokeWidth="1"
                        className="text-muted-foreground/20"
                    />
                    <line
                        x1="0"
                        y1={20 * ppm}
                        x2="100%"
                        y2={20 * ppm}
                        stroke="currentColor"
                        strokeDasharray="2 2"
                        strokeWidth="1"
                        className="text-muted-foreground/20"
                    />
                    <line
                        x1="0"
                        y1={40 * ppm}
                        x2="100%"
                        y2={40 * ppm}
                        stroke="currentColor"
                        strokeDasharray="2 2"
                        strokeWidth="1"
                        className="text-muted-foreground/20"
                    />
                    <line
                        x1="0"
                        y1={50 * ppm}
                        x2="100%"
                        y2={50 * ppm}
                        stroke="currentColor"
                        strokeDasharray="2 2"
                        strokeWidth="1"
                        className="text-muted-foreground/20"
                    />
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-hour)" />
            {halfOpacity > 0 && (
                <rect
                    width="100%"
                    height="100%"
                    fill="url(#grid-half)"
                    style={{ opacity: halfOpacity }}
                />
            )}
            {tenOpacity > 0 && (
                <rect
                    width="100%"
                    height="100%"
                    fill="url(#grid-ten)"
                    style={{ opacity: tenOpacity }}
                />
            )}
        </svg>
    )
}
