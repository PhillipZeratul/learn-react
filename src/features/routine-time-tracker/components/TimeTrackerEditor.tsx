import { useMemo, useState } from "react"
import type { TimeTrackerCard } from "../models/time-tracker-card.model"
import {
    timeToISO,
    isoToTime,
    formatLocalDate,
    getNowISO,
    resolveTagColor,
} from "../utils/utils"
import { useTagStore } from "../stores/tag.store"
import { useTimeTrackerCardStore } from "../stores/time-tracker-card.store"
import { DEFAULT_TAG_ID } from "../models/tag.model"
import { useBackAction } from "@/hooks/useBackAction"
import { getSortedTagsWithDepth } from "../utils/tag-utils"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowUp01Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons"
import type { TagId } from "../models/routine-time-tracker.model"
import type { IsoDateTime } from "@/shared/models/base.model"

interface TimeTrackerEditorProps {
    task: TimeTrackerCard
    onSave: (task: TimeTrackerCard) => Promise<void>
    onDelete: (id: string) => Promise<void>
    onCancel: () => void
    hideTimeFields?: boolean
    isNew?: boolean
}

type EditorState = {
    title: string
    startDate: string
    startAt: string
    endDate: string
    endAt: string
    tagId: TagId
    isTracking: boolean
}

export const TimeTrackerEditor = ({
    task,
    onSave,
    onDelete,
    onCancel,
    hideTimeFields = false,
    isNew = false,
}: TimeTrackerEditorProps) => {
    useBackAction(onCancel, true)
    const { items: tags } = useTagStore()
    const { items: allTimeTrackerCards } = useTimeTrackerCardStore()

    const initialValues = useMemo(
        () => ({
            title: task.title,
            startDate: formatLocalDate(new Date(task.start_at)),
            startAt: isoToTime(task.start_at, true),
            endDate: formatLocalDate(new Date(task.end_at || getNowISO())),
            endAt: isoToTime(task.end_at || getNowISO(), true),
            tagId: task.tag_id,
            isTracking: task.end_at === null,
        }),
        [task]
    )

    const [updates, setUpdates] = useState<Partial<EditorState>>({})

    const title = updates.title ?? initialValues.title
    const startDate = updates.startDate ?? initialValues.startDate
    const startAt = updates.startAt ?? initialValues.startAt
    const endDate = updates.endDate ?? initialValues.endDate
    const endAt = updates.endAt ?? initialValues.endAt
    const tagId = updates.tagId ?? initialValues.tagId
    const isTracking = updates.isTracking ?? initialValues.isTracking

    const handleUpdate = (patch: Partial<EditorState>) => {
        setUpdates((prev: Partial<EditorState>) => ({ ...prev, ...patch }))
    }

    const activeTags = tags.filter((tag) => !tag.is_deleted)
    const sortedTags = useMemo(
        () => getSortedTagsWithDepth(activeTags),
        [activeTags]
    )

    const handleSnapStart = () => {
        const currentStart = new Date(timeToISO(startAt, startDate)).getTime()
        const otherTasks = allTimeTrackerCards.filter(
            (c) =>
                !c.is_deleted &&
                c.id !== task.id &&
                formatLocalDate(new Date(c.start_at)) === startDate
        )

        let closestEnd = -1
        let closestEndStr = ""
        for (const c of otherTasks) {
            const endIso = c.end_at || getNowISO()
            const endTime = new Date(endIso).getTime()
            if (endTime <= currentStart && endTime > closestEnd) {
                closestEnd = endTime
                closestEndStr = isoToTime(endIso, true)
            }
        }

        if (closestEndStr && closestEndStr === startAt) {
            let secondClosest = -1
            let secondClosestStr = ""
            for (const c of otherTasks) {
                const endIso = c.end_at || getNowISO()
                const endTime = new Date(endIso).getTime()
                if (endTime < closestEnd && endTime > secondClosest) {
                    secondClosest = endTime
                    secondClosestStr = isoToTime(endIso, true)
                }
            }
            if (secondClosestStr) {
                handleUpdate({ startAt: secondClosestStr })
                return
            }
        }

        if (closestEndStr) {
            handleUpdate({ startAt: closestEndStr })
        }
    }

    const handleSnapEnd = () => {
        if (isTracking) return
        const currentEnd = new Date(timeToISO(endAt, endDate)).getTime()
        const otherTasks = allTimeTrackerCards.filter(
            (c) =>
                !c.is_deleted &&
                c.id !== task.id &&
                formatLocalDate(new Date(c.start_at)) === endDate
        )

        let closestStart = Infinity
        let closestStartStr = ""
        for (const c of otherTasks) {
            const startTime = new Date(c.start_at).getTime()
            if (startTime >= currentEnd && startTime < closestStart) {
                closestStart = startTime
                closestStartStr = isoToTime(c.start_at, true)
            }
        }

        if (closestStartStr && closestStartStr === endAt) {
            let secondClosest = Infinity
            let secondClosestStr = ""
            for (const c of otherTasks) {
                const startTime = new Date(c.start_at).getTime()
                if (startTime > closestStart && startTime < secondClosest) {
                    secondClosest = startTime
                    secondClosestStr = isoToTime(c.start_at, true)
                }
            }
            if (secondClosestStr) {
                handleUpdate({ endAt: secondClosestStr })
                return
            }
        }

        if (closestStartStr) {
            handleUpdate({ endAt: closestStartStr })
        }
    }

    const handleSave = async () => {
        const finalTitle = title.trim()

        let finalEndAt: IsoDateTime | null = null
        if (!isTracking) {
            if (updates.endAt !== undefined || updates.endDate !== undefined) {
                finalEndAt = timeToISO(endAt, endDate)
            } else if (task.end_at) {
                finalEndAt = task.end_at
            } else {
                finalEndAt = timeToISO(endAt, endDate)
            }
        }

        const now = new Date()
        const nowIso = now.toISOString() as IsoDateTime

        if (
            finalEndAt !== null &&
            new Date(finalEndAt).getTime() > now.getTime()
        ) {
            finalEndAt = nowIso
        }

        let finalStartAt: IsoDateTime
        if (hideTimeFields) {
            finalStartAt = task.start_at
        } else if (
            updates.startAt !== undefined ||
            updates.startDate !== undefined
        ) {
            finalStartAt = timeToISO(startAt, startDate)
        } else {
            finalStartAt = task.start_at
        }

        if (new Date(finalStartAt).getTime() > now.getTime()) {
            finalStartAt = nowIso
        }

        if (
            finalEndAt !== null &&
            new Date(finalStartAt).getTime() > new Date(finalEndAt).getTime()
        ) {
            finalStartAt = finalEndAt
        }

        await onSave({
            ...task,
            title: finalTitle,
            start_at: finalStartAt,
            end_at: finalEndAt,
            tag_id: tagId || DEFAULT_TAG_ID,
        })
    }

    return (
        <div className="fixed inset-0 z-[100] flex animate-in items-center justify-center bg-background/80 p-4 backdrop-blur-sm duration-200 fade-in">
            <div className="w-full max-w-md animate-in rounded-2xl border border-border bg-card p-6 shadow-2xl duration-200 zoom-in-95">
                <h3 className="mb-4 text-lg font-semibold text-foreground">
                    {isNew ? "New Tracking Task" : "Time Tracker"}
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
                            onChange={(e) =>
                                handleUpdate({ title: e.target.value })
                            }
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
                                            handleUpdate({
                                                startDate: e.target.value,
                                            })
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
                                    <div className="flex gap-2">
                                        <input
                                            id="tracker-start-time"
                                            type="time"
                                            step="1"
                                            value={startAt}
                                            onChange={(e) =>
                                                handleUpdate({
                                                    startAt: e.target.value,
                                                })
                                            }
                                            className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleSnapStart}
                                            className="flex items-center justify-center rounded-lg border border-border bg-muted px-2.5 text-muted-foreground transition-colors hover:bg-muted-foreground/10 hover:text-foreground"
                                            title="Snap to previous task"
                                        >
                                            <HugeiconsIcon
                                                icon={ArrowUp01Icon}
                                                size={16}
                                            />
                                        </button>
                                    </div>
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
                                        disabled={isTracking}
                                        value={endDate}
                                        onChange={(e) =>
                                            handleUpdate({
                                                endDate: e.target.value,
                                            })
                                        }
                                        className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                                    />
                                </div>
                                <div className="flex-1">
                                    <div className="mb-1 flex items-center justify-between">
                                        <label
                                            htmlFor="tracker-end-time"
                                            className="block text-xs text-muted-foreground"
                                        >
                                            End Time
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (isTracking) {
                                                    handleUpdate({
                                                        isTracking: false,
                                                        endDate:
                                                            formatLocalDate(
                                                                new Date()
                                                            ),
                                                        endAt: isoToTime(
                                                            getNowISO(),
                                                            true
                                                        ),
                                                    })
                                                } else {
                                                    handleUpdate({
                                                        isTracking: true,
                                                    })
                                                }
                                            }}
                                            className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase transition-all select-none ${
                                                isTracking
                                                    ? "border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500/20"
                                                    : "border-border bg-muted text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground"
                                            }`}
                                        >
                                            {isTracking && (
                                                <span className="relative flex h-1.5 w-1.5">
                                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                                                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500"></span>
                                                </span>
                                            )}
                                            {isTracking ? "Tracking" : "Track"}
                                        </button>
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            id="tracker-end-time"
                                            type="time"
                                            step="1"
                                            disabled={isTracking}
                                            value={endAt}
                                            onChange={(e) =>
                                                handleUpdate({
                                                    endAt: e.target.value,
                                                })
                                            }
                                            className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                                        />
                                        <button
                                            type="button"
                                            disabled={isTracking}
                                            onClick={handleSnapEnd}
                                            className={`flex items-center justify-center rounded-lg border border-border bg-muted px-2.5 text-muted-foreground transition-colors ${isTracking ? "cursor-not-allowed opacity-50" : "hover:bg-muted-foreground/10 hover:text-foreground"}`}
                                            title="Snap to next task"
                                        >
                                            <HugeiconsIcon
                                                icon={ArrowDown01Icon}
                                                size={16}
                                            />
                                        </button>
                                    </div>
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
                                    onClick={() =>
                                        handleUpdate({ tagId: tag.id })
                                    }
                                    className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-all ${
                                        tagId === tag.id
                                            ? "border-primary bg-primary/10"
                                            : "border-transparent bg-muted hover:border-muted-foreground/30"
                                    }`}
                                >
                                    <div
                                        className="size-2 rounded-full"
                                        style={{
                                            backgroundColor: resolveTagColor(
                                                tag.color
                                            ),
                                        }}
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
                        {isNew ? "Create" : "Save"}
                    </button>
                    <div className="flex gap-2">
                        <button
                            onClick={onCancel}
                            className="flex-1 rounded-lg bg-muted py-2 font-medium text-muted-foreground transition-colors hover:bg-muted/80"
                        >
                            Cancel
                        </button>
                        {!isNew && (
                            <button
                                onClick={() => onDelete(task.id)}
                                className="rounded-lg bg-destructive/10 px-4 py-2 font-medium text-destructive transition-colors hover:bg-destructive/20"
                            >
                                Delete
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
