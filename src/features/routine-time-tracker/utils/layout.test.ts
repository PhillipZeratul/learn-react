import { describe, it, expect } from "vite-plus/test"
import { calculateLayout } from "./layout"
import { timeToISO } from "./utils"
import type { RoutineCard } from "../models/routine-card.model"
import type { RoutineCardId, TagId } from "../models/routine-time-tracker.model"
import type { UserId } from "@/shared/models/base.model"

describe("calculateLayout", () => {
    const today = new Date(2026, 4, 20) // May 20, 2026

    // Helper to generate a minimal routine card object for layout testing
    const mockCard = (
        id: string,
        startStr: string,
        endStr: string
    ): RoutineCard => {
        return {
            id: id as RoutineCardId,
            title: `Mock Card ${id}`,
            start_at: timeToISO(startStr, "2026-05-20"),
            end_at: timeToISO(endStr, "2026-05-20"),
            tag_id: "default-tag-id" as TagId,
            user_id: "user-id" as UserId,
            created_at: timeToISO("00:00", "2026-05-20"),
            updated_at: timeToISO("00:00", "2026-05-20"),
            is_deleted: false,
        }
    }

    it("should place two perfectly contiguous sequential tasks in the same column", () => {
        const card1 = mockCard("1", "08:00", "09:00")
        const card2 = mockCard("2", "09:00", "10:00")

        const layout = calculateLayout([card1, card2], today)

        const l1 = layout.get("1")!
        const l2 = layout.get("2")!

        // Since they are sequential, they should occupy 100% width and left=0
        expect(l1.left).toBe("calc(0% + 4px)")
        expect(l1.width).toBe("calc(100% - 8px)")
        expect(l2.left).toBe("calc(0% + 4px)")
        expect(l2.width).toBe("calc(100% - 8px)")
    })

    it("should resolve the contiguous gap minimization bug (sequential tasks grouped correctly with a third overlapping task)", () => {
        // Construct the gap-minimization bug scenario:
        // Column 0: card4 (07:30 - 08:55) -> 5 mins gap to card2
        // Column 1: card1 (08:00 - 09:00) -> 0 mins gap to card2
        // Column 2: card3 (08:30 - 09:30) -> overlap with card2
        // Card 2 starts at 09:00. Under greedy matching, it would go to Column 0.
        // Under our gap-minimization, it must choose Column 1 (0 mins gap sequential fit).
        const card4 = mockCard("4", "07:30", "08:55")
        const card1 = mockCard("1", "08:00", "09:00")
        const card3 = mockCard("3", "08:30", "09:30")
        const card2 = mockCard("2", "09:00", "10:00")

        const layout = calculateLayout([card4, card1, card3, card2], today)

        const l4 = layout.get("4")!
        const l1 = layout.get("1")!
        const l3 = layout.get("3")!
        const l2 = layout.get("2")!

        // All cards are in the same cluster, max columns must be 3
        // card4 -> column 0 (left: 0%)
        // card1 -> column 1 (left: 33.33%)
        // card3 -> column 2 (left: 66.66%)
        // card2 -> MUST be in column 1 (left: 33.33%) because it is contiguous with card1
        expect(l4.left).toBe("calc(0% + 4px)")
        expect(l1.left).toBe("calc(33.33333333333333% + 4px)")
        expect(l3.left).toBe("calc(66.66666666666666% + 4px)")
        expect(l2.left).toBe("calc(33.33333333333333% + 4px)") // Stays in the same column as card1!
    })

    it("should split overlapping cards into different parallel columns", () => {
        const card1 = mockCard("1", "09:00", "10:00")
        const card2 = mockCard("2", "09:30", "10:30")

        const layout = calculateLayout([card1, card2], today)

        const l1 = layout.get("1")!
        const l2 = layout.get("2")!

        // They overlap, so they must be in separate columns (col 0 and col 1) with 50% width
        expect(l1.left).toBe("calc(0% + 4px)")
        expect(l1.width).toBe("calc(50% - 8px)")
        expect(l2.left).toBe("calc(50% + 4px)")
        expect(l2.width).toBe("calc(50% - 8px)")
    })
})
