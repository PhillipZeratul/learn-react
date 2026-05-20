import { useState, useCallback, useMemo } from "react"
import { getVisualBoundsForDate, TOP_MARGIN } from "../utils/utils"
import { dragOverridesSignal } from "../stores/drag.store"
import { pixelsPerMinuteSignal } from "../stores/zoom.store"
import { LinkIndicator } from "./LinkIndicator"
import type { RoutineCard } from "../models/routine-card.model"
import type { TimeTrackerCard } from "../models/time-tracker-card.model"

interface LinkIndicatorLayerProps {
    cards: Array<RoutineCard | TimeTrackerCard>
    currentDate: Date | null
}

interface KnownLink {
    id: string
    top: number
}

/**
 * Computes the set of currently active link boundaries from the cards' visual
 * positions, reading live drag overrides and zoom level.
 */
function computeActiveLinks(
    cards: Array<RoutineCard | TimeTrackerCard>,
    currentDate: Date,
    ppm: number
): Map<string, number> {
    const bounds = cards.map((c) => {
        const { startMin, duration } = getVisualBoundsForDate(
            c.start_at,
            c.end_at,
            currentDate
        )
        const override = dragOverridesSignal.value[c.id]
        const top = override ? override.top : startMin * ppm + TOP_MARGIN
        const height = override ? override.height : duration * ppm
        return { id: c.id, top, bottom: top + height }
    })

    const result = new Map<string, number>()
    for (let i = 0; i < bounds.length; i++) {
        for (let j = 0; j < bounds.length; j++) {
            if (i === j) continue
            const a = bounds[i]
            const b = bounds[j]
            if (Math.abs(a.bottom - b.top) < 1.5) {
                result.set(`${a.id}_to_${b.id}`, b.top)
            }
        }
    }
    return result
}

export const LinkIndicatorLayer = ({
    cards,
    currentDate,
}: LinkIndicatorLayerProps) => {
    // ─── All hooks declared unconditionally before any early return ───────────
    const ppm = pixelsPerMinuteSignal.value

    // Active links derived purely from props + signals (no side-effects needed).
    const activeLinks = useMemo(
        () =>
            currentDate
                ? computeActiveLinks(cards, currentDate, ppm)
                : new Map<string, number>(),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- dragOverridesSignal is a signal (external)
        [cards, currentDate, ppm, dragOverridesSignal.value]
    )

    // Registry of all known links (active + in-exit-animation). We seed it from
    // activeLinks on first render and add new entries as they appear. Removal
    // only happens when the LinkIndicator calls onAnimationDone after its exit.
    const [knownLinks, setKnownLinks] = useState<KnownLink[]>(() =>
        Array.from(activeLinks.entries()).map(([id, top]) => ({ id, top }))
    )

    // Merge new active links + update positions of existing ones (pure in-render).
    const mergedLinks = useMemo(() => {
        const next = knownLinks.map((item) => {
            const newTop = activeLinks.get(item.id)
            return newTop !== undefined ? { ...item, top: newTop } : item
        })
        activeLinks.forEach((top, linkId) => {
            if (!next.some((item) => item.id === linkId)) {
                next.push({ id: linkId, top })
            }
        })
        return next
    }, [knownLinks, activeLinks])

    // Sync knownLinks with mergedLinks without a useEffect: schedule via callback
    // pattern. We compare lengths/ids to detect additions and schedule one state
    // update via a stable callback that is invoked at the end of the render batch.
    const removeLink = useCallback((linkId: string) => {
        setKnownLinks((prev) => prev.filter((l) => l.id !== linkId))
    }, [])

    // If mergedLinks has more entries than knownLinks, there are new active links;
    // update state on the next microtask (outside render) to trigger a re-render
    // that will include the new entries.
    if (mergedLinks.length !== knownLinks.length) {
        // This is safe: we only call setState here when a new link appears (not on
        // every render), and queueMicrotask keeps it outside the current call stack.
        queueMicrotask(() => setKnownLinks(mergedLinks))
    }

    if (!currentDate) return null

    return (
        <>
            {mergedLinks.map((link) => (
                <LinkIndicator
                    key={link.id}
                    isLinked={activeLinks.has(link.id)}
                    top={link.top}
                    onAnimationDone={() => removeLink(link.id)}
                />
            ))}
        </>
    )
}
