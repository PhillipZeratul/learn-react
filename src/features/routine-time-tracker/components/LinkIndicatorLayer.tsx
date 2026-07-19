import { useState, useCallback, useRef, useEffect, useMemo } from "react"
import { TOP_MARGIN } from "../utils/utils"
import { getAbsoluteBounds } from "../utils/time-coordinates"
import { dragOverridesSignal } from "../stores/drag.store"
import { pixelsPerMinuteSignal } from "../stores/zoom.store"
import { LinkIndicator, type CardBoundsMap } from "./LinkIndicator"
import type { RoutineCard } from "../models/routine-card.model"
import type { TimeTrackerCard } from "../models/time-tracker-card.model"

interface LinkIndicatorLayerProps {
    cards: Array<RoutineCard | TimeTrackerCard>
    baseDate: Date | null
    layoutMap: Map<string, { left: string; width: string }>
}

interface KnownLink {
    id: string
    cardAId: string
    cardBId: string
}

/**
 * Minute-bounds per card id — rebuilt only when card *data* changes (never
 * per zoom/drag frame), so signal-frequency readers stay O(1) per lookup.
 */
function computeBoundsMap(
    cards: Array<RoutineCard | TimeTrackerCard>,
    baseDate: Date
): CardBoundsMap {
    const map: CardBoundsMap = new Map()
    for (const c of cards) {
        map.set(c.id, getAbsoluteBounds(c.start_at, c.end_at, baseDate))
    }
    return map
}

/**
 * Determine which card-pairs share a visual boundary right now.
 * Uses peek() so this does NOT subscribe to signals (called during render).
 * Sorted sweep: O(n log n) instead of comparing all O(n²) pairs.
 */
function computeActiveBoundaries(
    cards: Array<RoutineCard | TimeTrackerCard>,
    boundsMap: CardBoundsMap
): Set<string> {
    const ppm = pixelsPerMinuteSignal.peek()
    const overrides = dragOverridesSignal.peek()

    const bounds = cards
        .map((c) => {
            const b = boundsMap.get(c.id)
            if (!b) return null
            const ov = overrides[c.id]
            const top = ov ? ov.top : b.startMin * ppm + TOP_MARGIN
            const height = ov ? ov.height : b.duration * ppm
            const isActive = (c as TimeTrackerCard)._isActive || false
            return { id: c.id, top, bottom: top + height, isActive }
        })
        .filter((b): b is NonNullable<typeof b> => b !== null)
        .sort((a, b) => a.top - b.top)

    const active = new Set<string>()
    for (let i = 0; i < bounds.length; i++) {
        for (let j = i + 1; j < bounds.length; j++) {
            // Sorted by top: once a later card starts more than the
            // threshold past bounds[i]'s bottom, no further card can
            // touch it either — stop scanning this pair window.
            if (bounds[j].top - bounds[i].bottom > 1.5) break
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
    baseDate,
    layoutMap,
}: LinkIndicatorLayerProps) => {
    // ── All hooks unconditionally before any early return ─────────────────────

    // Stable refs so LinkIndicator's useCallback never needs to re-create itself.
    const layoutMapRef = useRef(layoutMap)
    const boundsMapRef = useRef<CardBoundsMap>(new Map())

    const boundsMap = useMemo<CardBoundsMap>(
        () => (baseDate ? computeBoundsMap(cards, baseDate) : new Map()),
        [cards, baseDate]
    )

    // Keep refs current without triggering re-renders.
    useEffect(() => {
        layoutMapRef.current = layoutMap
    }, [layoutMap])
    useEffect(() => {
        boundsMapRef.current = boundsMap
    }, [boundsMap])

    const [knownLinks, setKnownLinks] = useState<KnownLink[]>(() => {
        if (!baseDate) return []
        const active = computeActiveBoundaries(
            cards,
            computeBoundsMap(cards, baseDate)
        )
        return Array.from(active).map((id) => {
            const [cardAId, cardBId] = id.split("_to_")
            return { id, cardAId, cardBId }
        })
    })

    const removeLink = useCallback((linkId: string) => {
        setKnownLinks((prev) => prev.filter((l) => l.id !== linkId))
    }, [])

    // ── Guard ────────────────────────────────────────────────────────────────
    if (!baseDate) return null

    // ── Derived state (snapshot, not reactive) ───────────────────────────────
    const activeBoundaries = computeActiveBoundaries(cards, boundsMap)

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
                    boundsMapRef={boundsMapRef}
                    layoutMapRef={layoutMapRef}
                    onAnimationDone={() => removeLink(link.id)}
                />
            ))}
        </>
    )
}
