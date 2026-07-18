import { getAbsoluteBounds } from "./time-coordinates"
import type { RoutineCard } from "../models/routine-card.model"
import type { TimeTrackerCard } from "../models/time-tracker-card.model"

export function calculateLayout(
    cards: (RoutineCard | TimeTrackerCard)[],
    baseDate: Date
) {
    const sorted = cards.toSorted((a, b) => {
        const aBounds = getAbsoluteBounds(a.start_at, a.end_at, baseDate)
        const bBounds = getAbsoluteBounds(b.start_at, b.end_at, baseDate)
        const startDiff = aBounds.startMin - bBounds.startMin
        if (startDiff !== 0) return startDiff
        return bBounds.duration - aBounds.duration
    })

    const clusters: (RoutineCard | TimeTrackerCard)[][] = []
    let currentCluster: (RoutineCard | TimeTrackerCard)[] = []
    let clusterEndMin = -1

    for (const card of sorted) {
        const { startMin, duration } = getAbsoluteBounds(
            card.start_at,
            card.end_at,
            baseDate
        )
        const endMin = startMin + duration

        if (startMin >= clusterEndMin) {
            if (currentCluster.length > 0) {
                clusters.push(currentCluster)
            }
            currentCluster = [card]
            clusterEndMin = endMin
        } else {
            currentCluster.push(card)
            clusterEndMin = Math.max(clusterEndMin, endMin)
        }
    }
    if (currentCluster.length > 0) {
        clusters.push(currentCluster)
    }

    const finalLayout = new Map<string, { left: string; width: string }>()

    for (const cluster of clusters) {
        const clusterCols: (RoutineCard | TimeTrackerCard)[][] = []
        const layoutMap = new Map<string, { column: number }>()

        for (const card of cluster) {
            let placed = false
            const { startMin } = getAbsoluteBounds(
                card.start_at,
                card.end_at,
                baseDate
            )

            let bestColIndex = -1
            let minGap = Infinity

            for (let i = 0; i < clusterCols.length; i++) {
                const col = clusterCols[i]
                const lastCard = col[col.length - 1]
                const { startMin: lastStart, duration: lastDur } =
                    getAbsoluteBounds(
                        lastCard.start_at,
                        lastCard.end_at,
                        baseDate
                    )
                const lastEnd = lastStart + lastDur
                const gap = startMin - lastEnd

                const bothActive =
                    (card as TimeTrackerCard)._isActive &&
                    (lastCard as TimeTrackerCard)._isActive

                // Strict sequential placement (no overlap allowed)
                // Use a tiny epsilon (-0.01) to handle floating-point precision errors
                // Parallel active tasks should never be sequential
                if (gap >= -0.01 && !bothActive) {
                    if (gap < minGap) {
                        minGap = gap
                        bestColIndex = i
                        // Perfect contiguous match (within epsilon), select immediately
                        if (Math.abs(gap) < 0.01) {
                            break
                        }
                    }
                }
            }

            if (bestColIndex !== -1) {
                clusterCols[bestColIndex].push(card)
                layoutMap.set(card.id, { column: bestColIndex })
                placed = true
            }

            if (!placed) {
                clusterCols.push([card])
                layoutMap.set(card.id, { column: clusterCols.length - 1 })
            }
        }

        const maxCols = clusterCols.length
        for (const card of cluster) {
            const data = layoutMap.get(card.id)!
            const leftPct = (data.column / maxCols) * 100
            const widthPct = (1 / maxCols) * 100

            finalLayout.set(card.id, {
                left: `calc(${leftPct}% + 4px)`,
                width: `calc(${widthPct}% - 8px)`,
            })
        }
    }

    return finalLayout
}
