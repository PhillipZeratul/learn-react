import { useState } from "react"
import type { TimeTrackerCard } from "../models/time-tracker-card.model"
import { timeToISO, isoToTime, formatLocalDate } from "../utils/utils"
import { useTagStore } from "../stores/tag.store"
import { DEFAULT_TAG_ID } from "../models/tag.model"

interface TimeTrackerEditorProps {
  task: TimeTrackerCard
  onSave: (task: TimeTrackerCard) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onCancel: () => void
}

export const TimeTrackerEditor = ({
  task,
  onSave,
  onDelete,
  onCancel,
}: TimeTrackerEditorProps) => {
  const { items: tags } = useTagStore()
  const [title, setTitle] = useState(task.title)
  const [startAt, setStartAt] = useState(isoToTime(task.start_at))
  const [endAt, setEndAt] = useState(isoToTime(task.end_at))
  const [tagId, setTagId] = useState(task.tag_id)

  const activeTags = tags.filter((tag) => !tag.is_deleted)

  const handleSave = async () => {
    let finalTitle = title.trim()
    if (!finalTitle) {
      const selectedTag = tags.find((t) => t.id === tagId)
      finalTitle = selectedTag?.name || "Time Tracker"
    }

    const datePart = formatLocalDate(new Date(task.start_at))

    await onSave({
      ...task,
      title: finalTitle,
      start_at: timeToISO(startAt, datePart),
      end_at: timeToISO(endAt, datePart),
      tag_id: tagId || DEFAULT_TAG_ID,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex animate-in items-center justify-center bg-background/80 p-4 backdrop-blur-sm duration-200 fade-in">
      <div className="w-full max-w-sm animate-in rounded-2xl border border-border bg-card p-6 shadow-2xl duration-200 zoom-in-95">
        <h3 className="mb-4 text-lg font-semibold text-foreground">
          Time Tracker
        </h3>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
              placeholder={
                tags.find((t) => t.id === tagId)?.name || "Time Tracker"
              }
              autoFocus
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">
                Start
              </label>
              <input
                type="time"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">
                End
              </label>
              <input
                type="time"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Tag
            </label>
            <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
              {activeTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => setTagId(tag.id)}
                  className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-all ${
                    tagId === tag.id
                      ? "border-primary bg-primary/10"
                      : "border-transparent bg-muted hover:border-muted-foreground/30"
                  }`}
                >
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-2">
          <button
            onClick={handleSave}
            className="w-full rounded-lg bg-primary py-2 font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Save
          </button>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="flex-1 rounded-lg bg-muted py-2 font-medium text-muted-foreground transition-colors hover:bg-muted/80"
            >
              Cancel
            </button>
            <button
              onClick={() => onDelete(task.id)}
              className="rounded-lg bg-destructive/10 px-4 py-2 font-medium text-destructive transition-colors hover:bg-destructive/20"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
