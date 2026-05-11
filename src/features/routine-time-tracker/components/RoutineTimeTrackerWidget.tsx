import React, { useState, useEffect, useRef, useMemo } from "react"
import { batch } from "@preact/signals-react"
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
import {
    timeToISO,
    isoToTime,
    isoToMinutes,
    isTouchEvent,
    formatLocalDate,
    PIXELS_PER_MINUTE,
    TOP_MARGIN,
    BOTTOM_MARGIN,
} from "../utils/utils"
import { useRoutineTimeTrackerStateStore } from "../stores/routine-time-tracker-state.store"
import { RoutineTimeTrackerService } from "../services/routine-time-tracker.service"
import { RoutineEditor } from "./RoutineEditor"
import { TimeTrackerEditor } from "./TimeTrackerEditor"
import { getRoutineInstancesForDate } from "../utils/routine-expansion"
import type { IsoDateTime } from "@/shared/models/base.model"
import type { RoutineCardId } from "../models/routine-time-tracker.model"
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

type EditingState =
    | { type: "routine"; card: RoutineCard }
    | { type: "timeTracker"; card: TimeTrackerCard }
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
    const setActiveTimeTrackerId = (id: any) =>
        RoutineTimeTrackerService.setActiveTrackerId(id)

    const [currentDate, setCurrentDate] = useState(new Date())
    const isCurrentDay =
        new Date().toDateString() === currentDate.toDateString()

    const currentDateTimeTrackerCards = useMemo(() => {
        const dateStr = formatLocalDate(currentDate)
        return allTimeTrackerCards.filter(
            (c) => !c.is_deleted && c.start_at.startsWith(dateStr)
        )
    }, [allTimeTrackerCards, currentDate])

    const currentDateRoutineCards = useMemo(() => {
        return getRoutineInstancesForDate(allRoutineCards, currentDate)
    }, [allRoutineCards, currentDate])

    const routineLayoutMap = useMemo(() => {
        return calculateLayout(
            currentDateRoutineCards.filter((t) => !t.is_deleted)
        )
    }, [currentDateRoutineCards])

    const [editingState, setEditingState] = useState<EditingState>(null)
    const [dragState, setDragState] = useState<DragState | null>(null)
    const [confirmDragState, setConfirmDragState] = useState<{
        type: "routine" | "timeTracker"
        card: RoutineCard | TimeTrackerCard
        originalStartAt: IsoDateTime
    } | null>(null)
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const lastTouchPos = useRef<{ x: number; y: number } | null>(null)
    const wasDragged = useRef(false)
    const lastBackgroundTime = useRef<number | null>(null)

    // Scroll to current time on mount and focus
    const scrollToCurrentTime = () => {
        if (!scrollContainerRef.current) return

        const now = new Date()
        const currentMinutes = now.getHours() * 60 + now.getMinutes()
        const targetY = currentMinutes * PIXELS_PER_MINUTE + TOP_MARGIN
        const containerHeight = scrollContainerRef.current.clientHeight

        scrollContainerRef.current.scrollTo({
            top: targetY - containerHeight / 2,
            behavior: "smooth",
        })
    }

    useEffect(() => {
        // Initial scroll - only if viewing today (which is the default)
        const timer = setTimeout(() => {
            if (currentDate.toDateString() === new Date().toDateString()) {
                scrollToCurrentTime()
            }
        }, 100)

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                const now = new Date()
                let shouldScroll =
                    currentDate.toDateString() === now.toDateString()

                // Auto-switch to today if backgrounded for more than threshold
                if (lastBackgroundTime.current) {
                    const elapsed = Date.now() - lastBackgroundTime.current
                    if (elapsed >= AUTO_SWITCH_TO_TODAY_MS) {
                        console.log(
                            `SyncService: App idle for ${Math.round(elapsed / 1000 / 60)}m, auto-switching to today.`
                        )
                        setCurrentDate(now)
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
    }, [currentDate])

    useEffect(() => {
        if (!activeTimeTrackerId) return

        const task = allTimeTrackerCards.find(
            (c) => c.id === activeTimeTrackerId
        )
        if (!task || task.is_deleted) {
            setActiveTimeTrackerId(null)
            return
        }

        const timer = setInterval(() => {
            const now = new Date()
            const endHour = now.getHours()
            const endMin = now.getMinutes()
            const endTime = `${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`

            const updatedCard = {
                ...task,
                end_at: timeToISO(endTime),
            }

            upsertTimeTrackerCard(updatedCard)
            SyncService.save(timeTrackerCardConfig, updatedCard).catch(
                console.error
            )
        }, 60000)

        return () => clearInterval(timer)
    }, [
        activeTimeTrackerId,
        allTimeTrackerCards,
        upsertTimeTrackerCard,
        setActiveTimeTrackerId,
    ])

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
                setEditingState({ type: "timeTracker", card: newCard })
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
            setEditingState({ type: "timeTracker", card: newCard })
        }
    }

    const getTagColor = (tagId: string) => {
        const tag = tags.find((t) => t.id === tagId)
        return tag?.color || "#94a3b8" // Fallback to slate-400 if tag not found
    }

    const handleCreateTask = async (clientX: number, clientY: number) => {
        if (!scrollContainerRef.current) return

        const rect = scrollContainerRef.current.getBoundingClientRect()
        const relativeY =
            clientY - rect.top + scrollContainerRef.current.scrollTop
        const relativeX = clientX - rect.left
        const contentWidth = scrollContainerRef.current.clientWidth

        const minutes = Math.floor((relativeY - TOP_MARGIN) / PIXELS_PER_MINUTE)
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

        let mode: DragMode = "center"
        if (relativeY < height * 0.25) mode = "top"
        else if (relativeY > height * 0.75) mode = "bottom"

        longPressTimer.current = setTimeout(() => {
            const startMin = isoToMinutes(task.start_at)
            const duration = isoToMinutes(task.end_at) - startMin

            batch(() => {
                dragTopSignal.value = startMin * PIXELS_PER_MINUTE + TOP_MARGIN
                dragHeightSignal.value = duration * PIXELS_PER_MINUTE
            })

            setDragState({
                type,
                card: task,
                initialStartMin: startMin,
                initialEndMin: isoToMinutes(task.end_at),
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
                Math.round((finalTop - TOP_MARGIN) / PIXELS_PER_MINUTE / 5) * 5
            const finalEndMin =
                Math.round(
                    (finalTop + finalHeight - TOP_MARGIN) /
                        PIXELS_PER_MINUTE /
                        5
                ) * 5

            const dateStr = formatLocalDate(new Date(dragState.card.start_at))
            const finalCard = {
                ...dragState.card,
                start_at: timeToISO(
                    `${String(Math.floor(finalStartMin / 60)).padStart(2, "0")}:${String(finalStartMin % 60).padStart(2, "0")}`,
                    dateStr
                ),
                end_at: timeToISO(
                    `${String(Math.floor(finalEndMin / 60)).padStart(2, "0")}:${String(finalEndMin % 60).padStart(2, "0")}`,
                    dateStr
                ),
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
                dragState.initialStartMin * PIXELS_PER_MINUTE + TOP_MARGIN
            let newHeight =
                (dragState.initialEndMin - dragState.initialStartMin) *
                PIXELS_PER_MINUTE

            if (dragState.mode === "top") {
                const requestedTop =
                    dragState.initialStartMin * PIXELS_PER_MINUTE +
                    TOP_MARGIN +
                    deltaY
                const minTop = TOP_MARGIN
                const maxTop =
                    (dragState.initialEndMin - 5) * PIXELS_PER_MINUTE +
                    TOP_MARGIN
                newTop = Math.max(minTop, Math.min(maxTop, requestedTop))
                newHeight =
                    dragState.initialEndMin * PIXELS_PER_MINUTE +
                    TOP_MARGIN -
                    newTop
            } else if (dragState.mode === "bottom") {
                const requestedHeight =
                    (dragState.initialEndMin - dragState.initialStartMin) *
                        PIXELS_PER_MINUTE +
                    deltaY
                const minHeight = 5 * PIXELS_PER_MINUTE
                const maxHeight =
                    (24 * 60 - dragState.initialStartMin) * PIXELS_PER_MINUTE
                newHeight = Math.max(
                    minHeight,
                    Math.min(maxHeight, requestedHeight)
                )
            } else {
                const requestedTop =
                    dragState.initialStartMin * PIXELS_PER_MINUTE +
                    TOP_MARGIN +
                    deltaY
                const duration =
                    (dragState.initialEndMin - dragState.initialStartMin) *
                    PIXELS_PER_MINUTE
                const minTop = TOP_MARGIN
                const maxTop =
                    24 * 60 * PIXELS_PER_MINUTE + TOP_MARGIN - duration
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
            <DateNavigator date={currentDate} onDateChange={setCurrentDate} />

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
            >
                <div
                    className="pointer-events-none relative mx-auto w-full max-w-2xl"
                    style={{
                        height: `${24 * 60 * PIXELS_PER_MINUTE + BOTTOM_MARGIN}px`,
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
                                    isDragging={dragState?.card.id === task.id}
                                    getTagColor={getTagColor}
                                    onPress={(e) =>
                                        handleCardPress(e, "timeTracker", task)
                                    }
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
                            />
                        </div>

                        {/* Center Timeline Spacer (for layout alignment) */}
                        <div className="h-full w-[60px]" />

                        {/* Routine Column */}
                        <div className="relative h-full flex-1">
                            {currentDateRoutineCards
                                .filter((t) => !t.is_deleted)
                                .map((task) => (
                                    <TaskCard
                                        key={task.id}
                                        card={task}
                                        isDragging={
                                            dragState?.card.id === task.id
                                        }
                                        getTagColor={getTagColor}
                                        onPress={(e) =>
                                            handleCardPress(e, "routine", task)
                                        }
                                        onClick={() => {
                                            if (!wasDragged.current) {
                                                setEditingState({
                                                    type: "routine",
                                                    card: task,
                                                })
                                            }
                                        }}
                                        layout={routineLayoutMap.get(task.id)}
                                    />
                                ))}
                        </div>
                    </div>

                    <CurrentTimeIndicator isCurrentDay={isCurrentDay} />
                </div>
            </div>

            {editingState?.type === "routine" && (
                <RoutineEditor
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
                    task={editingState.card}
                    onSave={async (updated) => {
                        const exists = allTimeTrackerCards.some(
                            (c) => c.id === updated.id
                        )
                        upsertTimeTrackerCard(updated)
                        if (!exists && !activeTimeTrackerId && isCurrentDay) {
                            setActiveTimeTrackerId(updated.id)
                        }
                        await SyncService.save(timeTrackerCardConfig, updated)
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
                                updated_at:
                                    new Date().toISOString() as IsoDateTime,
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
                            const datePart = formatLocalDate(
                                new Date(master.start_at)
                            )
                            const timePartStart = isoToTime(routine.start_at)
                            const timePartEnd = isoToTime(routine.end_at)

                            const updatedMaster = {
                                ...master,
                                start_at: timeToISO(timePartStart, datePart),
                                end_at: timeToISO(timePartEnd, datePart),
                                updated_at:
                                    new Date().toISOString() as IsoDateTime,
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
