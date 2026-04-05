import React, { useState } from 'react';

const PIXELS_PER_MINUTE = 1;
const TOP_MARGIN = 32;
const BOTTOM_MARGIN = 32;

export default function RoutineTimeTrackerWidget() {
    const [tasks, setTasks] = useState([
        { id: 1, title: '深度工作', start: '07:00', end: '10:30', side: 'left' }
    ]);

    // 将 "07:30" 转换为距离 00:00 的分钟数
    const timeToMinutes = (timeStr) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    };

    return (
        // 外层滚动容器
        <div className="h-full overflow-y-auto bg-background relative scrollbar-hide">

            {/* 24小时画布，总高度 24 * 60 = 1440px */}
            <div className="relative w-full max-w-2xl mx-auto py-8 px-4" style={{ height: `${25 * 60 * PIXELS_PER_MINUTE + BOTTOM_MARGIN}px` }}>

                {/* 中央时间刻度 (生成 0-24 的数组) */}
                {[...Array(25)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute w-full flex justify-center text-muted-foreground text-xs font-mono"
                        style={{ top: `${i * 60 * PIXELS_PER_MINUTE + TOP_MARGIN}px` }}
                    >
                        {/* 时间文字与刻度线 */}
                        <span className="bg-background px-2 z-10 tabular-nums">{String(i).padStart(2, '0')}:00</span>
                        <div className="absolute top-2 w-full border-t border-border border-dashed" />
                    </div>
                ))}

                {/* 渲染任务卡片 */}
                {tasks.map(task => {
                    const startMin = timeToMinutes(task.start);
                    const duration = timeToMinutes(task.end) - startMin;

                    return (
                        <div
                            key={task.id}
                            className={`absolute rounded-xl border border-border bg-card/50 backdrop-blur-sm p-3 shadow-sm transition-all hover:shadow-md ${
                                task.side === 'left' ? 'left-8 right-[52%]' : 'left-[52%] right-8'
                            }`}
                            style={{
                                top: `${startMin * PIXELS_PER_MINUTE + TOP_MARGIN}px`,
                                height: `${duration * PIXELS_PER_MINUTE}px`,
                            }}
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
                    className="absolute w-full flex items-center justify-center z-20 pointer-events-none"
                    style={{ top: `${630 * PIXELS_PER_MINUTE + 32}px` }}
                >
                    <div className="w-full border-t-2 border-primary/50" />
                    <span className="absolute bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                        10:30
                    </span>
                </div>

            </div>
        </div>
    );
}