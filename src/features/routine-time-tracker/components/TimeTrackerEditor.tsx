import { useState, useMemo } from "react"
import type { TimeTrackerCard } from "../models/time-tracker-card.model"
import { timeToISO, isoToTime, formatLocalDate } from "../utils/utils"
import { useTagStore } from "../stores/tag.store"
import { DEFAULT_TAG_ID } from "../models/tag.model"
import { useBackAction } from "@/hooks/useBackAction"
import { getSortedTagsWithDepth } from "../utils/tag-utils"

interface TimeTrackerEditorProps {
    task: TimeTrackerCard
    onSave: (task: TimeTrackerCard) => Promise<void>
    onDelete: (id: string) => Promise<void>
    onCancel: () => void
    hideTimeFields?: boolean
}

export const TimeTrackerEditor = ({
    task,
    onSave,
    onDelete,
    onCancel,
    hideTimeFields = false,
}: TimeTrackerEditorProps) => {
    useBackAction(onCancel, true)
    const { items: tags } = useTagStore()
    const [title, setTitle] = useState(task.title)
    const [startDate, setStartDate] = useState(() =>
        formatLocalDate(new Date(task.start_at))
    )
    const [startAt, setStartAt] = useState(() => isoToTime(task.start_at))
    const [endDate, setEndDate] = useState(() =>
        formatLocalDate(new Date(task.end_at || new Date().toISOString()))
    )
    const [endAt, setEndAt] = useState(() =>
        isoToTime(task.end_at || (new Date().toISOString() as string))
    )
    const [tagId, setTagId] = useState(task.tag_id)

    const activeTags = tags.filter((tag) => !tag.is_deleted)
    const sortedTags = useMemo(
        () => getSortedTagsWithDepth(activeTags),
        [activeTags]
    )

    const handleSave = async () => {
        const finalTitle = title.trim()

        await onSave({
            ...task,
            title: finalTitle,
            start_at: timeToISO(startAt, startDate),
            end_at: timeToISO(endAt, endDate),
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
                        <label
                            htmlFor="tracker-title"
                            className="mb-1 block text-xs text-muted-foreground"
                        >
                            Title
                        </label>
                        <input
                            id="tracker-title"
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                            placeholder={
                                tags.find((t) => t.id === tagId)?.name ||
                                "Time Tracker"
                            }
                        />
                    </div>
                    {!hideTimeFields && (
                        <div className="space-y-4">
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label
                                        htmlFor="tracker-start-date"
                                        className="mb-1 block text-xs text-muted-foreground"
                                    >
                                        Start Date
                                    </label>
                                    <input
                                        id="tracker-start-date"
                                        type="date"
                                        value={startDate}
                                        onChange={(e) =>
                                            setStartDate(e.target.value)
                                        }
                                        className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label
                                        htmlFor="tracker-start-time"
                                        className="mb-1 block text-xs text-muted-foreground"
                                    >
                                        Start Time
                                    </label>
                                    <input
                                        id="tracker-start-time"
                                        type="time"
                                        value={startAt}
                                        onChange={(e) =>
                                            setStartAt(e.target.value)
                                        }
                                        className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label
                                        htmlFor="tracker-end-date"
                                        className="mb-1 block text-xs text-muted-foreground"
                                    >
                                        End Date
                                    </label>
                                    <input
                                        id="tracker-end-date"
                                        type="date"
                                        value={endDate}
                                        onChange={(e) =>
                                            setEndDate(e.target.value)
                                        }
                                        className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label
                                        htmlFor="tracker-end-time"
                                        className="mb-1 block text-xs text-muted-foreground"
                                    >
                                        End Time
                                    </label>
                                    <input
                                        id="tracker-end-time"
                                        type="time"
                                        value={endAt}
                                        onChange={(e) =>
                                            setEndAt(e.target.value)
                                        }
                                        className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                    <div>
                        <p className="mb-1 block text-xs text-muted-foreground">
                            Tag
                        </p>
                        <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
                            {sortedTags.map((tag) => (
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
                                        className="size-2 rounded-full"
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
