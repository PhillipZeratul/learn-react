import React, { useRef, useEffect, memo } from "react"
import { effect } from "@preact/signals-react"
import {
    isoToTime,
    timeToISO,
    TOP_MARGIN,
    getDurationString,
} from "../utils/utils"
import { getAbsoluteBounds } from "../utils/time-coordinates"
import type { RoutineCard } from "../models/routine-card.model"
import type { TimeTrackerCard } from "../models/time-tracker-card.model"
import type { TimeTrackerCardId } from "../models/routine-time-tracker.model"
import {
    dragTopSignal,
    dragHeightSignal,
    dragOverridesSignal,
    dragLeftSignal,
} from "../stores/drag.store"
import { pixelsPerMinuteSignal } from "../stores/zoom.store"

interface TaskCardProps {
    card: RoutineCard | TimeTrackerCard
    type: "routine" | "timeTracker"
    isDragging: boolean
    isActive?: boolean
    getTagColor: (tagId: string) => string
    getTagName: (tagId: string) => string
    onPress: (
        e: React.MouseEvent | React.TouchEvent,
        type: "routine" | "timeTracker",
        card: RoutineCard | TimeTrackerCard
    ) => void
    onClick: (
        type: "routine" | "timeTracker",
        card: RoutineCard | TimeTrackerCard
    ) => void
    onStop?: (id: TimeTrackerCardId) => void
    baseDate: Date
    layoutLeft?: string
    layoutWidth?: string
    daysToRender: number
}

export const TaskCard = memo(
    ({
        card,
        type,
        isDragging,
        isActive = false,
        getTagColor,
        getTagName,
        onPress,
        onClick,
        onStop,
        baseDate,
        layoutLeft,
        layoutWidth,
        daysToRender,
    }: TaskCardProps) => {
        const cardRef = useRef<HTMLDivElement>(null)
        const timeRef = useRef<HTMLDivElement>(null)
        const durationRef = useRef<HTMLDivElement>(null)
        const solidBgRef = useRef<HTMLDivElement>(null)

        const { startMin: rawStartMin, duration: rawDuration } =
            getAbsoluteBounds(card.start_at, card.end_at, baseDate)

        const isStartClipped = rawStartMin < 0
        const isEndClipped = rawStartMin + rawDuration > daysToRender * 24 * 60

        const startMin = Math.max(0, rawStartMin)
        const duration = Math.max(
            0,
            Math.min(
                rawDuration - (startMin - rawStartMin),
                daysToRender * 24 * 60 - startMin
            )
        )
        const realStart = new Date(card.start_at).getTime()
        const realEnd = card.end_at
            ? new Date(card.end_at).getTime()
            : new Date().getTime()
        const realDurationMinutes = Math.max(0, (realEnd - realStart) / 60000)

        const GHOST_EXTENSION_PX = 60
        const isCurrentlyTracking = isActive || !card.end_at

        const initialHeightCalc = `calc(var(--duration) * var(--ppm) * 1px)`
        const initialTotalHeightCalc = isCurrentlyTracking
            ? `calc(var(--duration) * var(--ppm) * 1px + ${GHOST_EXTENSION_PX}px)`
            : initialHeightCalc
        const maskImageCalc = `linear-gradient(to bottom, black 0%, black ${initialHeightCalc}, transparent ${initialTotalHeightCalc})`
        const initialTransform = `translateY(calc(var(--start-min) * var(--ppm) * 1px + ${TOP_MARGIN}px))`

        useEffect(() => {
            const dispose = effect(() => {
                const container = cardRef.current
                if (!container) return

                const override = dragOverridesSignal.value[card.id]
                const activeDrag = isDragging || !!override

                if (activeDrag) {
                    const ppm = pixelsPerMinuteSignal.value
                    const dragHeight = override
                        ? override.height
                        : dragHeightSignal.value
                    const top = override ? override.top : dragTopSignal.value
                    const leftOffset = isDragging ? dragLeftSignal.value : 0

                    Object.assign(container.style, {
                        transform: `translate(${leftOffset}px, ${top}px)`,
                        height: `${dragHeight}px`,
                        webkitMaskImage: "",
                        maskImage: "",
                        zIndex: isDragging ? "50" : "40",
                    })

                    if (!isDragging) {
                        container.classList.add(
                            "ring-1",
                            "ring-primary/40",
                            "shadow-lg",
                            "border-primary/30"
                        )
                    }

                    if (solidBgRef.current) {
                        solidBgRef.current.style.height = `${dragHeight}px`
                    }

                    if (timeRef.current) {
                        const currentStartMin =
                            Math.round((top - TOP_MARGIN) / ppm / 5) * 5
                        const currentEndMin =
                            Math.round(
                                (top + dragHeight - TOP_MARGIN) / ppm / 5
                            ) * 5

                        const formatMin = (m: number) => {
                            const localM = Math.max(0, m) % (24 * 60)
                            const h = Math.floor(localM / 60)
                            const mm = localM % 60
                            return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
                        }

                        timeRef.current.textContent = `${isoToTime(timeToISO(formatMin(currentStartMin), "2000-01-01"))} - ${isoToTime(timeToISO(formatMin(currentEndMin), "2000-01-01"))}`
                    }

                    if (durationRef.current) {
                        const activeRealDurationMinutes =
                            realDurationMinutes + (dragHeight / ppm - duration)
                        durationRef.current.textContent = `${getDurationString(activeRealDurationMinutes)}`
                    }
                } else {
                    container.classList.remove(
                        "ring-1",
                        "ring-primary/40",
                        "shadow-lg",
                        "border-primary/30"
                    )

                    Object.assign(container.style, {
                        transform: initialTransform,
                        height: initialTotalHeightCalc,
                        WebkitMaskImage: isCurrentlyTracking
                            ? maskImageCalc
                            : "",
                        maskImage: isCurrentlyTracking ? maskImageCalc : "",
                        zIndex: "10",
                    })

                    if (solidBgRef.current) {
                        solidBgRef.current.style.height = initialHeightCalc
                    }

                    if (timeRef.current) {
                        timeRef.current.textContent = `${isoToTime(card.start_at)} - ${card.end_at ? isoToTime(card.end_at) : "Now"}`
                    }

                    if (durationRef.current) {
                        durationRef.current.textContent = `${getDurationString(realDurationMinutes)}`
                    }
                }
            })

            return () => dispose()
        }, [
            isDragging,
            card,
            duration,
            realDurationMinutes,
            initialTransform,
            initialTotalHeightCalc,
            maskImageCalc,
            initialHeightCalc,
            isCurrentlyTracking,
        ])

        const handleKeyDown = (e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onClick(type, card)
            }
        }

        const baseClasses = `task-card tc-container absolute pointer-events-auto flex flex-col justify-start overflow-hidden`
        const idleClasses = isCurrentlyTracking
            ? "transition-shadow duration-200 hover:shadow-md cursor-pointer shadow-sm"
            : "transition-shadow duration-200 hover:shadow-md cursor-pointer shadow-sm border border-border bg-card/60"
        const draggingClasses =
            "z-50 ring-2 ring-primary border-primary shadow-xl opacity-90 cursor-grabbing backdrop-blur-sm rounded-xl"

        const currentRounding = `${
            isStartClipped ? "rounded-t-none border-t-0" : "rounded-t-xl"
        } ${isEndClipped ? "rounded-b-none border-b-0" : "rounded-b-xl"}`

        const defaultLeft = layoutLeft ?? "0.5rem"
        const defaultWidth = layoutWidth ?? "calc(100% - 1rem)"

        const leftStyle = defaultLeft
        const widthStyle = defaultWidth
        const zIndexStyle = isDragging ? 50 : 10
        const willChangeStyle = isDragging
            ? "transform, height, opacity"
            : undefined

        return (
            <div
                ref={cardRef}
                className={`${baseClasses} ${currentRounding} ${
                    isDragging ? draggingClasses : idleClasses
                }`}
                data-start-clamped={isStartClipped}
                data-end-clamped={isEndClipped}
                role="button"
                tabIndex={0}
                onKeyDown={handleKeyDown}
                style={
                    {
                        top: 0,
                        transform: isDragging ? undefined : initialTransform,
                        height: isDragging ? undefined : initialTotalHeightCalc,
                        left: leftStyle,
                        width: widthStyle,
                        zIndex: zIndexStyle,
                        willChange: willChangeStyle,
                        WebkitMaskImage:
                            isCurrentlyTracking && !isDragging
                                ? maskImageCalc
                                : undefined,
                        maskImage:
                            isCurrentlyTracking && !isDragging
                                ? maskImageCalc
                                : undefined,
                        "--start-min": startMin.toString(),
                        "--duration": duration.toString(),
                    } as React.CSSProperties
                }
                onMouseDown={(e) => onPress(e, type, card)}
                onTouchStart={(e) => onPress(e, type, card)}
                onClick={(e) => {
                    if (isCurrentlyTracking && !isDragging) {
                        const rect = e.currentTarget.getBoundingClientRect()
                        const relativeY = e.clientY - rect.top
                        const currentPpm = pixelsPerMinuteSignal.value
                        const currentSolidHeight = duration * currentPpm
                        if (relativeY > currentSolidHeight) {
                            onStop?.(card.id as TimeTrackerCardId)
                            return
                        }
                    }
                    onClick(type, card)
                }}
            >
                {/* Ghost Extension Layer (Rendered underneath solid part) */}
                {isCurrentlyTracking && !isDragging && (
                    <div
                        className="pointer-events-none absolute inset-x-0 h-15"
                        style={{ top: initialHeightCalc }}
                    >
                        <div
                            className="absolute inset-x-0 bg-primary/20"
                            style={{ height: "60px", top: 0 }}
                        />
                        {/* Tag color (handled by global mask) */}
                        <div
                            className="absolute top-0 bottom-0 left-0 w-1.5 opacity-80"
                            style={{
                                height: "60px",
                                backgroundColor: getTagColor(card.tag_id),
                            }}
                        />
                        {/* Scanning animation */}
                        <div className="animate-scan-down absolute inset-x-0 h-1 bg-primary/40 blur-[2px]" />
                    </div>
                )}

                {/* Solid Background Layer (Only active for tracking tasks) */}
                <div
                    ref={solidBgRef}
                    className={`absolute inset-x-0 top-0 overflow-hidden ${
                        isStartClipped ? "rounded-t-none" : "rounded-t-xl"
                    } ${
                        isCurrentlyTracking
                            ? "border-x border-t border-border bg-card/90"
                            : "bg-transparent"
                    }`}
                    style={{
                        height: isDragging ? undefined : initialHeightCalc,
                        borderTopColor: isStartClipped
                            ? "transparent"
                            : undefined,
                    }}
                />

                {/* Content Wrapper */}
                <div
                    className={`tc-content-wrapper absolute inset-x-0 top-0 bottom-0 z-10 flex flex-col justify-center px-3`}
                >
                    <div
                        className="absolute top-0 bottom-0 left-0 z-10 w-1.5"
                        style={{
                            backgroundColor: getTagColor(card.tag_id),
                        }}
                    />
                    <div
                        className={`tc-title shrink-0 truncate text-sm font-medium text-foreground`}
                    >
                        {card.title || getTagName(card.tag_id)}
                    </div>
                    <div
                        ref={timeRef}
                        className={`tc-time shrink-0 truncate text-[10px] text-muted-foreground tabular-nums`}
                    >
                        {`${isoToTime(card.start_at)} - ${card.end_at ? isoToTime(card.end_at) : "Now"}`}
                    </div>
                    <div
                        ref={durationRef}
                        className={`tc-duration shrink-0 truncate text-[10px] text-muted-foreground/80 tabular-nums`}
                    >
                        {`${getDurationString(realDurationMinutes)}`}
                    </div>
                </div>
            </div>
        )
    }
)
