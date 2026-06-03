import { useState, memo, useCallback, useMemo } from "react"
import { v4 as uuidv4 } from "uuid"
import type { RoutineCard } from "../models/routine-card.model"
import {
    timeToISO,
    isoToTime,
    formatLocalDate,
    resolveTagColor,
} from "../utils/utils"
import { useTagStore } from "../stores/tag.store"
import { useRoutineCardStore } from "../stores/routine-card.store"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowUp01Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { getSortedTagsWithDepth } from "../utils/tag-utils"
import { splitRoutineSeries } from "../utils/routine-expansion"
import type { RoutineCardId, TagId } from "../models/routine-time-tracker.model"
import type { IsoDateTime } from "@/shared/models/base.model"
import { Button } from "@/components/ui/Button"
import { useBackAction } from "@/hooks/useBackAction"

interface RoutineEditorProps {
    task: RoutineCard
    masterTask?: RoutineCard
    onSave: (task: RoutineCard | RoutineCard[]) => Promise<void>
    onDelete: (id: string) => Promise<void>
    onCancel: () => void
    isNew?: boolean
}

const RRULE_OPTIONS = [
    { label: "None", value: "" },
    { label: "Daily", value: "FREQ=DAILY;INTERVAL=1" },
    { label: "Weekly", value: "FREQ=WEEKLY;INTERVAL=1" },
    { label: "Every 2 Weeks", value: "FREQ=WEEKLY;INTERVAL=2" },
    { label: "Monthly", value: "FREQ=MONTHLY;INTERVAL=1" },
]

type EditorState = {
    title: string
    startDate: string
    startAt: string
    endDate: string
    endAt: string
    tagId: TagId
    rrule: string
}

export const RoutineEditor = memo(
    ({
        task,
        masterTask,
        onSave,
        onDelete,
        onCancel,
        isNew = false,
    }: RoutineEditorProps) => {
        const { items: tags } = useTagStore()

        const initialValues = useMemo(
            () => ({
                title: task.title,
                startDate: formatLocalDate(new Date(task.start_at)),
                startAt: isoToTime(task.start_at),
                endDate: formatLocalDate(new Date(task.end_at)),
                endAt: isoToTime(task.end_at),
                tagId: task.tag_id,
                rrule: task.rrule || masterTask?.rrule || "",
            }),
            [task, masterTask]
        )

        const [updates, setUpdates] = useState<Partial<EditorState>>({})

        const title = updates.title ?? initialValues.title
        const startDate = updates.startDate ?? initialValues.startDate
        const startAt = updates.startAt ?? initialValues.startAt
        const endDate = updates.endDate ?? initialValues.endDate
        const endAt = updates.endAt ?? initialValues.endAt
        const tagId = (updates.tagId ?? initialValues.tagId) as TagId
        const rrule = updates.rrule ?? initialValues.rrule

        const handleUpdate = useCallback((patch: Partial<EditorState>) => {
            setUpdates((prev) => ({ ...prev, ...patch }))
        }, [])

        const { items: allRoutineCards } = useRoutineCardStore()

        const handleSnapStart = () => {
            const currentStart = new Date(
                timeToISO(startAt, startDate)
            ).getTime()
            const otherTasks = allRoutineCards.filter(
                (c) =>
                    !c.is_deleted &&
                    c.id !== task.id &&
                    formatLocalDate(new Date(c.start_at)) === startDate
            )

            let closestEnd = -1
            let closestEndStr = ""
            for (const c of otherTasks) {
                const endIso = c.end_at
                const endTime = new Date(endIso).getTime()
                if (endTime <= currentStart && endTime > closestEnd) {
                    closestEnd = endTime
                    closestEndStr = isoToTime(endIso)
                }
            }

            if (closestEndStr && closestEndStr === startAt) {
                let secondClosest = -1
                let secondClosestStr = ""
                for (const c of otherTasks) {
                    const endIso = c.end_at
                    const endTime = new Date(endIso).getTime()
                    if (endTime < closestEnd && endTime > secondClosest) {
                        secondClosest = endTime
                        secondClosestStr = isoToTime(endIso)
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
            const currentEnd = new Date(timeToISO(endAt, endDate)).getTime()
            const otherTasks = allRoutineCards.filter(
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
                    closestStartStr = isoToTime(c.start_at)
                }
            }

            if (closestStartStr && closestStartStr === endAt) {
                let secondClosest = Infinity
                let secondClosestStr = ""
                for (const c of otherTasks) {
                    const startTime = new Date(c.start_at).getTime()
                    if (startTime > closestStart && startTime < secondClosest) {
                        secondClosest = startTime
                        secondClosestStr = isoToTime(c.start_at)
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

        // Fix endAt setter name if needed (the original code had endAt and setEndAt)
        // Wait, looking at the code:
        // const [endAt, setEndAt] = useState(isoToTime(task.end_at))
        // I should stick to the original names.

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
        const sortedTags = useMemo(
            () => getSortedTagsWithDepth(activeTags),
            [activeTags]
        )

        const isRecurring = !!masterTask || !!task.rrule

        const handleSave = async (scope: "one" | "all" = "one") => {
            const finalTitle = title.trim()

            const newStartAt =
                updates.startAt !== undefined || updates.startDate !== undefined
                    ? timeToISO(startAt, startDate)
                    : task.start_at

            const newEndAt =
                updates.endAt !== undefined || updates.endDate !== undefined
                    ? timeToISO(endAt, endDate)
                    : task.end_at

            if (scope === "all" && masterTask) {
                const newMasterProps: Partial<RoutineCard> = {
                    title: finalTitle,
                    start_at: newStartAt,
                    end_at: newEndAt,
                    tag_id: tagId as TagId,
                    rrule: rrule || undefined,
                }

                if (masterTask.id === task.id) {
                    await onSave({
                        ...masterTask,
                        ...newMasterProps,
                        updated_at: new Date().toISOString() as IsoDateTime,
                    })
                } else {
                    const splitDate = task._isVirtual
                        ? task.original_recurrence_date || task.start_at
                        : task.start_at
                    const [updatedMaster, newMaster] = splitRoutineSeries(
                        masterTask,
                        splitDate,
                        newMasterProps
                    )
                    await onSave([updatedMaster, newMaster])
                }
                return
            }

            // Default: Scope 'one' (Exception logic)
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
            <div className="fixed inset-0 z-100 flex animate-in items-center justify-center bg-background/60 p-4 backdrop-blur-[6px] duration-200 fade-in">
                <div
                    className="w-full max-w-md animate-in rounded-2xl border border-border bg-card p-6 shadow-2xl duration-200 zoom-in-95"
                    style={{
                        transform: "translateZ(0)",
                    }}
                >
                    <h3 className="mb-4 text-lg font-semibold text-foreground">
                        {isNew
                            ? "New Routine"
                            : task._isVirtual
                              ? "Edit Occurrence"
                              : "Routine"}
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label
                                htmlFor="routine-title"
                                className="mb-1 block text-xs text-muted-foreground"
                            >
                                Title
                            </label>
                            <input
                                id="routine-title"
                                type="text"
                                value={title}
                                onChange={(e) =>
                                    handleUpdate({ title: e.target.value })
                                }
                                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                                placeholder={
                                    tags.find((t) => t.id === tagId)?.name ||
                                    "Routine"
                                }
                            />
                        </div>
                        <div className="space-y-4">
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label
                                        htmlFor="routine-start-date"
                                        className="mb-1 block text-xs text-muted-foreground"
                                    >
                                        Start Date
                                    </label>
                                    <input
                                        id="routine-start-date"
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
                                        htmlFor="routine-start-time"
                                        className="mb-1 block text-xs text-muted-foreground"
                                    >
                                        Start Time
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            id="routine-start-time"
                                            type="time"
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
                                        htmlFor="routine-end-date"
                                        className="mb-1 block text-xs text-muted-foreground"
                                    >
                                        End Date
                                    </label>
                                    <input
                                        id="routine-end-date"
                                        type="date"
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
                                    <label
                                        htmlFor="routine-end-time"
                                        className="mb-1 block text-xs text-muted-foreground"
                                    >
                                        End Time
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            id="routine-end-time"
                                            type="time"
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
                                            onClick={handleSnapEnd}
                                            className="flex items-center justify-center rounded-lg border border-border bg-muted px-2.5 text-muted-foreground transition-colors hover:bg-muted-foreground/10 hover:text-foreground"
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

                        {(!task.parent_routine_id ||
                            !!task.rrule ||
                            !!masterTask?.rrule) && (
                            <div>
                                <label
                                    htmlFor="routine-rrule"
                                    className="mb-1 block text-xs text-muted-foreground"
                                >
                                    Repeat (Series)
                                </label>
                                <select
                                    id="routine-rrule"
                                    value={rrule}
                                    onChange={(e) =>
                                        handleUpdate({ rrule: e.target.value })
                                    }
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
                                                backgroundColor:
                                                    resolveTagColor(tag.color),
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
                                    onClick={onInitiateDelete}
                                    className="rounded-lg bg-destructive/10 px-4 py-2 font-medium text-destructive transition-colors hover:bg-destructive/20"
                                >
                                    Delete
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {confirmAction && (
                    <div className="fixed inset-0 z-110 flex animate-in items-center justify-center bg-background/20 p-4 backdrop-blur-xs duration-200 fade-in">
                        <div
                            className="w-full max-w-70 animate-in rounded-2xl border border-border bg-card p-6 shadow-2xl duration-200 zoom-in-95"
                            style={{
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
                                occurrence or all future events?
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
                                    All future events
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
