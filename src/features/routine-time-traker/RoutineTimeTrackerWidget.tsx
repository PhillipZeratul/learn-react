import React, { useState } from 'react';

// 核心配置：1小时 = 60px
const PIXELS_PER_MINUTE = 1;

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
        <div className="h-screen overflow-y-auto bg-white relative">

            {/* 24小时画布，总高度 24 * 60 = 1440px */}
            <div className="relative w-full max-w-md mx-auto" style={{ height: `${24 * 60 * PIXELS_PER_MINUTE}px` }}>

                {/* 中央时间刻度 (生成 0-24 的数组) */}
                {[...Array(24)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute w-full flex justify-center text-gray-400 text-sm"
                        style={{ top: `${i * 60 * PIXELS_PER_MINUTE}px` }}
                    >
                        {/* 时间文字与刻度线 */}
                        <span className="bg-white px-2 z-10">{i}:00</span>
                        <div className="absolute top-3 w-full border-t border-gray-200 border-dashed" />
                    </div>
                ))}

                {/* 渲染任务卡片 */}
                {tasks.map(task => {
                    const startMin = timeToMinutes(task.start);
                    const duration = timeToMinutes(task.end) - startMin;

                    return (
                        <div
                            key={task.id}
                            className={`absolute rounded-lg bg-gray-100 p-2 shadow-sm ${
                                task.side === 'left' ? 'left-4 right-[55%]' : 'left-[55%] right-4'
                            }`}
                            style={{
                                top: `${startMin * PIXELS_PER_MINUTE}px`,
                                height: `${duration * PIXELS_PER_MINUTE}px`,
                            }}
                        >
                            {task.title}
                        </div>
                    );
                })}

                {/* 当前时间红线 (假设当前是 10:30 = 630 分钟) */}
                <div
                    className="absolute w-full flex items-center justify-center z-20 pointer-events-none"
                    style={{ top: `${630 * PIXELS_PER_MINUTE}px` }}
                >
                    <div className="w-full border-t border-red-400" />
                    <span className="absolute bg-red-400 text-white text-xs px-2 py-1 rounded-full">
            10:30
          </span>
                </div>

            </div>
        </div>
    );
}