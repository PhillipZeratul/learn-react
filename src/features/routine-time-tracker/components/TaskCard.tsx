import React, { useRef, useEffect, memo } from "react"
import { effect } from "@preact/signals-react"
import {
    getVisualBoundsForDate,
    isoToTime,
    timeToISO,
    TOP_MARGIN,
    SHOW_CARD_TITLE_HEIGHT,
    SHOW_CARD_TIME_HEIGHT,
} from "../utils/utils"
import type { RoutineCard } from "../models/routine-card.model"
import type { TimeTrackerCard } from "../models/time-tracker-card.model"
import { dragTopSignal, dragHeightSignal } from "../stores/drag.store"
import { pixelsPerMinuteSignal } from "../stores/zoom.store"

interface TaskCardProps {
    card: RoutineCard | TimeTrackerCard
    isDragging: boolean
    isActive?: boolean
    getTagColor: (tagId: string) => string
    getTagName: (tagId: string) => string
    onPress: (e: React.MouseEvent | React.TouchEvent) => void
    onClick: () => void
    currentDate: Date
    layout?: { left: string; width: string }
}

export const TaskCard = memo(
    ({
        card,
        isDragging,
        isActive = false,
        getTagColor,
        getTagName,
        onPress,
        onClick,
        currentDate,
        layout,
    }: TaskCardProps) => {
        const cardRef = useRef<HTMLDivElement>(null)
        const titleRef = useRef<HTMLDivElement>(null)
        const timeRef = useRef<HTMLDivElement>(null)
        const solidBgRef = useRef<HTMLDivElement>(null)
        const ghostBgRef = useRef<HTMLDivElement>(null)
        const contentWrapperRef = useRef<HTMLDivElement>(null)

        const { startMin, duration, isStartClamped, isEndClamped } =
            getVisualBoundsForDate(card.start_at, card.end_at, currentDate)

        const GHOST_EXTENSION_PX = 60
        const isCurrentlyTracking = isActive || !card.end_at

        useEffect(() => {
            const dispose = effect(() => {
                const ppm = pixelsPerMinuteSignal.value
                const container = cardRef.current
                if (!container) return

                if (isDragging) {
                    const dragHeight = dragHeightSignal.value
                    const top = dragTopSignal.value
                    const showTitle = dragHeight >= SHOW_CARD_TITLE_HEIGHT
                    const showTime = dragHeight >= SHOW_CARD_TIME_HEIGHT

                    Object.assign(container.style, {
                        transform: `translateY(${top}px) scale(1.02)`,
                        height: `${dragHeight}px`,
                    })

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
                            const h = Math.floor(m / 60)
                            const mm = m % 60
                            return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
                        }

                        timeRef.current.textContent = `${isoToTime(timeToISO(formatMin(currentStartMin)))} - ${isoToTime(timeToISO(formatMin(currentEndMin)))}`
                    }
                } else {
                    const height = duration * ppm
                    const totalHeight = isCurrentlyTracking
                        ? height + GHOST_EXTENSION_PX
                        : height
                    const showTitle = totalHeight >= SHOW_CARD_TITLE_HEIGHT
                    const showTime = totalHeight >= SHOW_CARD_TIME_HEIGHT

                    Object.assign(container.style, {
                        transform: `translateY(${startMin * ppm + TOP_MARGIN}px)`,
                        height: `${totalHeight}px`,
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
                }
            })

            return () => dispose()
        }, [isDragging, card, startMin, duration, isCurrentlyTracking])

        const handleKeyDown = (e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onClick()
            }
        }

        const baseClasses = `task-card absolute pointer-events-auto flex flex-col justify-start overflow-hidden`
        const idleClasses =
            "transition-shadow duration-200 hover:shadow-md cursor-pointer shadow-sm"
        const draggingClasses =
            "z-50 ring-2 ring-primary border-primary shadow-xl opacity-90 cursor-grabbing backdrop-blur-sm rounded-xl"

        const roundedTClass = !isStartClamped ? "rounded-t-xl" : ""
        const roundedBClass = !isEndClamped ? "rounded-b-xl" : ""

        const ppm = pixelsPerMinuteSignal.peek()
        const initialHeight = duration * ppm
        const initialTotalHeight = isCurrentlyTracking
            ? initialHeight + GHOST_EXTENSION_PX
            : initialHeight
        const initialTransform = `translateY(${startMin * ppm + TOP_MARGIN}px)`
        const initialShowTitle = initialHeight >= SHOW_CARD_TITLE_HEIGHT
        const initialShowTime = initialHeight >= SHOW_CARD_TIME_HEIGHT

        const defaultLeft = layout ? layout.left : "0.5rem"
        const defaultWidth = layout ? layout.width : "calc(100% - 1rem)"

        const leftStyle = isDragging ? "0.5rem" : defaultLeft
        const widthStyle = isDragging ? "calc(100% - 1rem)" : defaultWidth
        const zIndexStyle = isDragging ? 50 : 10
        const willChangeStyle = isDragging
            ? "transform, height, opacity"
            : undefined

        return (
            <div
                ref={cardRef}
                className={`${baseClasses} ${roundedTClass} ${roundedBClass} ${
                    isDragging ? draggingClasses : idleClasses
                }`}
                data-start-clamped={isStartClamped}
                data-end-clamped={isEndClamped}
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
                }}
                onMouseDown={onPress}
                onTouchStart={onPress}
                onClick={onClick}
            >
                {/* Ghost Extension Layer (Rendered underneath solid part) */}
                {isCurrentlyTracking && !isDragging && (
                    <div
                        ref={ghostBgRef}
                        className="pointer-events-none absolute inset-x-0 h-[60px]"
                        style={{ top: `${initialHeight}px` }}
                    >
                        <div
                            className="absolute inset-x-0 bg-gradient-to-b from-primary/20 via-primary/5 to-transparent"
                            style={{ height: "60px", top: 0 }}
                        />
                        {/* Tag color gradient */}
                        <div
                            className="absolute top-0 bottom-0 left-0 w-1.5 opacity-80"
                            style={{
                                height: "60px",
                                backgroundImage: `linear-gradient(to bottom, ${getTagColor(card.tag_id)}, transparent)`,
                            }}
                        />
                        {/* Scanning animation */}
                        <div className="animate-scan-down absolute inset-x-0 h-1 bg-primary/40 blur-[2px]" />
                    </div>
                )}

                {/* Solid Background Layer */}
                <div
                    ref={solidBgRef}
                    className={`absolute inset-x-0 top-0 ${
                        isCurrentlyTracking
                            ? "bg-card/90"
                            : "border border-border bg-card/60"
                    }`}
                    style={{
                        height: isDragging ? undefined : `${initialHeight}px`,
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
                        className={`card-title flex-shrink-0 truncate text-sm font-medium text-foreground ${
                            initialShowTitle || isDragging ? "block" : "none"
                        } ${initialShowTime ? "leading-tight" : "leading-none"}`}
                    >
                        {card.title || getTagName(card.tag_id)}
                    </div>
                    <div
                        ref={timeRef}
                        className={`card-time flex-shrink-0 truncate text-[10px] text-muted-foreground tabular-nums ${
                            initialShowTime || isDragging ? "block" : "none"
                        }`}
                    >
                        {`${isoToTime(card.start_at)} - ${card.end_at ? isoToTime(card.end_at) : "Now"}`}
                    </div>
                </div>
            </div>
        )
    }
)
