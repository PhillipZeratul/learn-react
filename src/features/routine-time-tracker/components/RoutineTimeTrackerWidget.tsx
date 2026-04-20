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
    | { type: 'routine'; card: RoutineCard }
    | { type: 'timeTracker'; card: TimeTrackerCard }
    | null;

type DragMode = 'top' | 'center' | 'bottom';

interface DragState {
    type: 'routine' | 'timeTracker';
    card: RoutineCard | TimeTrackerCard;
    initialStartMin: number;
    initialEndMin: number;
    initialMouseY: number;
    mode: DragMode;
}

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
    const [dragState, setDragState] = useState<DragState | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastTouchPos = useRef<{ x: number, y: number } | null>(null);
    const wasDragged = useRef(false);

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
            setEditingState({ type: 'timeTracker', card: newCard });
        } else {
            const newCard = createRoutineCard({
                start_at: timeToISO(startTime),
                end_at: timeToISO(endTime),
            });
            setEditingState({ type: 'routine', card: newCard });
        }
    };

    const handleCardPress = (e: React.MouseEvent | React.TouchEvent, type: 'routine' | 'timeTracker', task: RoutineCard | TimeTrackerCard) => {
        e.stopPropagation();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        
        lastTouchPos.current = { x: clientX, y: clientY };
        wasDragged.current = false;

        const cardElement = (e.currentTarget as HTMLElement);
        const rect = cardElement.getBoundingClientRect();
        const relativeY = clientY - rect.top;
        const height = rect.height;

        let mode: DragMode = 'center';
        if (relativeY < height * 0.25) mode = 'top';
        else if (relativeY > height * 0.75) mode = 'bottom';

        longPressTimer.current = setTimeout(() => {
            setDragState({
                type,
                card: task,
                initialStartMin: isoToMinutes(task.start_at),
                initialEndMin: isoToMinutes(task.end_at),
                initialMouseY: clientY,
                mode
            });
            longPressTimer.current = null;
        }, 500);
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

    const endPress = async () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }

        if (dragState) {
            wasDragged.current = true;

            if (dragState.type === 'routine') {
                const routineCard = dragState.card as RoutineCard;
                await RoutineTimeTrackerService.save(routineCardConfig, routineCard);
            } else {
                const timeTrackerCard = dragState.card as TimeTrackerCard;
                await RoutineTimeTrackerService.save(timeTrackerCardConfig, timeTrackerCard);
            }
            setDragState(null);
        }
    };

    const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        if (dragState) {
            wasDragged.current = true;
            const deltaY = clientY - dragState.initialMouseY;
            const deltaMin = Math.round(deltaY / PIXELS_PER_MINUTE / 5) * 5; // Snap to 5 mins

            let newStartMin = dragState.initialStartMin;
            let newEndMin = dragState.initialEndMin;

            if (dragState.mode === 'top') {
                newStartMin = Math.min(dragState.initialEndMin - 5, Math.max(0, dragState.initialStartMin + deltaMin));
            } else if (dragState.mode === 'bottom') {
                newEndMin = Math.max(dragState.initialStartMin + 5, Math.min(24 * 60, dragState.initialEndMin + deltaMin));
            } else {
                const duration = dragState.initialEndMin - dragState.initialStartMin;
                newStartMin = Math.max(0, Math.min(24 * 60 - duration, dragState.initialStartMin + deltaMin));
                newEndMin = newStartMin + duration;
            }

            const updatedCard = {
                ...dragState.card,
                start_at: timeToISO(`${String(Math.floor(newStartMin / 60)).padStart(2, '0')}:${String(newStartMin % 60).padStart(2, '0')}`),
                end_at: timeToISO(`${String(Math.floor(newEndMin / 60)).padStart(2, '0')}:${String(newEndMin % 60).padStart(2, '0')}`),
            };

            if (dragState.type === 'routine') {
                const routineCard = updatedCard as RoutineCard;
                updateRoutineCard(updatedCard.id, routineCard);
            } else {
                const timeTrackerCard = updatedCard as TimeTrackerCard;
                updateTimeTrackerCard(updatedCard.id, timeTrackerCard);
            }

            setDragState({ ...dragState, card: updatedCard as any });
            return;
        }

        if (!longPressTimer.current || !lastTouchPos.current) return;

        const dist = Math.sqrt(
            Math.pow(clientX - lastTouchPos.current.x, 2) +
            Math.pow(clientY - lastTouchPos.current.y, 2)
        );

        if (dist > 10) {
            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
            }
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
                                const isDragging = dragState?.card.id === task.id;
                                return (
                                    <div
                                        key={task.id}
                                        className={`task-card absolute left-2 right-2 rounded-xl border border-border bg-card/50 backdrop-blur-sm p-3 shadow-sm transition-all hover:shadow-md pointer-events-auto cursor-pointer overflow-hidden ${isDragging ? 'z-50 ring-2 ring-primary border-primary shadow-xl opacity-90 scale-[1.02]' : ''}`}
                                        style={{
                                            top: `${startMin * PIXELS_PER_MINUTE + TOP_MARGIN}px`,
                                            height: `${duration * PIXELS_PER_MINUTE}px`,
                                        }}
                                        onMouseDown={(e) => handleCardPress(e, 'timeTracker', task)}
                                        onTouchStart={(e) => handleCardPress(e, 'timeTracker', task)}
                                        onClick={() => {
                                            if (!wasDragged.current) {
                                                setEditingState({ type: 'timeTracker', card: task });
                                            }
                                        }}
                                    >
                                        <div 
                                            className="absolute left-0 top-0 bottom-0 w-1.5 z-10" 
                                            style={{ backgroundColor: getTagColor(task.tag_id) }} 
                                        />
                                        <div className="font-medium text-sm text-foreground truncate">{task.title}</div>
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
                                const isDragging = dragState?.card.id === task.id;
                                return (
                                    <div
                                        key={task.id}
                                        className={`task-card absolute left-2 right-2 rounded-xl border border-border bg-card/50 backdrop-blur-sm p-3 shadow-sm transition-all hover:shadow-md pointer-events-auto cursor-pointer overflow-hidden ${isDragging ? 'z-50 ring-2 ring-primary border-primary shadow-xl opacity-90 scale-[1.02]' : ''}`}
                                        style={{
                                            top: `${startMin * PIXELS_PER_MINUTE + TOP_MARGIN}px`,
                                            height: `${duration * PIXELS_PER_MINUTE}px`,
                                        }}
                                        onMouseDown={(e) => handleCardPress(e, 'routine', task)}
                                        onTouchStart={(e) => handleCardPress(e, 'routine', task)}
                                        onClick={() => {
                                            if (!wasDragged.current) {
                                                setEditingState({ type: 'routine', card: task });
                                            }
                                        }}
                                    >
                                        <div 
                                            className="absolute left-0 top-0 bottom-0 w-1.5 z-10" 
                                            style={{ backgroundColor: getTagColor(task.tag_id) }} 
                                        />
                                        <div className="font-medium text-sm text-foreground truncate">{task.title}</div>
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
                    task={editingState.card}
                    onSave={async (updated) => {
                        const exists = routineCards.some(c => c.id === updated.id);
                        if (exists) {
                            updateRoutineCard(updated.id, updated);
                        } else {
                            addRoutineCard(updated);
                        }
                        await RoutineTimeTrackerService.save(routineCardConfig, updated);
                        setEditingState(null);
                    }}
                    onDelete={async (id) => {
                        const exists = routineCards.some(c => c.id === id);
                        if (exists) {
                            deleteRoutineCard(id);
                            await RoutineTimeTrackerService.delete(routineCardConfig, id);
                        }
                        setEditingState(null);
                    }}
                    onCancel={() => setEditingState(null)}
                />
            )}

            {editingState?.type === 'timeTracker' && (
                <TimeTrackerEditor
                    task={editingState.card}
                    onSave={async (updated) => {
                        const exists = timeTrackerCards.some(c => c.id === updated.id);
                        if (exists) {
                            updateTimeTrackerCard(updated.id, updated);
                        } else {
                            addTimeTrackerCard(updated);
                        }
                        await RoutineTimeTrackerService.save(timeTrackerCardConfig, updated);
                        setEditingState(null);
                    }}
                    onDelete={async (id) => {
                        const exists = timeTrackerCards.some(c => c.id === id);
                        if (exists) {
                            deleteTimeTrackerCard(id);
                            await RoutineTimeTrackerService.delete(timeTrackerCardConfig, id);
                        }
                        setEditingState(null);
                    }}
                    onCancel={() => setEditingState(null)}
                />
            )}
        </div>
    );
}
