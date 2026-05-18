import React, { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { batch, effect } from "@preact/signals-react"
import { v4 as uuidv4 } from "uuid"
import {
    createRoutineCard,
    routineCardConfig,
    type RoutineCard,
} from "../models/routine-card.model"
import {
    createTimeTrackerCard,
    timeTrackerCardConfig,
    type TimeTrackerCard,
} from "../models/time-tracker-card.model"
import { useRoutineCardStore } from "../stores/routine-card.store"
import { useTimeTrackerCardStore } from "../stores/time-tracker-card.store"
import { useTagStore } from "../stores/tag.store"
import { SyncService } from "@/shared/services/sync.service"
import { pixelsPerMinuteSignal, zoomLevelSignal } from "../stores/zoom.store"
import {
    timeToISO,
    isoToTime,
    isTouchEvent,
    formatLocalDate,
    isCardOverlappingDate,
    getVisualBoundsForDate,
    TOP_MARGIN,
    BOTTOM_MARGIN,
} from "../utils/utils"
import { useRoutineTimeTrackerStateStore } from "../stores/routine-time-tracker-state.store"
import { RoutineTimeTrackerService } from "../services/routine-time-tracker.service"
import { RoutineEditor } from "./RoutineEditor"
import { TimeTrackerEditor } from "./TimeTrackerEditor"
import { getRoutineInstancesForDate } from "../utils/routine-expansion"
import type { IsoDateTime } from "@/shared/models/base.model"
import type {
    RoutineCardId,
    TimeTrackerCardId,
} from "../models/routine-time-tracker.model"
import { AUTO_SWITCH_TO_TODAY_MS } from "@/features/settings/stores/settings.store"

// Extracted components and utilities
import { calculateLayout } from "../utils/layout"
import { DateNavigator } from "./DateNavigator"
import { CurrentTimeIndicator } from "./CurrentTimeIndicator"
import { TimeTrackerActionButton } from "./TimeTrackerActionButton"
import { TaskCard } from "./TaskCard"
import { TimelineGrid } from "./TimelineGrid"
import { SaveChangeDialog } from "./SaveChangeDialog"
import { dragTopSignal, dragHeightSignal } from "../stores/drag.store"
import { useBackAction } from "@/hooks/useBackAction"

type EditingState =
    | { type: "routine"; card: RoutineCard }
    | { type: "timeTracker"; card: TimeTrackerCard; hideTimeFields?: boolean }
    | null

type DragMode = "top" | "center" | "bottom"

interface DragState {
    type: "routine" | "timeTracker"
    card: RoutineCard | TimeTrackerCard
    initialStartMin: number
    initialEndMin: number
    initialMouseY: number
    mode: DragMode
}

export default function RoutineTimeTrackerWidget() {
    const {
        items: allTimeTrackerCards,
        upsert: upsertTimeTrackerCard,
        remove: deleteTimeTrackerCard,
    } = useTimeTrackerCardStore()

    const {
        items: allRoutineCards,
        upsert: upsertRoutineCard,
        remove: deleteRoutineCard,
    } = useRoutineCardStore()

    const { items: tags } = useTagStore()
    const activeTimeTrackerId =
        useRoutineTimeTrackerStateStore(
            (state) => state.state?.active_time_tracker_id
        ) || null
    const setActiveTimeTrackerId = async (id: TimeTrackerCardId | null) =>
        RoutineTimeTrackerService.setActiveTrackerId(id)

    const [currentDate, setCurrentDate] = useState<Date | null>(null)
    const [now, setNow] = useState<Date | null>(null)

    useEffect(() => {
        const initialDate = new Date()
        // Defer to next tick to avoid cascading render lint error
        const timer = setTimeout(() => {
            setCurrentDate(initialDate)
            setNow(initialDate)
        }, 0)

        const interval = setInterval(() => setNow(new Date()), 1000)
        return () => {
            clearTimeout(timer)
            clearInterval(interval)
        }
    }, [])

    const isCurrentDay =
        now && currentDate
            ? now.toDateString() === currentDate.toDateString()
            : false

    const currentDateTimeTrackerCards = useMemo(() => {
        if (!currentDate || !now) return []
        return allTimeTrackerCards.reduce<TimeTrackerCard[]>((acc, c) => {
            if (
                !c.is_deleted &&
                isCardOverlappingDate(c.start_at, c.end_at, currentDate)
            ) {
                // For the active task on the current day, virtualize end_at to 'now' for real-time UI updates
                if (c.id === activeTimeTrackerId && isCurrentDay) {
                    acc.push({
                        ...c,
                        end_at: now.toISOString() as IsoDateTime,
                    })
                } else {
                    acc.push(c)
                }
            }
            return acc
        }, [])
    }, [
        allTimeTrackerCards,
        currentDate,
        activeTimeTrackerId,
        isCurrentDay,
        now,
    ])

    const currentDateRoutineCards = useMemo(() => {
        if (!currentDate) return []
        return getRoutineInstancesForDate(allRoutineCards, currentDate)
    }, [allRoutineCards, currentDate])

    const routineLayoutMap = useMemo(() => {
        if (!currentDate) return new Map()
        return calculateLayout(
            currentDateRoutineCards.filter((t) => !t.is_deleted),
            currentDate
        )
    }, [currentDateRoutineCards, currentDate])

    const [editingState, setEditingState] = useState<EditingState>(null)
    const [dragState, setDragState] = useState<DragState | null>(null)
    const [confirmDragState, setConfirmDragState] = useState<{
        type: "routine" | "timeTracker"
        card: RoutineCard | TimeTrackerCard
        originalStartAt: IsoDateTime
    } | null>(null)

    useBackAction(() => setConfirmDragState(null), !!confirmDragState)

    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const timelineContainerRef = useRef<HTMLDivElement>(null)
    const zoomSliderRef = useRef<HTMLInputElement>(null)
    const zoomLabelRef = useRef<HTMLSpanElement>(null)

    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const lastTouchPos = useRef<{ x: number; y: number } | null>(null)
    const wasDragged = useRef(false)
    const lastBackgroundTime = useRef<number | null>(null)

    // Synchronize zoom signal with DOM elements to avoid React re-renders
    useEffect(() => {
        const dispose = effect(() => {
            const ppm = pixelsPerMinuteSignal.value
            const zoom = zoomLevelSignal.value

            if (timelineContainerRef.current) {
                timelineContainerRef.current.style.height = `${24 * 60 * ppm + BOTTOM_MARGIN}px`
            }
            if (zoomSliderRef.current) {
                zoomSliderRef.current.value = zoom.toString()
            }
            if (zoomLabelRef.current) {
                zoomLabelRef.current.textContent = `${zoom.toFixed(1)}x`
            }
        })
        return () => dispose()
    }, [])

    // Scroll to current time on mount and focus
    const scrollToCurrentTime = useCallback(() => {
        if (!scrollContainerRef.current) return

        const scrollNow = new Date()
        const currentMinutes =
            scrollNow.getHours() * 60 + scrollNow.getMinutes()
        const targetY =
            currentMinutes * pixelsPerMinuteSignal.value + TOP_MARGIN
        const containerHeight = scrollContainerRef.current.clientHeight

        scrollContainerRef.current.scrollTo({
            top: targetY - containerHeight / 2,
            behavior: "smooth",
        })
    }, [])

    useEffect(() => {
        if (!currentDate) return

        // Initial scroll - only if viewing today (which is the default)
        const timer = setTimeout(() => {
            if (currentDate.toDateString() === new Date().toDateString()) {
                scrollToCurrentTime()
            }
        }, 100)

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                const currentNow = new Date()
                let shouldScroll =
                    currentDate.toDateString() === currentNow.toDateString()

                // Auto-switch to today if backgrounded for more than threshold
                if (lastBackgroundTime.current) {
                    const elapsed = Date.now() - lastBackgroundTime.current
                    if (elapsed >= AUTO_SWITCH_TO_TODAY_MS) {
                        console.log(
                            `SyncService: App idle for ${Math.round(elapsed / 1000 / 60)}m, auto-switching to today.`
                        )
                        setCurrentDate(currentNow)
                        shouldScroll = true // Always scroll after an auto-switch
                    }
                    lastBackgroundTime.current = null
                }

                if (shouldScroll) {
                    scrollToCurrentTime()
                }
            } else {
                lastBackgroundTime.current = Date.now()
            }
        }

        document.addEventListener("visibilitychange", handleVisibilityChange)
        return () => {
            clearTimeout(timer)
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange
            )
        }
    }, [currentDate, scrollToCurrentTime])

    useEffect(() => {
        if (!scrollContainerRef.current) return
        const container = scrollContainerRef.current

        console.log("SyncService: Zoom listeners attached to container.")

        let initialTouchDistance = 0
        let initialZoom = 1

        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault()
                // Smooth multiplier for trackpad and mouse wheel
                const delta = -e.deltaY * 0.005
                const nextZoom = Math.max(
                    1,
                    Math.min(3, zoomLevelSignal.value + delta)
                )
                zoomLevelSignal.value = nextZoom
                console.log(`SyncService: [WHEEL ZOOM] ${nextZoom.toFixed(2)}x`)
            }
        }

        const handleGestureStart = (e: Event) => {
            e.preventDefault()
            initialZoom = zoomLevelSignal.value
            console.log("SyncService: [GESTURE START]")
        }

        const handleGestureChange = (e: Event) => {
            e.preventDefault()
            const gestureEvent = e as unknown as { scale: number }
            const nextZoom = Math.max(
                1,
                Math.min(3, initialZoom * gestureEvent.scale)
            )
            zoomLevelSignal.value = nextZoom
            console.log(`SyncService: [GESTURE ZOOM] ${nextZoom.toFixed(2)}x`)
        }

        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 2) {
                initialTouchDistance = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                )
                initialZoom = zoomLevelSignal.value
                console.log("SyncService: [TOUCH ZOOM START]")
            }
        }

        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length === 2 && initialTouchDistance > 0) {
                e.preventDefault()
                const currentDistance = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                )
                const scale = currentDistance / initialTouchDistance
                const nextZoom = Math.max(1, Math.min(3, initialZoom * scale))
                zoomLevelSignal.value = nextZoom
                console.log(`SyncService: [TOUCH ZOOM] ${nextZoom.toFixed(2)}x`)
            }
        }

        const handleDoubleClick = () => {
            zoomLevelSignal.value = 1
            console.log("SyncService: [ZOOM RESET]")
        }

        container.addEventListener("wheel", handleWheel, { passive: false })
        container.addEventListener("touchstart", handleTouchStart)
        container.addEventListener("touchmove", handleTouchMove, {
            passive: false,
        })
        container.addEventListener("dblclick", handleDoubleClick)
        container.addEventListener("gesturestart", handleGestureStart)
        container.addEventListener("gesturechange", handleGestureChange)

        return () => {
            console.log("SyncService: Zoom listeners detached.")
            container.removeEventListener("wheel", handleWheel)
            container.removeEventListener("touchstart", handleTouchStart)
            container.removeEventListener("touchmove", handleTouchMove)
            container.removeEventListener("dblclick", handleDoubleClick)
            container.removeEventListener("gesturestart", handleGestureStart)
            container.removeEventListener("gesturechange", handleGestureChange)
        }
    }, [currentDate !== null])

    if (!currentDate || !now) {
        return (
            <div className="flex h-full w-full items-center justify-center p-8 text-muted-foreground">
                Loading tracker…
            </div>
        )
    }

    const handleTimeTrackerAction = () => {
        if (activeTimeTrackerId) {
            const task = allTimeTrackerCards.find(
                (c) => c.id === activeTimeTrackerId
            )
            if (task && !task.is_deleted) {
                setActiveTimeTrackerId(null)

                const now = new Date()
                const startHour = now.getHours()
                const startMin = now.getMinutes()
                const startTime = `${String(startHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`

                const endHour = Math.min(24, startHour + 1)
                const endTime = `${String(endHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`

                const newCard = createTimeTrackerCard({
                    start_at: timeToISO(startTime),
                    end_at: timeToISO(endTime),
                })
                setEditingState({
                    type: "timeTracker",
                    card: newCard,
                    hideTimeFields: true,
                })
            }
        } else {
            const now = new Date()
            const startHour = now.getHours()
            const startMin = now.getMinutes()
            const startTime = `${String(startHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`

            const endTime = `${String(startHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`

            const newCard = createTimeTrackerCard({
                start_at: timeToISO(startTime),
                end_at: timeToISO(endTime),
            })
            setEditingState({
                type: "timeTracker",
                card: newCard,
                hideTimeFields: true,
            })
        }
    }

    const getTagColor = (tagId: string) => {
        const tag = tags.find((t) => t.id === tagId)
        return tag?.color || "#94a3b8" // Fallback to slate-400 if tag not found
    }

    const getTagName = (tagId: string) => {
        const tag = tags.find((t) => t.id === tagId)
        return tag?.name || "Task"
    }

    const handleCreateTask = async (clientX: number, clientY: number) => {
        if (!scrollContainerRef.current) return

        const rect = scrollContainerRef.current.getBoundingClientRect()
        const relativeY =
            clientY - rect.top + scrollContainerRef.current.scrollTop
        const relativeX = clientX - rect.left
        const contentWidth = scrollContainerRef.current.clientWidth

        const minutes = Math.floor(
            (relativeY - TOP_MARGIN) / pixelsPerMinuteSignal.value
        )
        if (minutes < 0 || minutes >= 24 * 60) return

        const roundedMinutes = Math.round(minutes / 30) * 30
        const startHour = Math.floor(roundedMinutes / 60)
        const startMin = roundedMinutes % 60

        const dateStr = formatLocalDate(currentDate)
        const startTime = `${String(startHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`
        const startIso = timeToISO(startTime, dateStr)

        const endMinutes = roundedMinutes + 60
        const endHour = Math.floor(endMinutes / 60)
        const endMin = endMinutes % 60
        const endTime = `${String(Math.min(24, endHour)).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`
        const endIso = timeToISO(endTime, dateStr)

        const isTimeTrackerBlock = relativeX < contentWidth / 2

        if (isTimeTrackerBlock) {
            const newCard = createTimeTrackerCard({
                start_at: startIso,
                end_at: endIso,
            })
            setEditingState({ type: "timeTracker", card: newCard })
        } else {
            const newCard = createRoutineCard({
                start_at: startIso,
                end_at: endIso,
            })
            setEditingState({ type: "routine", card: newCard })
        }
    }

    const handleCardPress = (
        e: React.MouseEvent | React.TouchEvent,
        type: "routine" | "timeTracker",
        task: RoutineCard | TimeTrackerCard
    ) => {
        e.stopPropagation()

        // Ignore multi-touch (pinch zoom)
        if (isTouchEvent(e) && e.touches.length > 1) {
            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current)
                longPressTimer.current = null
            }
            return
        }

        const clientX = isTouchEvent(e) ? e.touches[0].clientX : e.clientX
        const clientY = isTouchEvent(e) ? e.touches[0].clientY : e.clientY

        lastTouchPos.current = { x: clientX, y: clientY }
        wasDragged.current = false

        const cardElement = e.currentTarget as HTMLElement
        const rect = cardElement.getBoundingClientRect()
        const relativeY = clientY - rect.top
        const height = rect.height

        const isStartClamped = cardElement.dataset.startClamped === "true"
        const isEndClamped = cardElement.dataset.endClamped === "true"

        let mode: DragMode = "center"
        if (relativeY < height * 0.25) mode = "top"
        else if (relativeY > height * 0.75) mode = "bottom"

        // Prevent dragging clamped edges
        if (mode === "top" && isStartClamped) return
        if (mode === "bottom" && isEndClamped) return
        if (mode === "center" && (isStartClamped || isEndClamped)) return

        longPressTimer.current = setTimeout(() => {
            const { startMin, duration } = getVisualBoundsForDate(
                task.start_at,
                task.end_at,
                currentDate
            )

            batch(() => {
                dragTopSignal.value =
                    startMin * pixelsPerMinuteSignal.value + TOP_MARGIN
                dragHeightSignal.value = duration * pixelsPerMinuteSignal.value
            })

            setDragState({
                type,
                card: task,
                initialStartMin: startMin,
                initialEndMin: startMin + duration,
                initialMouseY: clientY,
                mode,
            })
            longPressTimer.current = null
        }, 500)
    }

    const startPress = (e: React.MouseEvent | React.TouchEvent) => {
        if ((e.target as HTMLElement).closest(".task-card")) return

        // Ignore multi-touch (pinch zoom)
        if (isTouchEvent(e) && e.touches.length > 1) {
            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current)
                longPressTimer.current = null
            }
            return
        }

        const clientX = isTouchEvent(e) ? e.touches[0].clientX : e.clientX
        const clientY = isTouchEvent(e) ? e.touches[0].clientY : e.clientY

        lastTouchPos.current = { x: clientX, y: clientY }

        longPressTimer.current = setTimeout(() => {
            handleCreateTask(clientX, clientY)
            longPressTimer.current = null
        }, 500)
    }

    const endPress = async () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current)
            longPressTimer.current = null
        }

        if (dragState) {
            wasDragged.current = true

            // Calculate final snapped times
            const finalTop = dragTopSignal.value
            const finalHeight = dragHeightSignal.value
            const finalStartMin =
                Math.round(
                    (finalTop - TOP_MARGIN) / pixelsPerMinuteSignal.value / 5
                ) * 5
            const finalEndMin =
                Math.round(
                    (finalTop + finalHeight - TOP_MARGIN) /
                        pixelsPerMinuteSignal.value /
                        5
                ) * 5

            const formatMin = (m: number) => {
                const h = Math.floor(m / 60)
                const mm = m % 60
                return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
            }

            const dateStr = formatLocalDate(currentDate)
            const finalCard = { ...dragState.card }

            if (dragState.mode === "top") {
                finalCard.start_at = timeToISO(
                    formatMin(finalStartMin),
                    dateStr
                )
            } else if (dragState.mode === "bottom") {
                finalCard.end_at = timeToISO(formatMin(finalEndMin), dateStr)
            } else if (dragState.mode === "center") {
                const durationMs =
                    new Date(dragState.card.end_at || now).getTime() -
                    new Date(dragState.card.start_at).getTime()
                const newStart = timeToISO(formatMin(finalStartMin), dateStr)
                finalCard.start_at = newStart
                finalCard.end_at = new Date(
                    new Date(newStart).getTime() + durationMs
                ).toISOString() as IsoDateTime
            }

            // If it's a recurring routine, show confirmation dialog
            if (dragState.type === "routine") {
                const routine = finalCard as RoutineCard
                const isRecurring =
                    routine._isVirtual ||
                    !!routine.rrule ||
                    !!routine.parent_routine_id

                if (isRecurring) {
                    setConfirmDragState({
                        type: "routine",
                        card: routine,
                        originalStartAt: dragState.card.start_at as IsoDateTime,
                    })
                    setDragState(null)
                    return
                }

                upsertRoutineCard(routine)
                await SyncService.save(routineCardConfig, routine)
            } else {
                upsertTimeTrackerCard(finalCard as TimeTrackerCard)
                await SyncService.save(
                    timeTrackerCardConfig,
                    finalCard as TimeTrackerCard
                )
            }
            setDragState(null)
        }
    }

    const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
        // Ignore if multi-touch starts during a move
        if (isTouchEvent(e) && e.touches.length > 1) {
            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current)
                longPressTimer.current = null
            }
            return
        }

        const clientX = isTouchEvent(e) ? e.touches[0].clientX : e.clientX
        const clientY = isTouchEvent(e) ? e.touches[0].clientY : e.clientY

        if (dragState) {
            wasDragged.current = true
            const deltaY = clientY - dragState.initialMouseY

            let newTop =
                dragState.initialStartMin * pixelsPerMinuteSignal.value +
                TOP_MARGIN
            let newHeight =
                (dragState.initialEndMin - dragState.initialStartMin) *
                pixelsPerMinuteSignal.value

            if (dragState.mode === "top") {
                const requestedTop =
                    dragState.initialStartMin * pixelsPerMinuteSignal.value +
                    TOP_MARGIN +
                    deltaY
                const minTop = TOP_MARGIN
                const maxTop =
                    (dragState.initialEndMin - 5) *
                        pixelsPerMinuteSignal.value +
                    TOP_MARGIN
                newTop = Math.max(minTop, Math.min(maxTop, requestedTop))
                newHeight =
                    dragState.initialEndMin * pixelsPerMinuteSignal.value +
                    TOP_MARGIN -
                    newTop
            } else if (dragState.mode === "bottom") {
                const requestedHeight =
                    (dragState.initialEndMin - dragState.initialStartMin) *
                        pixelsPerMinuteSignal.value +
                    deltaY
                const minHeight = 5 * pixelsPerMinuteSignal.value
                const maxHeight =
                    (24 * 60 - dragState.initialStartMin) *
                    pixelsPerMinuteSignal.value
                newHeight = Math.max(
                    minHeight,
                    Math.min(maxHeight, requestedHeight)
                )
            } else {
                const requestedTop =
                    dragState.initialStartMin * pixelsPerMinuteSignal.value +
                    TOP_MARGIN +
                    deltaY
                const duration =
                    (dragState.initialEndMin - dragState.initialStartMin) *
                    pixelsPerMinuteSignal.value
                const minTop = TOP_MARGIN
                const maxTop =
                    24 * 60 * pixelsPerMinuteSignal.value +
                    TOP_MARGIN -
                    duration
                newTop = Math.max(minTop, Math.min(maxTop, requestedTop))
            }

            batch(() => {
                dragTopSignal.value = newTop
                dragHeightSignal.value = newHeight
            })
            return
        }

        if (!longPressTimer.current || !lastTouchPos.current) return

        const dist = Math.sqrt(
            Math.pow(clientX - lastTouchPos.current.x, 2) +
                Math.pow(clientY - lastTouchPos.current.y, 2)
        )

        if (dist > 10) {
            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current)
                longPressTimer.current = null
            }
        }
    }

    return (
        <div className="relative flex h-full w-full flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b bg-card px-4 py-2">
                <DateNavigator
                    date={currentDate}
                    onDateChange={setCurrentDate}
                />
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                        Zoom
                    </span>
                    <input
                        ref={zoomSliderRef}
                        type="range"
                        min="1"
                        max="3"
                        step="0.1"
                        defaultValue={zoomLevelSignal.peek()}
                        onChange={(e) =>
                            (zoomLevelSignal.value = parseFloat(e.target.value))
                        }
                        className="h-1 w-20 cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
                    />
                    <span
                        ref={zoomLabelRef}
                        className="w-8 text-right font-mono text-[10px] font-bold text-muted-foreground"
                    >
                        {zoomLevelSignal.peek().toFixed(1)}x
                    </span>
                </div>
            </div>

            <div
                ref={scrollContainerRef}
                className={`scrollbar-hide relative w-full flex-1 bg-background select-none ${dragState ? "overflow-hidden" : "overflow-y-auto"}`}
                onMouseDown={startPress}
                onMouseUp={endPress}
                onMouseLeave={endPress}
                onMouseMove={handleMove}
                onTouchStart={startPress}
                onTouchEnd={endPress}
                onTouchMove={handleMove}
                role="region"
                aria-label="Daily timeline grid"
            >
                <div
                    ref={timelineContainerRef}
                    className="pointer-events-none relative mx-auto w-full max-w-2xl"
                    style={{
                        height: `${24 * 60 * pixelsPerMinuteSignal.peek() + BOTTOM_MARGIN}px`,
                    }}
                >
                    <TimelineGrid />

                    <div className="absolute inset-0 flex">
                        {/* Time Tracker Column */}
                        <div className="relative h-full flex-1">
                            {currentDateTimeTrackerCards.map((task) => (
                                <TaskCard
                                    key={task.id}
                                    card={task}
                                    currentDate={currentDate}
                                    isDragging={dragState?.card.id === task.id}
                                    getTagColor={getTagColor}
                                    getTagName={getTagName}
                                    onPress={(e) => {
                                        handleCardPress(e, "timeTracker", task)
                                    }}
                                    onClick={() => {
                                        if (!wasDragged.current) {
                                            setEditingState({
                                                type: "timeTracker",
                                                card: task,
                                            })
                                        }
                                    }}
                                />
                            ))}
                            <TimeTrackerActionButton
                                activeTimeTrackerId={activeTimeTrackerId}
                                onAction={handleTimeTrackerAction}
                                isCurrentDay={isCurrentDay}
                                currentTime={now}
                            />
                        </div>

                        {/* Center Timeline Spacer (for layout alignment) */}
                        <div className="h-full w-[60px]" />

                        {/* Routine Column */}
                        <div className="relative h-full flex-1">
                            {currentDateRoutineCards.reduce<React.ReactNode[]>(
                                (acc, task) => {
                                    if (!task.is_deleted) {
                                        acc.push(
                                            <TaskCard
                                                key={task.id}
                                                card={task}
                                                currentDate={currentDate}
                                                isDragging={
                                                    dragState?.card.id ===
                                                    task.id
                                                }
                                                getTagColor={getTagColor}
                                                getTagName={getTagName}
                                                onPress={(e) => {
                                                    handleCardPress(
                                                        e,
                                                        "routine",
                                                        task
                                                    )
                                                }}
                                                onClick={() => {
                                                    if (!wasDragged.current) {
                                                        setEditingState({
                                                            type: "routine",
                                                            card: task,
                                                        })
                                                    }
                                                }}
                                                layout={routineLayoutMap.get(
                                                    task.id
                                                )}
                                            />
                                        )
                                    }
                                    return acc
                                },
                                []
                            )}
                        </div>
                    </div>

                    <CurrentTimeIndicator
                        isCurrentDay={isCurrentDay}
                        currentTime={now}
                    />
                </div>
            </div>

            {editingState?.type === "routine" && (
                <RoutineEditor
                    key={editingState.card.id}
                    task={editingState.card}
                    masterTask={(() => {
                        const task = editingState.card
                        if (task._isVirtual) {
                            const masterId = task.id.split("_")[0]
                            return allRoutineCards.find(
                                (c) => c.id === masterId
                            )
                        }
                        if (task.parent_routine_id) {
                            return allRoutineCards.find(
                                (c) => c.id === task.parent_routine_id
                            )
                        }
                        if (task.rrule) {
                            return task
                        }
                        return undefined
                    })()}
                    onSave={async (updated) => {
                        upsertRoutineCard(updated)
                        await SyncService.save(routineCardConfig, updated)
                        setEditingState(null)
                    }}
                    onDelete={async (id) => {
                        const exists = allRoutineCards.some((c) => c.id === id)
                        if (exists) {
                            deleteRoutineCard(id)
                            await SyncService.delete(routineCardConfig, id)
                        }
                        setEditingState(null)
                    }}
                    onCancel={() => setEditingState(null)}
                />
            )}

            {editingState?.type === "timeTracker" && (
                <TimeTrackerEditor
                    key={editingState.card.id}
                    task={editingState.card}
                    hideTimeFields={editingState.hideTimeFields}
                    onSave={async (updated) => {
                        const exists = allTimeTrackerCards.some(
                            (c) => c.id === updated.id
                        )
                        upsertTimeTrackerCard(updated)
                        await SyncService.save(timeTrackerCardConfig, updated)

                        // Only auto-start if it's a BRAND NEW card (not an update) and we are on current day
                        if (!exists && !activeTimeTrackerId && isCurrentDay) {
                            await setActiveTimeTrackerId(updated.id)
                        }

                        setEditingState(null)
                    }}
                    onDelete={async (id) => {
                        const exists = allTimeTrackerCards.some(
                            (c) => c.id === id
                        )
                        if (exists) {
                            deleteTimeTrackerCard(id)
                            await SyncService.delete(timeTrackerCardConfig, id)
                        }
                        setEditingState(null)
                    }}
                    onCancel={() => setEditingState(null)}
                />
            )}

            {confirmDragState && (
                <SaveChangeDialog
                    onOccurrenceOnly={async () => {
                        const routine = confirmDragState.card as RoutineCard
                        if (routine._isVirtual) {
                            const masterId = routine.id.split(
                                "_"
                            )[0] as RoutineCardId
                            const detachedInstance: RoutineCard = {
                                ...routine,
                                id: uuidv4() as RoutineCardId,
                                parent_routine_id: masterId,
                                original_recurrence_date:
                                    confirmDragState.originalStartAt,
                                _isVirtual: undefined,
                                updated_at: now.toISOString() as IsoDateTime,
                            }
                            upsertRoutineCard(detachedInstance)
                            await SyncService.save(
                                routineCardConfig,
                                detachedInstance
                            )
                        } else {
                            upsertRoutineCard(routine)
                            await SyncService.save(routineCardConfig, routine)
                        }
                        setConfirmDragState(null)
                    }}
                    onAllOccurrences={async () => {
                        const routine = confirmDragState.card as RoutineCard
                        const masterId = routine._isVirtual
                            ? routine.id.split("_")[0]
                            : routine.id
                        const master = allRoutineCards.find(
                            (c) => c.id === masterId
                        )

                        if (master) {
                            const masterStartDatePart = formatLocalDate(
                                new Date(master.start_at)
                            )
                            const timePartStart = isoToTime(routine.start_at)
                            const timePartEnd = isoToTime(routine.end_at)

                            // Calculate day difference in the instance to preserve multi-day span
                            // Use local-time-safe calculation
                            const instanceStartDatePart = formatLocalDate(
                                new Date(routine.start_at)
                            )
                            const instanceEndDatePart = formatLocalDate(
                                new Date(routine.end_at)
                            )

                            const [y1, m1, d1] = instanceStartDatePart
                                .split("-")
                                .map(Number)
                            const [y2, m2, d2] = instanceEndDatePart
                                .split("-")
                                .map(Number)

                            const dStart = new Date(y1, m1 - 1, d1)
                            const dEnd = new Date(y2, m2 - 1, d2)
                            const dayDiff = Math.round(
                                (dEnd.getTime() - dStart.getTime()) /
                                    (1000 * 60 * 60 * 24)
                            )

                            const [my, mm, md] = masterStartDatePart
                                .split("-")
                                .map(Number)
                            const masterEndDate = new Date(my, mm - 1, md)
                            masterEndDate.setDate(
                                masterEndDate.getDate() + dayDiff
                            )
                            const masterEndDatePart =
                                formatLocalDate(masterEndDate)

                            const updatedMaster = {
                                ...master,
                                start_at: timeToISO(
                                    timePartStart,
                                    masterStartDatePart
                                ),
                                end_at: timeToISO(
                                    timePartEnd,
                                    masterEndDatePart
                                ),
                                updated_at: now.toISOString() as IsoDateTime,
                            }
                            upsertRoutineCard(updatedMaster)
                            await SyncService.save(
                                routineCardConfig,
                                updatedMaster
                            )
                        }
                        setConfirmDragState(null)
                    }}
                    onCancel={() => setConfirmDragState(null)}
                />
            )}
        </div>
    )
}
