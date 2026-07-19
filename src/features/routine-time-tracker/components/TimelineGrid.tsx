import { useEffect, useState } from "react"
import { effect } from "@preact/signals-react"
import { TOP_MARGIN } from "../utils/utils"
import { zoomLevelSignal } from "../stores/zoom.store"

interface TimelineGridProps {
    daysToRender: number
    baseDate?: Date
    /** Inclusive range of day indices whose labels should be mounted. */
    renderStartDay: number
    renderEndDay: number
}

/**
 * Zoom tier gating which label densities are mounted in the DOM (#9):
 *  - tier 0 (zoom <= 2): hour labels only
 *  - tier 1 (zoom  > 2): + half-hour labels
 *  - tier 2 (zoom  > 4): + 10-minute labels
 *
 * The opacity/display fade is still driven by CSS variables set on the
 * timeline container, so freshly mounted tiers fade in smoothly.
 */
const getZoomTier = (zoom: number) => (zoom > 4 ? 2 : zoom > 2 ? 1 : 0)

export const TimelineGrid = ({
    daysToRender,
    baseDate,
    renderStartDay,
    renderEndDay,
}: TimelineGridProps) => {
    const totalHours = daysToRender * 24
    const tenMins = [10, 20, 40, 50]

    const [zoomTier, setZoomTier] = useState(() =>
        getZoomTier(zoomLevelSignal.peek())
    )

    useEffect(() => {
        const dispose = effect(() => {
            const tier = getZoomTier(zoomLevelSignal.value)
            setZoomTier((prev) => (prev === tier ? prev : tier))
        })
        return () => dispose()
    }, [])

    const isDayRendered = (day: number) =>
        day >= renderStartDay && day <= renderEndDay

    return (
        <div className="pointer-events-none absolute inset-0">
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
                        // The final boundary label belongs to the last day
                        const day = Math.min(
                            Math.floor(i / 24),
                            daysToRender - 1
                        )
                        if (!isDayRendered(day)) return null

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
                                className="grid-time-label-hour absolute left-1/2 z-10 flex flex-col items-center justify-center font-mono text-xs text-muted-foreground select-none"
                                style={{
                                    top: `calc(${i * 60} * var(--ppm) * 1px + ${TOP_MARGIN}px)`,
                                    transform: `translate(-50%, -50%) scaleY(var(--inverse-preview-scale-y, 1))`,
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

                    {/* Half-Hour Labels (only mounted past zoom tier 1) */}
                    {zoomTier >= 1 &&
                        [...Array(totalHours)].map((_, i) => {
                            if (!isDayRendered(Math.floor(i / 24))) return null

                            const localHour = i % 24
                            return (
                                <div
                                    key={`grid-label-half-${i}`}
                                    className="grid-time-label-half absolute left-1/2 z-10 font-mono text-xs text-muted-foreground/60 select-none"
                                    style={{
                                        top: `calc(${i * 60 + 30} * var(--ppm) * 1px + ${TOP_MARGIN}px)`,
                                        transform: `translate(-50%, -50%) scaleY(var(--inverse-preview-scale-y, 1))`,
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

                    {/* 10-Minute Labels (only mounted past zoom tier 2) */}
                    {zoomTier >= 2 &&
                        [...Array(totalHours * 4)].map((_, i) => {
                            const hour = Math.floor(i / 4)
                            if (!isDayRendered(Math.floor(hour / 24)))
                                return null

                            const minute = tenMins[i % 4]
                            const localHour = hour % 24
                            return (
                                <div
                                    key={`grid-label-ten-${i}`}
                                    className="grid-time-label-ten absolute left-1/2 z-10 font-mono text-xs text-muted-foreground/60 select-none"
                                    style={{
                                        top: `calc(${hour * 60 + minute} * var(--ppm) * 1px + ${TOP_MARGIN}px)`,
                                        transform: `translate(-50%, -50%) scaleY(var(--inverse-preview-scale-y, 1))`,
                                        opacity: "var(--ten-opacity)",
                                        display: "var(--ten-display)",
                                    }}
                                >
                                    <span className="pointer-events-auto bg-background px-1.5 tabular-nums">
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
    return (
        <>
            {/* Hour lines */}
            <div
                className="pointer-events-none absolute inset-x-0 text-muted-foreground/30"
                style={{
                    top: `${TOP_MARGIN}px`,
                    bottom: 0,
                    backgroundImage: `repeating-linear-gradient(to bottom, 
                        currentColor 0, 
                        currentColor 1px, 
                        transparent 1px, 
                        transparent calc(60 * var(--ppm) * 1px)
                    )`,
                    maskImage: `repeating-linear-gradient(to right, black 0, black 4px, transparent 4px, transparent 8px)`,
                    WebkitMaskImage: `repeating-linear-gradient(to right, black 0, black 4px, transparent 4px, transparent 8px)`,
                }}
            />
            {/* Half-hour lines */}
            <div
                className="pointer-events-none absolute inset-x-0 text-muted-foreground/25"
                style={{
                    top: `${TOP_MARGIN}px`,
                    bottom: 0,
                    opacity: "var(--half-opacity)",
                    display: "var(--half-display)",
                    backgroundImage: `repeating-linear-gradient(to bottom, 
                        transparent 0, 
                        transparent calc(30 * var(--ppm) * 1px), 
                        currentColor calc(30 * var(--ppm) * 1px), 
                        currentColor calc(30 * var(--ppm) * 1px + 1px), 
                        transparent calc(30 * var(--ppm) * 1px + 1px), 
                        transparent calc(60 * var(--ppm) * 1px)
                    )`,
                    maskImage: `repeating-linear-gradient(to right, black 0, black 2px, transparent 2px, transparent 4px)`,
                    WebkitMaskImage: `repeating-linear-gradient(to right, black 0, black 2px, transparent 2px, transparent 4px)`,
                }}
            />
            {/* Ten-minute lines */}
            <div
                className="pointer-events-none absolute inset-x-0 text-muted-foreground/25"
                style={{
                    top: `${TOP_MARGIN}px`,
                    bottom: 0,
                    opacity: "var(--ten-opacity)",
                    display: "var(--ten-display)",
                    backgroundImage: `repeating-linear-gradient(to bottom, 
                        transparent 0,
                        transparent calc(10 * var(--ppm) * 1px),
                        currentColor calc(10 * var(--ppm) * 1px),
                        currentColor calc(10 * var(--ppm) * 1px + 1px),
                        
                        transparent calc(10 * var(--ppm) * 1px + 1px),
                        transparent calc(20 * var(--ppm) * 1px),
                        currentColor calc(20 * var(--ppm) * 1px),
                        currentColor calc(20 * var(--ppm) * 1px + 1px),
                        
                        transparent calc(20 * var(--ppm) * 1px + 1px),
                        transparent calc(40 * var(--ppm) * 1px),
                        currentColor calc(40 * var(--ppm) * 1px),
                        currentColor calc(40 * var(--ppm) * 1px + 1px),
                        
                        transparent calc(40 * var(--ppm) * 1px + 1px),
                        transparent calc(50 * var(--ppm) * 1px),
                        currentColor calc(50 * var(--ppm) * 1px),
                        currentColor calc(50 * var(--ppm) * 1px + 1px),
                        
                        transparent calc(50 * var(--ppm) * 1px + 1px),
                        transparent calc(60 * var(--ppm) * 1px)
                    )`,
                    maskImage: `repeating-linear-gradient(to right, black 0, black 2px, transparent 2px, transparent 4px)`,
                    WebkitMaskImage: `repeating-linear-gradient(to right, black 0, black 2px, transparent 2px, transparent 4px)`,
                }}
            />
        </>
    )
}
