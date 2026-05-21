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
    getNowISO,
    resolveTagColor,
    TOP_MARGIN,
    BOTTOM_MARGIN,
} from "../utils/utils"
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
import { LinkIndicatorLayer } from "./LinkIndicatorLayer"
import { TimelineGrid } from "./TimelineGrid"
import { SaveChangeDialog } from "./SaveChangeDialog"
import {
    dragTopSignal,
    dragHeightSignal,
    dragOverridesSignal,
} from "../stores/drag.store"
import { useBackAction } from "@/hooks/useBackAction"
import {
    detectShake,
    calculateSnap,
    calculateLinkedBounds,
} from "../utils/drag"

type EditingState =
    | { type: "routine"; card: RoutineCard; isNew?: boolean }
    | {
          type: "timeTracker"
          card: TimeTrackerCard
          hideTimeFields?: boolean
          isNew?: boolean
      }
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
    const handleStopTracker = async (id: TimeTrackerCardId) => {
        const activeCount = allTimeTrackerCards.filter(
            (c) => c.end_at === null && !c.is_deleted
        ).length

        const now = getNowISO()
        await RoutineTimeTrackerService.toggleTracker(id, now)

        if (activeCount === 1) {
            handleTimeTrackerAction(now)
        }
    }

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
                // For active tasks on the current day, virtualize end_at to 'now' for real-time UI updates
                if (c.end_at === null && isCurrentDay) {
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
    }, [allTimeTrackerCards, currentDate, isCurrentDay, now])

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

    const timeTrackerLayoutMap = useMemo(() => {
        if (!currentDate) return new Map()
        return calculateLayout(
            currentDateTimeTrackerCards.filter((t) => !t.is_deleted),
            currentDate
        )
    }, [currentDateTimeTrackerCards, currentDate])

    const [editingState, setEditingState] = useState<EditingState>(null)
    const [dragState, setDragState] = useState<DragState | null>(null)
    const [confirmDragState, setConfirmDragState] = useState<{
        type: "routine" | "timeTracker"
        card: RoutineCard | TimeTrackerCard
        originalStartAt: IsoDateTime
    } | null>(null)

    const closeConfirmDragDialog = (shouldClearOverrides = true) => {
        setConfirmDragState(null)
        if (shouldClearOverrides) {
            dragOverridesSignal.value = {}
        }
    }

    useBackAction(() => closeConfirmDragDialog(true), !!confirmDragState)

    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const timelineContainerRef = useRef<HTMLDivElement>(null)

    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const lastTouchPos = useRef<{ x: number; y: number } | null>(null)
    const wasDragged = useRef(false)
    const lastBackgroundTime = useRef<number | null>(null)

    // Snapping and Linking gesture state refs
    const shakeHistoryRef = useRef<Array<{ y: number; timestamp: number }>>([])
    const isUnlinkedRef = useRef<boolean>(false)
    const linkedEdgesRef = useRef<
        Array<{
            card: RoutineCard | TimeTrackerCard
            edge: "start" | "end"
            type: "routine" | "timeTracker"
            initialStartMin: number
            initialEndMin: number
        }>
    >([])

    const snapTargetsRef = useRef<number[]>([])
    const snapTargetISOMapRef = useRef<Map<number, string>>(new Map())
    const snappedTargetRef = useRef<number | null>(null)
    const bypassedSnapsRef = useRef<Set<number>>(new Set())
    const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Track the last clientY during drags to re-trigger updates on hold-timer snap breaks
    const lastDragYRef = useRef<number>(0)
    const updateDragPositionRef = useRef<(clientY: number) => void>(() => {})

    // Registry for pending multi-card concurrent updates
    const pendingUpdatesRef = useRef<
        Array<{
            type: "routine" | "timeTracker"
            card: RoutineCard | TimeTrackerCard
            originalStartAt: IsoDateTime
        }>
    >([])

    const updateDragPosition = useCallback(
        (clientY: number) => {
            if (!dragState) return

            const ppm = pixelsPerMinuteSignal.value
            lastDragYRef.current = clientY

            // 1. Shake Detection (only if not already unlinked and dragging an edge)
            if (
                !isUnlinkedRef.current &&
                (dragState.mode === "top" || dragState.mode === "bottom")
            ) {
                const nowTime = Date.now()
                shakeHistoryRef.current.push({ y: clientY, timestamp: nowTime })

                if (detectShake(shakeHistoryRef.current, nowTime)) {
                    // SHAKE DETECTED! BREAK LINKS!
                    isUnlinkedRef.current = true
                    shakeHistoryRef.current = []

                    // Reset all secondary linked edges from overrides
                    // (we only keep the primary card in the active overrides)
                    const primaryId = dragState.card.id
                    const nextOverrides: Record<
                        string,
                        { top: number; height: number }
                    > = {}
                    const currentPrimaryOverride =
                        dragOverridesSignal.value[primaryId]
                    if (currentPrimaryOverride) {
                        nextOverrides[primaryId] = currentPrimaryOverride
                    }
                    dragOverridesSignal.value = nextOverrides

                    // Filter linkedEdgesRef to only contain the primary card's edge
                    linkedEdgesRef.current = linkedEdgesRef.current.filter(
                        (le) => le.card.id === primaryId
                    )
                } else {
                    // Keep history trimmed
                    shakeHistoryRef.current = shakeHistoryRef.current.filter(
                        (p) => nowTime - p.timestamp <= 400
                    )
                }
            }

            const deltaY = clientY - dragState.initialMouseY

            // 2. Snapping Calculations (only for edge dragging)
            let snapOffsetMinutes = 0

            if (dragState.mode === "top" || dragState.mode === "bottom") {
                const initialMinutes =
                    dragState.mode === "top"
                        ? dragState.initialStartMin
                        : dragState.initialEndMin
                const requestedMinutes = initialMinutes + deltaY / ppm
                const requestedPixels = requestedMinutes * ppm + TOP_MARGIN

                const {
                    snappedTargetVal: snapVal,
                    snapOffsetMinutes: snapOffset,
                    shouldBypass,
                    shouldStartTimer,
                } = calculateSnap(
                    requestedPixels,
                    snapTargetsRef.current,
                    bypassedSnapsRef.current,
                    ppm,
                    snappedTargetRef.current,
                    TOP_MARGIN
                )

                if (shouldBypass) {
                    if (snappedTargetRef.current !== null) {
                        bypassedSnapsRef.current.add(snappedTargetRef.current)
                        snappedTargetRef.current = null
                    }
                    if (snapTimerRef.current) {
                        clearTimeout(snapTimerRef.current)
                        snapTimerRef.current = null
                    }
                } else if (shouldStartTimer !== null) {
                    snappedTargetRef.current = shouldStartTimer
                    snapOffsetMinutes = snapOffset

                    if (snapTimerRef.current) {
                        clearTimeout(snapTimerRef.current)
                    }
                    snapTimerRef.current = setTimeout(() => {
                        bypassedSnapsRef.current.add(shouldStartTimer)
                        snappedTargetRef.current = null
                        snapTimerRef.current = null
                        updateDragPositionRef.current(lastDragYRef.current)
                    }, 3000)
                } else if (snapVal !== null) {
                    snapOffsetMinutes = snapOffset
                } else {
                    // Not snapping, clear snapping state if it was snapping
                    if (snappedTargetRef.current !== null) {
                        snappedTargetRef.current = null
                        if (snapTimerRef.current) {
                            clearTimeout(snapTimerRef.current)
                            snapTimerRef.current = null
                        }
                    }
                }
            }

            // 3. Compute active delta minutes
            const activeDeltaMin = deltaY / ppm + snapOffsetMinutes

            // 4. Multi-card Override Coordinates calculation
            const nextOverrides: Record<
                string,
                { top: number; height: number }
            > = {}

            if (dragState.mode === "center") {
                // Translate the entire primary card
                let newStartMin = dragState.initialStartMin + activeDeltaMin
                const duration =
                    dragState.initialEndMin - dragState.initialStartMin

                // Absolute bounds clamping
                let maxStartMin = 24 * 60 - duration
                if (dragState.type === "timeTracker" && currentDate) {
                    const realNow = new Date()
                    const currentDateStr = formatLocalDate(currentDate)
                    const realNowStr = formatLocalDate(realNow)

                    if (currentDateStr === realNowStr) {
                        const nowMinutes =
                            realNow.getHours() * 60 + realNow.getMinutes()
                        maxStartMin = Math.min(
                            maxStartMin,
                            nowMinutes - duration
                        )
                    } else if (currentDateStr > realNowStr) {
                        maxStartMin = 0
                    }
                }

                newStartMin = Math.max(0, Math.min(maxStartMin, newStartMin))

                const top = newStartMin * ppm + TOP_MARGIN
                const height = duration * ppm

                nextOverrides[dragState.card.id] = { top, height }

                batch(() => {
                    dragTopSignal.value = top
                    dragHeightSignal.value = height
                    dragOverridesSignal.value = nextOverrides
                })
            } else {
                // Edge Dragging (with constraints and linking)
                // Calculate absolute safe bounds for E_eff across all linked edges using utility
                const { absoluteMin, absoluteMax } = calculateLinkedBounds(
                    linkedEdgesRef.current
                )

                // Calculate target minutes
                const initialEdgeMin =
                    dragState.mode === "top"
                        ? dragState.initialStartMin
                        : dragState.initialEndMin
                let targetEdgeMin = initialEdgeMin + activeDeltaMin

                let maxEdgeMin = absoluteMax
                if (dragState.type === "timeTracker" && currentDate) {
                    const realNow = new Date()
                    const currentDateStr = formatLocalDate(currentDate)
                    const realNowStr = formatLocalDate(realNow)

                    if (currentDateStr === realNowStr) {
                        const nowMinutes =
                            realNow.getHours() * 60 + realNow.getMinutes()
                        maxEdgeMin = Math.min(maxEdgeMin, nowMinutes)
                    } else if (currentDateStr > realNowStr) {
                        maxEdgeMin = 0
                    }
                }

                targetEdgeMin = Math.max(
                    absoluteMin,
                    Math.min(maxEdgeMin, targetEdgeMin)
                )

                // Now apply targetEdgeMin to every linked card
                linkedEdgesRef.current.forEach((le) => {
                    let startMin = le.initialStartMin
                    let endMin = le.initialEndMin

                    if (le.edge === "start") {
                        startMin = targetEdgeMin
                    } else {
                        endMin = targetEdgeMin
                    }

                    const top = startMin * ppm + TOP_MARGIN
                    const height = (endMin - startMin) * ppm

                    nextOverrides[le.card.id] = { top, height }

                    // If this is the primary card, also update the global dragTop/dragHeight signals
                    if (le.card.id === dragState.card.id) {
                        batch(() => {
                            dragTopSignal.value = top
                            dragHeightSignal.value = height
                        })
                    }
                })

                batch(() => {
                    dragOverridesSignal.value = nextOverrides
                })
            }
        },
        [dragState, currentDate]
    )

    useEffect(() => {
        updateDragPositionRef.current = updateDragPosition
    }, [updateDragPosition])

    // Synchronize zoom signal with DOM elements to avoid React re-renders
    useEffect(() => {
        const dispose = effect(() => {
            const ppm = pixelsPerMinuteSignal.value

            if (timelineContainerRef.current) {
                timelineContainerRef.current.style.height = `${24 * 60 * ppm + BOTTOM_MARGIN}px`
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

        let initialTouchDistance = 0
        let initialZoom = 1

        const updateZoom = (nextZoom: number, focalYViewport: number) => {
            const oldZoom = zoomLevelSignal.value
            if (oldZoom === nextZoom) return

            const s1 = container.scrollTop

            // Apply new zoom
            zoomLevelSignal.value = nextZoom

            // Adjust scroll position to keep focal point fixed relative to the viewport
            // s2 = (s1 + y - TOP_MARGIN) * (z2 / z1) + TOP_MARGIN - y
            const nextScrollTop =
                (s1 + focalYViewport - TOP_MARGIN) * (nextZoom / oldZoom) +
                TOP_MARGIN -
                focalYViewport

            container.scrollTop = nextScrollTop
        }

        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault()
                const rect = container.getBoundingClientRect()
                const focalYViewport = e.clientY - rect.top

                const delta = -e.deltaY * 0.005
                const nextZoom = Math.max(
                    1,
                    Math.min(6, zoomLevelSignal.value + delta)
                )
                updateZoom(nextZoom, focalYViewport)
            }
        }

        const handleGestureStart = (e: Event) => {
            e.preventDefault()
            initialZoom = zoomLevelSignal.value
        }

        const handleGestureChange = (e: Event) => {
            e.preventDefault()
            const gestureEvent = e as unknown as { scale: number }
            const nextZoom = Math.max(
                1,
                Math.min(6, initialZoom * gestureEvent.scale)
            )

            // For Safari gestures, use center of container as focal point
            const focalYViewport = container.clientHeight / 2
            updateZoom(nextZoom, focalYViewport)
        }

        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 2) {
                initialTouchDistance = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                )
                initialZoom = zoomLevelSignal.value
            }
        }

        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length === 2 && initialTouchDistance > 0) {
                e.preventDefault()
                const currentDistance = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                )

                const rect = container.getBoundingClientRect()
                const pinchCenterY =
                    (e.touches[0].clientY + e.touches[1].clientY) / 2
                const focalYViewport = pinchCenterY - rect.top

                const scale = currentDistance / initialTouchDistance
                const nextZoom = Math.max(1, Math.min(6, initialZoom * scale))
                updateZoom(nextZoom, focalYViewport)
            }
        }

        const handleDoubleClick = () => {
            zoomLevelSignal.value = 1
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
            container.removeEventListener("wheel", handleWheel)
            container.removeEventListener("touchstart", handleTouchStart)
            container.removeEventListener("touchmove", handleTouchMove)
            container.removeEventListener("dblclick", handleDoubleClick)
            container.removeEventListener("gesturestart", handleGestureStart)
            container.removeEventListener("gesturechange", handleGestureChange)
        }
    }, [currentDate])

    if (!currentDate || !now) {
        return (
            <div className="flex h-full w-full items-center justify-center p-8 text-muted-foreground">
                Loading tracker…
            </div>
        )
    }

    const handleTimeTrackerAction = async (timestamp?: IsoDateTime) => {
        const nowIso = timestamp || getNowISO()

        const newCard = createTimeTrackerCard({
            start_at: nowIso,
            end_at: null,
        })

        setEditingState({
            type: "timeTracker",
            card: newCard,
            hideTimeFields: true,
            isNew: true,
        })
    }

    const getTagColor = (tagId: string) => {
        const tag = tags.find((t) => t.id === tagId)
        return resolveTagColor(tag?.color || "#94a3b8")
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
            setEditingState({ type: "timeTracker", card: newCard, isNew: true })
        } else {
            const newCard = createRoutineCard({
                start_at: startIso,
                end_at: endIso,
            })
            setEditingState({ type: "routine", card: newCard, isNew: true })
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

            // Initialize snapping and linking states
            isUnlinkedRef.current = false
            shakeHistoryRef.current = []
            snappedTargetRef.current = null
            bypassedSnapsRef.current = new Set()
            lastDragYRef.current = clientY
            if (snapTimerRef.current) {
                clearTimeout(snapTimerRef.current)
                snapTimerRef.current = null
            }

            const allDailyCards = (
                type === "routine"
                    ? currentDateRoutineCards
                    : currentDateTimeTrackerCards
            ).filter((c) => !c.is_deleted)

            // Discovery of Linked Edges
            const linked: Array<{
                card: RoutineCard | TimeTrackerCard
                edge: "start" | "end"
                type: "routine" | "timeTracker"
                initialStartMin: number
                initialEndMin: number
            }> = []
            // Primary card's dragged edge is always included
            linked.push({
                card: task,
                edge: mode === "top" ? ("start" as const) : ("end" as const),
                type,
                initialStartMin: startMin,
                initialEndMin: startMin + duration,
            })

            if (mode === "top" || mode === "bottom") {
                const targetTime = mode === "top" ? task.start_at : task.end_at
                if (targetTime) {
                    allDailyCards.forEach((c) => {
                        if (c.id === task.id) return
                        const { startMin: cStart, duration: cDur } =
                            getVisualBoundsForDate(
                                c.start_at,
                                c.end_at,
                                currentDate
                            )

                        const isStartLinked =
                            c.start_at &&
                            targetTime &&
                            Math.abs(
                                new Date(c.start_at).getTime() -
                                    new Date(targetTime).getTime()
                            ) < 1000
                        const isEndLinked =
                            c.end_at &&
                            targetTime &&
                            Math.abs(
                                new Date(c.end_at).getTime() -
                                    new Date(targetTime).getTime()
                            ) < 1000

                        if (isStartLinked) {
                            linked.push({
                                card: c,
                                edge: "start" as const,
                                type,
                                initialStartMin: cStart,
                                initialEndMin: cStart + cDur,
                            })
                        }
                        if (isEndLinked) {
                            linked.push({
                                card: c,
                                edge: "end" as const,
                                type,
                                initialStartMin: cStart,
                                initialEndMin: cStart + cDur,
                            })
                        }
                    })
                }
            }
            linkedEdgesRef.current = linked

            // Collection of Snapping Targets
            const snapTargets = new Set<number>()
            const timeMap = new Map<number, string>()
            allDailyCards.forEach((c) => {
                if (linked.some((le) => le.card.id === c.id)) return
                const {
                    startMin: cStart,
                    duration: cDur,
                    isStartClamped,
                    isEndClamped,
                } = getVisualBoundsForDate(c.start_at, c.end_at, currentDate)

                if (!isStartClamped) {
                    snapTargets.add(cStart)
                    timeMap.set(cStart, c.start_at)
                }
                if (c.end_at && !isEndClamped) {
                    snapTargets.add(cStart + cDur)
                    timeMap.set(cStart + cDur, c.end_at)
                }
            })
            snapTargetsRef.current = Array.from(snapTargets)
            snapTargetISOMapRef.current = timeMap

            // Setup initial drag overrides map
            const initOverrides: Record<
                string,
                { top: number; height: number }
            > = {}
            const ppm = pixelsPerMinuteSignal.value
            linked.forEach((le) => {
                initOverrides[le.card.id] = {
                    top: le.initialStartMin * ppm + TOP_MARGIN,
                    height: (le.initialEndMin - le.initialStartMin) * ppm,
                }
            })

            batch(() => {
                dragTopSignal.value = startMin * ppm + TOP_MARGIN
                dragHeightSignal.value = duration * ppm
                dragOverridesSignal.value = initOverrides
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

        if (snapTimerRef.current) {
            clearTimeout(snapTimerRef.current)
            snapTimerRef.current = null
        }

        if (dragState) {
            wasDragged.current = true

            // Read final overrides
            const finalOverrides = { ...dragOverridesSignal.value }

            const formatMin = (m: number) => {
                const h = Math.floor(m / 60)
                const mm = m % 60
                return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
            }
            const dateStr = formatLocalDate(currentDate)

            // Build atomic list of concurrent updates for all modified linked/primary cards
            const updates: Array<{
                type: "routine" | "timeTracker"
                card: RoutineCard | TimeTrackerCard
                originalStartAt: IsoDateTime
            }> = []

            linkedEdgesRef.current.forEach((le) => {
                const override = finalOverrides[le.card.id]
                if (!override) return

                const finalCard = { ...le.card }

                // Check if the card is an active tracking task (originally running)
                const originalCard =
                    le.type === "timeTracker"
                        ? allTimeTrackerCards.find((c) => c.id === le.card.id)
                        : null
                const isOriginallyTracking =
                    originalCard && originalCard.end_at === null
                const shouldStopTracking =
                    isOriginallyTracking &&
                    dragState.card.id === le.card.id &&
                    dragState.mode === "bottom"

                if (dragState.mode === "center") {
                    // Center drag: shift both start and end, round to 5 mins
                    const startMin =
                        Math.round(
                            (override.top - TOP_MARGIN) /
                                pixelsPerMinuteSignal.value /
                                5
                        ) * 5
                    const endMin =
                        Math.round(
                            (override.top + override.height - TOP_MARGIN) /
                                pixelsPerMinuteSignal.value /
                                5
                        ) * 5

                    finalCard.start_at = timeToISO(formatMin(startMin), dateStr)
                    if (isOriginallyTracking && !shouldStopTracking) {
                        finalCard.end_at = null
                    } else if (le.card.end_at !== null) {
                        finalCard.end_at = timeToISO(formatMin(endMin), dateStr)
                    }
                } else {
                    // Edge drag (mode === "top" or "bottom")
                    if (le.edge === "start") {
                        // Start edge is being dragged. End edge remains exactly at its original value.
                        finalCard.end_at =
                            isOriginallyTracking && !shouldStopTracking
                                ? null
                                : le.card.end_at

                        const snappedIso =
                            snappedTargetRef.current !== null
                                ? snapTargetISOMapRef.current.get(
                                      snappedTargetRef.current
                                  )
                                : undefined

                        if (snappedIso) {
                            // Snapped! Use exact raw UTC IsoDateTime string of the target edge
                            finalCard.start_at = snappedIso as IsoDateTime
                        } else {
                            // Not snapped, round to 5 mins
                            const startMin =
                                Math.round(
                                    (override.top - TOP_MARGIN) /
                                        pixelsPerMinuteSignal.value /
                                        5
                                ) * 5
                            finalCard.start_at = timeToISO(
                                formatMin(startMin),
                                dateStr
                            )
                        }
                    } else {
                        // End edge is being dragged. Start edge remains exactly at its original value.
                        finalCard.start_at = le.card.start_at

                        if (isOriginallyTracking && !shouldStopTracking) {
                            finalCard.end_at = null
                        } else if (le.card.end_at !== null) {
                            const snappedIso =
                                snappedTargetRef.current !== null
                                    ? snapTargetISOMapRef.current.get(
                                          snappedTargetRef.current
                                      )
                                    : undefined

                            if (snappedIso) {
                                // Snapped! Use exact raw UTC IsoDateTime string of the target edge
                                finalCard.end_at = snappedIso as IsoDateTime
                            } else {
                                // Not snapped, round to 5 mins
                                const endMin =
                                    Math.round(
                                        (override.top +
                                            override.height -
                                            TOP_MARGIN) /
                                            pixelsPerMinuteSignal.value /
                                            5
                                    ) * 5
                                finalCard.end_at = timeToISO(
                                    formatMin(endMin),
                                    dateStr
                                )
                            }
                        }
                    }
                }

                updates.push({
                    type: le.type,
                    card: finalCard,
                    originalStartAt: le.card.start_at as IsoDateTime,
                })
            })

            // Check if any modified card is a recurring routine
            const recurringRoutines = updates.filter((up) => {
                if (up.type !== "routine") return false
                const routine = up.card as RoutineCard
                return (
                    routine._isVirtual ||
                    !!routine.rrule ||
                    !!routine.parent_routine_id
                )
            })

            if (recurringRoutines.length > 0) {
                // Keep the updates registered for confirmation callbacks
                pendingUpdatesRef.current = updates
                setConfirmDragState({
                    type: "routine",
                    card: recurringRoutines[0].card as RoutineCard,
                    originalStartAt: recurringRoutines[0].originalStartAt,
                })
            } else {
                // Immediately save all changes concurrently
                for (const up of updates) {
                    if (up.type === "routine") {
                        upsertRoutineCard(up.card as RoutineCard)
                        await SyncService.save(
                            routineCardConfig,
                            up.card as RoutineCard
                        )
                    } else {
                        upsertTimeTrackerCard(up.card as TimeTrackerCard)
                        await SyncService.save(
                            timeTrackerCardConfig,
                            up.card as TimeTrackerCard
                        )
                    }
                }
                setTimeout(() => {
                    dragOverridesSignal.value = {}
                }, 50)
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
            updateDragPosition(clientY)
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
                                    isActive={
                                        allTimeTrackerCards.find(
                                            (c) => c.id === task.id
                                        )?.end_at === null
                                    }
                                    getTagColor={getTagColor}
                                    getTagName={getTagName}
                                    onPress={(e) => {
                                        const original =
                                            allTimeTrackerCards.find(
                                                (c) => c.id === task.id
                                            ) || task
                                        handleCardPress(
                                            e,
                                            "timeTracker",
                                            original
                                        )
                                    }}
                                    onClick={() => {
                                        if (!wasDragged.current) {
                                            const original =
                                                allTimeTrackerCards.find(
                                                    (c) => c.id === task.id
                                                ) || task
                                            setEditingState({
                                                type: "timeTracker",
                                                card: original,
                                            })
                                        }
                                    }}
                                    onStop={() => handleStopTracker(task.id)}
                                    layout={timeTrackerLayoutMap.get(task.id)}
                                />
                            ))}
                            <TimeTrackerActionButton
                                onAction={handleTimeTrackerAction}
                                isCurrentDay={isCurrentDay}
                                currentTime={now}
                                hasActiveTasks={allTimeTrackerCards.some(
                                    (c) => c.end_at === null && !c.is_deleted
                                )}
                            />
                            <LinkIndicatorLayer
                                cards={currentDateTimeTrackerCards.filter(
                                    (t) => !t.is_deleted
                                )}
                                currentDate={currentDate}
                                layoutMap={timeTrackerLayoutMap}
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
                            <LinkIndicatorLayer
                                cards={currentDateRoutineCards.filter(
                                    (r) => !r.is_deleted
                                )}
                                currentDate={currentDate}
                                layoutMap={routineLayoutMap}
                            />
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
                    isNew={editingState.isNew}
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
                    isNew={editingState.isNew}
                    onSave={async (updated) => {
                        upsertTimeTrackerCard(updated)
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
                        for (const up of pendingUpdatesRef.current) {
                            if (up.type === "routine") {
                                const routine = up.card as RoutineCard
                                const isRecurring =
                                    routine._isVirtual ||
                                    !!routine.rrule ||
                                    !!routine.parent_routine_id
                                if (isRecurring) {
                                    if (routine._isVirtual) {
                                        const masterId = routine.id.split(
                                            "_"
                                        )[0] as RoutineCardId
                                        const detachedInstance: RoutineCard = {
                                            ...routine,
                                            id: uuidv4() as RoutineCardId,
                                            parent_routine_id: masterId,
                                            original_recurrence_date:
                                                up.originalStartAt,
                                            _isVirtual: undefined,
                                            updated_at:
                                                now.toISOString() as IsoDateTime,
                                        }
                                        upsertRoutineCard(detachedInstance)
                                        await SyncService.save(
                                            routineCardConfig,
                                            detachedInstance
                                        )
                                    } else {
                                        upsertRoutineCard(routine)
                                        await SyncService.save(
                                            routineCardConfig,
                                            routine
                                        )
                                    }
                                } else {
                                    upsertRoutineCard(routine)
                                    await SyncService.save(
                                        routineCardConfig,
                                        routine
                                    )
                                }
                            } else {
                                upsertTimeTrackerCard(
                                    up.card as TimeTrackerCard
                                )
                                await SyncService.save(
                                    timeTrackerCardConfig,
                                    up.card as TimeTrackerCard
                                )
                            }
                        }
                        closeConfirmDragDialog(false)
                        setTimeout(() => {
                            dragOverridesSignal.value = {}
                        }, 50)
                    }}
                    onAllOccurrences={async () => {
                        for (const up of pendingUpdatesRef.current) {
                            if (up.type === "routine") {
                                const routine = up.card as RoutineCard
                                const isRecurring =
                                    routine._isVirtual ||
                                    !!routine.rrule ||
                                    !!routine.parent_routine_id

                                if (isRecurring) {
                                    const masterId = routine._isVirtual
                                        ? routine.id.split("_")[0]
                                        : routine.id
                                    const master = allRoutineCards.find(
                                        (c) => c.id === masterId
                                    )

                                    if (master) {
                                        const masterStartDatePart =
                                            formatLocalDate(
                                                new Date(master.start_at)
                                            )
                                        const timePartStart = isoToTime(
                                            routine.start_at
                                        )
                                        const timePartEnd = isoToTime(
                                            routine.end_at
                                        )

                                        const instanceStartDatePart =
                                            formatLocalDate(
                                                new Date(routine.start_at)
                                            )
                                        const instanceEndDatePart =
                                            formatLocalDate(
                                                new Date(routine.end_at)
                                            )

                                        const [y1, m1, d1] =
                                            instanceStartDatePart
                                                .split("-")
                                                .map(Number)
                                        const [y2, m2, d2] = instanceEndDatePart
                                            .split("-")
                                            .map(Number)

                                        const dStart = new Date(y1, m1 - 1, d1)
                                        const dEnd = new Date(y2, m2 - 1, d2)
                                        const dayDiff = Math.round(
                                            (dEnd.getTime() -
                                                dStart.getTime()) /
                                                (1000 * 60 * 60 * 24)
                                        )

                                        const [my, mm, md] = masterStartDatePart
                                            .split("-")
                                            .map(Number)
                                        const masterEndDate = new Date(
                                            my,
                                            mm - 1,
                                            md
                                        )
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
                                            updated_at:
                                                now.toISOString() as IsoDateTime,
                                        }
                                        upsertRoutineCard(updatedMaster)
                                        await SyncService.save(
                                            routineCardConfig,
                                            updatedMaster
                                        )
                                    }
                                } else {
                                    upsertRoutineCard(routine)
                                    await SyncService.save(
                                        routineCardConfig,
                                        routine
                                    )
                                }
                            } else {
                                upsertTimeTrackerCard(
                                    up.card as TimeTrackerCard
                                )
                                await SyncService.save(
                                    timeTrackerCardConfig,
                                    up.card as TimeTrackerCard
                                )
                            }
                        }
                        closeConfirmDragDialog(false)
                        setTimeout(() => {
                            dragOverridesSignal.value = {}
                        }, 50)
                    }}
                    onCancel={() => closeConfirmDragDialog(true)}
                />
            )}
        </div>
    )
}
