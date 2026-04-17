import React, {useState, useEffect, useRef} from 'react';
import type {IsoDateTime} from "@/models/base.model";
import { RoutineCard } from '@/features/routine-time-tracker/models/routine-card.model';
import { TimeTrackerCard } from '@/features/routine-time-tracker/models/time-tracker-card.model';
import { useRoutineTimeTrackerStore } from '../stores/routine-time-tracker.store';
import { RoutineTimeTrackerService } from '../services/routine-time-tracker-service';

// 核心配置：1小时 = 60px
const PIXELS_PER_MINUTE = 1;
const TOP_MARGIN = 32;
const BOTTOM_MARGIN = 64;

const timeToISO = (timeStr: string, dateStr?: string): IsoDateTime => {
    const date = dateStr || new Date().toISOString().split('T')[0];
    return new Date(`${date}T${timeStr}:00`).toISOString() as IsoDateTime;
};

const isoToTime = (isoStr: string): string => {
    const date = new Date(isoStr);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

type AnyCard = TimeTrackerCard | RoutineCard;

export default function RoutineTimeTrackerWidget() {
    const { timeTrackerCards, routineCards, addTimeTrackerCard, addRoutineCard, updateTimeTrackerCard, updateRoutineCard, deleteTimeTrackerCard, deleteRoutineCard } = useRoutineTimeTrackerStore();
    
    const [editingTask, setEditingTask] = useState<AnyCard | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastTouchPos = useRef<{ x: number, y: number } | null>(null);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const isoToMinutes = (isoStr: string) => {
        const date = new Date(isoStr);
        return date.getHours() * 60 + date.getMinutes();
    };

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
            const newCard = new TimeTrackerCard({
                start_at: timeToISO(startTime),
                end_at: timeToISO(endTime),
            });
            addTimeTrackerCard(newCard);
            await RoutineTimeTrackerService.saveTimeTrackerCard(newCard);
        } else {
            const newCard = new RoutineCard({
                start_at: timeToISO(startTime),
                end_at: timeToISO(endTime),
            });
            addRoutineCard(newCard);
            await RoutineTimeTrackerService.saveRoutineCard(newCard);
        }
    };

    const handleUpdateTask = async (updatedTask: AnyCard) => {
        if (updatedTask instanceof TimeTrackerCard) {
            updateTimeTrackerCard(updatedTask.id, updatedTask);
            await RoutineTimeTrackerService.saveTimeTrackerCard(updatedTask);
        } else if (updatedTask instanceof RoutineCard) {
            updateRoutineCard(updatedTask.id, updatedTask);
            await RoutineTimeTrackerService.saveRoutineCard(updatedTask);
        }
        setEditingTask(null);
    };

    const handleDeleteTask = async (id: string) => {
        const taskToDelete = [...timeTrackerCards, ...routineCards].find(t => t.id === id);
        if (!taskToDelete) return;

        if (taskToDelete instanceof TimeTrackerCard) {
            deleteTimeTrackerCard(id);
            await RoutineTimeTrackerService.deleteTimeTrackerCard(id);
        } else {
            deleteRoutineCard(id);
            await RoutineTimeTrackerService.deleteRoutineCard(id);
        }
        setEditingTask(null);
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
                        <div className="relative flex-1 h-full">
                            {timeTrackerCards.filter(t => !t.is_deleted).map(task => {
                                const startMin = isoToMinutes(task.start_at);
                                const duration = isoToMinutes(task.end_at) - startMin;
                                return (
                                    <div
                                        key={task.id}
                                        className="task-card absolute left-2 right-2 rounded-xl border border-border bg-card/50 backdrop-blur-sm p-3 shadow-sm transition-all hover:shadow-md pointer-events-auto cursor-pointer"
                                        style={{
                                            top: `${startMin * PIXELS_PER_MINUTE + TOP_MARGIN}px`,
                                            height: `${duration * PIXELS_PER_MINUTE}px`,
                                        }}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onTouchStart={(e) => e.stopPropagation()}
                                        onClick={() => setEditingTask(task)}
                                    >
                                        <div className="font-medium text-sm text-foreground">{task.title}</div>
                                        <div className="text-[10px] text-muted-foreground mt-1 tabular-nums">
                                            {isoToTime(task.start_at)} - {isoToTime(task.end_at)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

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

                        <div className="relative flex-1 h-full">
                            {routineCards.filter(t => !t.is_deleted).map(task => {
                                const startMin = isoToMinutes(task.start_at);
                                const duration = isoToMinutes(task.end_at) - startMin;
                                return (
                                    <div
                                        key={task.id}
                                        className="task-card absolute left-2 right-2 rounded-xl border border-border bg-card/50 backdrop-blur-sm p-3 shadow-sm transition-all hover:shadow-md pointer-events-auto cursor-pointer"
                                        style={{
                                            top: `${startMin * PIXELS_PER_MINUTE + TOP_MARGIN}px`,
                                            height: `${duration * PIXELS_PER_MINUTE}px`,
                                        }}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onTouchStart={(e) => e.stopPropagation()}
                                        onClick={() => setEditingTask(task)}
                                    >
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

            {editingTask && (
                <TaskEditor
                    task={editingTask}
                    onSave={handleUpdateTask}
                    onDelete={handleDeleteTask}
                    onCancel={() => setEditingTask(null)}
                />
            )}
        </div>
    );
}

function TaskEditor({
                        task,
                        onSave,
                        onDelete,
                        onCancel
                    }: {
    task: AnyCard,
    onSave: (task: AnyCard) => void,
    onDelete: (id: string) => void,
    onCancel: () => void
}) {
    const [title, setTitle] = useState(task.title);
    const [startAt, setStartAt] = useState(isoToTime(task.start_at));
    const [endAt, setEndAt] = useState(isoToTime(task.end_at));

    const handleSave = () => {
        if (task instanceof TimeTrackerCard) {
            onSave(new TimeTrackerCard({ ...task, title, start_at: timeToISO(startAt), end_at: timeToISO(endAt) }));
        } else if (task instanceof RoutineCard) {
            onSave(new RoutineCard({ ...task, title, start_at: timeToISO(startAt), end_at: timeToISO(endAt) }));
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
                <h3 className="text-lg font-semibold mb-4 text-foreground">编辑任务</h3>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">任务名称</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            placeholder="任务名称"
                            autoFocus
                        />
                    </div>

                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="text-xs text-muted-foreground mb-1 block">开始时间</label>
                            <input
                                type="time"
                                value={startAt}
                                onChange={(e) => setStartAt(e.target.value)}
                                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs text-muted-foreground mb-1 block">结束时间</label>
                            <input
                                type="time"
                                value={endAt}
                                onChange={(e) => setEndAt(e.target.value)}
                                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex flex-col gap-2">
                    <button
                        onClick={handleSave}
                        className="w-full bg-primary text-primary-foreground font-medium py-2 rounded-lg hover:opacity-90 transition-opacity"
                    >
                        保存
                    </button>
                    <div className="flex gap-2">
                        <button
                            onClick={onCancel}
                            className="flex-1 bg-muted text-muted-foreground font-medium py-2 rounded-lg hover:bg-muted/80 transition-colors"
                        >
                            取消
                        </button>
                        <button
                            onClick={() => onDelete(task.id)}
                            className="px-4 bg-destructive/10 text-destructive font-medium py-2 rounded-lg hover:bg-destructive/20 transition-colors"
                        >
                            删除
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
