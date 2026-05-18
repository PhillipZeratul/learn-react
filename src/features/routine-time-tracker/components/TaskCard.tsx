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

        const { startMin, duration, isStartClamped, isEndClamped } =
            getVisualBoundsForDate(card.start_at, card.end_at, currentDate)

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
                        paddingTop: showTime ? "0.5rem" : "0",
                        paddingBottom: showTime ? "0.5rem" : "0",
                    })

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
                    const showTitle = height >= SHOW_CARD_TITLE_HEIGHT
                    const showTime = height >= SHOW_CARD_TIME_HEIGHT

                    Object.assign(container.style, {
                        transform: `translateY(${startMin * ppm + TOP_MARGIN}px)`,
                        height: `${height}px`,
                        paddingTop: showTime ? "0.5rem" : "0",
                        paddingBottom: showTime ? "0.5rem" : "0",
                    })

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
        }, [isDragging, card, startMin, duration])

        const handleKeyDown = (e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onClick()
            }
        }

        const baseClasses = `task-card absolute border border-border px-3 pointer-events-auto overflow-hidden flex flex-col justify-center bg-card/60`
        const idleClasses =
            "transition-all hover:shadow-md cursor-pointer shadow-sm"
        const draggingClasses =
            "z-50 ring-2 ring-primary border-primary shadow-xl opacity-90 cursor-grabbing backdrop-blur-sm"

        const roundedClasses = `${!isStartClamped ? "rounded-t-xl" : ""} ${!isEndClamped ? "rounded-b-xl" : ""}`

        const ppm = pixelsPerMinuteSignal.peek()
        const initialHeight = duration * ppm
        const initialTransform = `translateY(${startMin * ppm + TOP_MARGIN}px)`
        const initialShowTitle = initialHeight >= SHOW_CARD_TITLE_HEIGHT
        const initialShowTime = initialHeight >= SHOW_CARD_TIME_HEIGHT

        const defaultLeft = layout ? layout.left : "0.5rem"
        const defaultWidth = layout ? layout.width : "calc(100% - 1rem)"

        const leftStyle = isDragging ? "0.5rem" : defaultLeft
        const widthStyle = isDragging ? "calc(100% - 1rem)" : defaultWidth
        const zIndexStyle = isDragging ? 50 : undefined
        const willChangeStyle = isDragging
            ? "transform, height, opacity"
            : undefined

        return (
            <div
                ref={cardRef}
                className={`${baseClasses} ${roundedClasses} ${
                    isDragging ? draggingClasses : idleClasses
                } ${!isDragging && initialShowTime ? "py-2" : "py-0"}`}
                data-start-clamped={isStartClamped}
                data-end-clamped={isEndClamped}
                role="button"
                tabIndex={0}
                onKeyDown={handleKeyDown}
                style={{
                    top: 0,
                    transform: isDragging ? undefined : initialTransform,
                    height: isDragging ? undefined : `${initialHeight}px`,
                    left: leftStyle,
                    width: widthStyle,
                    zIndex: zIndexStyle,
                    // Hardware Hinting: dedicated GPU layer only when dragging
                    willChange: willChangeStyle,
                }}
                onMouseDown={onPress}
                onTouchStart={onPress}
                onClick={onClick}
            >
                <div
                    className="absolute top-0 bottom-0 left-0 z-10 w-1.5"
                    style={{ backgroundColor: getTagColor(card.tag_id) }}
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
        )
    }
)
