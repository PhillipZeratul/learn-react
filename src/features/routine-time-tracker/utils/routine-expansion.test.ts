import { describe, it, expect } from "vitest"
import { getRoutineInstancesForDate } from "./routine-expansion"
import { createRoutineCard } from "../models/routine-card.model"
import { timeToISO } from "./utils"
import type { RoutineCardId } from "../models/routine-time-tracker.model"

describe("routine-expansion", () => {
    // To be 100% deterministic and TZ-agnostic, we use local dates for the 'date' parameter,
    // and timeToISO (which uses local date by default) for the card bounds.
    const today = new Date(2026, 3, 25, 12, 0, 0) // April 25
    const tomorrow = new Date(2026, 3, 26, 12, 0, 0) // April 26

    it("should return non-recurring cards on their start date", () => {
        const card = createRoutineCard({
            id: "1" as RoutineCardId,
            title: "One-off",
            start_at: timeToISO("08:00", "2026-04-25"),
            end_at: timeToISO("09:00", "2026-04-25"),
        })

        const instancesToday = getRoutineInstancesForDate([card], today)
        expect(instancesToday).toHaveLength(1)
        expect(instancesToday[0].id).toBe("1")

        const instancesTomorrow = getRoutineInstancesForDate([card], tomorrow)
        expect(instancesTomorrow).toHaveLength(0)
    })

    it("should expand recurring cards into virtual cards", () => {
        const master = createRoutineCard({
            id: "master" as RoutineCardId,
            title: "Daily Jog",
            start_at: timeToISO("08:00", "2026-04-25"),
            end_at: timeToISO("09:00", "2026-04-25"),
            rrule: "FREQ=DAILY;INTERVAL=1",
        })

        const instancesToday = getRoutineInstancesForDate([master], today)
        expect(instancesToday).toHaveLength(1)
        expect(instancesToday[0]._isVirtual).toBe(true)
        expect(instancesToday[0].start_at).toBe(
            timeToISO("08:00", "2026-04-25")
        )

        const instancesTomorrow = getRoutineInstancesForDate([master], tomorrow)
        expect(instancesTomorrow).toHaveLength(1)
        expect(instancesTomorrow[0]._isVirtual).toBe(true)
        expect(instancesTomorrow[0].start_at).toBe(
            timeToISO("08:00", "2026-04-26")
        )
    })

    it("should replace virtual cards with detached instances (exceptions)", () => {
        const master = createRoutineCard({
            id: "master" as RoutineCardId,
            title: "Daily Jog",
            start_at: timeToISO("08:00", "2026-04-25"),
            end_at: timeToISO("09:00", "2026-04-25"),
            rrule: "FREQ=DAILY;INTERVAL=1",
        })

        const exception = createRoutineCard({
            id: "exception" as RoutineCardId,
            parent_routine_id: "master" as RoutineCardId,
            original_recurrence_date: timeToISO("08:00", "2026-04-26"),
            title: "Modified Jog",
            start_at: timeToISO("07:00", "2026-04-26"),
            end_at: timeToISO("08:00", "2026-04-26"),
        })

        const instancesTomorrow = getRoutineInstancesForDate(
            [master, exception],
            tomorrow
        )
        expect(instancesTomorrow).toHaveLength(1)
        expect(instancesTomorrow[0].id).toBe("exception")
        expect(instancesTomorrow[0].title).toBe("Modified Jog")
        expect(instancesTomorrow[0]._isVirtual).toBeUndefined()
    })

    it("should skip virtual cards if a deleted detached instance exists", () => {
        const master = createRoutineCard({
            id: "master" as RoutineCardId,
            title: "Daily Jog",
            start_at: timeToISO("08:00", "2026-04-25"),
            end_at: timeToISO("09:00", "2026-04-25"),
            rrule: "FREQ=DAILY;INTERVAL=1",
        })

        const deletedException = createRoutineCard({
            id: "deleted" as RoutineCardId,
            parent_routine_id: "master" as RoutineCardId,
            original_recurrence_date: timeToISO("08:00", "2026-04-26"),
            is_deleted: true,
        })

        const instancesTomorrow = getRoutineInstancesForDate(
            [master, deletedException],
            tomorrow
        )
        expect(instancesTomorrow).toHaveLength(0)
    })

    it("should return cross-day routines for both start and overlap days", () => {
        const card = createRoutineCard({
            id: "cross-day" as RoutineCardId,
            title: "Sleep",
            start_at: timeToISO("22:00", "2026-04-25"),
            end_at: timeToISO("06:00", "2026-04-26"),
        })

        const instancesDay1 = getRoutineInstancesForDate([card], today)
        expect(instancesDay1).toHaveLength(1)
        expect(instancesDay1[0].id).toBe("cross-day")

        const instancesDay2 = getRoutineInstancesForDate([card], tomorrow)
        expect(instancesDay2).toHaveLength(1)
        expect(instancesDay2[0].id).toBe("cross-day")
    })

    it("should expand recurring cross-day routines correctly", () => {
        const master = createRoutineCard({
            id: "master" as RoutineCardId,
            title: "Daily Sleep",
            start_at: timeToISO("22:00", "2026-04-25"),
            end_at: timeToISO("06:00", "2026-04-26"),
            rrule: "FREQ=DAILY;INTERVAL=1",
        })

        // On day 1, should see the instance starting at 22:00
        const instancesDay1 = getRoutineInstancesForDate([master], today)
        expect(instancesDay1).toHaveLength(1)
        expect(instancesDay1[0].start_at).toBe(timeToISO("22:00", "2026-04-25"))

        // On day 2, should see TWO instances:
        // 1. The one that started on day 1 (overlaps 00:00-06:00)
        // 2. The one that starts on day 2 (starts at 22:00)
        const instancesDay2 = getRoutineInstancesForDate([master], tomorrow)
        expect(instancesDay2).toHaveLength(2)
        expect(instancesDay2.map((i) => i.start_at)).toContain(
            timeToISO("22:00", "2026-04-25")
        )
        expect(instancesDay2.map((i) => i.start_at)).toContain(
            timeToISO("22:00", "2026-04-26")
        )
    })
})
