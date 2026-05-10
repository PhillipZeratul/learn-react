import React, { useState, useEffect, useRef, useMemo } from 'react';
import { signal, batch, effect } from '@preact/signals-react';
import { v4 as uuidv4 } from 'uuid';
import { createRoutineCard, routineCardConfig, type RoutineCard } from '../models/routine-card.model';
import { createTimeTrackerCard, timeTrackerCardConfig, type TimeTrackerCard } from '../models/time-tracker-card.model';
import { useRoutineCardStore } from '../stores/routine-card.store';
import { useTimeTrackerCardStore } from '../stores/time-tracker-card.store';
import { useTagStore } from '../stores/tag.store';
import { SyncService } from '@/shared/services/sync.service';
import { timeToISO, isoToTime, isoToMinutes, isTouchEvent, formatLocalDate } from '../utils/utils';
import { useRoutineTimeTrackerStore } from '../stores/routine-time-tracker.store';
import { RoutineEditor } from './RoutineEditor';
import { TimeTrackerEditor } from './TimeTrackerEditor';
import { getRoutineInstancesForDate } from '../utils/routine-expansion';
import { Button } from '@/components/ui/Button';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, ArrowRight01Icon, Calendar03Icon } from '@hugeicons/core-free-icons';
import type { IsoDateTime } from '@/shared/models/base.model';
import type { RoutineCardId } from '../models/routine-time-tracker.model';

import { AUTO_SWITCH_TO_TODAY_MS } from '@/features/settings/stores/settings.store';

const PIXELS_PER_MINUTE = 1;
const TOP_MARGIN = 32;
const BOTTOM_MARGIN = 64;
const SHOW_CARD_TITLE_HEIGHT = 20;
const SHOW_CARD_TIME_HEIGHT = 44;

function calculateLayout(cards: (RoutineCard | TimeTrackerCard)[]) {
    const sorted = [...cards].sort((a, b) => {
        const startDiff = isoToMinutes(a.start_at) - isoToMinutes(b.start_at);
        if (startDiff !== 0) return startDiff;
        return isoToMinutes(b.end_at) - isoToMinutes(a.end_at);
    });

    const clusters: (RoutineCard | TimeTrackerCard)[][] = [];
    let currentCluster: (RoutineCard | TimeTrackerCard)[] = [];
    let clusterEndMin = -1;

    for (const card of sorted) {
        const startMin = isoToMinutes(card.start_at);
        const endMin = isoToMinutes(card.end_at);
        
        if (startMin >= clusterEndMin) {
            if (currentCluster.length > 0) {
                clusters.push(currentCluster);
            }
            currentCluster = [card];
            clusterEndMin = endMin;
        } else {
            currentCluster.push(card);
            clusterEndMin = Math.max(clusterEndMin, endMin);
        }
    }
    if (currentCluster.length > 0) {
        clusters.push(currentCluster);
    }

    const finalLayout = new Map<string, { left: string, width: string }>();

    for (const cluster of clusters) {
        const clusterCols: (RoutineCard | TimeTrackerCard)[][] = [];
        const layoutMap = new Map<string, { column: number }>();
        
        for (const card of cluster) {
            let placed = false;
            const startMin = isoToMinutes(card.start_at);
            for (let i = 0; i < clusterCols.length; i++) {
                const col = clusterCols[i];
                const lastCard = col[col.length - 1];
                if (isoToMinutes(lastCard.end_at) <= startMin) {
                    col.push(card);
                    layoutMap.set(card.id, { column: i });
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                clusterCols.push([card]);
                layoutMap.set(card.id, { column: clusterCols.length - 1 });
            }
        }

        const maxCols = clusterCols.length;
        for (const card of cluster) {
            const data = layoutMap.get(card.id)!;
            const leftPct = (data.column / maxCols) * 100;
            const widthPct = (1 / maxCols) * 100;
            
            finalLayout.set(card.id, {
                left: `calc(${leftPct}% + 4px)`,
                width: `calc(${widthPct}% - 8px)`
            });
        }
    }

    return finalLayout;
}

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

const DateNavigator = ({ date, onDateChange }: { date: Date, onDateChange: (d: Date) => void }) => {
    const isToday = new Date().toDateString() === date.toDateString();
    
    const changeDate = (days: number) => {
        const newDate = new Date(date);
        newDate.setDate(date.getDate() + days);
        onDateChange(newDate);
    };

    return (
        <div className="flex items-center justify-between px-4 py-2 bg-background border-b sticky top-0 z-40">
            <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => changeDate(-1)} className="h-8 w-8">
                    <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
                </Button>
                <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => onDateChange(new Date())}
                    className={`text-xs font-bold ${isToday ? 'text-primary' : ''}`}
                >
                    {isToday ? 'TODAY' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => changeDate(1)} className="h-8 w-8">
                    <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
                </Button>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
                <HugeiconsIcon icon={Calendar03Icon} size={16} />
                <span className="text-[10px] font-medium uppercase tracking-wider">
                    {date.toLocaleDateString(undefined, { weekday: 'short' })}
                </span>
            </div>
        </div>
    );
};

const CurrentTimeIndicator = ({ isCurrentDay }: { isCurrentDay: boolean }) => {
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

const TimeTrackerActionButton = ({ 
    activeTimeTrackerId, 
    onAction,
    isCurrentDay
}: { 
    activeTimeTrackerId: string | null;
    onAction: () => void;
    isCurrentDay: boolean;
}) => {
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

interface TaskCardProps {
    card: RoutineCard | TimeTrackerCard;
    isDragging: boolean;
    getTagColor: (tagId: string) => string;
    onPress: (e: React.MouseEvent | React.TouchEvent) => void;
    onClick: () => void;
    layout?: { left: string, width: string };
}

const TaskCard = ({ card, isDragging, getTagColor, onPress, onClick, layout }: TaskCardProps) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const titleRef = useRef<HTMLDivElement>(null);
    const timeRef = useRef<HTMLDivElement>(null);

    const startMin = isoToMinutes(card.start_at);
    const duration = isoToMinutes(card.end_at) - startMin;
    const height = duration * PIXELS_PER_MINUTE;

    // GPU-Accelerated Positioning
    const defaultTransform = `translateY(${startMin * PIXELS_PER_MINUTE + TOP_MARGIN}px)`;
    const defaultHeight = `${height}px`;

    useEffect(() => {
        if (!isDragging) {
            if (cardRef.current) {
                cardRef.current.style.paddingTop = '';
                cardRef.current.style.paddingBottom = '';
            }
            if (titleRef.current) {
                titleRef.current.style.lineHeight = '';
            }
            return;
        }

        const dispose = effect(() => {
            const dragHeight = dragHeightSignal.value;
            const top = dragTopSignal.value;
            
            if (cardRef.current) {
                cardRef.current.style.transform = `translateY(${top}px) scale(1.02)`;
                cardRef.current.style.height = `${dragHeight}px`;
                
                // Direct layout updates to avoid re-renders
                const showTitle = dragHeight >= SHOW_CARD_TITLE_HEIGHT;
                const showTime = dragHeight >= SHOW_CARD_TIME_HEIGHT;

                // Update padding directly on the card ref
                cardRef.current.style.paddingTop = showTime ? '0.5rem' : '0';
                cardRef.current.style.paddingBottom = showTime ? '0.5rem' : '0';

                if (titleRef.current) {
                    titleRef.current.style.display = showTitle ? 'block' : 'none';
                    titleRef.current.style.lineHeight = showTime ? '1.25rem' : '1'; 
                }

                if (timeRef.current) {
                    timeRef.current.style.display = showTime ? 'block' : 'none';

                    const currentStartMin = Math.round((top - TOP_MARGIN) / PIXELS_PER_MINUTE / 5) * 5;
                    const currentEndMin = Math.round((top + dragHeight - TOP_MARGIN) / PIXELS_PER_MINUTE / 5) * 5;

                    const formatMin = (m: number) => {
                        const h = Math.floor(m / 60);
                        const mm = m % 60;
                        return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
                    };

                    timeRef.current.textContent = `${isoToTime(timeToISO(formatMin(currentStartMin)))} - ${isoToTime(timeToISO(formatMin(currentEndMin)))} (dragging)`;
                }
            }
        });

        return () => dispose();
    }, [isDragging]);

    const baseClasses = `task-card absolute rounded-xl border border-border px-3 pointer-events-auto overflow-hidden flex flex-col justify-center bg-card/60`;
    const idleClasses = "transition-all hover:shadow-md cursor-pointer shadow-sm";
    const draggingClasses = "z-50 ring-2 ring-primary border-primary shadow-xl opacity-90 cursor-grabbing backdrop-blur-sm";

    const showTitle = height >= SHOW_CARD_TITLE_HEIGHT;
    const showTime = height >= SHOW_CARD_TIME_HEIGHT;

    const defaultLeft = layout ? layout.left : '0.5rem';
    const defaultWidth = layout ? layout.width : 'calc(100% - 1rem)';

    return (
        <div
            ref={cardRef}
            className={`${baseClasses} ${isDragging ? draggingClasses : idleClasses}`}
            style={{
                top: 0,
                transform: isDragging ? undefined : defaultTransform,
                height: isDragging ? undefined : defaultHeight,
                left: isDragging ? '0.5rem' : defaultLeft,
                width: isDragging ? 'calc(100% - 1rem)' : defaultWidth,
                zIndex: isDragging ? 50 : undefined,
                paddingTop: isDragging ? undefined : (showTime ? '0.5rem' : '0'),
                paddingBottom: isDragging ? undefined : (showTime ? '0.5rem' : '0'),
                // Hardware Hinting: dedicated GPU layer for the card
                willChange: 'transform, height, opacity',
            }}
            onMouseDown={onPress}
            onTouchStart={onPress}
            onClick={onClick}
        >
            <div
                className="absolute left-0 top-0 bottom-0 w-1.5 z-10"
                style={{ backgroundColor: getTagColor(card.tag_id) }}
            />
            <div 
                ref={titleRef}
                className="card-title font-medium text-sm text-foreground truncate flex-shrink-0"
                style={{ 
                    display: showTitle || isDragging ? 'block' : 'none',
                    lineHeight: showTime ? '1.25rem' : '1'
                }}
            >
                {card.title}
            </div>
            <div 
                ref={timeRef}
                className="card-time text-[10px] text-muted-foreground tabular-nums truncate flex-shrink-0"
                style={{ display: showTime || isDragging ? 'block' : 'none' }}
            >
                {`${isoToTime(card.start_at)} - ${isoToTime(card.end_at)}`}
            </div>
        </div>
    );
};

export default function RoutineTimeTrackerWidget() {
    const {
        items: allTimeTrackerCards,
        add: addTimeTrackerCard,
        update: updateTimeTrackerCard,
        remove: deleteTimeTrackerCard
    } = useTimeTrackerCardStore();

    const {
        items: allRoutineCards,
        add: addRoutineCard,
        update: updateRoutineCard,
        remove: deleteRoutineCard
    } = useRoutineCardStore();

    const { items: tags } = useTagStore();
    const { activeTimeTrackerId, setActiveTimeTrackerId } = useRoutineTimeTrackerStore();

    const [currentDate, setCurrentDate] = useState(new Date());
    const isCurrentDay = new Date().toDateString() === currentDate.toDateString();

    const currentDateTimeTrackerCards = useMemo(() => {
        const dateStr = formatLocalDate(currentDate);
        return allTimeTrackerCards.filter(c => !c.is_deleted && c.start_at.startsWith(dateStr));
    }, [allTimeTrackerCards, currentDate]);

    const currentDateRoutineCards = useMemo(() => {
        return getRoutineInstancesForDate(allRoutineCards, currentDate);
    }, [allRoutineCards, currentDate]);

    const routineLayoutMap = useMemo(() => {
        return calculateLayout(currentDateRoutineCards.filter(t => !t.is_deleted));
    }, [currentDateRoutineCards]);

    const [editingState, setEditingState] = useState<EditingState>(null);
    const [dragState, setDragState] = useState<DragState | null>(null);
    const [confirmDragState, setConfirmDragState] = useState<{
        type: 'routine' | 'timeTracker';
        card: RoutineCard | TimeTrackerCard;
        originalStartAt: IsoDateTime;
    } | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastTouchPos = useRef<{ x: number, y: number } | null>(null);
    const wasDragged = useRef(false);
    const lastBackgroundTime = useRef<number | null>(null);

    // Scroll to current time on mount and focus
    const scrollToCurrentTime = () => {
        if (!scrollContainerRef.current) return;
        
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const targetY = currentMinutes * PIXELS_PER_MINUTE + TOP_MARGIN;
        const containerHeight = scrollContainerRef.current.clientHeight;
        
        scrollContainerRef.current.scrollTo({
            top: targetY - containerHeight / 2,
            behavior: 'smooth'
        });
    };

    useEffect(() => {
        // Initial scroll - only if viewing today (which is the default)
        const timer = setTimeout(() => {
            if (currentDate.toDateString() === new Date().toDateString()) {
                scrollToCurrentTime();
            }
        }, 100);

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                const now = new Date();
                let shouldScroll = currentDate.toDateString() === now.toDateString();

                // Auto-switch to today if backgrounded for more than threshold
                if (lastBackgroundTime.current) {
                    const elapsed = Date.now() - lastBackgroundTime.current;
                    if (elapsed >= AUTO_SWITCH_TO_TODAY_MS) {
                        console.log(`SyncService: App idle for ${Math.round(elapsed/1000/60)}m, auto-switching to today.`);
                        setCurrentDate(now);
                        shouldScroll = true; // Always scroll after an auto-switch
                    }
                    lastBackgroundTime.current = null;
                }
                
                if (shouldScroll) {
                    scrollToCurrentTime();
                }
            } else {
                lastBackgroundTime.current = Date.now();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [currentDate]);

    useEffect(() => {
        if (!activeTimeTrackerId) return;

        const task = allTimeTrackerCards.find(c => c.id === activeTimeTrackerId);
        if (!task || task.is_deleted) {
            setActiveTimeTrackerId(null);
            return;
        }

        const timer = setInterval(() => {
            const now = new Date();
            const endHour = now.getHours();
            const endMin = now.getMinutes();
            const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
            
            const updatedCard = {
                ...task,
                end_at: timeToISO(endTime)
            };
            
            updateTimeTrackerCard(task.id, updatedCard);
            SyncService.save(timeTrackerCardConfig, updatedCard).catch(console.error);
        }, 60000);

        return () => clearInterval(timer);
    }, [activeTimeTrackerId, allTimeTrackerCards, updateTimeTrackerCard, setActiveTimeTrackerId]);

    const handleTimeTrackerAction = () => {
        if (activeTimeTrackerId) {
            const task = allTimeTrackerCards.find(c => c.id === activeTimeTrackerId);
            if (task && !task.is_deleted) {
                setActiveTimeTrackerId(null);
                
                const now = new Date();
                const startHour = now.getHours();
                const startMin = now.getMinutes();
                const startTime = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;
                
                const endHour = Math.min(24, startHour + 1);
                const endTime = `${String(endHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;

                const newCard = createTimeTrackerCard({
                    start_at: timeToISO(startTime),
                    end_at: timeToISO(endTime),
                });
                setEditingState({ type: 'timeTracker', card: newCard });
            }
        } else {
            const now = new Date();
            const startHour = now.getHours();
            const startMin = now.getMinutes();
            const startTime = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;
            
            const endTime = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;

            const newCard = createTimeTrackerCard({
                start_at: timeToISO(startTime),
                end_at: timeToISO(endTime),
            });
            setEditingState({ type: 'timeTracker', card: newCard });
        }
    };

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
        
        const dateStr = formatLocalDate(currentDate);
        const startTime = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;
        const startIso = timeToISO(startTime, dateStr);

        const endMinutes = roundedMinutes + 60;
        const endHour = Math.floor(endMinutes / 60);
        const endMin = endMinutes % 60;
        const endTime = `${String(Math.min(24, endHour)).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
        const endIso = timeToISO(endTime, dateStr);

        const isTimeTrackerBlock = relativeX < contentWidth / 2;

        if (isTimeTrackerBlock) {
            const newCard = createTimeTrackerCard({
                start_at: startIso,
                end_at: endIso,
            });
            setEditingState({ type: 'timeTracker', card: newCard });
        } else {
            const newCard = createRoutineCard({
                start_at: startIso,
                end_at: endIso,
            });
            setEditingState({ type: 'routine', card: newCard });
        }
    };

    const handleCardPress = (e: React.MouseEvent | React.TouchEvent, type: 'routine' | 'timeTracker', task: RoutineCard | TimeTrackerCard) => {
        e.stopPropagation();

        // Ignore multi-touch (pinch zoom)
        if (isTouchEvent(e) && e.touches.length > 1) {
            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
            }
            return;
        }

        const clientX = isTouchEvent(e) ? e.touches[0].clientX : e.clientX;
        const clientY = isTouchEvent(e) ? e.touches[0].clientY : e.clientY;

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

        // Ignore multi-touch (pinch zoom)
        if (isTouchEvent(e) && e.touches.length > 1) {
            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
            }
            return;
        }

        const clientX = isTouchEvent(e) ? e.touches[0].clientX : e.clientX;
        const clientY = isTouchEvent(e) ? e.touches[0].clientY : e.clientY;

        lastTouchPos.current = { x: clientX, y: clientY };

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

            const dateStr = formatLocalDate(new Date(dragState.card.start_at));
            const finalCard = {
                ...dragState.card,
                start_at: timeToISO(`${String(Math.floor(finalStartMin / 60)).padStart(2, '0')}:${String(finalStartMin % 60).padStart(2, '0')}`, dateStr),
                end_at: timeToISO(`${String(Math.floor(finalEndMin / 60)).padStart(2, '0')}:${String(finalEndMin % 60).padStart(2, '0')}`, dateStr),
            };

            // If it's a recurring routine, show confirmation dialog
            if (dragState.type === 'routine') {
                const routine = finalCard as RoutineCard;
                const isRecurring = routine._isVirtual || !!routine.rrule || !!routine.parent_routine_id;
                
                if (isRecurring) {
                    setConfirmDragState({ 
                        type: 'routine', 
                        card: routine,
                        originalStartAt: dragState.card.start_at as IsoDateTime
                    });
                    setDragState(null);
                    return;
                }

                updateRoutineCard(routine.id, routine);
                await SyncService.save(routineCardConfig, routine);
            } else {
                updateTimeTrackerCard(finalCard.id, finalCard as TimeTrackerCard);
                await SyncService.save(timeTrackerCardConfig, finalCard as TimeTrackerCard);
            }
            setDragState(null);
        }
    };

    const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
        // Ignore if multi-touch starts during a move
        if (isTouchEvent(e) && e.touches.length > 1) {
            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
            }
            return;
        }

        const clientX = isTouchEvent(e) ? e.touches[0].clientX : e.clientX;
        const clientY = isTouchEvent(e) ? e.touches[0].clientY : e.clientY;

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
        <div className="h-full w-full relative flex flex-col overflow-hidden">
            <DateNavigator date={currentDate} onDateChange={setCurrentDate} />
            
            <div
                ref={scrollContainerRef}
                className={`flex-1 w-full bg-background relative scrollbar-hide select-none ${dragState ? 'overflow-hidden' : 'overflow-y-auto'}`}
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
                            style={{ top: `${i * 60 * PIXELS_PER_MINUTE + TOP_MARGIN}px` }}
                        />
                    ))}

                    <div className="absolute inset-0 flex">
                        {/* Time Tracker Column */}
                        <div className="relative flex-1 h-full">
                            {currentDateTimeTrackerCards.map(task => (
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
                            <TimeTrackerActionButton 
                                activeTimeTrackerId={activeTimeTrackerId}
                                onAction={handleTimeTrackerAction}
                                isCurrentDay={isCurrentDay}
                            />
                        </div>

                        {/* Center Timeline */}
                        <div className="relative w-fit h-full flex flex-col items-center">
                            <div className="invisible font-mono text-xs select-none px-2">00:00</div>
                            {[...Array(25)].map((_, i) => (
                                <div
                                    key={`time-${i}`}
                                    className="absolute left-1/2 -translate-x-1/2 text-muted-foreground text-xs font-mono -translate-y-1/2 z-10"
                                    style={{ top: `${i * 60 * PIXELS_PER_MINUTE + TOP_MARGIN}px` }}
                                >
                                    <span className="bg-background px-2 tabular-nums">
                                        {String(i).padStart(2, '0')}:00
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Routine Column */}
                        <div className="relative flex-1 h-full">
                            {currentDateRoutineCards.filter(t => !t.is_deleted).map(task => (
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
                                    layout={routineLayoutMap.get(task.id)}
                                />
                            ))}
                        </div>
                    </div>

                    <CurrentTimeIndicator isCurrentDay={isCurrentDay} />
                </div>
            </div>

            {editingState?.type === 'routine' && (
                <RoutineEditor
                    task={editingState.card}
                    masterTask={(() => {
                        const task = editingState.card;
                        if (task._isVirtual) {
                            const masterId = task.id.split('_')[0];
                            return allRoutineCards.find(c => c.id === masterId);
                        }
                        if (task.parent_routine_id) {
                            return allRoutineCards.find(c => c.id === task.parent_routine_id);
                        }
                        if (task.rrule) {
                            return task;
                        }
                        return undefined;
                    })()}
                    onSave={async (updated) => {
                        const exists = allRoutineCards.some(c => c.id === updated.id);
                        if (exists) {
                            updateRoutineCard(updated.id, updated);
                        } else {
                            addRoutineCard(updated);
                        }
                        await SyncService.save(routineCardConfig, updated);
                        setEditingState(null);
                    }}
                    onDelete={async (id) => {
                        const exists = allRoutineCards.some(c => c.id === id);
                        if (exists) {
                            deleteRoutineCard(id);
                            await SyncService.delete(routineCardConfig, id);
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
                        const exists = allTimeTrackerCards.some(c => c.id === updated.id);
                        if (exists) {
                            updateTimeTrackerCard(updated.id, updated);
                        } else {
                            addTimeTrackerCard(updated);
                            if (!activeTimeTrackerId && isCurrentDay) {
                                setActiveTimeTrackerId(updated.id);
                            }
                        }
                        await SyncService.save(timeTrackerCardConfig, updated);
                        setEditingState(null);
                    }}
                    onDelete={async (id) => {
                        const exists = allTimeTrackerCards.some(c => c.id === id);
                        if (exists) {
                            deleteTimeTrackerCard(id);
                            await SyncService.delete(timeTrackerCardConfig, id);
                        }
                        setEditingState(null);
                    }}
                    onCancel={() => setEditingState(null)}
                />
            )}

            {confirmDragState && (
                <div 
                    className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/20 backdrop-blur-[4px] animate-in fade-in duration-200"
                >
                    <div className="w-full max-w-[280px] bg-card border border-border rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
                        <h4 className="text-base font-semibold mb-2 text-foreground">Save changes</h4>
                        <p className="text-sm text-muted-foreground mb-6">
                            Do you want to apply this change to only this occurrence or the entire series?
                        </p>
                        <div className="space-y-2">
                            <Button 
                                className="w-full justify-center" 
                                onClick={async () => {
                                    const routine = confirmDragState.card as RoutineCard;
                                    if (routine._isVirtual) {
                                        const masterId = routine.id.split('_')[0] as RoutineCardId;
                                        const detachedInstance: RoutineCard = {
                                            ...routine,
                                            id: uuidv4() as RoutineCardId,
                                            parent_routine_id: masterId,
                                            original_recurrence_date: confirmDragState.originalStartAt,
                                            _isVirtual: undefined,
                                            updated_at: new Date().toISOString() as IsoDateTime
                                        };
                                        addRoutineCard(detachedInstance);
                                        await SyncService.save(routineCardConfig, detachedInstance);
                                    } else {
                                        updateRoutineCard(routine.id, routine);
                                        await SyncService.save(routineCardConfig, routine);
                                    }
                                    setConfirmDragState(null);
                                }}
                            >
                                This occurrence only
                            </Button>
                            <Button 
                                variant="outline"
                                className="w-full justify-center" 
                                onClick={async () => {
                                    const routine = confirmDragState.card as RoutineCard;
                                    const masterId = routine._isVirtual ? routine.id.split('_')[0] : routine.id;
                                    const master = allRoutineCards.find(c => c.id === masterId);
                                    
                                    if (master) {
                                        const datePart = formatLocalDate(new Date(master.start_at));
                                        const timePartStart = isoToTime(routine.start_at);
                                        const timePartEnd = isoToTime(routine.end_at);
                                        
                                        const updatedMaster = {
                                            ...master,
                                            start_at: timeToISO(timePartStart, datePart),
                                            end_at: timeToISO(timePartEnd, datePart),
                                            updated_at: new Date().toISOString() as IsoDateTime
                                        };
                                        updateRoutineCard(master.id, updatedMaster);
                                        await SyncService.save(routineCardConfig, updatedMaster);
                                    }
                                    setConfirmDragState(null);
                                }}
                            >
                                All occurrences
                            </Button>
                            <Button 
                                variant="ghost"
                                className="w-full justify-center text-muted-foreground" 
                                onClick={() => setConfirmDragState(null)}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
