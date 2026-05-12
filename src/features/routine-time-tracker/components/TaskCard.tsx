import React, { useRef, useEffect } from "react"
import { effect } from "@preact/signals-react"
import {
    getVisualBoundsForDate,
    isoToTime,
    timeToISO,
    PIXELS_PER_MINUTE,
    TOP_MARGIN,
    SHOW_CARD_TITLE_HEIGHT,
    SHOW_CARD_TIME_HEIGHT,
} from "../utils/utils"
import type { RoutineCard } from "../models/routine-card.model"
import type { TimeTrackerCard } from "../models/time-tracker-card.model"
import { dragTopSignal, dragHeightSignal } from "../stores/drag.store"

interface TaskCardProps {
    card: RoutineCard | TimeTrackerCard
    isDragging: boolean
    getTagColor: (tagId: string) => string
    onPress: (e: React.MouseEvent | React.TouchEvent) => void
    onClick: () => void
    currentDate: Date
    layout?: { left: string; width: string }
}

export const TaskCard = ({
    card,
    isDragging,
    getTagColor,
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
    const height = duration * PIXELS_PER_MINUTE

    // GPU-Accelerated Positioning
    const defaultTransform = `translateY(${startMin * PIXELS_PER_MINUTE + TOP_MARGIN}px)`
    const defaultHeight = `${height}px`

    useEffect(() => {
        if (!isDragging) {
            if (cardRef.current) {
                cardRef.current.style.paddingTop = ""
                cardRef.current.style.paddingBottom = ""
            }
            if (titleRef.current) {
                titleRef.current.style.lineHeight = ""
            }
            return
        }

        const dispose = effect(() => {
            const dragHeight = dragHeightSignal.value
            const top = dragTopSignal.value

            if (cardRef.current) {
                cardRef.current.style.transform = `translateY(${top}px) scale(1.02)`
                cardRef.current.style.height = `${dragHeight}px`

                // Direct layout updates to avoid re-renders
                const showTitle = dragHeight >= SHOW_CARD_TITLE_HEIGHT
                const showTime = dragHeight >= SHOW_CARD_TIME_HEIGHT

                // Update padding directly on the card ref
                cardRef.current.style.paddingTop = showTime ? "0.5rem" : "0"
                cardRef.current.style.paddingBottom = showTime ? "0.5rem" : "0"

                if (titleRef.current) {
                    titleRef.current.style.display = showTitle
                        ? "block"
                        : "none"
                    titleRef.current.style.lineHeight = showTime
                        ? "1.25rem"
                        : "1"
                }

                if (timeRef.current) {
                    timeRef.current.style.display = showTime ? "block" : "none"

                    const currentStartMin =
                        Math.round((top - TOP_MARGIN) / PIXELS_PER_MINUTE / 5) *
                        5
                    const currentEndMin =
                        Math.round(
                            (top + dragHeight - TOP_MARGIN) /
                                PIXELS_PER_MINUTE /
                                5
                        ) * 5

                    const formatMin = (m: number) => {
                        const h = Math.floor(m / 60)
                        const mm = m % 60
                        return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
                    }

                    timeRef.current.textContent = `${isoToTime(timeToISO(formatMin(currentStartMin)))} - ${isoToTime(timeToISO(formatMin(currentEndMin)))}`
                }
            }
        })

        return () => dispose()
    }, [isDragging])

    const baseClasses = `task-card absolute border border-border px-3 pointer-events-auto overflow-hidden flex flex-col justify-center bg-card/60`
    const idleClasses =
        "transition-all hover:shadow-md cursor-pointer shadow-sm"
    const draggingClasses =
        "z-50 ring-2 ring-primary border-primary shadow-xl opacity-90 cursor-grabbing backdrop-blur-sm"

    const roundedClasses = `${!isStartClamped ? "rounded-t-xl" : ""} ${!isEndClamped ? "rounded-b-xl" : ""}`

    const showTitle = height >= SHOW_CARD_TITLE_HEIGHT
    const showTime = height >= SHOW_CARD_TIME_HEIGHT

    const defaultLeft = layout ? layout.left : "0.5rem"
    const defaultWidth = layout ? layout.width : "calc(100% - 1rem)"

    return (
        <div
            ref={cardRef}
            className={`${baseClasses} ${roundedClasses} ${isDragging ? draggingClasses : idleClasses}`}
            data-start-clamped={isStartClamped}
            data-end-clamped={isEndClamped}
            style={{
                top: 0,
                transform: isDragging ? undefined : defaultTransform,
                height: isDragging ? undefined : defaultHeight,
                left: isDragging ? "0.5rem" : defaultLeft,
                width: isDragging ? "calc(100% - 1rem)" : defaultWidth,
                zIndex: isDragging ? 50 : undefined,
                paddingTop: isDragging ? undefined : showTime ? "0.5rem" : "0",
                paddingBottom: isDragging
                    ? undefined
                    : showTime
                      ? "0.5rem"
                      : "0",
                // Hardware Hinting: dedicated GPU layer for the card
                willChange: "transform, height, opacity",
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
                className="card-title flex-shrink-0 truncate text-sm font-medium text-foreground"
                style={{
                    display: showTitle || isDragging ? "block" : "none",
                    lineHeight: showTime ? "1.25rem" : "1",
                }}
            >
                {card.title}
            </div>
            <div
                ref={timeRef}
                className="card-time flex-shrink-0 truncate text-[10px] text-muted-foreground tabular-nums"
                style={{ display: showTime || isDragging ? "block" : "none" }}
            >
                {`${isoToTime(card.start_at)} - ${isoToTime(card.end_at)}`}
            </div>
        </div>
    )
}
