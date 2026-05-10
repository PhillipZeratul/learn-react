import React, { useState, useEffect } from 'react';
import { PIXELS_PER_MINUTE, TOP_MARGIN } from '../utils/utils';

interface TimeTrackerActionButtonProps {
    activeTimeTrackerId: string | null;
    onAction: () => void;
    isCurrentDay: boolean;
}

export const TimeTrackerActionButton = ({ 
    activeTimeTrackerId, 
    onAction,
    isCurrentDay
}: TimeTrackerActionButtonProps) => {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    if (!isCurrentDay) return null;

    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

    return (
        <div
            className="absolute left-0 right-0 flex justify-center z-30 pointer-events-none"
            style={{ top: `${currentMinutes * PIXELS_PER_MINUTE + TOP_MARGIN + 24}px` }}
        >
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onAction();
                }}
                className={`pointer-events-auto text-[10px] font-bold px-4 py-2 rounded-full shadow-lg transition-all active:scale-95 flex items-center gap-1.5 ${
                    activeTimeTrackerId
                        ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-destructive/20'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20'
                }`}
            >
                <div className={`w-2 h-2 rounded-full ${activeTimeTrackerId ? 'bg-white animate-pulse' : 'bg-white/50'}`} />
                {activeTimeTrackerId ? 'FINISH' : 'BEGIN'}
            </button>
        </div>
    );
};
