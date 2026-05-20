import { getVisualBoundsForDate } from "./utils"
import type { RoutineCard } from "../models/routine-card.model"
import type { TimeTrackerCard } from "../models/time-tracker-card.model"

export function calculateLayout(
    cards: (RoutineCard | TimeTrackerCard)[],
    currentDate: Date
) {
    const sorted = cards.toSorted((a, b) => {
        const aBounds = getVisualBoundsForDate(
            a.start_at,
            a.end_at,
            currentDate
        )
        const bBounds = getVisualBoundsForDate(
            b.start_at,
            b.end_at,
            currentDate
        )
        const startDiff = aBounds.startMin - bBounds.startMin
        if (startDiff !== 0) return startDiff
        return bBounds.duration - aBounds.duration
    })

    const clusters: (RoutineCard | TimeTrackerCard)[][] = []
    let currentCluster: (RoutineCard | TimeTrackerCard)[] = []
    let clusterEndMin = -1

    for (const card of sorted) {
        const { startMin, duration } = getVisualBoundsForDate(
            card.start_at,
            card.end_at,
            currentDate
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
            const { startMin } = getVisualBoundsForDate(
                card.start_at,
                card.end_at,
                currentDate
            )

            let bestColIndex = -1
            let minGap = Infinity

            for (let i = 0; i < clusterCols.length; i++) {
                const col = clusterCols[i]
                const lastCard = col[col.length - 1]
                const { startMin: lastStart, duration: lastDur } =
                    getVisualBoundsForDate(
                        lastCard.start_at,
                        lastCard.end_at,
                        currentDate
                    )
                const lastEnd = lastStart + lastDur
                const gap = startMin - lastEnd

                // Strict sequential placement (no overlap allowed)
                if (gap >= 0) {
                    if (gap < minGap) {
                        minGap = gap
                        bestColIndex = i
                        // Perfect contiguous match, select immediately
                        if (gap === 0) {
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
