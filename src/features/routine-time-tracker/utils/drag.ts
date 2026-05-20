export interface ShakePoint {
    y: number
    timestamp: number
}

/**
 * Robust Y-axis shake detection algorithm to break routine/tracker links during dragging.
 * Tracks direction reversals in the last 400ms.
 * Reversals >= 3 and amplitude >= 15px trigger link breakage.
 */
export function detectShake(history: ShakePoint[], nowTime: number): boolean {
    // Keep last 400ms
    const recent = history.filter((p) => nowTime - p.timestamp <= 400)
    if (recent.length < 4) return false

    let reversals = 0
    let lastDir = 0
    let minY = Infinity
    let maxY = -Infinity

    for (let i = 1; i < recent.length; i++) {
        const diffY = recent[i].y - recent[i - 1].y
        minY = Math.min(minY, recent[i].y, recent[i - 1].y)
        maxY = Math.max(maxY, recent[i].y, recent[i - 1].y)

        if (Math.abs(diffY) >= 2) {
            const dir = Math.sign(diffY)
            if (lastDir !== 0 && dir !== lastDir) {
                reversals++
            }
            lastDir = dir
        }
    }

    const amplitude = maxY - minY
    return reversals >= 3 && amplitude >= 15
}

export interface SnapResult {
    snappedTargetVal: number | null
    snapOffsetMinutes: number
    shouldBypass: boolean
    shouldStartTimer: number | null
}

/**
 * Magnetic snapping calculations.
 * Snaps to closest target within SNAP_THRESHOLD = 10px.
 * Pulling cursor > 30px away breaks/bypasses snapping (adds to bypassed set).
 */
export function calculateSnap(
    requestedPixels: number,
    snapTargets: number[],
    bypassedSnaps: Set<number>,
    ppm: number,
    currentSnappedTarget: number | null,
    topMargin: number
): SnapResult {
    const SNAP_THRESHOLD_PX = 10
    const SNAP_BREAK_THRESHOLD_PX = 30

    // Find closest non-bypassed snap target
    let closestTarget: number | null = null
    let minDiffPx = Infinity

    snapTargets.forEach((targetMin) => {
        if (bypassedSnaps.has(targetMin)) return
        const targetPx = targetMin * ppm + topMargin
        const diffPx = Math.abs(requestedPixels - targetPx)
        if (diffPx < minDiffPx) {
            minDiffPx = diffPx
            closestTarget = targetMin
        }
    })

    if (closestTarget !== null) {
        const targetMin = closestTarget as number
        const targetPx = targetMin * ppm + topMargin

        if (currentSnappedTarget === targetMin) {
            // Already snapped to this target!
            // It only breaks if we drag past SNAP_BREAK_THRESHOLD_PX (30px)
            const requestedDiffPx = Math.abs(requestedPixels - targetPx)
            if (requestedDiffPx >= SNAP_BREAK_THRESHOLD_PX) {
                return {
                    snappedTargetVal: null,
                    snapOffsetMinutes: 0,
                    shouldBypass: true,
                    shouldStartTimer: null,
                }
            } else {
                // Keep snapped!
                return {
                    snappedTargetVal: targetMin,
                    snapOffsetMinutes:
                        targetMin - (requestedPixels - topMargin) / ppm,
                    shouldBypass: false,
                    shouldStartTimer: null,
                }
            }
        } else {
            // Not currently snapped to this target.
            // We only enter the snap state if within the SNAP_THRESHOLD_PX (10px)
            if (minDiffPx < SNAP_THRESHOLD_PX) {
                return {
                    snappedTargetVal: targetMin,
                    snapOffsetMinutes:
                        targetMin - (requestedPixels - topMargin) / ppm,
                    shouldBypass: false,
                    shouldStartTimer: targetMin,
                }
            }
        }
    }

    return {
        snappedTargetVal: null,
        snapOffsetMinutes: 0,
        shouldBypass: false,
        shouldStartTimer: null,
    }
}

export interface LinkedEdge {
    edge: "start" | "end"
    initialStartMin: number
    initialEndMin: number
}

/**
 * Computes absolute bounds limit for linked edges dragging.
 * Start edge dragging cannot collapse card (must be at least 5 mins before end).
 * End edge dragging cannot collapse card (must be at least 5 mins after start).
 */
export function calculateLinkedBounds(linkedEdges: LinkedEdge[]): {
    absoluteMin: number
    absoluteMax: number
} {
    let maxStartLimit = 24 * 60
    let minEndLimit = 0

    linkedEdges.forEach((le) => {
        if (le.edge === "start") {
            maxStartLimit = Math.min(maxStartLimit, le.initialEndMin - 5)
        } else {
            minEndLimit = Math.max(minEndLimit, le.initialStartMin + 5)
        }
    })

    const absoluteMin = Math.max(0, minEndLimit)
    const absoluteMax = Math.min(24 * 60, maxStartLimit)

    return { absoluteMin, absoluteMax }
}
