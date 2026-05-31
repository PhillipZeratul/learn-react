import { useMemo, useReducer } from "react"
import type { TimeTrackerCard } from "../models/time-tracker-card.model"
import {
    timeToISO,
    isoToTime,
    formatLocalDate,
    getNowISO,
    resolveTagColor,
} from "../utils/utils"
import { useTagStore } from "../stores/tag.store"
import { DEFAULT_TAG_ID } from "../models/tag.model"
import { useBackAction } from "@/hooks/useBackAction"
import { getSortedTagsWithDepth } from "../utils/tag-utils"
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

type EditorAction =
    | { type: "SET_TITLE"; value: string }
    | { type: "SET_START_DATE"; value: string }
    | { type: "SET_START_AT"; value: string }
    | { type: "SET_END_DATE"; value: string }
    | { type: "SET_END_AT"; value: string }
    | { type: "SET_TAG_ID"; value: TagId }
    | { type: "SET_IS_TRACKING"; value: boolean }

const editorReducer = (
    state: EditorState,
    action: EditorAction
): EditorState => {
    switch (action.type) {
        case "SET_TITLE":
            return { ...state, title: action.value }
        case "SET_START_DATE":
            return { ...state, startDate: action.value }
        case "SET_START_AT":
            return { ...state, startAt: action.value }
        case "SET_END_DATE":
            return { ...state, endDate: action.value }
        case "SET_END_AT":
            return { ...state, endAt: action.value }
        case "SET_TAG_ID":
            return { ...state, tagId: action.value }
        case "SET_IS_TRACKING":
            return { ...state, isTracking: action.value }
        default:
            return state
    }
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

    const [state, dispatch] = useReducer(
        editorReducer,
        task,
        (initialTask) => ({
            title: initialTask.title,
            startDate: formatLocalDate(new Date(initialTask.start_at)),
            startAt: isoToTime(initialTask.start_at, true),
            endDate: formatLocalDate(
                new Date(initialTask.end_at || getNowISO())
            ),
            endAt: isoToTime(initialTask.end_at || getNowISO(), true),
            tagId: initialTask.tag_id,
            isTracking: initialTask.end_at === null,
        })
    )

    const activeTags = tags.filter((tag) => !tag.is_deleted)
    const sortedTags = useMemo(
        () => getSortedTagsWithDepth(activeTags),
        [activeTags]
    )

    const handleSave = async () => {
        const finalTitle = state.title.trim()

        // If the task was active (end_at is null), we should only set end_at if it's explicitly edited.
        // However, for newly created tasks via BEGIN button, hideTimeFields is true.
        // We'll trust the editor state unless it's a null transition.

        let finalEndAt = timeToISO(state.endAt, state.endDate)

        if (state.isTracking) {
            finalEndAt = null as unknown as IsoDateTime
        }

        const now = new Date()
        const nowIso = now.toISOString() as IsoDateTime

        if (
            finalEndAt !== null &&
            new Date(finalEndAt).getTime() > now.getTime()
        ) {
            finalEndAt = nowIso
        }

        let finalStartAt = hideTimeFields
            ? task.start_at
            : timeToISO(state.startAt, state.startDate)

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
            tag_id: state.tagId || DEFAULT_TAG_ID,
        })
    }

    return (
        <div className="fixed inset-0 z-[100] flex animate-in items-center justify-center bg-background/80 p-4 backdrop-blur-sm duration-200 fade-in">
            <div className="max-sm w-full animate-in rounded-2xl border border-border bg-card p-6 shadow-2xl duration-200 zoom-in-95">
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
                            value={state.title}
                            onChange={(e) =>
                                dispatch({
                                    type: "SET_TITLE",
                                    value: e.target.value,
                                })
                            }
                            className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                            placeholder={
                                tags.find((t) => t.id === state.tagId)?.name ||
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
                                        value={state.startDate}
                                        onChange={(e) =>
                                            dispatch({
                                                type: "SET_START_DATE",
                                                value: e.target.value,
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
                                    <input
                                        id="tracker-start-time"
                                        type="time"
                                        step="1"
                                        value={state.startAt}
                                        onChange={(e) =>
                                            dispatch({
                                                type: "SET_START_AT",
                                                value: e.target.value,
                                            })
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
                                        disabled={state.isTracking}
                                        value={state.endDate}
                                        onChange={(e) =>
                                            dispatch({
                                                type: "SET_END_DATE",
                                                value: e.target.value,
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
                                                if (state.isTracking) {
                                                    dispatch({
                                                        type: "SET_IS_TRACKING",
                                                        value: false,
                                                    })
                                                    dispatch({
                                                        type: "SET_END_DATE",
                                                        value: formatLocalDate(
                                                            new Date()
                                                        ),
                                                    })
                                                    dispatch({
                                                        type: "SET_END_AT",
                                                        value: isoToTime(
                                                            getNowISO(),
                                                            true
                                                        ),
                                                    })
                                                } else {
                                                    dispatch({
                                                        type: "SET_IS_TRACKING",
                                                        value: true,
                                                    })
                                                }
                                            }}
                                            className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase transition-all select-none ${
                                                state.isTracking
                                                    ? "border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500/20"
                                                    : "border-border bg-muted text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground"
                                            }`}
                                        >
                                            {state.isTracking && (
                                                <span className="relative flex h-1.5 w-1.5">
                                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                                                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500"></span>
                                                </span>
                                            )}
                                            {state.isTracking
                                                ? "Tracking"
                                                : "Track"}
                                        </button>
                                    </div>
                                    <input
                                        id="tracker-end-time"
                                        type="time"
                                        step="1"
                                        disabled={state.isTracking}
                                        value={state.endAt}
                                        onChange={(e) =>
                                            dispatch({
                                                type: "SET_END_AT",
                                                value: e.target.value,
                                            })
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
                                    onClick={() =>
                                        dispatch({
                                            type: "SET_TAG_ID",
                                            value: tag.id,
                                        })
                                    }
                                    className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-all ${
                                        state.tagId === tag.id
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
