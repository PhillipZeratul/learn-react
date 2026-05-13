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

interface SortableTagItemProps {
    tag: Tag
    onDelete: (id: string) => void
    onUpdateName: (id: string, newName: string) => void
    depth?: number
}

const SortableTagItem = ({
    tag,
    onDelete,
    onUpdateName,
    depth = 0,
}: SortableTagItemProps) => {
    const [isEditing, setIsEditing] = useState(false)
    const [editName, setEditName] = useState(tag.name)

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: tag.id, disabled: isEditing })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        marginLeft: `${depth * 1.5}rem`,
        zIndex: isDragging ? 50 : undefined,
    }

    const handleSave = () => {
        if (editName.trim() && editName !== tag.name) {
            onUpdateName(tag.id, editName)
        } else {
            setEditName(tag.name)
        }
        setIsEditing(false)
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
                    className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
                    disabled={isEditing}
                >
                    <HugeiconsIcon icon={DragDropIcon} size={16} />
                </button>
                <div
                    className="h-4 w-4 shrink-0 rounded-full"
                    style={{ backgroundColor: tag.color }}
                />
                {isEditing ? (
                    <input
                        autoFocus
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handleSave()
                            if (e.key === "Escape") {
                                setEditName(tag.name)
                                setIsEditing(false)
                            }
                        }}
                        className="h-7 w-full rounded border border-input bg-background px-2 text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                ) : (
                    <span
                        className="cursor-text text-sm font-medium hover:underline"
                        onClick={() => setIsEditing(true)}
                    >
                        {tag.name}
                    </span>
                )}
            </div>
            <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(tag.id)}
                className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
                <HugeiconsIcon icon={Delete02Icon} size={16} />
            </Button>
        </div>
    )
}

export const TagManager = () => {
    const { items: tags, upsert: upsertTag, remove: deleteTag } = useTagStore()
    const [newTagName, setNewTagName] = useState("")
    const [newTagColor, setNewTagColor] = useState("#787878")
    const [parentId, setParentId] = useState<TagId | "">("")

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    const activeTags = useMemo(
        () => tags.filter((tag) => !tag.is_deleted),
        [tags]
    )

    // Helper to organize tags into a flat list with depth for sorting
    const sortedTags = useMemo(() => {
        const result: (Tag & { depth: number })[] = []
        const processTags = (pId: TagId | undefined, depth: number) => {
            const siblings = activeTags
                .filter((t) => (t.parent_id || undefined) === pId)
                .sort((a, b) => a.sort_order - b.sort_order)

            siblings.forEach((sibling) => {
                result.push({ ...sibling, depth })
                processTags(sibling.id, depth + 1)
            })
        }
        processTags(undefined, 0)
        return result
    }, [activeTags])

    const handleAddTag = async () => {
        if (!newTagName.trim()) return

        // Calculate sort order: end of current siblings
        const siblings = activeTags.filter(
            (t) => t.parent_id === (parentId || undefined)
        )
        const maxSortOrder = siblings.reduce(
            (max, t) => Math.max(max, t.sort_order),
            0
        )

        const tag = createTag({
            name: newTagName,
            color: newTagColor,
            parent_id: parentId || undefined,
            sort_order: maxSortOrder + 1,
        })

        upsertTag(tag)
        await SyncService.save(tagConfig, tag)
        setNewTagName("")
        setParentId("")
    }

    const handleDeleteTag = async (id: string) => {
        const tag = tags.find((t) => t.id === id)
        if (!tag) return

        const confirmed = window.confirm(
            `Are you sure you want to delete the tag "${tag.name}"? This action cannot be undone.`
        )

        if (confirmed) {
            deleteTag(id)
            await SyncService.delete(tagConfig, id)
        }
    }

    const handleUpdateName = async (id: string, newName: string) => {
        const original = tags.find((t) => t.id === id)
        if (original) {
            const updated = {
                ...original,
                name: newName,
                updated_at: new Date().toISOString() as any,
            }
            upsertTag(updated)
            await SyncService.save(tagConfig, updated)
        }
    }

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return

        const oldIndex = sortedTags.findIndex((t) => t.id === active.id)
        const newIndex = sortedTags.findIndex((t) => t.id === over.id)

        const newSortedTags = arrayMove(sortedTags, oldIndex, newIndex)
        const activeTag = tags.find((t) => t.id === active.id)
        if (!activeTag) return

        // Simple sort order update: recalculate for simplicity in this MVP
        // In a real app, you'd use fractional indexing or only update the moved item
        const updatedTags = newSortedTags.map((t, idx) => ({
            ...t,
            sort_order: idx,
        }))

        // We only really need to save the ones that changed
        for (const tag of updatedTags) {
            const original = tags.find((t) => t.id === tag.id)
            if (original && original.sort_order !== tag.sort_order) {
                const updated = {
                    ...original,
                    sort_order: tag.sort_order,
                    updated_at: new Date().toISOString() as any,
                }
                upsertTag(updated)
                await SyncService.save(tagConfig, updated)
            }
        }
    }

    return (
        <div className="space-y-6">
            <div className="space-y-4 rounded-xl border bg-card/50 p-4">
                <h3 className="text-lg font-medium">Add New Tag</h3>
                <div className="grid gap-4">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newTagName}
                            onChange={(e) => setNewTagName(e.target.value)}
                            placeholder="Tag name..."
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        />
                        <input
                            type="color"
                            value={newTagColor}
                            onChange={(e) => setNewTagColor(e.target.value)}
                            className="h-10 w-12 cursor-pointer rounded-md border border-input bg-background p-1"
                        />
                    </div>
                    <div className="flex gap-2">
                        <select
                            value={parentId}
                            onChange={(e) =>
                                setParentId(e.target.value as TagId)
                            }
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                            <option value="">No Parent (Root Tag)</option>
                            {activeTags.map((t) => (
                                <option key={t.id} value={t.id}>
                                    Parent: {t.name}
                                </option>
                            ))}
                        </select>
                        <Button onClick={handleAddTag} className="shrink-0">
                            <HugeiconsIcon icon={PlusSignIcon} size={18} />
                            Add Tag
                        </Button>
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                    Your Tags (Drag to reorder)
                </h3>
                {sortedTags.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
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
                                        onUpdateName={handleUpdateName}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                )}
            </div>
        </div>
    )
}
