import React, {useState, useEffect, useRef} from 'react';
import type {IsoDateTime} from "@/types/models";
import { RoutineCard } from '@/features/routine-time-traker/models/RoutineCard';
import { TimeTrackerCard } from '@/features/routine-time-traker/models/TimeTrackerCard';

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
    const [timeTrackerCards, setTimeTrackerCards] = useState<TimeTrackerCard[]>([
        new TimeTrackerCard({
            title: 'Deep Work',
            start_at: timeToISO('07:00'),
            end_at: timeToISO('10:30'),
        })
    ]);
    const [routineCards, setRoutineCards] = useState<RoutineCard[]>([]);

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

    const handleCreateTask = (clientX: number, clientY: number) => {
        if (!scrollContainerRef.current) return;

        const rect = scrollContainerRef.current.getBoundingClientRect();
        // 获取相对于内容区域的 Y 坐标（考虑滚动）
        const relativeY = clientY - rect.top + scrollContainerRef.current.scrollTop;
        const relativeX = clientX - rect.left;

        // 使用 clientWidth 而不是 rect.width 来排除滚动条的影响，确保中心点判断准确
        const contentWidth = scrollContainerRef.current.clientWidth;

        // 减去容器内边距和顶部边距
        const minutes = Math.floor((relativeY - TOP_MARGIN) / PIXELS_PER_MINUTE);

        if (minutes < 0 || minutes >= 24 * 60) return;

        // 就近取整到 30 分钟间隔
        const roundedMinutes = Math.round(minutes / 30) * 30;
        const startHour = Math.floor(roundedMinutes / 60);
        const startMin = roundedMinutes % 60;

        const startTime = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;

        // 默认 1 小时时长
        const endMinutes = roundedMinutes + 60;
        const endHour = Math.floor(endMinutes / 60);
        const endMin = endMinutes % 60;
        const endTime = `${String(Math.min(24, endHour)).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

        // 使用 contentWidth 来判断左右侧
        const isTimeTrackerBlock = relativeX < contentWidth / 2;

        if (isTimeTrackerBlock) {
            const newCard = new TimeTrackerCard({
                start_at: timeToISO(startTime),
                end_at: timeToISO(endTime),
            });
            setTimeTrackerCards(prev => [...prev, newCard]);
        } else {
            const newCard = new RoutineCard({
                start_at: timeToISO(startTime),
                end_at: timeToISO(endTime),
            });
            setRoutineCards(prev => [...prev, newCard]);
        }
    };

    const handleUpdateTask = (updatedTask: AnyCard) => {
        if (updatedTask instanceof TimeTrackerCard) {
            setTimeTrackerCards(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
        } else if (updatedTask instanceof RoutineCard) {
            setRoutineCards(prev => prev.map(r => r.id === updatedTask.id ? updatedTask : r));
        }
        setEditingTask(null);
    };

    const handleDeleteTask = (id: string) => {
        setTimeTrackerCards(prev => prev.filter(t => t.id !== id));
        setRoutineCards(prev => prev.filter(r => r.id !== id));
        setEditingTask(null);
    };

    const startPress = (e: React.MouseEvent | React.TouchEvent) => {
        // 如果点击的是已有任务，不触发创建
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

        // 如果移动距离超过 10px，取消长按
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
            {/* 外层滚动容器 */}
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
                {/* 24小时画布 - 固定高度确保触发滚动 */}
                <div
                    className="relative w-full max-w-2xl mx-auto pointer-events-none"
                    style={{
                        height: `${24 * 60 * PIXELS_PER_MINUTE + BOTTOM_MARGIN}px`,
                    }}
                >
                    {/* 1. 背景刻度线 (根据容器宽度铺满) */}
                    {[...Array(25)].map((_, i) => (
                        <div
                            key={`line-${i}`}
                            className="absolute left-0 right-0 border-t border-border border-dashed -translate-y-1/2"
                            style={{top: `${i * 60 * PIXELS_PER_MINUTE + TOP_MARGIN}px`}}
                        />
                    ))}

                    {/* 2. 三栏布局层 (左任务 - 时间轴 - 右任务) */}
                    <div className="absolute inset-0 flex">

                        {/* 左侧任务栏 (TimeTracker) */}
                        <div className="relative flex-1 h-full">
                            {timeTrackerCards.map(task => {
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

                        {/* 中间时间轴 */}
                        <div className="relative w-fit h-full flex flex-col items-center">
                            {/* 隐形占位符，确保轴宽随字体变化 */}
                            <div className="invisible font-mono text-xs select-none px-2">00:00</div>

                            {/* 时间文字 */}
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

                        {/* 右侧任务栏 (Routine) */}
                        <div className="relative flex-1 h-full">
                            {routineCards.map(task => {
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

                    {/* 3. 当前时间红线 (全宽) */}
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

            {/* 任务编辑弹窗 */}
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
