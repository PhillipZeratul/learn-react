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
    isTouchEvent,
    formatLocalDate,
    getNowISO,
    resolveTagColor,
    TOP_MARGIN,
    BOTTOM_MARGIN,
} from "../utils/utils"
import { getAbsoluteBounds } from "../utils/time-coordinates"
import { RoutineTimeTrackerService } from "../services/routine-time-tracker.service"
import { RoutineEditor } from "./RoutineEditor"
import { TimeTrackerEditor } from "./TimeTrackerEditor"
import {
    getRoutineInstancesForDateRange,
    splitRoutineSeries,
} from "../utils/routine-expansion"
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
    dragLeftSignal,
    isHoveringTrackerColumnSignal,
} from "../stores/drag.store"
import { useBackAction } from "@/hooks/useBackAction"
import {
    detectShake,
    calculateSnap,
    calculateLinkedBounds,
} from "../utils/drag"

const FULL_DAY_MIN = 24 * 60
const DAY_BUFFER_DAYS = 1

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
    initialMouseX: number
    mode: DragMode
}

const TrackerDropZoneHighlight = () => {
    const highlightRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const dispose = effect(() => {
            const isHovering = isHoveringTrackerColumnSignal.value
            if (highlightRef.current) {
                if (isHovering) {
                    highlightRef.current.className =
                        "pointer-events-none absolute inset-0 z-0 rounded-xl border-2 transition-all duration-200 border-primary bg-primary/5 opacity-100"
                } else {
                    highlightRef.current.className =
                        "pointer-events-none absolute inset-0 z-0 rounded-xl border-2 transition-all duration-200 border-transparent opacity-0"
                }
            }
        })
        return () => dispose()
    }, [])

    return (
        <div
            ref={highlightRef}
            className="pointer-events-none absolute inset-0 z-0 rounded-xl border-2 border-transparent opacity-0 transition-all duration-200"
        />
    )
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

    // O(1) lookup for "is this tracker currently running" (#5)
    const activeTrackerIds = useMemo(
        () =>
            new Set(
                allTimeTrackerCards
                    .filter((c) => c.end_at === null)
                    .map((c) => c.id)
            ),
        [allTimeTrackerCards]
    )

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

    const [baseDate, setBaseDate] = useState<Date | null>(null)
    const [currentDate, setCurrentDate] = useState<Date | null>(null)
    const DAYS_TO_RENDER = 10

    // Day-range virtualization (#8): only cards/labels intersecting the
    // visible days (± buffer) are mounted. Everything is absolutely
    // positioned in container space, so unmounted days need no placeholders.
    // Initial range centers on today (baseDate starts as today - 7 days).
    const [dayRange, setDayRange] = useState(() => {
        const todayIdx = Math.min(DAYS_TO_RENDER - 1, 7)
        return {
            start: Math.max(0, todayIdx - 2),
            end: Math.min(DAYS_TO_RENDER - 1, todayIdx + 2),
        }
    })
    const dayRangeRef = useRef<{ start: number; end: number } | null>(null)

    const [now, setNow] = useState<Date | null>(null)

    useEffect(() => {
        const initialDate = new Date()
        // Defer to next tick to avoid cascading render lint error
        const timer = setTimeout(() => {
            const bDate = new Date(initialDate)
            bDate.setHours(0, 0, 0, 0)
            bDate.setDate(bDate.getDate() - 7)
            setBaseDate(bDate)
            setCurrentDate(initialDate)
            setNow(initialDate)
        }, 0)

        // Tick at minute precision (#6): the UI displays minute-level times
        // (1 minute = 1px at zoom 1), so sub-minute re-renders are pure
        // churn. Returning the previous reference lets React bail out.
        const interval = setInterval(() => {
            const next = new Date()
            setNow((prev) =>
                prev &&
                Math.floor(prev.getTime() / 60000) ===
                    Math.floor(next.getTime() / 60000)
                    ? prev
                    : next
            )
        }, 1000)
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
        if (!baseDate || !now) return []
        const endDate = new Date(baseDate)
        endDate.setDate(endDate.getDate() + DAYS_TO_RENDER)
        return allTimeTrackerCards.reduce<TimeTrackerCard[]>((acc, c) => {
            if (!c.is_deleted) {
                const cStartMs = new Date(c.start_at).getTime()
                const cEndMs = c.end_at
                    ? new Date(c.end_at).getTime()
                    : now.getTime()
                if (
                    cStartMs <= endDate.getTime() &&
                    cEndMs >= baseDate.getTime()
                ) {
                    // For active tasks, virtualize end_at to 'now' for real-time UI updates
                    if (c.end_at === null) {
                        acc.push({
                            ...c,
                            end_at: now.toISOString() as IsoDateTime,
                            _isActive: true,
                        })
                    } else {
                        acc.push(c)
                    }
                }
            }
            return acc
        }, [])
    }, [allTimeTrackerCards, baseDate, now])

    const currentDateRoutineCards = useMemo(() => {
        if (!baseDate) return []
        const endDate = new Date(baseDate)
        endDate.setDate(endDate.getDate() + DAYS_TO_RENDER)

        // Subtract 1 ms to prevent including the boundary day
        // if endDate is exactly 00:00 of the next day
        const effectiveEndDate = new Date(endDate.getTime() - 1)

        return getRoutineInstancesForDateRange(
            allRoutineCards,
            baseDate,
            effectiveEndDate
        )
    }, [allRoutineCards, baseDate])

    const routineLayoutMap = useMemo(() => {
        if (!baseDate) return new Map()
        return calculateLayout(
            currentDateRoutineCards.filter((t) => !t.is_deleted),
            baseDate
        )
    }, [currentDateRoutineCards, baseDate])

    const timeTrackerLayoutMap = useMemo(() => {
        if (!baseDate) return new Map()
        return calculateLayout(
            currentDateTimeTrackerCards.filter((t) => !t.is_deleted),
            baseDate
        )
    }, [currentDateTimeTrackerCards, baseDate])

    // Virtualization filter (#8): keep only cards intersecting rendered days.
    // Cards spanning midnight are kept if *any* intersected day is rendered.
    const isCardInRenderedRange = useCallback(
        (startMin: number, duration: number) => {
            const totalMin = DAYS_TO_RENDER * FULL_DAY_MIN
            const clampedStart = Math.max(0, startMin)
            const clampedEnd = Math.min(totalMin, startMin + duration)
            const startDay = Math.floor(clampedStart / FULL_DAY_MIN)
            const endDay = Math.floor(
                Math.max(clampedStart, clampedEnd - 1e-6) / FULL_DAY_MIN
            )
            return endDay >= dayRange.start && startDay <= dayRange.end
        },
        [dayRange, DAYS_TO_RENDER]
    )

    const renderedTimeTrackerCards = useMemo(() => {
        if (!baseDate) return []
        return currentDateTimeTrackerCards.filter((c) => {
            const { startMin, duration } = getAbsoluteBounds(
                c.start_at,
                c.end_at,
                baseDate
            )
            return isCardInRenderedRange(startMin, duration)
        })
    }, [currentDateTimeTrackerCards, baseDate, isCardInRenderedRange])

    const renderedRoutineCards = useMemo(() => {
        if (!baseDate) return []
        return currentDateRoutineCards.filter((c) => {
            if (c.is_deleted) return false
            const { startMin, duration } = getAbsoluteBounds(
                c.start_at,
                c.end_at,
                baseDate
            )
            return isCardInRenderedRange(startMin, duration)
        })
    }, [currentDateRoutineCards, baseDate, isCardInRenderedRange])

    const [editingState, setEditingState] = useState<EditingState>(null)
    const [dragState, setDragState] = useState<DragState | null>(null)

    useEffect(() => {
        dragStateRef.current = dragState
    }, [dragState])

    // ── Stable TaskCard dispatchers (#5) ───────────────────────────────────
    // TaskCard is memoized; fresh inline closures on every widget render
    // would defeat the memo. These wrappers never change identity — they
    // forward to the latest handlers via refs.
    const cardPressRef = useRef<
        (
            e: React.MouseEvent | React.TouchEvent,
            type: "routine" | "timeTracker",
            card: RoutineCard | TimeTrackerCard
        ) => void
    >(() => {})
    const cardClickRef = useRef<
        (
            type: "routine" | "timeTracker",
            card: RoutineCard | TimeTrackerCard
        ) => void
    >(() => {})
    const stopTrackerRef = useRef<(id: TimeTrackerCardId) => void>(() => {})

    const stableCardPress = useCallback(
        (
            e: React.MouseEvent | React.TouchEvent,
            type: "routine" | "timeTracker",
            card: RoutineCard | TimeTrackerCard
        ) => cardPressRef.current(e, type, card),
        []
    )
    const stableCardClick = useCallback(
        (
            type: "routine" | "timeTracker",
            card: RoutineCard | TimeTrackerCard
        ) => cardClickRef.current(type, card),
        []
    )
    const stableStopTracker = useCallback(
        (id: TimeTrackerCardId) => stopTrackerRef.current(id),
        []
    )

    useEffect(() => {
        stopTrackerRef.current = handleStopTracker
    })
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

    // Zoom preview state (#7): during a zoom gesture only a compositor
    // transform is updated; the real zoom (--ppm/height/scrollTop) is
    // committed exactly once at gesture end.
    const previewZoomRef = useRef(zoomLevelSignal.peek())
    const previewActiveRef = useRef(false)
    const overscrollPxRef = useRef(0)
    const previewFocalContentYRef = useRef(0)
    const dragStateRef = useRef<DragState | null>(null)

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
            primaryEdge?: "start" | "end"
        }>
    >([])

    const snapTargetsRef = useRef<number[]>([])
    const snapTargetISOMapRef = useRef<Map<number, string>>(new Map())
    const snappedTargetRef = useRef<number | null>(null)
    const bypassedSnapsRef = useRef<Set<number>>(new Set())
    const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const snappedEdgeRef = useRef<"top" | "bottom" | null>(null)

    // Track the last clientY during drags to re-trigger updates on hold-timer snap breaks
    const lastDragYRef = useRef<number>(0)
    const lastDragXRef = useRef<number>(0)
    const updateDragPositionRef = useRef<
        (clientY: number, clientX?: number) => void
    >(() => {})

    // Registry for pending multi-card concurrent updates
    const pendingUpdatesRef = useRef<
        Array<{
            type: "routine" | "timeTracker"
            card: RoutineCard | TimeTrackerCard
            originalStartAt: IsoDateTime
        }>
    >([])

    const updateDragPosition = useCallback(
        (clientY: number, clientX?: number) => {
            if (!dragState) return

            const ppm = pixelsPerMinuteSignal.value
            lastDragYRef.current = clientY
            if (clientX !== undefined) lastDragXRef.current = clientX

            // Handle horizontal drag
            if (clientX !== undefined && dragState.type === "routine") {
                const deltaX = clientX - dragState.initialMouseX
                if (deltaX < -20) {
                    dragLeftSignal.value = deltaX

                    if (scrollContainerRef.current) {
                        const rect =
                            scrollContainerRef.current.getBoundingClientRect()
                        const relativeX = clientX - rect.left
                        const contentWidth =
                            scrollContainerRef.current.clientWidth
                        const isTimeTrackerBlock = relativeX < contentWidth / 2
                        isHoveringTrackerColumnSignal.value = isTimeTrackerBlock
                    }
                } else {
                    dragLeftSignal.value = 0
                    isHoveringTrackerColumnSignal.value = false
                }
            }

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

            // 2. Snapping Calculations
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
            } else if (dragState.mode === "center") {
                const requestedMinutesTop =
                    dragState.initialStartMin + deltaY / ppm
                const requestedPixelsTop =
                    requestedMinutesTop * ppm + TOP_MARGIN
                const requestedMinutesBottom =
                    dragState.initialEndMin + deltaY / ppm
                const requestedPixelsBottom =
                    requestedMinutesBottom * ppm + TOP_MARGIN

                if (snappedEdgeRef.current === "top") {
                    const {
                        snappedTargetVal: snapVal,
                        snapOffsetMinutes: snapOffset,
                        shouldBypass,
                        shouldStartTimer,
                    } = calculateSnap(
                        requestedPixelsTop,
                        snapTargetsRef.current,
                        bypassedSnapsRef.current,
                        ppm,
                        snappedTargetRef.current,
                        TOP_MARGIN
                    )

                    if (shouldBypass) {
                        if (snappedTargetRef.current !== null) {
                            bypassedSnapsRef.current.add(
                                snappedTargetRef.current
                            )
                            snappedTargetRef.current = null
                        }
                        snappedEdgeRef.current = null
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
                            snappedEdgeRef.current = null
                            snapTimerRef.current = null
                            updateDragPositionRef.current(lastDragYRef.current)
                        }, 3000)
                    } else if (snapVal !== null) {
                        snapOffsetMinutes = snapOffset
                    } else {
                        if (snappedTargetRef.current !== null) {
                            snappedTargetRef.current = null
                            snappedEdgeRef.current = null
                            if (snapTimerRef.current) {
                                clearTimeout(snapTimerRef.current)
                                snapTimerRef.current = null
                            }
                        }
                    }
                } else if (snappedEdgeRef.current === "bottom") {
                    const {
                        snappedTargetVal: snapVal,
                        snapOffsetMinutes: snapOffset,
                        shouldBypass,
                        shouldStartTimer,
                    } = calculateSnap(
                        requestedPixelsBottom,
                        snapTargetsRef.current,
                        bypassedSnapsRef.current,
                        ppm,
                        snappedTargetRef.current,
                        TOP_MARGIN
                    )

                    if (shouldBypass) {
                        if (snappedTargetRef.current !== null) {
                            bypassedSnapsRef.current.add(
                                snappedTargetRef.current
                            )
                            snappedTargetRef.current = null
                        }
                        snappedEdgeRef.current = null
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
                            snappedEdgeRef.current = null
                            snapTimerRef.current = null
                            updateDragPositionRef.current(lastDragYRef.current)
                        }, 3000)
                    } else if (snapVal !== null) {
                        snapOffsetMinutes = snapOffset
                    } else {
                        if (snappedTargetRef.current !== null) {
                            snappedTargetRef.current = null
                            snappedEdgeRef.current = null
                            if (snapTimerRef.current) {
                                clearTimeout(snapTimerRef.current)
                                snapTimerRef.current = null
                            }
                        }
                    }
                } else {
                    // Not currently snapped to either edge
                    const snapResultTop = calculateSnap(
                        requestedPixelsTop,
                        snapTargetsRef.current,
                        bypassedSnapsRef.current,
                        ppm,
                        null,
                        TOP_MARGIN
                    )
                    const snapResultBottom = calculateSnap(
                        requestedPixelsBottom,
                        snapTargetsRef.current,
                        bypassedSnapsRef.current,
                        ppm,
                        null,
                        TOP_MARGIN
                    )

                    const isTopSnapping =
                        snapResultTop.snappedTargetVal !== null
                    const isBottomSnapping =
                        snapResultBottom.snappedTargetVal !== null

                    if (isTopSnapping && isBottomSnapping) {
                        const targetPxTop =
                            snapResultTop.snappedTargetVal! * ppm + TOP_MARGIN
                        const diffTop = Math.abs(
                            requestedPixelsTop - targetPxTop
                        )

                        const targetPxBottom =
                            snapResultBottom.snappedTargetVal! * ppm +
                            TOP_MARGIN
                        const diffBottom = Math.abs(
                            requestedPixelsBottom - targetPxBottom
                        )

                        if (diffTop <= diffBottom) {
                            snappedEdgeRef.current = "top"
                            snappedTargetRef.current =
                                snapResultTop.snappedTargetVal
                            snapOffsetMinutes = snapResultTop.snapOffsetMinutes
                            if (snapResultTop.shouldStartTimer !== null) {
                                if (snapTimerRef.current)
                                    clearTimeout(snapTimerRef.current)
                                snapTimerRef.current = setTimeout(() => {
                                    bypassedSnapsRef.current.add(
                                        snapResultTop.shouldStartTimer!
                                    )
                                    snappedTargetRef.current = null
                                    snappedEdgeRef.current = null
                                    snapTimerRef.current = null
                                    updateDragPositionRef.current(
                                        lastDragYRef.current
                                    )
                                }, 3000)
                            }
                        } else {
                            snappedEdgeRef.current = "bottom"
                            snappedTargetRef.current =
                                snapResultBottom.snappedTargetVal
                            snapOffsetMinutes =
                                snapResultBottom.snapOffsetMinutes
                            if (snapResultBottom.shouldStartTimer !== null) {
                                if (snapTimerRef.current)
                                    clearTimeout(snapTimerRef.current)
                                snapTimerRef.current = setTimeout(() => {
                                    bypassedSnapsRef.current.add(
                                        snapResultBottom.shouldStartTimer!
                                    )
                                    snappedTargetRef.current = null
                                    snappedEdgeRef.current = null
                                    snapTimerRef.current = null
                                    updateDragPositionRef.current(
                                        lastDragYRef.current
                                    )
                                }, 3000)
                            }
                        }
                    } else if (isTopSnapping) {
                        snappedEdgeRef.current = "top"
                        snappedTargetRef.current =
                            snapResultTop.snappedTargetVal
                        snapOffsetMinutes = snapResultTop.snapOffsetMinutes
                        if (snapResultTop.shouldStartTimer !== null) {
                            if (snapTimerRef.current)
                                clearTimeout(snapTimerRef.current)
                            snapTimerRef.current = setTimeout(() => {
                                bypassedSnapsRef.current.add(
                                    snapResultTop.shouldStartTimer!
                                )
                                snappedTargetRef.current = null
                                snappedEdgeRef.current = null
                                snapTimerRef.current = null
                                updateDragPositionRef.current(
                                    lastDragYRef.current
                                )
                            }, 3000)
                        }
                    } else if (isBottomSnapping) {
                        snappedEdgeRef.current = "bottom"
                        snappedTargetRef.current =
                            snapResultBottom.snappedTargetVal
                        snapOffsetMinutes = snapResultBottom.snapOffsetMinutes
                        if (snapResultBottom.shouldStartTimer !== null) {
                            if (snapTimerRef.current)
                                clearTimeout(snapTimerRef.current)
                            snapTimerRef.current = setTimeout(() => {
                                bypassedSnapsRef.current.add(
                                    snapResultBottom.shouldStartTimer!
                                )
                                snappedTargetRef.current = null
                                snappedEdgeRef.current = null
                                snapTimerRef.current = null
                                updateDragPositionRef.current(
                                    lastDragYRef.current
                                )
                            }, 3000)
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
                let maxStartMin = Infinity
                if (dragState.type === "timeTracker") {
                    const realNow = new Date()
                    const nowMinutes =
                        (realNow.getTime() - baseDate!.getTime()) / 60000
                    maxStartMin = Math.min(maxStartMin, nowMinutes - duration)
                }

                newStartMin = Math.max(0, Math.min(maxStartMin, newStartMin))

                const top = newStartMin * ppm + TOP_MARGIN
                const height = duration * ppm

                nextOverrides[dragState.card.id] = { top, height }

                // Shift linked edges for secondary cards based on actual clamped delta
                const clampedDeltaMin = newStartMin - dragState.initialStartMin
                linkedEdgesRef.current.forEach((le) => {
                    if (le.card.id === dragState.card.id) return

                    let startMin = le.initialStartMin
                    let endMin = le.initialEndMin

                    if (le.edge === "start") {
                        startMin = le.initialStartMin + clampedDeltaMin
                    } else {
                        endMin = le.initialEndMin + clampedDeltaMin
                    }

                    const topLinked = startMin * ppm + TOP_MARGIN
                    const heightLinked = (endMin - startMin) * ppm

                    nextOverrides[le.card.id] = {
                        top: topLinked,
                        height: heightLinked,
                    }
                })

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
                if (dragState.type === "timeTracker") {
                    const realNow = new Date()
                    const nowMinutes =
                        (realNow.getTime() - baseDate!.getTime()) / 60000
                    maxEdgeMin = Math.min(maxEdgeMin, nowMinutes)
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
        [dragState, baseDate]
    )

    useEffect(() => {
        updateDragPositionRef.current = updateDragPosition
    }, [updateDragPosition])

    // Synchronize zoom signal with DOM elements to avoid React re-renders.
    // Only runs on zoom *commits* (once per gesture) thanks to the
    // transform-preview architecture — never per wheel/touchmove frame.
    useEffect(() => {
        const dispose = effect(() => {
            const ppm = pixelsPerMinuteSignal.value
            const zoom = zoomLevelSignal.value

            if (timelineContainerRef.current) {
                const style = timelineContainerRef.current.style
                style.height = `${DAYS_TO_RENDER * FULL_DAY_MIN * ppm + BOTTOM_MARGIN}px`
                style.setProperty("--ppm", ppm.toString())

                // Label-tier fade variables (consumed by TimelineGrid)
                const halfOpacity = Math.max(0, Math.min(1, (zoom - 2) * 2))
                const tenOpacity = Math.max(0, Math.min(1, (zoom - 4) * 2))
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
    }, [DAYS_TO_RENDER])

    // Scroll to current time on mount and focus
    const scrollToCurrentTime = useCallback(
        (smooth: boolean = true) => {
            if (!scrollContainerRef.current || !baseDate) return

            const scrollNow = new Date()
            const currentMinutes =
                (scrollNow.getTime() - baseDate.getTime()) / 60000
            const targetY =
                currentMinutes * pixelsPerMinuteSignal.value + TOP_MARGIN
            const containerHeight = scrollContainerRef.current.clientHeight

            scrollContainerRef.current.scrollTo({
                top: targetY - containerHeight / 2,
                behavior: smooth ? "smooth" : "auto",
            })
        },
        [baseDate]
    )

    // Recompute which days are visible (± buffer) — drives virtualization.
    // Cheap; only triggers a re-render when the integer day range changes.
    const updateVisibleRange = useCallback(() => {
        const container = scrollContainerRef.current
        if (!container) return

        const ppm = pixelsPerMinuteSignal.peek()
        const dayPx = FULL_DAY_MIN * ppm
        const start = Math.max(
            0,
            Math.floor((container.scrollTop - TOP_MARGIN) / dayPx) -
                DAY_BUFFER_DAYS
        )
        const end = Math.min(
            DAYS_TO_RENDER - 1,
            Math.floor(
                (container.scrollTop + container.clientHeight - TOP_MARGIN) /
                    dayPx
            ) + DAY_BUFFER_DAYS
        )

        const prev = dayRangeRef.current
        if (!prev || prev.start !== start || prev.end !== end) {
            const next = { start, end }
            dayRangeRef.current = next
            setDayRange(next)
        }
    }, [DAYS_TO_RENDER])

    useEffect(() => {
        // Initial scroll - jump immediately (no smooth animation)
        const timer = setTimeout(() => {
            scrollToCurrentTime(false)
            updateVisibleRange()
        }, 10)

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                const currentNow = new Date()
                let shouldScroll = false

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
                    scrollToCurrentTime(false)
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
    }, [setCurrentDate, scrollToCurrentTime, updateVisibleRange])

    useEffect(() => {
        if (!scrollContainerRef.current) return
        const container = scrollContainerRef.current

        let initialTouchDistance = 0
        let initialZoom = 1
        let snapBackRafId: number | null = null
        let wheelTimeout: ReturnType<typeof setTimeout> | null = null
        let lastFocalYViewport = container.clientHeight / 2

        // ── Zoom preview/commit (#7) ───────────────────────────────────────
        // During a zoom gesture only a compositor-friendly
        // `transform: scaleY()` is applied to the timeline container (no
        // style recalc, no layout). The real zoom (--ppm, container height,
        // scrollTop) is committed exactly once when the gesture ends.

        const writeTransform = () => {
            const el = timelineContainerRef.current
            if (!el) return
            const overscroll = overscrollPxRef.current
            const scale = previewActiveRef.current
                ? previewZoomRef.current / zoomLevelSignal.value
                : 1

            if (overscroll === 0 && scale === 1) {
                el.style.transform = ""
                el.style.transformOrigin = ""
                el.style.willChange = ""
                el.style.removeProperty("--preview-scale-y")
                el.style.removeProperty("--inverse-preview-scale-y")
                return
            }

            // translateY is unaffected by transform-origin; scaleY is pinned
            // to the focal content point so it stays fixed in the viewport.
            el.style.transformOrigin = `0 ${previewFocalContentYRef.current}px`
            el.style.transform = `translateY(${overscroll}px) scaleY(${scale})`
            el.style.willChange = "transform"
            el.style.setProperty("--preview-scale-y", scale.toString())
            el.style.setProperty(
                "--inverse-preview-scale-y",
                (1 / scale).toString()
            )
        }

        const commitZoom = (nextZoom: number, focalYViewport: number) => {
            const oldZoom = zoomLevelSignal.value
            previewActiveRef.current = false
            previewZoomRef.current = nextZoom

            if (oldZoom === nextZoom) {
                writeTransform() // just clears any leftover preview transform
                return
            }

            const s1 = container.scrollTop

            // Apply new zoom (synchronously flushes height/--ppm/tier vars)
            zoomLevelSignal.value = nextZoom

            // Adjust scroll position to keep focal point fixed relative to the viewport
            container.scrollTop =
                (s1 + focalYViewport - TOP_MARGIN) * (nextZoom / oldZoom) +
                TOP_MARGIN -
                focalYViewport

            // Clear the preview transform in the same frame as the layout commit
            writeTransform()
            updateVisibleRange()
        }

        const applyZoomPreview = (nextZoom: number, focalYViewport: number) => {
            // Drag math reads the committed ppm — never preview during a drag
            if (dragStateRef.current) {
                commitZoom(nextZoom, focalYViewport)
                return
            }
            previewZoomRef.current = nextZoom
            previewActiveRef.current = true
            previewFocalContentYRef.current =
                container.scrollTop + focalYViewport
            writeTransform()
        }

        const snapBackZoom = (focalYViewport: number) => {
            if (snapBackRafId) cancelAnimationFrame(snapBackRafId)

            const minZoom = 1
            const maxZoom = 6
            const currentZoom = previewZoomRef.current

            if (currentZoom >= minZoom && currentZoom <= maxZoom) {
                commitZoom(currentZoom, focalYViewport)
                return
            }

            const targetZoom = currentZoom < minZoom ? minZoom : maxZoom

            // Rubber-band back using cheap transform-only preview frames
            const animate = () => {
                const z = previewZoomRef.current
                const diff = targetZoom - z
                if (Math.abs(diff) < 0.001) {
                    commitZoom(targetZoom, focalYViewport)
                    return
                }
                applyZoomPreview(z + diff * 0.35, focalYViewport)
                snapBackRafId = requestAnimationFrame(animate)
            }
            snapBackRafId = requestAnimationFrame(animate)
        }

        let overscrollY = 0
        let overscrollRafId: number | null = null

        const updateOverscroll = (dy: number) => {
            const oldSign = Math.sign(overscrollY)
            overscrollY += dy
            const newSign = Math.sign(overscrollY)

            if (oldSign !== 0 && overscrollY !== 0 && oldSign !== newSign) {
                overscrollY = 0 // Crossed 0 threshold
            }

            const maxOverscroll = 250
            const sign = Math.sign(overscrollY)
            const abs = Math.abs(overscrollY)
            const dampened = maxOverscroll * (1 - Math.exp(-abs / 200))

            overscrollPxRef.current = sign * dampened
            writeTransform()

            return overscrollY !== 0
        }

        const snapBackOverscroll = () => {
            if (overscrollRafId) cancelAnimationFrame(overscrollRafId)
            const animate = () => {
                if (Math.abs(overscrollY) < 1) {
                    overscrollY = 0
                    overscrollPxRef.current = 0
                    writeTransform()
                    return
                }
                overscrollY *= 0.8
                const maxOverscroll = 250
                const sign = Math.sign(overscrollY)
                const abs = Math.abs(overscrollY)
                const dampened = maxOverscroll * (1 - Math.exp(-abs / 200))
                overscrollPxRef.current = sign * dampened
                writeTransform()
                overscrollRafId = requestAnimationFrame(animate)
            }
            overscrollRafId = requestAnimationFrame(animate)
        }

        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault()
                if (snapBackRafId) cancelAnimationFrame(snapBackRafId)

                const rect = container.getBoundingClientRect()
                const focalYViewport = e.clientY - rect.top
                lastFocalYViewport = focalYViewport

                const delta = -e.deltaY * 0.005
                const currentZoom = previewZoomRef.current
                let nextZoom = currentZoom + delta

                // Overshoot resistance
                if (nextZoom < 1) {
                    nextZoom = currentZoom + delta * 0.1
                } else if (nextZoom > 6) {
                    nextZoom = currentZoom + delta * 0.1
                }

                nextZoom = Math.max(0.9, Math.min(8, nextZoom))
                applyZoomPreview(nextZoom, focalYViewport)

                if (wheelTimeout) clearTimeout(wheelTimeout)
                wheelTimeout = setTimeout(() => {
                    snapBackZoom(focalYViewport)
                }, 50)
            } else {
                // A scroll intent ends any active zoom gesture
                if (previewActiveRef.current) {
                    if (wheelTimeout) clearTimeout(wheelTimeout)
                    commitZoom(previewZoomRef.current, lastFocalYViewport)
                }

                const atTop = container.scrollTop <= 0
                const atBottom =
                    container.scrollTop + container.clientHeight >=
                    container.scrollHeight - 1

                if (
                    (atTop && e.deltaY < 0) ||
                    (atBottom && e.deltaY > 0) ||
                    overscrollY !== 0
                ) {
                    e.preventDefault()
                    if (overscrollRafId) cancelAnimationFrame(overscrollRafId)
                    updateOverscroll(-e.deltaY * 0.5)

                    if (wheelTimeout) clearTimeout(wheelTimeout)
                    wheelTimeout = setTimeout(snapBackOverscroll, 50)
                }
            }
        }

        const handleGestureStart = (e: Event) => {
            e.preventDefault()
            if (snapBackRafId) cancelAnimationFrame(snapBackRafId)
            initialZoom = previewZoomRef.current
        }

        const handleGestureChange = (e: Event) => {
            e.preventDefault()
            const gestureEvent = e as unknown as { scale: number }
            let nextZoom = initialZoom * gestureEvent.scale

            if (nextZoom < 1) {
                nextZoom = 1 - (1 - nextZoom) * 0.15
            } else if (nextZoom > 6) {
                nextZoom = 6 + (nextZoom - 6) * 0.15
            }

            nextZoom = Math.max(0.5, Math.min(7, nextZoom))

            const focalYViewport = container.clientHeight / 2
            lastFocalYViewport = focalYViewport
            applyZoomPreview(nextZoom, focalYViewport)
        }

        const handleGestureEnd = (e: Event) => {
            e.preventDefault()
            snapBackZoom(lastFocalYViewport)
        }

        let lastTouchY = 0

        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 2) {
                if (snapBackRafId) cancelAnimationFrame(snapBackRafId)
                initialTouchDistance = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                )
                initialZoom = previewZoomRef.current
            } else if (e.touches.length === 1) {
                // A one-finger gesture (scroll/drag) ends any active zoom preview
                if (previewActiveRef.current) {
                    commitZoom(previewZoomRef.current, lastFocalYViewport)
                }
                lastTouchY = e.touches[0].clientY
                if (overscrollRafId) cancelAnimationFrame(overscrollRafId)
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
                lastFocalYViewport = focalYViewport

                const scale = currentDistance / initialTouchDistance
                let nextZoom = initialZoom * scale

                if (nextZoom < 1) {
                    nextZoom = 1 - (1 - nextZoom) * 0.15
                } else if (nextZoom > 6) {
                    nextZoom = 6 + (nextZoom - 6) * 0.15
                }

                nextZoom = Math.max(0.5, Math.min(7, nextZoom))
                applyZoomPreview(nextZoom, focalYViewport)
            } else if (e.touches.length === 1) {
                const clientY = e.touches[0].clientY
                const dy = clientY - lastTouchY
                lastTouchY = clientY

                const atTop = container.scrollTop <= 0
                const atBottom =
                    container.scrollTop + container.clientHeight >=
                    container.scrollHeight - 1

                if (
                    (atTop && dy > 0) ||
                    (atBottom && dy < 0) ||
                    overscrollY !== 0
                ) {
                    if (overscrollRafId) cancelAnimationFrame(overscrollRafId)
                    const isOverscrolling = updateOverscroll(dy * 1.5)
                    if (isOverscrolling) {
                        e.preventDefault()
                    }
                }
            }
        }

        const handleTouchEnd = (e: TouchEvent) => {
            if (e.touches.length < 2) {
                initialTouchDistance = 0
                snapBackZoom(lastFocalYViewport)
            }
            if (overscrollY !== 0) {
                snapBackOverscroll()
            }
        }

        const handleDoubleClick = () => {
            if (snapBackRafId) cancelAnimationFrame(snapBackRafId)
            if (wheelTimeout) clearTimeout(wheelTimeout)
            commitZoom(1, container.clientHeight / 2)
        }

        container.addEventListener("wheel", handleWheel, { passive: false })
        container.addEventListener("touchstart", handleTouchStart)
        container.addEventListener("touchmove", handleTouchMove, {
            passive: false,
        })
        container.addEventListener("touchend", handleTouchEnd)
        container.addEventListener("touchcancel", handleTouchEnd)
        container.addEventListener("dblclick", handleDoubleClick)
        container.addEventListener("gesturestart", handleGestureStart)
        container.addEventListener("gesturechange", handleGestureChange)
        container.addEventListener("gestureend", handleGestureEnd)

        return () => {
            if (snapBackRafId) cancelAnimationFrame(snapBackRafId)
            if (overscrollRafId) cancelAnimationFrame(overscrollRafId)
            if (wheelTimeout) clearTimeout(wheelTimeout)
            container.removeEventListener("wheel", handleWheel)
            container.removeEventListener("touchstart", handleTouchStart)
            container.removeEventListener("touchmove", handleTouchMove)
            container.removeEventListener("touchend", handleTouchEnd)
            container.removeEventListener("touchcancel", handleTouchEnd)
            container.removeEventListener("dblclick", handleDoubleClick)
            container.removeEventListener("gesturestart", handleGestureStart)
            container.removeEventListener("gesturechange", handleGestureChange)
            container.removeEventListener("gestureend", handleGestureEnd)
        }
    }, [currentDate, updateVisibleRange])

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

    // Stable identities so memoized TaskCards aren't re-rendered by these (#5)
    const getTagColor = useCallback(
        (tagId: string) => {
            const tag = tags.find((t) => t.id === tagId)
            return resolveTagColor(tag?.color || "#94a3b8")
        },
        [tags]
    )

    const getTagName = useCallback(
        (tagId: string) => {
            const tag = tags.find((t) => t.id === tagId)
            return tag?.name || "Task"
        },
        [tags]
    )

    const handleCreateTask = async (clientX: number, clientY: number) => {
        if (!scrollContainerRef.current || !baseDate) return

        const rect = scrollContainerRef.current.getBoundingClientRect()
        const relativeY =
            clientY - rect.top + scrollContainerRef.current.scrollTop
        const relativeX = clientX - rect.left
        const contentWidth = scrollContainerRef.current.clientWidth

        const minutesFromBase = Math.floor(
            (relativeY - TOP_MARGIN) / pixelsPerMinuteSignal.value
        )
        if (minutesFromBase < 0) return

        const roundedMinutes = Math.round(minutesFromBase / 30) * 30

        const startDays = Math.floor(roundedMinutes / (24 * 60))
        const startLocalMins = roundedMinutes % (24 * 60)
        const startTarget = new Date(baseDate)
        startTarget.setDate(startTarget.getDate() + startDays)

        const startHour = Math.floor(startLocalMins / 60)
        const startMin = startLocalMins % 60
        const dateStr = formatLocalDate(startTarget)
        const startTime = `${String(startHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`
        const startIso = timeToISO(startTime, dateStr)

        const endMinutes = roundedMinutes + 60
        const endDays = Math.floor(endMinutes / (24 * 60))
        const endLocalMins = endMinutes % (24 * 60)
        const endTarget = new Date(baseDate)
        endTarget.setDate(endTarget.getDate() + endDays)

        const endHour = Math.floor(endLocalMins / 60)
        const endMin = endLocalMins % 60
        const endDateStr = formatLocalDate(endTarget)
        const endTime = `${String(Math.min(24, endHour)).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`
        const endIso = timeToISO(endTime, endDateStr)

        const isTimeTrackerBlock = relativeX < contentWidth / 2

        if (isTimeTrackerBlock) {
            if (new Date(startIso).getTime() > Date.now()) {
                return
            }
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

    const handleCardClick = (
        type: "routine" | "timeTracker",
        card: RoutineCard | TimeTrackerCard
    ) => {
        if (wasDragged.current) return

        if (type === "timeTracker") {
            // Use the store's original object, not a virtualized copy
            const original =
                allTimeTrackerCards.find((c) => c.id === card.id) ??
                (card as TimeTrackerCard)
            setEditingState({ type: "timeTracker", card: original })
        } else {
            setEditingState({ type: "routine", card: card as RoutineCard })
        }
    }

    const handleCardPress = (
        e: React.MouseEvent | React.TouchEvent,
        type: "routine" | "timeTracker",
        rawTask: RoutineCard | TimeTrackerCard
    ) => {
        e.stopPropagation()

        // Rendered tracker cards may be virtualized copies (active tasks get a
        // synthetic end_at) — always operate on the store's original object.
        const task =
            type === "timeTracker"
                ? allTimeTrackerCards.find((c) => c.id === rawTask.id) ||
                  rawTask
                : rawTask

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
            const { startMin, duration } = getAbsoluteBounds(
                task.start_at,
                task.end_at,
                baseDate!
            )

            // Initialize snapping and linking states
            isUnlinkedRef.current = false
            shakeHistoryRef.current = []
            snappedTargetRef.current = null
            snappedEdgeRef.current = null
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
                primaryEdge?: "start" | "end"
            }> = []
            // Primary card's dragged edge is always included
            linked.push({
                card: task,
                edge:
                    mode === "top"
                        ? ("start" as const)
                        : mode === "bottom"
                          ? ("end" as const)
                          : ("start" as const),
                type,
                initialStartMin: startMin,
                initialEndMin: startMin + duration,
                primaryEdge:
                    mode === "top"
                        ? ("start" as const)
                        : mode === "bottom"
                          ? ("end" as const)
                          : ("start" as const),
            })

            const originalPrimaryCard =
                type === "timeTracker"
                    ? allTimeTrackerCards.find((otc) => otc.id === task.id)
                    : null
            const isPrimaryTrackingTask =
                originalPrimaryCard && originalPrimaryCard.end_at === null

            if (
                (mode === "top" || mode === "bottom") &&
                !(isPrimaryTrackingTask && mode === "bottom")
            ) {
                const targetTime = mode === "top" ? task.start_at : task.end_at
                if (targetTime) {
                    allDailyCards.forEach((c) => {
                        if (c.id === task.id) return
                        const { startMin: cStart, duration: cDur } =
                            getAbsoluteBounds(c.start_at, c.end_at, baseDate!)

                        const originalC =
                            type === "timeTracker"
                                ? allTimeTrackerCards.find(
                                      (otc) => otc.id === c.id
                                  )
                                : null
                        const isCTracking =
                            originalC && originalC.end_at === null

                        const isStartLinked =
                            c.start_at &&
                            targetTime &&
                            Math.abs(
                                new Date(c.start_at).getTime() -
                                    new Date(targetTime).getTime()
                            ) < 1000
                        const isEndLinked =
                            !isCTracking &&
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
            } else if (mode === "center") {
                const targetStartTime = task.start_at
                const targetEndTime = task.end_at

                allDailyCards.forEach((c) => {
                    if (c.id === task.id) return
                    const { startMin: cStart, duration: cDur } =
                        getAbsoluteBounds(c.start_at, c.end_at, baseDate!)

                    const originalC =
                        type === "timeTracker"
                            ? allTimeTrackerCards.find((otc) => otc.id === c.id)
                            : null
                    const isCTracking = originalC && originalC.end_at === null

                    // 1. Check if linked to task.start_at
                    if (targetStartTime) {
                        const isStartLinkedToStart =
                            c.start_at &&
                            Math.abs(
                                new Date(c.start_at).getTime() -
                                    new Date(targetStartTime).getTime()
                            ) < 1000
                        const isEndLinkedToStart =
                            !isCTracking &&
                            c.end_at &&
                            Math.abs(
                                new Date(c.end_at).getTime() -
                                    new Date(targetStartTime).getTime()
                            ) < 1000

                        if (isStartLinkedToStart) {
                            linked.push({
                                card: c,
                                edge: "start" as const,
                                type,
                                initialStartMin: cStart,
                                initialEndMin: cStart + cDur,
                                primaryEdge: "start" as const,
                            })
                        }
                        if (isEndLinkedToStart) {
                            linked.push({
                                card: c,
                                edge: "end" as const,
                                type,
                                initialStartMin: cStart,
                                initialEndMin: cStart + cDur,
                                primaryEdge: "start" as const,
                            })
                        }
                    }

                    // 2. Check if linked to task.end_at
                    if (targetEndTime) {
                        const isStartLinkedToEnd =
                            c.start_at &&
                            Math.abs(
                                new Date(c.start_at).getTime() -
                                    new Date(targetEndTime).getTime()
                            ) < 1000
                        const isEndLinkedToEnd =
                            !isCTracking &&
                            c.end_at &&
                            Math.abs(
                                new Date(c.end_at).getTime() -
                                    new Date(targetEndTime).getTime()
                            ) < 1000

                        if (isStartLinkedToEnd) {
                            linked.push({
                                card: c,
                                edge: "start" as const,
                                type,
                                initialStartMin: cStart,
                                initialEndMin: cStart + cDur,
                                primaryEdge: "end" as const,
                            })
                        }
                        if (isEndLinkedToEnd) {
                            linked.push({
                                card: c,
                                edge: "end" as const,
                                type,
                                initialStartMin: cStart,
                                initialEndMin: cStart + cDur,
                                primaryEdge: "end" as const,
                            })
                        }
                    }
                })
            }
            linkedEdgesRef.current = linked

            // Collection of Snapping Targets
            const snapTargets = new Set<number>()
            const timeMap = new Map<number, string>()
            allDailyCards.forEach((c) => {
                if (linked.some((le) => le.card.id === c.id)) return
                const { startMin: cStart, duration: cDur } = getAbsoluteBounds(
                    c.start_at,
                    c.end_at,
                    baseDate!
                )

                const isCTracking =
                    type === "timeTracker" &&
                    (c as TimeTrackerCard).end_at === null

                snapTargets.add(cStart)
                timeMap.set(cStart, c.start_at)

                if (c.end_at && !isCTracking) {
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
                initialMouseX: clientX,
                mode,
            })
            longPressTimer.current = null
        }, 500)
    }

    useEffect(() => {
        cardPressRef.current = handleCardPress
    })
    useEffect(() => {
        cardClickRef.current = handleCardClick
    })

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

            if (
                dragState.type === "routine" &&
                isHoveringTrackerColumnSignal.value
            ) {
                const routine = dragState.card as RoutineCard
                const newTrackerCard = createTimeTrackerCard({
                    title: routine.title,
                    tag_id: routine.tag_id,
                    start_at: getNowISO(),
                    end_at: null,
                })

                upsertTimeTrackerCard(newTrackerCard)
                SyncService.save(timeTrackerCardConfig, newTrackerCard)

                // eslint-disable-next-line react-hooks/immutability
                dragLeftSignal.value = 0
                // eslint-disable-next-line react-hooks/immutability
                isHoveringTrackerColumnSignal.value = false
                snappedEdgeRef.current = null
                setDragState(null)

                setTimeout(() => {
                    dragOverridesSignal.value = {}
                }, 50)
                return
            }

            // Read final overrides
            const finalOverrides = { ...dragOverridesSignal.value }

            const getIsoFromAbsoluteMinutes = (m: number) => {
                const d = new Date(baseDate!.getTime() + m * 60000)
                return d.toISOString() as IsoDateTime
            }

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
                    const snappedIso =
                        snappedTargetRef.current !== null
                            ? snapTargetISOMapRef.current.get(
                                  snappedTargetRef.current
                              )
                            : undefined

                    if (snappedIso && snappedEdgeRef.current === "top") {
                        const shiftMs =
                            new Date(snappedIso).getTime() -
                            new Date(dragState.card.start_at).getTime()
                        if (le.card.id === dragState.card.id) {
                            finalCard.start_at = snappedIso as IsoDateTime
                            finalCard.end_at = isOriginallyTracking
                                ? null
                                : (new Date(
                                      new Date(le.card.end_at!).getTime() +
                                          shiftMs
                                  ).toISOString() as IsoDateTime)
                        } else {
                            if (le.primaryEdge === "start") {
                                // Snapped side: snaps to snappedIso
                                if (le.edge === "start") {
                                    finalCard.start_at =
                                        snappedIso as IsoDateTime
                                    finalCard.end_at = le.card.end_at
                                } else {
                                    finalCard.start_at = le.card.start_at
                                    finalCard.end_at = snappedIso as IsoDateTime
                                }
                            } else {
                                // Shifting side: shifts by shiftMs
                                if (le.edge === "start") {
                                    finalCard.start_at = new Date(
                                        new Date(le.card.start_at).getTime() +
                                            shiftMs
                                    ).toISOString() as IsoDateTime
                                    finalCard.end_at = le.card.end_at
                                } else {
                                    finalCard.start_at = le.card.start_at
                                    finalCard.end_at = new Date(
                                        new Date(le.card.end_at!).getTime() +
                                            shiftMs
                                    ).toISOString() as IsoDateTime
                                }
                            }
                        }
                    } else if (
                        snappedIso &&
                        snappedEdgeRef.current === "bottom"
                    ) {
                        const shiftMs =
                            new Date(snappedIso).getTime() -
                            new Date(dragState.card.end_at!).getTime()
                        if (le.card.id === dragState.card.id) {
                            finalCard.start_at = new Date(
                                new Date(le.card.start_at).getTime() + shiftMs
                            ).toISOString() as IsoDateTime
                            finalCard.end_at = snappedIso as IsoDateTime
                        } else {
                            if (le.primaryEdge === "end") {
                                // Snapped side: snaps to snappedIso
                                if (le.edge === "start") {
                                    finalCard.start_at =
                                        snappedIso as IsoDateTime
                                    finalCard.end_at = le.card.end_at
                                } else {
                                    finalCard.start_at = le.card.start_at
                                    finalCard.end_at = snappedIso as IsoDateTime
                                }
                            } else {
                                // Shifting side: shifts by shiftMs
                                if (le.edge === "start") {
                                    finalCard.start_at = new Date(
                                        new Date(le.card.start_at).getTime() +
                                            shiftMs
                                    ).toISOString() as IsoDateTime
                                    finalCard.end_at = le.card.end_at
                                } else {
                                    finalCard.start_at = le.card.start_at
                                    finalCard.end_at = new Date(
                                        new Date(le.card.end_at!).getTime() +
                                            shiftMs
                                    ).toISOString() as IsoDateTime
                                }
                            }
                        }
                    } else {
                        // Not snapped, apply rounded 5-minute shift
                        const primaryOverride =
                            finalOverrides[dragState.card.id]
                        if (primaryOverride) {
                            const primaryStartMin =
                                Math.round(
                                    (primaryOverride.top - TOP_MARGIN) /
                                        pixelsPerMinuteSignal.value /
                                        5
                                ) * 5
                            const deltaMin =
                                primaryStartMin - dragState.initialStartMin

                            if (le.card.id === dragState.card.id) {
                                finalCard.start_at =
                                    getIsoFromAbsoluteMinutes(primaryStartMin)
                                finalCard.end_at = isOriginallyTracking
                                    ? null
                                    : getIsoFromAbsoluteMinutes(
                                          primaryStartMin +
                                              (dragState.initialEndMin -
                                                  dragState.initialStartMin)
                                      )
                            } else {
                                if (le.edge === "start") {
                                    finalCard.start_at =
                                        getIsoFromAbsoluteMinutes(
                                            le.initialStartMin + deltaMin
                                        )
                                    finalCard.end_at = le.card.end_at
                                } else {
                                    finalCard.start_at = le.card.start_at
                                    finalCard.end_at =
                                        getIsoFromAbsoluteMinutes(
                                            le.initialEndMin + deltaMin
                                        )
                                }
                            }
                        }
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
                            finalCard.start_at =
                                getIsoFromAbsoluteMinutes(startMin)
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
                                finalCard.end_at =
                                    getIsoFromAbsoluteMinutes(endMin)
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
                // Immediately update all stores synchronously to trigger a single layout render pass
                for (const up of updates) {
                    if (up.type === "routine") {
                        upsertRoutineCard(up.card as RoutineCard)
                    } else {
                        upsertTimeTrackerCard(up.card as TimeTrackerCard)
                    }
                }

                // Immediately trigger all sync saves concurrently in the background
                const savePromises = updates.map((up) => {
                    if (up.type === "routine") {
                        return SyncService.save(
                            routineCardConfig,
                            up.card as RoutineCard
                        )
                    } else {
                        return SyncService.save(
                            timeTrackerCardConfig,
                            up.card as TimeTrackerCard
                        )
                    }
                })
                await Promise.all(savePromises)

                setTimeout(() => {
                    dragOverridesSignal.value = {}
                }, 50)
            }
            // eslint-disable-next-line react-hooks/immutability
            dragLeftSignal.value = 0
            // eslint-disable-next-line react-hooks/immutability
            isHoveringTrackerColumnSignal.value = false
            snappedEdgeRef.current = null
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
            updateDragPosition(clientY, clientX)
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

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (!baseDate) return
        updateVisibleRange()
        const scrollTop = e.currentTarget.scrollTop
        const clientHeight = e.currentTarget.clientHeight
        const ppm = pixelsPerMinuteSignal.value

        // Calculate the minute at the center of the viewport
        const centerOffset = scrollTop + clientHeight / 2 - TOP_MARGIN
        const minutesScrolled = Math.max(0, centerOffset) / ppm

        const daysScrolled = Math.floor(minutesScrolled / (24 * 60))
        const newCurrentDate = new Date(baseDate)
        newCurrentDate.setDate(newCurrentDate.getDate() + daysScrolled)
        if (
            currentDate &&
            newCurrentDate.toDateString() !== currentDate.toDateString()
        ) {
            setCurrentDate(newCurrentDate)
        }
    }

    if (!currentDate || !now) {
        return (
            <div className="flex h-full w-full items-center justify-center p-8 text-muted-foreground">
                Loading tracker…
            </div>
        )
    }

    return (
        <div className="relative flex h-full w-full flex-col overflow-hidden">
            <DateNavigator
                date={currentDate || new Date()}
                onNavigate={(days) => {
                    if (!baseDate || !scrollContainerRef.current) return
                    const targetDate = new Date(currentDate || new Date())
                    targetDate.setDate(targetDate.getDate() + days)

                    const maxDate = new Date(baseDate)
                    maxDate.setDate(maxDate.getDate() + DAYS_TO_RENDER - 1)
                    if (targetDate > maxDate) {
                        targetDate.setTime(maxDate.getTime())
                    }
                    if (targetDate < baseDate) {
                        targetDate.setTime(baseDate.getTime())
                    }

                    let targetY: number
                    if (
                        days === 1 &&
                        currentDate?.toDateString() === maxDate.toDateString()
                    ) {
                        targetY = scrollContainerRef.current.scrollHeight
                    } else {
                        const minutesFromBase =
                            (targetDate.getTime() - baseDate.getTime()) / 60000
                        targetY =
                            minutesFromBase * pixelsPerMinuteSignal.value +
                            TOP_MARGIN
                    }

                    scrollContainerRef.current.scrollTo({
                        top: Math.max(0, targetY - 100),
                        behavior: "smooth",
                    })
                }}
                onGoToToday={() => scrollToCurrentTime()}
            />

            <div
                ref={scrollContainerRef}
                className={`scrollbar-hide relative w-full flex-1 overscroll-y-none bg-background select-none ${dragState ? "overflow-hidden" : "overflow-y-auto"}`}
                onMouseDown={startPress}
                onMouseUp={endPress}
                onMouseLeave={endPress}
                onMouseMove={handleMove}
                onTouchStart={startPress}
                onTouchEnd={endPress}
                onTouchMove={handleMove}
                onScroll={handleScroll}
                role="region"
                aria-label="Daily timeline grid"
            >
                <div
                    ref={timelineContainerRef}
                    className="pointer-events-none relative mx-auto w-full max-w-2xl"
                    style={
                        {
                            height: `${DAYS_TO_RENDER * FULL_DAY_MIN * pixelsPerMinuteSignal.peek() + BOTTOM_MARGIN}px`,
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
                    <TimelineGrid
                        daysToRender={DAYS_TO_RENDER}
                        baseDate={baseDate || undefined}
                        renderStartDay={dayRange.start}
                        renderEndDay={dayRange.end}
                    />

                    <div className="absolute inset-0 flex">
                        {/* Time Tracker Column */}
                        <div className="relative h-full flex-1">
                            <TrackerDropZoneHighlight />
                            {renderedTimeTrackerCards.map((task) => (
                                <TaskCard
                                    key={task.id}
                                    card={task}
                                    type="timeTracker"
                                    baseDate={baseDate!}
                                    isDragging={dragState?.card.id === task.id}
                                    isActive={activeTrackerIds.has(task.id)}
                                    getTagColor={getTagColor}
                                    getTagName={getTagName}
                                    onPress={stableCardPress}
                                    onClick={stableCardClick}
                                    onStop={stableStopTracker}
                                    layoutLeft={
                                        timeTrackerLayoutMap.get(task.id)?.left
                                    }
                                    layoutWidth={
                                        timeTrackerLayoutMap.get(task.id)?.width
                                    }
                                    daysToRender={DAYS_TO_RENDER}
                                />
                            ))}
                            <TimeTrackerActionButton
                                onAction={handleTimeTrackerAction}
                                isCurrentDay={isCurrentDay}
                                currentTime={now}
                                baseDate={baseDate!}
                                hasActiveTasks={allTimeTrackerCards.some(
                                    (c) => c.end_at === null && !c.is_deleted
                                )}
                            />
                            <LinkIndicatorLayer
                                cards={renderedTimeTrackerCards}
                                baseDate={baseDate}
                                layoutMap={timeTrackerLayoutMap}
                            />
                        </div>

                        {/* Center Timeline Spacer (for layout alignment) */}
                        <div className="h-full w-15" />

                        {/* Routine Column */}
                        <div className="relative h-full flex-1">
                            {renderedRoutineCards.reduce<React.ReactNode[]>(
                                (acc, task) => {
                                    if (!task.is_deleted) {
                                        acc.push(
                                            <TaskCard
                                                key={task.id}
                                                card={task}
                                                type="routine"
                                                baseDate={baseDate!}
                                                isDragging={
                                                    dragState?.card.id ===
                                                    task.id
                                                }
                                                getTagColor={getTagColor}
                                                getTagName={getTagName}
                                                onPress={stableCardPress}
                                                onClick={stableCardClick}
                                                layoutLeft={
                                                    routineLayoutMap.get(
                                                        task.id
                                                    )?.left
                                                }
                                                layoutWidth={
                                                    routineLayoutMap.get(
                                                        task.id
                                                    )?.width
                                                }
                                                daysToRender={DAYS_TO_RENDER}
                                            />
                                        )
                                    }
                                    return acc
                                },
                                []
                            )}
                            <LinkIndicatorLayer
                                cards={renderedRoutineCards}
                                baseDate={baseDate}
                                layoutMap={routineLayoutMap}
                            />
                        </div>
                    </div>

                    <CurrentTimeIndicator
                        baseDate={baseDate!}
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
                        if (Array.isArray(updated)) {
                            updated.forEach((u) => upsertRoutineCard(u))
                            await Promise.all(
                                updated.map((u) =>
                                    SyncService.save(routineCardConfig, u)
                                )
                            )
                        } else {
                            upsertRoutineCard(updated)
                            await SyncService.save(routineCardConfig, updated)
                        }
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
                        const saves: Array<Promise<unknown>> = []
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
                                                new Date().toISOString() as IsoDateTime,
                                        }
                                        upsertRoutineCard(detachedInstance)
                                        saves.push(
                                            SyncService.save(
                                                routineCardConfig,
                                                detachedInstance
                                            )
                                        )
                                    } else {
                                        upsertRoutineCard(routine)
                                        saves.push(
                                            SyncService.save(
                                                routineCardConfig,
                                                routine
                                            )
                                        )
                                    }
                                } else {
                                    upsertRoutineCard(routine)
                                    saves.push(
                                        SyncService.save(
                                            routineCardConfig,
                                            routine
                                        )
                                    )
                                }
                            } else {
                                upsertTimeTrackerCard(
                                    up.card as TimeTrackerCard
                                )
                                saves.push(
                                    SyncService.save(
                                        timeTrackerCardConfig,
                                        up.card as TimeTrackerCard
                                    )
                                )
                            }
                        }
                        await Promise.all(saves)
                        closeConfirmDragDialog(false)
                        setTimeout(() => {
                            dragOverridesSignal.value = {}
                        }, 50)
                    }}
                    onAllOccurrences={async () => {
                        const saves: Array<Promise<unknown>> = []
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
                                        const newMasterProps: Partial<RoutineCard> =
                                            {
                                                start_at: routine.start_at,
                                                end_at: routine.end_at,
                                            }

                                        const splitDate = routine._isVirtual
                                            ? routine.original_recurrence_date ||
                                              routine.start_at
                                            : routine.start_at

                                        if (master.id === routine.id) {
                                            const updatedMaster = {
                                                ...master,
                                                ...newMasterProps,
                                                updated_at:
                                                    new Date().toISOString() as IsoDateTime,
                                            }
                                            upsertRoutineCard(updatedMaster)
                                            saves.push(
                                                SyncService.save(
                                                    routineCardConfig,
                                                    updatedMaster
                                                )
                                            )
                                        } else {
                                            const [updatedMaster, newMaster] =
                                                splitRoutineSeries(
                                                    master,
                                                    splitDate,
                                                    newMasterProps
                                                )
                                            upsertRoutineCard(updatedMaster)
                                            upsertRoutineCard(newMaster)
                                            saves.push(
                                                SyncService.save(
                                                    routineCardConfig,
                                                    updatedMaster
                                                )
                                            )
                                            saves.push(
                                                SyncService.save(
                                                    routineCardConfig,
                                                    newMaster
                                                )
                                            )
                                        }
                                    }
                                } else {
                                    upsertRoutineCard(routine)
                                    saves.push(
                                        SyncService.save(
                                            routineCardConfig,
                                            routine
                                        )
                                    )
                                }
                            } else {
                                upsertTimeTrackerCard(
                                    up.card as TimeTrackerCard
                                )
                                saves.push(
                                    SyncService.save(
                                        timeTrackerCardConfig,
                                        up.card as TimeTrackerCard
                                    )
                                )
                            }
                        }
                        await Promise.all(saves)
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
