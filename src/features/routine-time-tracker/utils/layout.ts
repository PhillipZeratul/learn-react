import { isoToMinutes } from "./utils"
import type { RoutineCard } from "../models/routine-card.model"
import type { TimeTrackerCard } from "../models/time-tracker-card.model"

export function calculateLayout(cards: (RoutineCard | TimeTrackerCard)[]) {
    const sorted = [...cards].sort((a, b) => {
        const startDiff = isoToMinutes(a.start_at) - isoToMinutes(b.start_at)
        if (startDiff !== 0) return startDiff
        return isoToMinutes(b.end_at) - isoToMinutes(a.end_at)
    })

    const clusters: (RoutineCard | TimeTrackerCard)[][] = []
    let currentCluster: (RoutineCard | TimeTrackerCard)[] = []
    let clusterEndMin = -1

    for (const card of sorted) {
        const startMin = isoToMinutes(card.start_at)
        const endMin = isoToMinutes(card.end_at)

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
            const startMin = isoToMinutes(card.start_at)
            for (let i = 0; i < clusterCols.length; i++) {
                const col = clusterCols[i]
                const lastCard = col[col.length - 1]
                if (isoToMinutes(lastCard.end_at) <= startMin) {
                    col.push(card)
                    layoutMap.set(card.id, { column: i })
                    placed = true
                    break
                }
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
