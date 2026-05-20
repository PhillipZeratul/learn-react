import { useRef, useEffect, useCallback } from "react"
import { effect } from "@preact/signals-react"
import { getVisualBoundsForDate, TOP_MARGIN } from "../utils/utils"
import { dragOverridesSignal } from "../stores/drag.store"
import { pixelsPerMinuteSignal } from "../stores/zoom.store"
import type { RoutineCard } from "../models/routine-card.model"
import type { TimeTrackerCard } from "../models/time-tracker-card.model"

export interface LinkIndicatorProps {
    isLinked: boolean
    cardAId: string
    cardBId: string
    /** All cards in the column – passed by ref so the effect doesn't need to re-subscribe. */
    cardsRef: React.RefObject<Array<RoutineCard | TimeTrackerCard>>
    currentDate: Date
    /** Layout map – passed by ref so the effect doesn't need to re-subscribe. */
    layoutMapRef: React.RefObject<Map<string, { left: string; width: string }>>
    onAnimationDone: () => void
}

/** Parse leading percentage from "calc(N% + 4px)" → N */
function parsePct(cssCalc: string): number {
    const match = cssCalc.match(/([0-9.]+)%/)
    return match ? parseFloat(match[1]) : 0
}

export const LinkIndicator = ({
    isLinked,
    cardAId,
    cardBId,
    cardsRef,
    currentDate,
    layoutMapRef,
    onAnimationDone,
}: LinkIndicatorProps) => {
    const containerRef = useRef<HTMLDivElement>(null)

    // Stable compute function: reads signals + refs, never changes identity.
    const computePosition = useCallback((): {
        top: number
        leftPct: number
    } | null => {
        const cards = cardsRef.current
        const layoutMap = layoutMapRef.current
        if (!cards || !layoutMap) return null

        const ppm = pixelsPerMinuteSignal.value // signal subscription

        const cardA = cards.find((c) => c.id === cardAId)
        const cardB = cards.find((c) => c.id === cardBId)
        if (!cardA || !cardB) return null

        const overrides = dragOverridesSignal.value // signal subscription
        const overrideA = overrides[cardAId]
        const overrideB = overrides[cardBId]

        const boundsA = getVisualBoundsForDate(
            cardA.start_at,
            cardA.end_at,
            currentDate
        )
        const topA = overrideA
            ? overrideA.top
            : boundsA.startMin * ppm + TOP_MARGIN
        const heightA = overrideA ? overrideA.height : boundsA.duration * ppm
        const bottomA = topA + heightA

        const boundsB = getVisualBoundsForDate(
            cardB.start_at,
            cardB.end_at,
            currentDate
        )
        const topB = overrideB
            ? overrideB.top
            : boundsB.startMin * ppm + TOP_MARGIN

        const boundaryY = (bottomA + topB) / 2

        // Horizontal: 1/4 from left of the narrower card
        const layoutA = layoutMap.get(cardAId)
        const layoutB = layoutMap.get(cardBId)

        let leftPct = 50
        if (layoutA && layoutB) {
            const leftA = parsePct(layoutA.left)
            const widthA = parsePct(layoutA.width)
            const leftB = parsePct(layoutB.left)
            const widthB = parsePct(layoutB.width)
            const [chosenLeft, chosenWidth] =
                widthA <= widthB ? [leftA, widthA] : [leftB, widthB]
            leftPct = chosenLeft + chosenWidth / 4
        } else if (layoutA) {
            leftPct = parsePct(layoutA.left) + parsePct(layoutA.width) / 4
        } else if (layoutB) {
            leftPct = parsePct(layoutB.left) + parsePct(layoutB.width) / 4
        }

        return { top: boundaryY, leftPct }
    }, [cardAId, cardBId, cardsRef, currentDate, layoutMapRef])
    // ^^ cardAId, cardBId, currentDate are stable per mount; cardsRef/layoutMapRef are refs

    // Drive position updates at signal frequency (60 fps) via direct DOM writes.
    useEffect(() => {
        const dispose = effect(() => {
            const pos = computePosition() // reads signals → auto-subscribed
            const el = containerRef.current
            if (!el || !pos) return
            el.style.top = `${pos.top}px`
            el.style.left = `${pos.leftPct}%`
        })
        return dispose
    }, [computePosition])

    // Trigger break animation when isLinked transitions false → true.
    const prevLinkedRef = useRef(isLinked)
    useEffect(() => {
        if (!isLinked && prevLinkedRef.current) {
            containerRef.current
                ?.querySelector(".link-chain-container")
                ?.classList.replace("linked", "breaking")
            const timer = setTimeout(() => {
                onAnimationDone()
            }, 350)
            return () => clearTimeout(timer)
        }
        prevLinkedRef.current = isLinked
    }, [isLinked, onAnimationDone])

    return (
        <div
            ref={containerRef}
            className="pointer-events-none absolute z-40"
            style={{ transform: "translate(-50%, -50%)" }}
        >
            <div className="link-chain-container linked">
                <div className="link-chain-glow" />
                <div className="link-chain-half top-half" />
                <div className="link-chain-half bottom-half" />
            </div>
        </div>
    )
}
