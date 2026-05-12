import React, { useState, useEffect } from "react"
import { PIXELS_PER_MINUTE, TOP_MARGIN } from "../utils/utils"

export const CurrentTimeIndicator = ({
    isCurrentDay,
}: {
    isCurrentDay: boolean
}) => {
    const [currentTime, setCurrentTime] = useState(new Date())

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    if (!isCurrentDay) return null

    const currentMinutes =
        currentTime.getHours() * 60 + currentTime.getMinutes()
    const currentTimeString = currentTime.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    })

    return (
        <div
            className="pointer-events-none absolute right-0 left-0 z-20 flex -translate-y-1/2 items-center justify-center"
            style={{
                top: `${currentMinutes * PIXELS_PER_MINUTE + TOP_MARGIN}px`,
            }}
        >
            <div className="w-full border-t-2 border-primary/50" />
            <span className="absolute rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow-lg">
                {currentTimeString}
            </span>
        </div>
    )
}
