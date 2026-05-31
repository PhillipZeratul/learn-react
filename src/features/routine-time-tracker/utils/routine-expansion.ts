import { RRule } from "rrule"
import { v4 as uuidv4 } from "uuid"
import type { RoutineCard } from "../models/routine-card.model"
import type { RoutineCardId } from "../models/routine-time-tracker.model"
import type { IsoDateTime } from "@/shared/models/base.model"
import { isCardOverlappingDate } from "./utils"

export const splitRoutineSeries = (
    master: RoutineCard,
    splitIsoDate: IsoDateTime,
    newMasterProps: Partial<RoutineCard>
): [RoutineCard, RoutineCard] => {
    const splitTime = new Date(splitIsoDate)
    const untilDate = new Date(splitTime)
    untilDate.setDate(untilDate.getDate() - 1)
    untilDate.setHours(23, 59, 59, 999)

    let newOriginalRRule = master.rrule
    if (master.rrule) {
        try {
            const options = RRule.parseString(master.rrule)
            options.until = untilDate
            const rule = new RRule(options)
            newOriginalRRule = rule.toString().replace(/^RRULE:/, "")
        } catch (e) {
            console.error("Failed to parse master rrule", e)
        }
    }

    const updatedMaster: RoutineCard = {
        ...master,
        rrule: newOriginalRRule,
        updated_at: new Date().toISOString() as IsoDateTime,
    }

    const newMaster: RoutineCard = {
        ...master,
        ...newMasterProps,
        id: uuidv4() as RoutineCardId,
        parent_routine_id: undefined,
        original_recurrence_date: undefined,
        _isVirtual: undefined,
        updated_at: new Date().toISOString() as IsoDateTime,
    }

    return [updatedMaster, newMaster]
}

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

    const masterCards = allCards.filter(
        (c) => !c.parent_routine_id && !c.is_deleted
    )
    const exceptions = allCards.filter((c) => !!c.parent_routine_id)

    // Build a map of exceptions for O(1) lookup: parent_id -> original_date_ms -> exception
    const exceptionsMap = new Map<string, Map<number, RoutineCard>>()
    for (const e of exceptions) {
        if (e.parent_routine_id && e.original_recurrence_date) {
            const time = new Date(e.original_recurrence_date).getTime()
            let parentMap = exceptionsMap.get(e.parent_routine_id)
            if (!parentMap) {
                parentMap = new Map()
                exceptionsMap.set(e.parent_routine_id, parentMap)
            }
            parentMap.set(time, e)
        }
    }

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
            const searchStart = new Date(
                startOfDay.getTime() - 24 * 60 * 60 * 1000
            )
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
                if (
                    !isCardOverlappingDate(occurrenceIso, expandedEndAt, date)
                ) {
                    continue
                }

                const override = exceptionsMap
                    .get(master.id)
                    ?.get(occurrenceTime)

                if (override) {
                    if (!override.is_deleted) {
                        instances.push(override)
                    }
                } else {
                    instances.push({
                        ...master,
                        id: `${master.id}_${occurrenceIso}` as RoutineCardId,
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
