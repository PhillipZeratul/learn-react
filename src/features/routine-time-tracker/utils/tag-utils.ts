import type { Tag } from "../models/tag.model"
import type { TagId } from "../models/routine-time-tracker.model"

/**
 * Sorts tags recursively based on their parent_id and sort_order.
 * Returns a flat array in the correct display order with depth information.
 */
export const getSortedTagsWithDepth = (
    tags: Tag[]
): (Tag & { depth: number })[] => {
    const result: (Tag & { depth: number })[] = []

    const processTags = (pId: TagId | undefined, depth: number) => {
        const siblings = tags
            .filter((t) => (t.parent_id || undefined) === pId)
            .sort((a, b) => a.sort_order - b.sort_order)

        siblings.forEach((sibling) => {
            result.push({ ...sibling, depth })
            processTags(sibling.id, depth + 1)
        })
    }

    processTags(undefined, 0)

    // Fallback: If some tags were not included (e.g. orphans with invalid parent_id),
    // add them at the end to ensure no data is lost in the UI.
    if (result.length < tags.length) {
        const includedIds = new Set(result.map((t) => t.id))
        const orphans = tags.filter((t) => !includedIds.has(t.id))
        orphans.forEach((orphan) => {
            result.push({ ...orphan, depth: 0 })
        })
    }

    return result
}
