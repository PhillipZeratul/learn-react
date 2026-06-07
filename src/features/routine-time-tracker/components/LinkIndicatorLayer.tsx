import { useState, useCallback, useRef, useEffect } from "react"
import { getVisualBoundsForDate, TOP_MARGIN } from "../utils/utils"
import { dragOverridesSignal } from "../stores/drag.store"
import { pixelsPerMinuteSignal } from "../stores/zoom.store"
import { LinkIndicator } from "./LinkIndicator"
import type { RoutineCard } from "../models/routine-card.model"
import type { TimeTrackerCard } from "../models/time-tracker-card.model"

interface LinkIndicatorLayerProps {
    cards: Array<RoutineCard | TimeTrackerCard>
    currentDate: Date | null
    layoutMap: Map<string, { left: string; width: string }>
}

interface KnownLink {
    id: string
    cardAId: string
    cardBId: string
}

/**
 * Determine which card-pairs share a visual boundary right now.
 * Uses peek() so this does NOT subscribe to signals (called during render).
 */
function computeActiveBoundaries(
    cards: Array<RoutineCard | TimeTrackerCard>,
    currentDate: Date
): Set<string> {
    const ppm = pixelsPerMinuteSignal.peek()
    const overrides = dragOverridesSignal.peek()

    const bounds = cards.map((c) => {
        const { startMin, duration } = getVisualBoundsForDate(
            c.start_at,
            c.end_at,
            currentDate
        )
        const ov = overrides[c.id]
        const top = ov ? ov.top : startMin * ppm + TOP_MARGIN
        const height = ov ? ov.height : duration * ppm
        const isActive = (c as TimeTrackerCard)._isActive || false
        return { id: c.id, top, bottom: top + height, isActive }
    })

    const active = new Set<string>()
    for (let i = 0; i < bounds.length; i++) {
        for (let j = 0; j < bounds.length; j++) {
            if (i === j) continue
            if (Math.abs(bounds[i].bottom - bounds[j].top) < 1.5) {
                if (bounds[i].isActive) continue
                active.add(`${bounds[i].id}_to_${bounds[j].id}`)
            }
        }
    }
    return active
}

export const LinkIndicatorLayer = ({
    cards,
    currentDate,
    layoutMap,
}: LinkIndicatorLayerProps) => {
    // ── All hooks unconditionally before any early return ─────────────────────

    // Stable refs so LinkIndicator's useCallback never needs to re-create itself.
    const cardsRef = useRef(cards)
    const layoutMapRef = useRef(layoutMap)

    // Keep refs current without triggering re-renders.
    useEffect(() => {
        cardsRef.current = cards
    }, [cards])
    useEffect(() => {
        layoutMapRef.current = layoutMap
    }, [layoutMap])

    const [knownLinks, setKnownLinks] = useState<KnownLink[]>(() => {
        if (!currentDate) return []
        const active = computeActiveBoundaries(cards, currentDate)
        return Array.from(active).map((id) => {
            const [cardAId, cardBId] = id.split("_to_")
            return { id, cardAId, cardBId }
        })
    })

    const removeLink = useCallback((linkId: string) => {
        setKnownLinks((prev) => prev.filter((l) => l.id !== linkId))
    }, [])

    // ── Guard ────────────────────────────────────────────────────────────────
    if (!currentDate) return null

    // ── Derived state (snapshot, not reactive) ───────────────────────────────
    const activeBoundaries = computeActiveBoundaries(cards, currentDate)

    // Add any newly formed links via microtask (keeps setState outside render).
    const newLinkIds = Array.from(activeBoundaries).filter(
        (id) => !knownLinks.some((l) => l.id === id)
    )
    if (newLinkIds.length > 0) {
        queueMicrotask(() => {
            setKnownLinks((prev) => {
                const additions = newLinkIds
                    .filter((id) => !prev.some((l) => l.id === id))
                    .map((id) => {
                        const [cardAId, cardBId] = id.split("_to_")
                        return { id, cardAId, cardBId }
                    })
                return additions.length > 0 ? [...prev, ...additions] : prev
            })
        })
    }

    return (
        <>
            {knownLinks.map((link) => (
                <LinkIndicator
                    key={link.id}
                    isLinked={activeBoundaries.has(link.id)}
                    cardAId={link.cardAId}
                    cardBId={link.cardBId}
                    cardsRef={cardsRef}
                    currentDate={currentDate}
                    layoutMapRef={layoutMapRef}
                    onAnimationDone={() => removeLink(link.id)}
                />
            ))}
        </>
    )
}
