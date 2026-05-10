import React, { useState, useEffect } from 'react';
import { PIXELS_PER_MINUTE, TOP_MARGIN } from '../utils/utils';

export const CurrentTimeIndicator = ({ isCurrentDay }: { isCurrentDay: boolean }) => {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    if (!isCurrentDay) return null;

    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    const currentTimeString = currentTime.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    return (
        <div
            className="absolute left-0 right-0 flex items-center justify-center z-20 pointer-events-none -translate-y-1/2"
            style={{ top: `${currentMinutes * PIXELS_PER_MINUTE + TOP_MARGIN}px` }}
        >
            <div className="w-full border-t-2 border-primary/50" />
            <span className="absolute bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                {currentTimeString}
            </span>
        </div>
    );
};
