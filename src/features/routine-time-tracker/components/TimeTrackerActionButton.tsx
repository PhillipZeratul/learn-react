import { useState, useEffect } from "react"
import { PIXELS_PER_MINUTE, TOP_MARGIN } from "../utils/utils"

interface TimeTrackerActionButtonProps {
  activeTimeTrackerId: string | null
  onAction: () => void
  isCurrentDay: boolean
}

export const TimeTrackerActionButton = ({
  activeTimeTrackerId,
  onAction,
  isCurrentDay,
}: TimeTrackerActionButtonProps) => {
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  if (!isCurrentDay) return null

  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes()

  return (
    <div
      className="pointer-events-none absolute right-0 left-0 z-30 flex justify-center"
      style={{
        top: `${currentMinutes * PIXELS_PER_MINUTE + TOP_MARGIN + 24}px`,
      }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation()
          onAction()
        }}
        className={`pointer-events-auto flex items-center gap-1.5 rounded-full px-4 py-2 text-[10px] font-bold shadow-lg transition-all active:scale-95 ${
          activeTimeTrackerId
            ? "text-destructive-foreground bg-destructive shadow-destructive/20 hover:bg-destructive/90"
            : "bg-primary text-primary-foreground shadow-primary/20 hover:bg-primary/90"
        }`}
      >
        <div
          className={`h-2 w-2 rounded-full ${activeTimeTrackerId ? "animate-pulse bg-white" : "bg-white/50"}`}
        />
        {activeTimeTrackerId ? "FINISH" : "BEGIN"}
      </button>
    </div>
  )
}
