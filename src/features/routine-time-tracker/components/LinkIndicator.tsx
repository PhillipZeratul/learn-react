import { useState, useEffect, useRef } from "react"

interface LinkIndicatorProps {
    isLinked: boolean
    top: number
    onAnimationDone: () => void
}

export const LinkIndicator = ({
    isLinked,
    top,
    onAnimationDone,
}: LinkIndicatorProps) => {
    const [visualState, setVisualState] = useState<
        "linked" | "breaking" | "hidden"
    >(isLinked ? "linked" : "hidden")
    const prevLinked = useRef(isLinked)

    useEffect(() => {
        if (isLinked && !prevLinked.current) {
            setVisualState("linked")
        } else if (!isLinked && prevLinked.current) {
            setVisualState("breaking")
            const timer = setTimeout(() => {
                setVisualState("hidden")
                onAnimationDone()
            }, 350) // Matches CSS animation duration
            return () => clearTimeout(timer)
        }
        prevLinked.current = isLinked
    }, [isLinked, onAnimationDone])

    if (visualState === "hidden") return null

    return (
        <div
            className="pointer-events-none absolute left-1/2 z-40"
            style={{
                top: `${top}px`,
                transform: "translate(-50%, -50%)",
            }}
        >
            <div className={`link-chain-container ${visualState}`}>
                {/* Glow Backdrop */}
                <div className="link-chain-glow" />
                {/* Top Interlocking Oval Loop */}
                <div className="link-chain-half top-half" />
                {/* Bottom Interlocking Oval Loop */}
                <div className="link-chain-half bottom-half" />
            </div>
        </div>
    )
}
