import React, {useState, useEffect, useRef} from 'react';
import { createRoutineCard, routineCardConfig, type RoutineCard } from '../models/routine-card.model';
import { createTimeTrackerCard, timeTrackerCardConfig, type TimeTrackerCard } from '../models/time-tracker-card.model';
import { useRoutineCardStore } from '../stores/routine-card.store';
import { useTimeTrackerCardStore } from '../stores/time-tracker-card.store';
import { useTagStore } from '../stores/tag.store';
import { RoutineTimeTrackerService } from '../services/routine-time-tracker-service';
import { timeToISO, isoToTime, isoToMinutes } from '../utils/utils';
import { RoutineEditor } from './RoutineEditor';
import { TimeTrackerEditor } from './TimeTrackerEditor';

const PIXELS_PER_MINUTE = 1;
const TOP_MARGIN = 32;
const BOTTOM_MARGIN = 64;

type EditingState = 
    | { type: 'routine'; task: RoutineCard }
    | { type: 'timeTracker'; task: TimeTrackerCard }
    | null;

export default function RoutineTimeTrackerWidget() {
    const { 
        items: timeTrackerCards, 
        add: addTimeTrackerCard, 
        update: updateTimeTrackerCard, 
        remove: deleteTimeTrackerCard 
    } = useTimeTrackerCardStore();
    
    const { 
        items: routineCards, 
        add: addRoutineCard, 
        update: updateRoutineCard, 
        remove: deleteRoutineCard 
    } = useRoutineCardStore();

    const { items: tags } = useTagStore();
    
    const [editingState, setEditingState] = useState<EditingState>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastTouchPos = useRef<{ x: number, y: number } | null>(null);

    const getTagColor = (tagId: string) => {
        const tag = tags.find(t => t.id === tagId);
        return tag?.color || '#94a3b8'; // Fallback to slate-400 if tag not found
    };

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    const currentTimeString = currentTime.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    const handleCreateTask = async (clientX: number, clientY: number) => {
        if (!scrollContainerRef.current) return;

        const rect = scrollContainerRef.current.getBoundingClientRect();
        const relativeY = clientY - rect.top + scrollContainerRef.current.scrollTop;
        const relativeX = clientX - rect.left;
        const contentWidth = scrollContainerRef.current.clientWidth;

        const minutes = Math.floor((relativeY - TOP_MARGIN) / PIXELS_PER_MINUTE);
        if (minutes < 0 || minutes >= 24 * 60) return;

        const roundedMinutes = Math.round(minutes / 30) * 30;
        const startHour = Math.floor(roundedMinutes / 60);
        const startMin = roundedMinutes % 60;
        const startTime = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;

        const endMinutes = roundedMinutes + 60;
        const endHour = Math.floor(endMinutes / 60);
        const endMin = endMinutes % 60;
        const endTime = `${String(Math.min(24, endHour)).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

        const isTimeTrackerBlock = relativeX < contentWidth / 2;

        if (isTimeTrackerBlock) {
            const newCard = createTimeTrackerCard({
                start_at: timeToISO(startTime),
                end_at: timeToISO(endTime),
            });
            addTimeTrackerCard(newCard);
            await RoutineTimeTrackerService.save(timeTrackerCardConfig, newCard);
        } else {
            const newCard = createRoutineCard({
                start_at: timeToISO(startTime),
                end_at: timeToISO(endTime),
            });
            addRoutineCard(newCard);
            await RoutineTimeTrackerService.save(routineCardConfig, newCard);
        }
    };

    const startPress = (e: React.MouseEvent | React.TouchEvent) => {
        if ((e.target as HTMLElement).closest('.task-card')) return;

        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        lastTouchPos.current = {x: clientX, y: clientY};

        longPressTimer.current = setTimeout(() => {
            handleCreateTask(clientX, clientY);
            longPressTimer.current = null;
        }, 500);
    };

    const endPress = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!longPressTimer.current || !lastTouchPos.current) return;

        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        const dist = Math.sqrt(
            Math.pow(clientX - lastTouchPos.current.x, 2) +
            Math.pow(clientY - lastTouchPos.current.y, 2)
        );

        if (dist > 10) {
            endPress();
        }
    };

    return (
        <div className="h-full w-full relative overflow-hidden">
            <div
                ref={scrollContainerRef}
                className="h-full w-full overflow-y-auto bg-background relative scrollbar-hide select-none"
                onMouseDown={startPress}
                onMouseUp={endPress}
                onMouseLeave={endPress}
                onMouseMove={handleMove}
                onTouchStart={startPress}
                onTouchEnd={endPress}
                onTouchMove={handleMove}
            >
                <div
                    className="relative w-full max-w-2xl mx-auto pointer-events-none"
                    style={{
                        height: `${24 * 60 * PIXELS_PER_MINUTE + BOTTOM_MARGIN}px`,
                    }}
                >
                    {[...Array(25)].map((_, i) => (
                        <div
                            key={`line-${i}`}
                            className="absolute left-0 right-0 border-t border-border border-dashed -translate-y-1/2"
                            style={{top: `${i * 60 * PIXELS_PER_MINUTE + TOP_MARGIN}px`}}
                        />
                    ))}

                    <div className="absolute inset-0 flex">
                        {/* Time Tracker Column */}
                        <div className="relative flex-1 h-full">
                            {timeTrackerCards.filter(t => !t.is_deleted).map(task => {
                                const startMin = isoToMinutes(task.start_at);
                                const duration = isoToMinutes(task.end_at) - startMin;
                                return (
                                    <div
                                        key={task.id}
                                        className="task-card absolute left-2 right-2 rounded-xl border border-border bg-card/50 backdrop-blur-sm p-3 shadow-sm transition-all hover:shadow-md pointer-events-auto cursor-pointer overflow-hidden"
                                        style={{
                                            top: `${startMin * PIXELS_PER_MINUTE + TOP_MARGIN}px`,
                                            height: `${duration * PIXELS_PER_MINUTE}px`,
                                        }}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onTouchStart={(e) => e.stopPropagation()}
                                        onClick={() => setEditingState({ type: 'timeTracker', task })}
                                    >
                                        <div 
                                            className="absolute left-0 top-0 bottom-0 w-1.5 z-10" 
                                            style={{ backgroundColor: getTagColor(task.tag_id) }} 
                                        />
                                        <div className="font-medium text-sm text-foreground">{task.title}</div>
                                        <div className="text-[10px] text-muted-foreground mt-1 tabular-nums">
                                            {isoToTime(task.start_at)} - {isoToTime(task.end_at)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Center Timeline */}
                        <div className="relative w-fit h-full flex flex-col items-center">
                            <div className="invisible font-mono text-xs select-none px-2">00:00</div>
                            {[...Array(25)].map((_, i) => (
                                <div
                                    key={`time-${i}`}
                                    className="absolute left-1/2 -translate-x-1/2 text-muted-foreground text-xs font-mono -translate-y-1/2 z-10"
                                    style={{top: `${i * 60 * PIXELS_PER_MINUTE + TOP_MARGIN}px`}}
                                >
                                    <span className="bg-background px-2 tabular-nums">
                                        {String(i).padStart(2, '0')}:00
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Routine Column */}
                        <div className="relative flex-1 h-full">
                            {routineCards.filter(t => !t.is_deleted).map(task => {
                                const startMin = isoToMinutes(task.start_at);
                                const duration = isoToMinutes(task.end_at) - startMin;
                                return (
                                    <div
                                        key={task.id}
                                        className="task-card absolute left-2 right-2 rounded-xl border border-border bg-card/50 backdrop-blur-sm p-3 shadow-sm transition-all hover:shadow-md pointer-events-auto cursor-pointer overflow-hidden"
                                        style={{
                                            top: `${startMin * PIXELS_PER_MINUTE + TOP_MARGIN}px`,
                                            height: `${duration * PIXELS_PER_MINUTE}px`,
                                        }}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onTouchStart={(e) => e.stopPropagation()}
                                        onClick={() => setEditingState({ type: 'routine', task })}
                                    >
                                        <div 
                                            className="absolute left-0 top-0 bottom-0 w-1.5 z-10" 
                                            style={{ backgroundColor: getTagColor(task.tag_id) }} 
                                        />
                                        <div className="font-medium text-sm text-foreground">{task.title}</div>
                                        <div className="text-[10px] text-muted-foreground mt-1 tabular-nums">
                                            {isoToTime(task.start_at)} - {isoToTime(task.end_at)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div
                        className="absolute left-0 right-0 flex items-center justify-center z-20 pointer-events-none -translate-y-1/2"
                        style={{top: `${currentMinutes * PIXELS_PER_MINUTE + TOP_MARGIN}px`}}
                    >
                        <div className="w-full border-t-2 border-primary/50"/>
                        <span
                            className="absolute bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                            {currentTimeString}
                        </span>
                    </div>
                </div>
            </div>

            {editingState?.type === 'routine' && (
                <RoutineEditor
                    task={editingState.task}
                    onSave={async (updated) => {
                        updateRoutineCard(updated.id, updated);
                        await RoutineTimeTrackerService.save(routineCardConfig, updated);
                        setEditingState(null);
                    }}
                    onDelete={async (id) => {
                        deleteRoutineCard(id);
                        await RoutineTimeTrackerService.delete(routineCardConfig, id);
                        setEditingState(null);
                    }}
                    onCancel={() => setEditingState(null)}
                />
            )}

            {editingState?.type === 'timeTracker' && (
                <TimeTrackerEditor
                    task={editingState.task}
                    onSave={async (updated) => {
                        updateTimeTrackerCard(updated.id, updated);
                        await RoutineTimeTrackerService.save(timeTrackerCardConfig, updated);
                        setEditingState(null);
                    }}
                    onDelete={async (id) => {
                        deleteTimeTrackerCard(id);
                        await RoutineTimeTrackerService.delete(timeTrackerCardConfig, id);
                        setEditingState(null);
                    }}
                    onCancel={() => setEditingState(null)}
                />
            )}
        </div>
    );
}
