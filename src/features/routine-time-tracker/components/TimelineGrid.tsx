import React from 'react';
import { PIXELS_PER_MINUTE, TOP_MARGIN } from '../utils/utils';

export const TimelineGrid = () => {
    return (
        <>
            {[...Array(25)].map((_, i) => (
                <div
                    key={`line-${i}`}
                    className="absolute left-0 right-0 border-t border-border border-dashed -translate-y-1/2"
                    style={{ top: `${i * 60 * PIXELS_PER_MINUTE + TOP_MARGIN}px` }}
                />
            ))}
            <div className="absolute inset-0 flex pointer-events-none">
                <div className="flex-1" /> {/* Left spacer */}
                <div className="relative w-fit h-full flex flex-col items-center">
                    <div className="invisible font-mono text-xs select-none px-2">00:00</div>
                    {[...Array(25)].map((_, i) => (
                        <div
                            key={`time-${i}`}
                            className="absolute left-1/2 -translate-x-1/2 text-muted-foreground text-xs font-mono -translate-y-1/2 z-10"
                            style={{ top: `${i * 60 * PIXELS_PER_MINUTE + TOP_MARGIN}px` }}
                        >
                            <span className="bg-background px-2 tabular-nums pointer-events-auto">
                                {String(i).padStart(2, '0')}:00
                            </span>
                        </div>
                    ))}
                </div>
                <div className="flex-1" /> {/* Right spacer */}
            </div>
        </>
    );
};
