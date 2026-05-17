import { useState, useMemo } from "react"
import { useTagStore } from "@/features/routine-time-tracker/stores/tag.store"
import {
    createTag,
    tagConfig,
    type Tag,
} from "@/features/routine-time-tracker/models/tag.model"
import { Button } from "@/components/ui/Button"
import { HugeiconsIcon } from "@hugeicons/react"
import {
    PlusSignIcon,
    Delete02Icon,
    DragDropIcon,
} from "@hugeicons/core-free-icons"
import { SyncService } from "@/shared/services/sync.service"
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core"
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { TagId } from "@/features/routine-time-tracker/models/routine-time-tracker.model"
import type { IsoDateTime } from "@/shared/models/base.model"

interface SortableTagItemProps {
    tag: Tag
    onDelete: (id: TagId) => void
    onEdit: (id: TagId) => void
    depth?: number
}

const SortableTagItem = ({
    tag,
    onDelete,
    onEdit,
    depth = 0,
}: SortableTagItemProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: tag.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        marginLeft: `${depth * 1.5}rem`,
        zIndex: isDragging ? 50 : undefined,
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group flex items-center justify-between rounded-lg border bg-card p-2 shadow-sm ${isDragging ? "opacity-50 ring-2 ring-primary" : ""}`}
        >
            <div className="flex flex-1 items-center gap-3">
                <button
                    {...attributes}
                    {...listeners}
                    type="button"
                    className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
                    style={{ touchAction: "none" }}
                    aria-label="Drag to reorder"
                >
                    <HugeiconsIcon icon={DragDropIcon} size={16} />
                </button>
                <div
                    className="size-4 shrink-0 rounded-full"
                    style={{ backgroundColor: tag.color }}
                />
                <button
                    type="button"
                    className="flex-1 text-left text-sm font-medium hover:underline focus:outline-none"
                    onClick={() => onEdit(tag.id)}
                >
                    {tag.name}
                </button>
            </div>
            <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(tag.id)}
                className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
                <HugeiconsIcon icon={Delete02Icon} size={16} />
            </Button>
        </div>
    )
}

import { TagEditorDialog } from "./TagEditorDialog"
import { getSortedTagsWithDepth } from "@/features/routine-time-tracker/utils/tag-utils"

export const TagManager = () => {
    const { items: tags, upsert: upsertTag, remove: deleteTag } = useTagStore()
    const [isEditorOpen, setIsEditorOpen] = useState(false)
    const [editingTagId, setEditingTagId] = useState<TagId | null>(null)

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    const activeTags = useMemo(
        () => tags.filter((tag) => !tag.is_deleted),
        [tags]
    )

    const editingTag = useMemo(
        () =>
            editingTagId ? tags.find((t) => t.id === editingTagId) : undefined,
        [editingTagId, tags]
    )

    // Helper to organize tags into a flat list with depth for sorting
    const sortedTags = useMemo(
        () => getSortedTagsWithDepth(activeTags),
        [activeTags]
    )

    const handleSaveTag = async (data: {
        name: string
        color: string
        parentId: TagId | undefined
    }) => {
        const tagMap = new Map(tags.map((t) => [t.id, t]))
        if (editingTagId) {
            const original = tagMap.get(editingTagId)
            if (original) {
                const updated = {
                    ...original,
                    ...data,
                    parent_id: data.parentId,
                    updated_at: new Date().toISOString() as IsoDateTime,
                }
                upsertTag(updated)
                await SyncService.save(tagConfig, updated)
            }
        } else {
            // Calculate sort order: end of current siblings
            const siblings = activeTags.filter(
                (t) => t.parent_id === data.parentId
            )
            const maxSortOrder = siblings.reduce(
                (max, t) => Math.max(max, t.sort_order),
                0
            )

            const tag = createTag({
                ...data,
                parent_id: data.parentId,
                sort_order: maxSortOrder + 1,
            })

            upsertTag(tag)
            await SyncService.save(tagConfig, tag)
        }
        setIsEditorOpen(false)
        setEditingTagId(null)
    }

    const handleDeleteTag = async (id: TagId) => {
        const tagMap = new Map(tags.map((t) => [t.id, t]))
        const tag = tagMap.get(id)
        if (!tag) return

        const confirmed = window.confirm(
            `Are you sure you want to delete the tag "${tag.name}"? This action cannot be undone.`
        )

        if (confirmed) {
            deleteTag(id)
            await SyncService.delete(tagConfig, id)
        }
    }

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over, delta } = event
        if (!over) return

        const activeId = active.id as TagId
        const overId = over.id as TagId

        const tagMap = new Map(tags.map((t) => [t.id, t]))
        const sortedTagMap = new Map(sortedTags.map((t) => [t.id, t]))
        const activeTag = sortedTagMap.get(activeId)
        if (!activeTag) return

        // Prevent dropping onto descendants
        const getDescendants = (parentId: TagId): TagId[] => {
            const children = activeTags.reduce<TagId[]>((acc, t) => {
                if (t.parent_id === parentId) acc.push(t.id)
                return acc
            }, [])
            return [...children, ...children.flatMap(getDescendants)]
        }
        const descendantIds = getDescendants(activeId)
        if (descendantIds.includes(overId)) return

        const oldIndex = sortedTags.findIndex((t) => t.id === activeId)
        const newIndex =
            activeId === overId
                ? oldIndex
                : sortedTags.findIndex((t) => t.id === overId)

        const newSortedTags = arrayMove(sortedTags, oldIndex, newIndex)
        const newSortedTagMap = new Map(newSortedTags.map((t) => [t.id, t]))

        // Calculate projected depth (24px = 1.5rem margin-left)
        const depthOffset = Math.round(delta.x / 24)
        let projectedDepth = activeTag.depth + depthOffset

        // Constrain depth
        const previousItem = newIndex > 0 ? newSortedTags[newIndex - 1] : null
        const maxDepth = previousItem ? previousItem.depth + 1 : 0
        projectedDepth = Math.max(0, Math.min(projectedDepth, maxDepth))

        let newParentId: TagId | undefined = undefined

        if (projectedDepth > 0 && previousItem) {
            let current = previousItem
            while (current && current.depth >= projectedDepth) {
                // Find parent in the sorted list, or break if we hit the root
                const currentParentId = current.parent_id
                const parent = currentParentId
                    ? newSortedTagMap.get(currentParentId)
                    : null
                if (!parent) break
                current = parent
            }
            if (current && current.depth === projectedDepth - 1) {
                if (!descendantIds.includes(current.id)) {
                    newParentId = current.id as TagId
                }
            }
        }

        // Find new siblings (including the active item) to update sort orders
        const siblings = newSortedTags.filter(
            (t) =>
                t.id === activeId || (t.parent_id || undefined) === newParentId
        )

        const updates: Tag[] = []
        const siblingIndexMap = new Map(siblings.map((s, idx) => [s.id, idx]))

        for (let i = 0; i < siblings.length; i++) {
            const sibling = siblings[i]
            const original = tagMap.get(sibling.id)
            if (!original) continue

            let changed = false
            const updated = { ...original }

            if (sibling.id === activeId && updated.parent_id !== newParentId) {
                updated.parent_id = newParentId
                changed = true
            }

            // We update the sort_order of the active tag and its NEW siblings
            // This is a simple re-sorting within the new parent container
            const newPos = siblingIndexMap.get(updated.id) ?? -1
            if (updated.sort_order !== newPos) {
                updated.sort_order = newPos
                changed = true
            }

            if (changed) {
                updated.updated_at = new Date().toISOString() as IsoDateTime
                updates.push(updated)
            }
        }

        if (updates.length > 0) {
            await Promise.all(
                updates.map((updated) => {
                    upsertTag(updated)
                    return SyncService.save(tagConfig, updated)
                })
            )
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
                <h2 className="text-xl font-semibold">Tags</h2>
                <Button
                    onClick={() => {
                        setEditingTagId(null)
                        setIsEditorOpen(true)
                    }}
                    className="gap-2"
                >
                    <HugeiconsIcon icon={PlusSignIcon} size={18} />
                    Add Tag
                </Button>
            </div>

            <div className="space-y-2">
                <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                    Your Tags (Drag handle to reorder/nest, tap name to edit)
                </h3>
                {sortedTags.length === 0 ? (
                    <p className="py-12 text-center text-sm text-muted-foreground">
                        No tags yet. Add one above to get started.
                    </p>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={sortedTags.map((t) => t.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="space-y-2">
                                {sortedTags.map((tag) => (
                                    <SortableTagItem
                                        key={tag.id}
                                        tag={tag}
                                        depth={tag.depth}
                                        onDelete={handleDeleteTag}
                                        onEdit={(id) => {
                                            setEditingTagId(id)
                                            setIsEditorOpen(true)
                                        }}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                )}
            </div>

            {isEditorOpen && (
                <TagEditorDialog
                    tag={editingTag}
                    activeTags={activeTags}
                    onSave={handleSaveTag}
                    onClose={() => {
                        setIsEditorOpen(false)
                        setEditingTagId(null)
                    }}
                />
            )}
        </div>
    )
}
