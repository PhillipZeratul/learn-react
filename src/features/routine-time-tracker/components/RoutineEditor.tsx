import { useState, memo, useCallback } from "react"
import { v4 as uuidv4 } from "uuid"
import type { RoutineCard } from "../models/routine-card.model"
import { timeToISO, isoToTime, formatLocalDate } from "../utils/utils"
import { useTagStore } from "../stores/tag.store"
import type { RoutineCardId, TagId } from "../models/routine-time-tracker.model"
import type { IsoDateTime } from "@/shared/models/base.model"
import { Button } from "@/components/ui/Button"
import { useBackAction } from "@/hooks/useBackAction"

interface RoutineEditorProps {
    task: RoutineCard
    masterTask?: RoutineCard
    onSave: (task: RoutineCard) => Promise<void>
    onDelete: (id: string) => Promise<void>
    onCancel: () => void
}

const RRULE_OPTIONS = [
    { label: "None", value: "" },
    { label: "Daily", value: "FREQ=DAILY;INTERVAL=1" },
    { label: "Weekly", value: "FREQ=WEEKLY;INTERVAL=1" },
    { label: "Every 2 Weeks", value: "FREQ=WEEKLY;INTERVAL=2" },
    { label: "Monthly", value: "FREQ=MONTHLY;INTERVAL=1" },
]

export const RoutineEditor = memo(
    ({ task, masterTask, onSave, onDelete, onCancel }: RoutineEditorProps) => {
        const { items: tags } = useTagStore()
        const [title, setTitle] = useState(task.title)
        const [startDate, setStartDate] = useState(
            formatLocalDate(new Date(task.start_at))
        )
        const [startAt, setStartAt] = useState(isoToTime(task.start_at))
        const [endDate, setEndDate] = useState(
            formatLocalDate(new Date(task.end_at))
        )
        const [endAt, setEndAt] = useState(isoToTime(task.end_at))
        const [tagId, setTagId] = useState(task.tag_id)
        const [rrule, setRrule] = useState(
            task.rrule || masterTask?.rrule || ""
        )

        const [confirmAction, setConfirmAction] = useState<
            "save" | "delete" | null
        >(null)

        const handleBack = useCallback(() => {
            if (confirmAction) {
                setConfirmAction(null)
            } else {
                onCancel()
            }
        }, [confirmAction, onCancel])

        useBackAction(handleBack, true)

        const activeTags = tags.filter((tag) => !tag.is_deleted)

        const isRecurring = !!masterTask || !!task.rrule

        const handleSave = async (scope: "one" | "all" = "one") => {
            let finalTitle = title.trim()
            if (!finalTitle) {
                const selectedTag = tags.find((t) => t.id === tagId)
                finalTitle = selectedTag?.name || "Routine"
            }

            if (scope === "all" && masterTask) {
                // Apply changes to the master record while preserving its original start date
                const masterStartDatePart = formatLocalDate(
                    new Date(masterTask.start_at)
                )

                // Calculate day difference in the editor's current state to preserve multi-day span
                const [y1, m1, d1] = startDate.split("-").map(Number)
                const [y2, m2, d2] = endDate.split("-").map(Number)
                const dStart = new Date(y1, m1 - 1, d1)
                const dEnd = new Date(y2, m2 - 1, d2)
                const dayDiff = Math.round(
                    (dEnd.getTime() - dStart.getTime()) / (1000 * 60 * 60 * 24)
                )

                const [my, mm, md] = masterStartDatePart.split("-").map(Number)
                const masterEndDate = new Date(my, mm - 1, md)
                masterEndDate.setDate(masterEndDate.getDate() + dayDiff)
                const masterEndDatePart = formatLocalDate(masterEndDate)

                await onSave({
                    ...masterTask,
                    title: finalTitle,
                    start_at: timeToISO(startAt, masterStartDatePart),
                    end_at: timeToISO(endAt, masterEndDatePart),
                    tag_id: tagId as TagId,
                    rrule: rrule || undefined,
                    updated_at: new Date().toISOString() as IsoDateTime,
                })
                return
            }

            // Default: Scope 'one' (Exception logic)
            const newStartAt = timeToISO(startAt, startDate)
            const newEndAt = timeToISO(endAt, endDate)

            if (task._isVirtual) {
                const masterId = task.id.split("_")[0] as RoutineCardId
                const detachedInstance: RoutineCard = {
                    ...task,
                    id: uuidv4() as RoutineCardId,
                    parent_routine_id: masterId,
                    original_recurrence_date: task.start_at as IsoDateTime,
                    title: finalTitle,
                    start_at: newStartAt,
                    end_at: newEndAt,
                    tag_id: tagId as TagId,
                    rrule: undefined,
                    _isVirtual: undefined,
                    updated_at: new Date().toISOString() as IsoDateTime,
                }
                await onSave(detachedInstance)
            } else {
                await onSave({
                    ...task,
                    title: finalTitle,
                    start_at: newStartAt,
                    end_at: newEndAt,
                    tag_id: tagId as TagId,
                    rrule: rrule || undefined,
                    updated_at: new Date().toISOString() as IsoDateTime,
                })
            }
        }

        const handleDelete = async (scope: "one" | "all" = "one") => {
            if (scope === "all" && masterTask) {
                await onDelete(masterTask.id)
                return
            }

            if (task._isVirtual) {
                const masterId = task.id.split("_")[0] as RoutineCardId
                const deletedInstance: RoutineCard = {
                    ...task,
                    id: uuidv4() as RoutineCardId,
                    parent_routine_id: masterId,
                    original_recurrence_date: task.start_at as IsoDateTime,
                    is_deleted: true,
                    _isVirtual: undefined,
                    updated_at: new Date().toISOString() as IsoDateTime,
                }
                await onSave(deletedInstance)
            } else {
                await onDelete(task.id)
            }
        }

        const onInitiateSave = () => {
            if (isRecurring) {
                setConfirmAction("save")
            } else {
                handleSave("one")
            }
        }

        const onInitiateDelete = () => {
            if (isRecurring) {
                setConfirmAction("delete")
            } else {
                handleDelete("one")
            }
        }

        return (
            <div
                className="fixed inset-0 z-50 flex animate-in items-center justify-center bg-background/60 p-4 backdrop-blur-[6px] duration-200 fade-in"
                style={{ willChange: "opacity, backdrop-filter" }}
            >
                <div
                    className="w-full max-w-sm animate-in rounded-2xl border border-border bg-card p-6 shadow-2xl duration-200 zoom-in-95"
                    style={{
                        willChange: "transform, opacity",
                        transform: "translateZ(0)",
                    }}
                >
                    <h3 className="mb-4 text-lg font-semibold text-foreground">
                        {task._isVirtual ? "Edit Occurrence" : "Routine"}
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
                                    tags.find((t) => t.id === tagId)?.name ||
                                    "Routine"
                                }
                                autoFocus
                            />
                        </div>
                        <div className="space-y-4">
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="mb-1 block text-xs text-muted-foreground">
                                        Start Date
                                    </label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) =>
                                            setStartDate(e.target.value)
                                        }
                                        className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="mb-1 block text-xs text-muted-foreground">
                                        Start Time
                                    </label>
                                    <input
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
                                    <label className="mb-1 block text-xs text-muted-foreground">
                                        End Date
                                    </label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) =>
                                            setEndDate(e.target.value)
                                        }
                                        className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="mb-1 block text-xs text-muted-foreground">
                                        End Time
                                    </label>
                                    <input
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

                        {(!task.parent_routine_id ||
                            !!task.rrule ||
                            !!masterTask?.rrule) && (
                            <div>
                                <label className="mb-1 block text-xs text-muted-foreground">
                                    Repeat (Series)
                                </label>
                                <select
                                    value={rrule}
                                    onChange={(e) => setRrule(e.target.value)}
                                    className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                                >
                                    {RRULE_OPTIONS.map((opt) => (
                                        <option
                                            key={opt.value}
                                            value={opt.value}
                                        >
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

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
                                            style={{
                                                backgroundColor: tag.color,
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
                            onClick={onInitiateSave}
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
                                onClick={onInitiateDelete}
                                className="rounded-lg bg-destructive/10 px-4 py-2 font-medium text-destructive transition-colors hover:bg-destructive/20"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>

                {confirmAction && (
                    <div
                        className="fixed inset-0 z-[60] flex animate-in items-center justify-center bg-background/20 p-4 backdrop-blur-[4px] duration-200 fade-in"
                        style={{ willChange: "opacity, backdrop-filter" }}
                    >
                        <div
                            className="w-full max-w-[280px] animate-in rounded-2xl border border-border bg-card p-6 shadow-2xl duration-200 zoom-in-95"
                            style={{
                                willChange: "transform, opacity",
                                transform: "translateZ(0)",
                            }}
                        >
                            <h4 className="mb-2 text-base font-semibold text-foreground">
                                {confirmAction === "save"
                                    ? "Save changes"
                                    : "Delete routine"}
                            </h4>
                            <p className="mb-6 text-sm text-muted-foreground">
                                Do you want to apply this to only this
                                occurrence or the entire series?
                            </p>
                            <div className="space-y-2">
                                <Button
                                    className="w-full justify-center"
                                    onClick={() => {
                                        if (confirmAction === "save")
                                            handleSave("one")
                                        else handleDelete("one")
                                        setConfirmAction(null)
                                    }}
                                >
                                    This occurrence only
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full justify-center"
                                    onClick={() => {
                                        if (confirmAction === "save")
                                            handleSave("all")
                                        else handleDelete("all")
                                        setConfirmAction(null)
                                    }}
                                >
                                    All occurrences
                                </Button>
                                <Button
                                    variant="ghost"
                                    className="w-full justify-center text-muted-foreground"
                                    onClick={() => setConfirmAction(null)}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }
)
