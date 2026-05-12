import React from "react"
import { PIXELS_PER_MINUTE, TOP_MARGIN } from "../utils/utils"

export const TimelineGrid = () => {
    return (
        <>
            {[...Array(25)].map((_, i) => (
                <div
                    key={`line-${i}`}
                    className="absolute right-0 left-0 -translate-y-1/2 border-t border-dashed border-border"
                    style={{
                        top: `${i * 60 * PIXELS_PER_MINUTE + TOP_MARGIN}px`,
                    }}
                />
            ))}
            <div className="pointer-events-none absolute inset-0 flex">
                <div className="flex-1" /> {/* Left spacer */}
                <div className="relative flex h-full w-fit flex-col items-center">
                    <div className="invisible px-2 font-mono text-xs select-none">
                        00:00
                    </div>
                    {[...Array(25)].map((_, i) => (
                        <div
                            key={`time-${i}`}
                            className="absolute left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground"
                            style={{
                                top: `${i * 60 * PIXELS_PER_MINUTE + TOP_MARGIN}px`,
                            }}
                        >
                            <span className="pointer-events-auto bg-background px-2 tabular-nums">
                                {String(i).padStart(2, "0")}:00
                            </span>
                        </div>
                    ))}
                </div>
                <div className="flex-1" /> {/* Right spacer */}
            </div>
        </>
    )
}
