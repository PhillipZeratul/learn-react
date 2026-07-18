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
import {
    dragTopSignal,
    dragHeightSignal,
    dragOverridesSignal,
    dragLeftSignal,
} from "../stores/drag.store"
import { pixelsPerMinuteSignal } from "../stores/zoom.store"

interface TaskCardProps {
    card: RoutineCard | TimeTrackerCard
    isDragging: boolean
    isActive?: boolean
    getTagColor: (tagId: string) => string
    getTagName: (tagId: string) => string
    onPress: (e: React.MouseEvent | React.TouchEvent) => void
    onClick: () => void
    onStop?: () => void
    baseDate: Date
    layout?: { left: string; width: string }
    daysToRender: number
}

const SHOW_CARD_TITLE_HEIGHT = 20
const SHOW_CARD_TIME_HEIGHT = 44
const SHOW_CARD_DURATION_HEIGHT = 58

export const TaskCard = memo(
    ({
        card,
        isDragging,
        isActive = false,
        getTagColor,
        getTagName,
        onPress,
        onClick,
        onStop,
        baseDate,
        layout,
        daysToRender,
    }: TaskCardProps) => {
        const cardRef = useRef<HTMLDivElement>(null)
        const titleRef = useRef<HTMLDivElement>(null)
        const timeRef = useRef<HTMLDivElement>(null)
        const durationRef = useRef<HTMLDivElement>(null)
        const solidBgRef = useRef<HTMLDivElement>(null)
        const ghostBgRef = useRef<HTMLDivElement>(null)
        const contentWrapperRef = useRef<HTMLDivElement>(null)
        const tagStripeRef = useRef<HTMLDivElement>(null)

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

        useEffect(() => {
            const dispose = effect(() => {
                const ppm = pixelsPerMinuteSignal.value
                const container = cardRef.current
                if (!container) return

                const override = dragOverridesSignal.value[card.id]
                const activeDrag = isDragging || !!override

                if (activeDrag) {
                    const dragHeight = override
                        ? override.height
                        : dragHeightSignal.value
                    const top = override ? override.top : dragTopSignal.value
                    const showTitle = dragHeight >= SHOW_CARD_TITLE_HEIGHT
                    const showTime = dragHeight >= SHOW_CARD_TIME_HEIGHT
                    const showDuration = dragHeight >= SHOW_CARD_DURATION_HEIGHT

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

                    if (contentWrapperRef.current) {
                        Object.assign(contentWrapperRef.current.style, {
                            height: `${dragHeight}px`,
                            paddingTop: showTime ? "0.5rem" : "0",
                            paddingBottom: showTime ? "0.5rem" : "0",
                        })
                    }

                    if (tagStripeRef.current) {
                        tagStripeRef.current.style.height = `${dragHeight}px`
                    }

                    if (titleRef.current) {
                        Object.assign(titleRef.current.style, {
                            display: showTitle ? "block" : "none",
                            lineHeight: showTime ? "1.25rem" : "1",
                        })
                    }

                    if (timeRef.current) {
                        timeRef.current.style.display = showTime
                            ? "block"
                            : "none"

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
                        durationRef.current.style.display = showDuration
                            ? "block"
                            : "none"
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

                    const height = duration * ppm
                    const totalHeight = isCurrentlyTracking
                        ? Math.max(height, 1) + GHOST_EXTENSION_PX
                        : height
                    const showTitle = totalHeight >= SHOW_CARD_TITLE_HEIGHT
                    const showTime = totalHeight >= SHOW_CARD_TIME_HEIGHT
                    const showDuration =
                        totalHeight >= SHOW_CARD_DURATION_HEIGHT

                    Object.assign(container.style, {
                        transform: `translateY(${startMin * ppm + TOP_MARGIN}px)`,
                        height: `${totalHeight}px`,
                        WebkitMaskImage: isCurrentlyTracking
                            ? `linear-gradient(to bottom, black 0%, black ${height}px, transparent ${totalHeight}px)`
                            : "",
                        maskImage: isCurrentlyTracking
                            ? `linear-gradient(to bottom, black 0%, black ${height}px, transparent ${totalHeight}px)`
                            : "",
                    })

                    if (solidBgRef.current) {
                        solidBgRef.current.style.height = `${height}px`
                    }

                    if (ghostBgRef.current) {
                        ghostBgRef.current.style.top = `${height}px`
                    }

                    if (contentWrapperRef.current) {
                        Object.assign(contentWrapperRef.current.style, {
                            height: `${totalHeight}px`,
                            paddingTop: showTime ? "0.5rem" : "0",
                            paddingBottom: showTime ? "0.5rem" : "0",
                        })
                    }

                    if (tagStripeRef.current) {
                        tagStripeRef.current.style.height = `${totalHeight}px`
                    }

                    if (titleRef.current) {
                        Object.assign(titleRef.current.style, {
                            display: showTitle ? "block" : "none",
                            lineHeight: showTime ? "1.25rem" : "1",
                        })
                    }

                    if (timeRef.current) {
                        timeRef.current.style.display = showTime
                            ? "block"
                            : "none"
                        timeRef.current.textContent = `${isoToTime(card.start_at)} - ${card.end_at ? isoToTime(card.end_at) : "Now"}`
                    }

                    if (durationRef.current) {
                        durationRef.current.style.display = showDuration
                            ? "block"
                            : "none"
                        durationRef.current.textContent = `${getDurationString(realDurationMinutes)}`
                    }
                }
            })

            return () => dispose()
        }, [
            isDragging,
            card,
            startMin,
            duration,
            isCurrentlyTracking,
            realDurationMinutes,
        ])

        const handleKeyDown = (e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onClick()
            }
        }

        const baseClasses = `task-card absolute pointer-events-auto flex flex-col justify-start overflow-hidden`
        const idleClasses = isCurrentlyTracking
            ? "transition-shadow duration-200 hover:shadow-md cursor-pointer shadow-sm"
            : "transition-shadow duration-200 hover:shadow-md cursor-pointer shadow-sm border border-border bg-card/60"
        const draggingClasses =
            "z-50 ring-2 ring-primary border-primary shadow-xl opacity-90 cursor-grabbing backdrop-blur-sm rounded-xl"

        const currentRounding = `${
            isStartClipped ? "rounded-t-none border-t-0" : "rounded-t-xl"
        } ${isEndClipped ? "rounded-b-none border-b-0" : "rounded-b-xl"}`

        const ppm = pixelsPerMinuteSignal.peek()
        const initialHeight = duration * ppm
        const initialTotalHeight = isCurrentlyTracking
            ? Math.max(initialHeight, 1) + GHOST_EXTENSION_PX
            : initialHeight
        const initialTransform = `translateY(${startMin * ppm + TOP_MARGIN}px)`
        const initialShowTitle = initialTotalHeight >= SHOW_CARD_TITLE_HEIGHT
        const initialShowTime = initialTotalHeight >= SHOW_CARD_TIME_HEIGHT
        const initialShowDuration =
            initialTotalHeight >= SHOW_CARD_DURATION_HEIGHT

        const defaultLeft = layout ? layout.left : "0.5rem"
        const defaultWidth = layout ? layout.width : "calc(100% - 1rem)"

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
                style={{
                    top: 0,
                    transform: isDragging ? undefined : initialTransform,
                    height: isDragging ? undefined : `${initialTotalHeight}px`,
                    left: leftStyle,
                    width: widthStyle,
                    zIndex: zIndexStyle,
                    willChange: willChangeStyle,
                    WebkitMaskImage:
                        isCurrentlyTracking && !isDragging
                            ? `linear-gradient(to bottom, black 0%, black ${initialHeight}px, transparent ${initialTotalHeight}px)`
                            : undefined,
                    maskImage:
                        isCurrentlyTracking && !isDragging
                            ? `linear-gradient(to bottom, black 0%, black ${initialHeight}px, transparent ${initialTotalHeight}px)`
                            : undefined,
                }}
                onMouseDown={onPress}
                onTouchStart={onPress}
                onClick={(e) => {
                    if (isCurrentlyTracking && !isDragging) {
                        const rect = e.currentTarget.getBoundingClientRect()
                        const relativeY = e.clientY - rect.top
                        const currentPpm = pixelsPerMinuteSignal.value
                        const currentSolidHeight = duration * currentPpm
                        if (relativeY > currentSolidHeight) {
                            onStop?.()
                            return
                        }
                    }
                    onClick()
                }}
            >
                {/* Ghost Extension Layer (Rendered underneath solid part) */}
                {isCurrentlyTracking && !isDragging && (
                    <div
                        ref={ghostBgRef}
                        className="pointer-events-none absolute inset-x-0 h-15"
                        style={{ top: `${initialHeight}px` }}
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
                        height: isDragging ? undefined : `${initialHeight}px`,
                        borderTopColor: isStartClipped
                            ? "transparent"
                            : undefined,
                    }}
                />

                {/* Content Wrapper */}
                <div
                    ref={contentWrapperRef}
                    className={`absolute inset-x-0 top-0 z-10 flex flex-col justify-center px-3 ${
                        !isDragging && initialShowTime ? "py-2" : "py-0"
                    }`}
                    style={{
                        height: isDragging
                            ? undefined
                            : `${initialTotalHeight}px`,
                    }}
                >
                    <div
                        ref={tagStripeRef}
                        className="absolute top-0 bottom-0 left-0 z-10 w-1.5"
                        style={{
                            backgroundColor: getTagColor(card.tag_id),
                            height: isDragging
                                ? undefined
                                : `${initialTotalHeight}px`,
                        }}
                    />
                    <div
                        ref={titleRef}
                        className={`card-title shrink-0 truncate text-sm font-medium text-foreground ${
                            isDragging || initialShowTitle ? "block" : "none"
                        } ${initialShowTime ? "leading-tight" : "leading-none"}`}
                    >
                        {card.title || getTagName(card.tag_id)}
                    </div>
                    <div
                        ref={timeRef}
                        className={`card-time shrink-0 truncate text-[10px] text-muted-foreground tabular-nums ${
                            isDragging || initialShowTime ? "block" : "none"
                        }`}
                    >
                        {`${isoToTime(card.start_at)} - ${card.end_at ? isoToTime(card.end_at) : "Now"}`}
                    </div>
                    <div
                        ref={durationRef}
                        className={`card-duration shrink-0 truncate text-[10px] text-muted-foreground/80 tabular-nums ${
                            isDragging || initialShowDuration ? "block" : "none"
                        }`}
                    >
                        {`${getDurationString(realDurationMinutes)}`}
                    </div>
                </div>
            </div>
        )
    }
)
