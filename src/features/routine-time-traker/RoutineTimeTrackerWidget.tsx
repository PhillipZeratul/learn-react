import React, { useState, useEffect, useRef } from 'react';

// 核心配置：1小时 = 60px
const PIXELS_PER_MINUTE = 1;
const TOP_MARGIN = 32;
const BOTTOM_MARGIN = 32;

export default function RoutineTimeTrackerWidget() {
    const [tasks, setTasks] = useState([
        { id: 1, title: '深度工作', start: '07:00', end: '10:30', side: 'left' }
    ]);

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

    const timeToMinutes = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
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
        const side = relativeX < contentWidth / 2 ? 'left' : 'right';

        const newTask = {
            id: Date.now(),
            title: '新任务',
            start: startTime,
            end: endTime,
            side: side as 'left' | 'right'
        };

        setTasks(prev => [...prev, newTask]);
    };

    const startPress = (e: React.MouseEvent | React.TouchEvent) => {
        // 如果点击的是已有任务，不触发创建
        if ((e.target as HTMLElement).closest('.task-card')) return;

        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        
        lastTouchPos.current = { x: clientX, y: clientY };

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
        // 外层滚动容器
        <div 
            ref={scrollContainerRef}
            className="h-full w-full overflow-y-auto bg-background relative flex flex-col items-center scrollbar-hide select-none"
            onMouseDown={startPress}
            onMouseUp={endPress}
            onMouseLeave={endPress}
            onMouseMove={handleMove}
            onTouchStart={startPress}
            onTouchEnd={endPress}
            onTouchMove={handleMove}
        >

            {/* 24小时画布 */}
            <div className="relative w-full max-w-2xl py-8 px-4 pointer-events-none" style={{ height: `${25 * 60 * PIXELS_PER_MINUTE + BOTTOM_MARGIN}px` }}>

                {/* 中央时间刻度 (生成 0-24 的数组) */}
                {[...Array(25)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute left-0 right-0 flex items-center justify-center text-muted-foreground text-xs font-mono -translate-y-1/2"
                        style={{ top: `${i * 60 * PIXELS_PER_MINUTE + TOP_MARGIN}px` }}
                    >
                        {/* 时间文字与刻度线 */}
                        <div className="absolute w-full border-t border-border border-dashed" />
                        <span className="bg-background px-2 z-10 tabular-nums">
                            {String(i).padStart(2, '0')}:00
                        </span>
                    </div>
                ))}

                {/* 渲染任务卡片 */}
                {tasks.map(task => {
                    const startMin = timeToMinutes(task.start);
                    const duration = timeToMinutes(task.end) - startMin;

                    return (
                        <div
                            key={task.id}
                            className={`task-card absolute rounded-xl border border-border bg-card/50 backdrop-blur-sm p-3 shadow-sm transition-all hover:shadow-md pointer-events-auto ${
                                task.side === 'left' 
                                    ? 'left-2 right-[calc(50%+30px)]' 
                                    : 'left-[calc(50%+30px)] right-2'
                            }`}
                            style={{
                                top: `${startMin * PIXELS_PER_MINUTE + TOP_MARGIN}px`,
                                height: `${duration * PIXELS_PER_MINUTE}px`,
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                        >
                            <div className="font-medium text-sm text-foreground">{task.title}</div>
                            <div className="text-[10px] text-muted-foreground mt-1 tabular-nums">
                                {task.start} - {task.end}
                            </div>
                        </div>
                    );
                })}

                {/* 当前时间红线 */}
                <div
                    className="absolute left-0 right-0 flex items-center justify-center z-20 pointer-events-none -translate-y-1/2"
                    style={{ top: `${currentMinutes * PIXELS_PER_MINUTE + TOP_MARGIN}px` }}
                >
                    <div className="w-full border-t-2 border-primary/50" />
                    <span className="absolute bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                        {currentTimeString}
                    </span>
                </div>

            </div>
        </div>
    );
}
