import React, {useState, useEffect, useRef} from 'react';
import { signal, batch, effect } from '@preact/signals-react';
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

// Signals for high-frequency dragging updates
const dragTopSignal = signal(0);
const dragHeightSignal = signal(0);

const CurrentTimeIndicator = () => {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    const currentTimeString = currentTime.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    return (
        <div
            className="absolute left-0 right-0 flex items-center justify-center z-20 pointer-events-none -translate-y-1/2"
            style={{top: `${currentMinutes * PIXELS_PER_MINUTE + TOP_MARGIN}px`}}
        >
            <div className="w-full border-t-2 border-primary/50"/>
            <span className="absolute bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                {currentTimeString}
            </span>
        </div>
    );
};

interface TaskCardProps {
    card: RoutineCard | TimeTrackerCard;
    isDragging: boolean;
    getTagColor: (tagId: string) => string;
    onPress: (e: React.MouseEvent | React.TouchEvent) => void;
    onClick: () => void;
}

const TaskCard = ({ card, isDragging, getTagColor, onPress, onClick }: TaskCardProps) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const timeLabelRef = useRef<HTMLDivElement>(null);

    const startMin = isoToMinutes(card.start_at);
    const duration = isoToMinutes(card.end_at) - startMin;

    // GPU-Accelerated Positioning
    const defaultTransform = `translateY(${startMin * PIXELS_PER_MINUTE + TOP_MARGIN}px)`;
    const defaultHeight = `${duration * PIXELS_PER_MINUTE}px`;

    useEffect(() => {
        if (!isDragging) return;

        const dispose = effect(() => {
            if (cardRef.current) {
                // Apply the transform directly. scale(1.02) is appended because inline transforms override Tailwind's scale utilities.
                cardRef.current.style.transform = `translateY(${dragTopSignal.value}px) scale(1.02)`;
                cardRef.current.style.height = `${dragHeightSignal.value}px`;
            }

            if (timeLabelRef.current) {
                const top = dragTopSignal.value;
                const height = dragHeightSignal.value;
                const currentStartMin = Math.round((top - TOP_MARGIN) / PIXELS_PER_MINUTE / 5) * 5;
                const currentEndMin = Math.round((top + height - TOP_MARGIN) / PIXELS_PER_MINUTE / 5) * 5;
                
                const formatMin = (m: number) => {
                    const h = Math.floor(m / 60);
                    const mm = m % 60;
                    return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
                };
                
                timeLabelRef.current.innerText = `${isoToTime(timeToISO(formatMin(currentStartMin)))} - ${isoToTime(timeToISO(formatMin(currentEndMin)))} (dragging)`;
            }
        });

        return () => dispose();
    }, [isDragging]);

    // Fix the Transition Trap: strictly separate idle (with transitions) from dragging styles
    const baseClasses = "task-card absolute left-2 right-2 rounded-xl border border-border bg-card/50 backdrop-blur-sm p-3 pointer-events-auto overflow-hidden";
    const idleClasses = "transition-all hover:shadow-md cursor-pointer shadow-sm"; 
    const draggingClasses = "z-50 ring-2 ring-primary border-primary shadow-xl opacity-90 cursor-grabbing";

    return (
        <div
            ref={cardRef}
            className={`${baseClasses} ${isDragging ? draggingClasses : idleClasses}`}
            style={{
                top: 0, // Anchor to top, let transform handle movement
                transform: isDragging ? undefined : defaultTransform,
                height: isDragging ? undefined : defaultHeight,
                // Hardware Hinting: dedicated GPU layer for the card
                willChange: isDragging ? 'transform, height' : 'auto', 
            }}
            onMouseDown={onPress}
            onTouchStart={onPress}
            onClick={onClick}
        >
            <div 
                className="absolute left-0 top-0 bottom-0 w-1.5 z-10" 
                style={{ backgroundColor: getTagColor(card.tag_id) }} 
            />
            <div className="font-medium text-sm text-foreground truncate">{card.title}</div>
            <div ref={timeLabelRef} className="text-[10px] text-muted-foreground mt-1 tabular-nums">
                {!isDragging && `${isoToTime(card.start_at)} - ${isoToTime(card.end_at)}`}
            </div>
        </div>
    );
};

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
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastTouchPos = useRef<{ x: number, y: number } | null>(null);
    const wasDragged = useRef(false);

    const getTagColor = (tagId: string) => {
        const tag = tags.find(t => t.id === tagId);
        return tag?.color || '#94a3b8'; // Fallback to slate-400 if tag not found
    };

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
            const startMin = isoToMinutes(task.start_at);
            const duration = isoToMinutes(task.end_at) - startMin;
            
            batch(() => {
                dragTopSignal.value = startMin * PIXELS_PER_MINUTE + TOP_MARGIN;
                dragHeightSignal.value = duration * PIXELS_PER_MINUTE;
            });

            setDragState({
                type,
                card: task,
                initialStartMin: startMin,
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

            // Calculate final snapped times
            const finalTop = dragTopSignal.value;
            const finalHeight = dragHeightSignal.value;
            const finalStartMin = Math.round((finalTop - TOP_MARGIN) / PIXELS_PER_MINUTE / 5) * 5;
            const finalEndMin = Math.round((finalTop + finalHeight - TOP_MARGIN) / PIXELS_PER_MINUTE / 5) * 5;

            const finalCard = {
                ...dragState.card,
                start_at: timeToISO(`${String(Math.floor(finalStartMin / 60)).padStart(2, '0')}:${String(finalStartMin % 60).padStart(2, '0')}`),
                end_at: timeToISO(`${String(Math.floor(finalEndMin / 60)).padStart(2, '0')}:${String(finalEndMin % 60).padStart(2, '0')}`),
            };

            // Sync the final dragged state to the global store
            if (dragState.type === 'routine') {
                updateRoutineCard(finalCard.id, finalCard as RoutineCard);
                await RoutineTimeTrackerService.save(routineCardConfig, finalCard as RoutineCard);
            } else {
                updateTimeTrackerCard(finalCard.id, finalCard as TimeTrackerCard);
                await RoutineTimeTrackerService.save(timeTrackerCardConfig, finalCard as TimeTrackerCard);
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
            
            let newTop = dragState.initialStartMin * PIXELS_PER_MINUTE + TOP_MARGIN;
            let newHeight = (dragState.initialEndMin - dragState.initialStartMin) * PIXELS_PER_MINUTE;

            if (dragState.mode === 'top') {
                const requestedTop = (dragState.initialStartMin * PIXELS_PER_MINUTE + TOP_MARGIN) + deltaY;
                const minTop = TOP_MARGIN;
                const maxTop = (dragState.initialEndMin - 5) * PIXELS_PER_MINUTE + TOP_MARGIN;
                newTop = Math.max(minTop, Math.min(maxTop, requestedTop));
                newHeight = ((dragState.initialEndMin * PIXELS_PER_MINUTE + TOP_MARGIN) - newTop);
            } else if (dragState.mode === 'bottom') {
                const requestedHeight = ((dragState.initialEndMin - dragState.initialStartMin) * PIXELS_PER_MINUTE) + deltaY;
                const minHeight = 5 * PIXELS_PER_MINUTE;
                const maxHeight = (24 * 60 - dragState.initialStartMin) * PIXELS_PER_MINUTE;
                newHeight = Math.max(minHeight, Math.min(maxHeight, requestedHeight));
            } else {
                const requestedTop = (dragState.initialStartMin * PIXELS_PER_MINUTE + TOP_MARGIN) + deltaY;
                const duration = (dragState.initialEndMin - dragState.initialStartMin) * PIXELS_PER_MINUTE;
                const minTop = TOP_MARGIN;
                const maxTop = (24 * 60 * PIXELS_PER_MINUTE + TOP_MARGIN) - duration;
                newTop = Math.max(minTop, Math.min(maxTop, requestedTop));
            }

            batch(() => {
                dragTopSignal.value = newTop;
                dragHeightSignal.value = newHeight;
            });
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
                className={`h-full w-full bg-background relative scrollbar-hide select-none ${dragState ? 'overflow-hidden' : 'overflow-y-auto'}`}
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
                            {timeTrackerCards.filter(t => !t.is_deleted).map(task => (
                                <TaskCard
                                    key={task.id}
                                    card={task}
                                    isDragging={dragState?.card.id === task.id}
                                    getTagColor={getTagColor}
                                    onPress={(e) => handleCardPress(e, 'timeTracker', task)}
                                    onClick={() => {
                                        if (!wasDragged.current) {
                                            setEditingState({ type: 'timeTracker', card: task });
                                        }
                                    }}
                                />
                            ))}
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
                            {routineCards.filter(t => !t.is_deleted).map(task => (
                                <TaskCard
                                    key={task.id}
                                    card={task}
                                    isDragging={dragState?.card.id === task.id}
                                    getTagColor={getTagColor}
                                    onPress={(e) => handleCardPress(e, 'routine', task)}
                                    onClick={() => {
                                        if (!wasDragged.current) {
                                            setEditingState({ type: 'routine', card: task });
                                        }
                                    }}
                                />
                            ))}
                        </div>
                    </div>

                    <CurrentTimeIndicator />
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
