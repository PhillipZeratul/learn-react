import { useState, useMemo } from "react"
import { type Tag } from "@/features/routine-time-tracker/models/tag.model"
import { Button } from "@/components/ui/Button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Tick02Icon, Cancel01Icon } from "@hugeicons/core-free-icons"
import type { TagId } from "@/features/routine-time-tracker/models/routine-time-tracker.model"
import { hexToHsv, hsvToHex } from "@/features/routine-time-tracker/utils/utils"
import { useBackAction } from "@/hooks/useBackAction"

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
        for (let i = 0; i < 5; i++) {
            const s = 10 + i * 20
            result.push(hsvToHex({ h: hsv.h, s, v: 100 }))
        }
        for (let i = 0; i < 5; i++) {
            const v = 100 - i * 15
            result.push(hsvToHex({ h: hsv.h, s: 100, v }))
        }
        return result
    }, [hsv.h])

    return (
        <div className="space-y-2 pt-2">
            <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                Shades
            </p>
            <div className="grid grid-cols-10 gap-2">
                {shades.map((s) => (
                    <button
                        key={s}
                        type="button"
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

interface TagEditorDialogProps {
    tag?: Tag
    activeTags: Tag[]
    onSave: (data: {
        name: string
        color: string
        parentId: TagId | undefined
    }) => Promise<void>
    onClose: () => void
}

export const TagEditorDialog = ({
    tag,
    activeTags,
    onSave,
    onClose,
}: TagEditorDialogProps) => {
    useBackAction(onClose, true)
    const [name, setName] = useState(tag?.name ?? "")
    const [color, setColor] = useState(tag?.color ?? PRESET_COLORS[0])
    const [parentId, setParentId] = useState<TagId | "">(tag?.parent_id ?? "")
    const [isSaving, setIsSaving] = useState(false)

    // Filter out current tag and its descendants from potential parents to prevent cycles
    const potentialParents = useMemo(() => {
        if (!tag) return activeTags

        const getDescendants = (pId: string): string[] => {
            const children = activeTags.reduce<string[]>((acc, t) => {
                if (t.parent_id === pId) {
                    acc.push(t.id)
                }
                return acc
            }, [])
            return [...children, ...children.flatMap(getDescendants)]
        }
        const descendantIds = new Set(getDescendants(tag.id))
        return activeTags.filter(
            (t) => t.id !== tag.id && !descendantIds.has(t.id)
        )
    }, [activeTags, tag])

    const handleSave = async () => {
        if (!name.trim()) return

        setIsSaving(true)
        try {
            await onSave({
                name: name.trim(),
                color,
                parentId: parentId || undefined,
            })
            onClose()
        } catch (error) {
            console.error("Failed to save tag:", error)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-60 flex animate-in items-center justify-center bg-background/20 p-4 backdrop-blur-xs duration-200 fade-in">
            <div className="w-full max-w-sm animate-in rounded-2xl border border-border bg-card p-6 shadow-2xl duration-200 zoom-in-95">
                <h3 className="mb-4 text-lg font-semibold text-foreground">
                    {tag ? "Edit Tag" : "Add Tag"}
                </h3>
                <div className="space-y-4">
                    <div className="grid gap-4">
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label htmlFor="tag-name" className="sr-only">
                                    Tag Name
                                </label>
                                <input
                                    id="tag-name"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Tag name..."
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                />
                            </div>
                            <div
                                className="size-10 shrink-0 rounded-md border border-input shadow-sm"
                                style={{ backgroundColor: color }}
                                aria-hidden="true"
                            />
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                                    Color Palette
                                </p>
                                <div className="grid grid-cols-10 gap-2">
                                    {PRESET_COLORS.map((c) => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setColor(c)}
                                            className={`aspect-square w-full rounded-full border-2 transition-all hover:scale-110 ${color === c ? "scale-110 border-primary shadow-sm" : "border-transparent"}`}
                                            style={{ backgroundColor: c }}
                                            title={c}
                                        />
                                    ))}
                                </div>
                            </div>

                            <ShadeSwatches color={color} onChange={setColor} />
                        </div>

                        <div className="space-y-2">
                            <label
                                htmlFor="parent-tag"
                                className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase"
                            >
                                Parent Tag
                            </label>
                            <select
                                id="parent-tag"
                                value={parentId}
                                onChange={(e) =>
                                    setParentId(e.target.value as TagId)
                                }
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            >
                                <option value="">No Parent (Root Tag)</option>
                                {potentialParents.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex flex-col gap-2">
                    <Button
                        onClick={handleSave}
                        disabled={isSaving || !name.trim()}
                        className="w-full justify-center"
                    >
                        <HugeiconsIcon
                            icon={Tick02Icon}
                            size={18}
                            className="mr-2"
                        />
                        Save Tag
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        disabled={isSaving}
                        className="w-full justify-center text-muted-foreground"
                    >
                        <HugeiconsIcon
                            icon={Cancel01Icon}
                            size={18}
                            className="mr-2"
                        />
                        Cancel
                    </Button>
                </div>
            </div>
        </div>
    )
}
