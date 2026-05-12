import { RRule } from "rrule"
import type { RoutineCard } from "../models/routine-card.model"
import type { IsoDateTime } from "@/shared/models/base.model"
import { isCardOverlappingDate } from "./utils"

/**
 * Calculates the end_at time based on the original duration and a new start time.
 */
const calculateEndAt = (
    originalStart: IsoDateTime,
    originalEnd: IsoDateTime,
    newStart: IsoDateTime
): IsoDateTime => {
    const duration =
        new Date(originalEnd).getTime() - new Date(originalStart).getTime()
    return new Date(
        new Date(newStart).getTime() + duration
    ).toISOString() as IsoDateTime
}

/**
 * Expands a list of routine cards (master and exceptions) into instances for a specific date.
 */
export const getRoutineInstancesForDate = (
    allCards: RoutineCard[],
    date: Date
): RoutineCard[] => {
    // startOfDay and endOfDay defined by the LOCAL date's boundaries
    const startOfDay = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        0,
        0,
        0,
        0
    )
    const endOfDay = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        23,
        59,
        59,
        999
    )

    const masterCards = allCards.filter((c) => !c.parent_routine_id)
    const exceptions = allCards.filter((c) => !!c.parent_routine_id)

    const instances: RoutineCard[] = []

    for (const master of masterCards) {
        if (!master.rrule) {
            if (isCardOverlappingDate(master.start_at, master.end_at, date)) {
                instances.push(master)
            }
            continue
        }

        try {
            // RRule options for strictly UTC handling
            const startDate = new Date(master.start_at)
            const options = RRule.parseString(master.rrule)
            options.dtstart = startDate
            options.tzid = "UTC" // Force UTC calculation

            const rule = new RRule(options)

            // Search back 24 hours to catch instances that started yesterday but overlap today
            const searchStart = new Date(startOfDay.getTime() - 24 * 60 * 60 * 1000)
            const occurrences = rule.between(searchStart, endOfDay, true)

            for (const occurrenceDate of occurrences) {
                const occurrenceIso =
                    occurrenceDate.toISOString() as IsoDateTime
                const occurrenceTime = occurrenceDate.getTime()
                
                const expandedEndAt = calculateEndAt(
                    master.start_at,
                    master.end_at,
                    occurrenceIso
                )

                // Only include if this instance overlaps today
                if (!isCardOverlappingDate(occurrenceIso, expandedEndAt, date)) {
                    continue
                }

                const override = exceptions.find((e) => {
                    if (
                        !e.parent_routine_id ||
                        e.parent_routine_id !== master.id ||
                        !e.original_recurrence_date
                    )
                        return false
                    return (
                        new Date(e.original_recurrence_date).getTime() ===
                        occurrenceTime
                    )
                })

                if (override) {
                    if (!override.is_deleted) {
                        instances.push(override)
                    }
                } else {
                    instances.push({
                        ...master,
                        id: `${master.id}_${occurrenceIso}` as any,
                        start_at: occurrenceIso,
                        end_at: expandedEndAt,
                        _isVirtual: true,
                    })
                }
            }
        } catch (error) {
            console.error(`Error expanding routine card ${master.id}:`, error)
            if (isCardOverlappingDate(master.start_at, master.end_at, date)) {
                instances.push(master)
            }
        }
    }

    return instances
}
