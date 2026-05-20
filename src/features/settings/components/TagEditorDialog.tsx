import { useState, useMemo } from "react"
import { type Tag } from "@/features/routine-time-tracker/models/tag.model"
import { Button } from "@/components/ui/Button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Tick02Icon, Cancel01Icon } from "@hugeicons/core-free-icons"
import type { TagId } from "@/features/routine-time-tracker/models/routine-time-tracker.model"
import {
    resolveTagColor,
    findNearestPresetAndShade,
    getTagShades,
    PRESET_COLORS,
} from "@/features/routine-time-tracker/utils/utils"
import { useBackAction } from "@/hooks/useBackAction"

const ShadeSwatches = ({
    presetIndex,
    shadeIndex,
    onChange,
}: {
    presetIndex: number
    shadeIndex: number
    onChange: (newShadeIndex: number) => void
}) => {
    const shades = useMemo(() => {
        const baseColor = PRESET_COLORS[presetIndex]
        return getTagShades(baseColor)
    }, [presetIndex])

    return (
        <div className="space-y-2 pt-2">
            <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                Shades
            </p>
            <div className="grid grid-cols-10 gap-2">
                {shades.map((s, idx) => (
                    <button
                        key={s}
                        type="button"
                        onClick={() => onChange(idx)}
                        className={`aspect-square w-full rounded-full border-2 transition-all hover:scale-110 ${shadeIndex === idx ? "scale-110 border-primary shadow-sm" : "border-transparent"}`}
                        style={{ backgroundColor: s }}
                        title={`Shade ${idx}`}
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
    const [color, setColor] = useState(() => {
        let initialColor = tag?.color ?? "17-5"
        if (initialColor.startsWith("#")) {
            initialColor = findNearestPresetAndShade(initialColor)
        }
        return initialColor
    })
    const [parentId, setParentId] = useState<TagId | "">(tag?.parent_id ?? "")
    const [isSaving, setIsSaving] = useState(false)

    const [presetIndex, shadeIndex] = useMemo(() => {
        const match = color.match(/^(\d+)-(\d+)$/)
        if (match) {
            return [parseInt(match[1], 10), parseInt(match[2], 10)]
        }
        return [17, 5] // Cool Slate, 5th shade
    }, [color])

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
                                style={{
                                    backgroundColor: resolveTagColor(color),
                                }}
                                aria-hidden="true"
                            />
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                                    Color Palette
                                </p>
                                <div className="grid grid-cols-10 gap-2">
                                    {PRESET_COLORS.map((c, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => setColor(`${idx}-5`)}
                                            className={`aspect-square w-full rounded-full border-2 transition-all hover:scale-110 ${presetIndex === idx ? "scale-110 border-primary shadow-sm" : "border-transparent"}`}
                                            style={{ backgroundColor: c }}
                                            title={`Preset ${idx}`}
                                        />
                                    ))}
                                </div>
                            </div>

                            <ShadeSwatches
                                presetIndex={presetIndex}
                                shadeIndex={shadeIndex}
                                onChange={(newShadeIndex) =>
                                    setColor(`${presetIndex}-${newShadeIndex}`)
                                }
                            />
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
