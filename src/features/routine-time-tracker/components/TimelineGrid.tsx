import { PIXELS_PER_MINUTE, TOP_MARGIN } from "../utils/utils"

export const TimelineGrid = () => {
    return (
        <>
            {[...Array(25)].map((_, hour) => (
                <div
                    key={`grid-line-hour-${hour}`}
                    className="absolute right-0 left-0 -translate-y-1/2 border-t border-dashed border-border"
                    style={{
                        top: `${hour * 60 * PIXELS_PER_MINUTE + TOP_MARGIN}px`,
                    }}
                />
            ))}
            <div className="pointer-events-none absolute inset-0 flex">
                <div className="flex-1" /> {/* Left spacer */}
                <div className="relative flex h-full w-fit flex-col items-center">
                    <div className="invisible px-2 font-mono text-xs select-none">
                        00:00
                    </div>
                    {[...Array(25)].map((_, hour) => (
                        <div
                            key={`grid-time-hour-${hour}`}
                            className="absolute left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground"
                            style={{
                                top: `${hour * 60 * PIXELS_PER_MINUTE + TOP_MARGIN}px`,
                            }}
                        >
                            <span className="pointer-events-auto bg-background px-2 tabular-nums">
                                {String(hour).padStart(2, "0")}:00
                            </span>
                        </div>
                    ))}
                </div>
                <div className="flex-1" /> {/* Right spacer */}
            </div>
        </>
    )
}
