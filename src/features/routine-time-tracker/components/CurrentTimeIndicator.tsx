import { useRef } from "react"
import { TOP_MARGIN } from "../utils/utils"

export const CurrentTimeIndicator = ({
    baseDate,
    currentTime,
}: {
    baseDate: Date
    currentTime: Date
}) => {
    const indicatorRef = useRef<HTMLDivElement>(null)

    const currentMinutes = (currentTime.getTime() - baseDate.getTime()) / 60000
    const currentTimeString = currentTime.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    })

    return (
        <div
            ref={indicatorRef}
            className="pointer-events-none absolute right-0 left-0 z-20 flex -translate-y-1/2 items-center justify-center"
            style={{
                top: `calc(${currentMinutes} * var(--ppm) * 1px + ${TOP_MARGIN}px)`,
                transform: `translateY(-50%) scaleY(var(--inverse-preview-scale-y, 1))`,
            }}
        >
            <div className="w-full border-t-2 border-primary/50" />
            <span className="absolute rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow-lg">
                {currentTimeString}
            </span>
        </div>
    )
}
