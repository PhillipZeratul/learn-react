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
import { hexToHsv, hsvToHex } from "@/features/routine-time-tracker/utils/utils"

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

const PRESET_COLORS = [
    "#ef4444", // Red
    "#f97316", // Orange
    "#f59e0b", // Amber
    "#eab308", // Yellow
    "#84cc16", // Lime
    "#22c55e", // Green
    "#10b981", // Emerald
    "#14b8a6", // Teal
    "#06b6d4", // Cyan
    "#0ea5e9", // Sky
    "#3b82f6", // Blue
    "#6366f1", // Indigo
    "#8b5cf6", // Violet
    "#a855f7", // Purple
    "#d946ef", // Fuchsia
    "#ec4899", // Pink
    "#f43f5e", // Rose
    "#64748b", // Slate
    "#71717a", // Zinc
    "#78716c", // Stone
]

const ShadeSwatches = ({
    color,
    onChange,
}: {
    color: string
    onChange: (newColor: string) => void
}) => {
    const hsv = useMemo(() => hexToHsv(color), [color])

    const shades = useMemo(() => {
        const result: string[] = []
        // Generate 10 shades: 5 lighter (varying saturation), 5 darker (varying brightness)
        for (let i = 0; i < 5; i++) {
            const s = 10 + i * 20 // 10, 30, 50, 70, 90
            result.push(hsvToHex({ h: hsv.h, s, v: 100 }))
        }
        for (let i = 0; i < 5; i++) {
            const v = 100 - i * 15 // 100, 85, 70, 55, 40
            result.push(hsvToHex({ h: hsv.h, s: 100, v }))
        }
        return result
    }, [hsv.h])

    return (
        <div className="space-y-2 pt-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Shades
            </p>
            <div className="grid grid-cols-10 gap-2">
                {shades.map((s, idx) => (
                    <button
                        key={`${s}-${idx}`}
                        onClick={() => onChange(s)}
                        className={`aspect-square w-full rounded-full border-2 transition-all hover:scale-110 ${color.toLowerCase() === s.toLowerCase() ? "scale-110 border-primary shadow-sm" : "border-transparent"}`}
                        style={{ backgroundColor: s }}
                        title={s}
                    />
                ))}
            </div>
        </div>
    )
}

export const TagManager = () => {
    const { items: tags, upsert: upsertTag, remove: deleteTag } = useTagStore()
    const [newTagName, setNewTagName] = useState("")
    const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0])
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
        const { active, over, delta } = event
        if (!over) return

        const activeId = active.id as string
        const overId = over.id as string

        const activeTag = sortedTags.find(t => t.id === activeId)
        if (!activeTag) return

        // Prevent dropping onto descendants
        const getDescendants = (parentId: string): string[] => {
            const children = activeTags.filter(t => t.parent_id === parentId).map(t => t.id)
            return [...children, ...children.flatMap(getDescendants)]
        }
        const descendantIds = getDescendants(activeId)
        if (descendantIds.includes(overId)) return

        const oldIndex = sortedTags.findIndex((t) => t.id === activeId)
        const newIndex = activeId === overId ? oldIndex : sortedTags.findIndex((t) => t.id === overId)

        const newSortedTags = arrayMove(sortedTags, oldIndex, newIndex)

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
                const parent = currentParentId ? newSortedTags.find(t => t.id === currentParentId) : null
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
        const siblings = newSortedTags.filter(t =>
            t.id === activeId ? true : (t.parent_id || undefined) === newParentId
        )

        for (let i = 0; i < siblings.length; i++) {
            const sibling = siblings[i]
            const original = tags.find((t) => t.id === sibling.id)
            if (!original) continue

            let changed = false
            const updated = { ...original }

            if (sibling.id === activeId && updated.parent_id !== newParentId) {
                updated.parent_id = newParentId
                changed = true
            }

            // We update the sort_order of the active tag and its NEW siblings
            // This is a simple re-sorting within the new parent container
            if (updated.id === activeId || (updated.parent_id || undefined) === newParentId) {
                const newPos = siblings.findIndex(s => s.id === updated.id)
                if (updated.sort_order !== newPos) {
                    updated.sort_order = newPos
                    changed = true
                }
            }

            if (changed) {
                updated.updated_at = new Date().toISOString() as any
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
                        <div
                            className="h-10 w-10 shrink-0 rounded-md border border-input shadow-sm"
                            style={{ backgroundColor: newTagColor }}
                        />
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                Color Palette
                            </p>
                            <div className="grid grid-cols-10 gap-2">
                                {PRESET_COLORS.map((color) => (
                                    <button
                                        key={color}
                                        onClick={() => setNewTagColor(color)}
                                        className={`aspect-square w-full rounded-full border-2 transition-all hover:scale-110 ${newTagColor === color ? "scale-110 border-primary shadow-sm" : "border-transparent"}`}
                                        style={{ backgroundColor: color }}
                                        title={color}
                                    />
                                ))}
                            </div>
                        </div>

                        <ShadeSwatches
                            color={newTagColor}
                            onChange={setNewTagColor}
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
                        <Button onClick={handleAddTag} className="shrink-0 px-4">
                            <HugeiconsIcon icon={PlusSignIcon} size={18} />
                            Add
                        </Button>
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                    Your Tags (Drag to reorder, drag right to nest)
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
