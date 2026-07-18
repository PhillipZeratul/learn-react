import { TOP_MARGIN } from "./utils"

/**
 * Converts a given date and time to an absolute Y pixel coordinate
 * relative to a base date.
 *
 * @param time The target time to convert
 * @param baseDate The anchor date (representing y = TOP_MARGIN)
 * @param pixelsPerMinute The current zoom level
 * @returns The absolute Y pixel coordinate
 */
export const dateToY = (
    time: Date | string,
    baseDate: Date,
    pixelsPerMinute: number
): number => {
    const t = typeof time === "string" ? new Date(time) : time
    const minutesDiff = (t.getTime() - baseDate.getTime()) / 60000
    return minutesDiff * pixelsPerMinute + TOP_MARGIN
}

/**
 * Converts an absolute Y pixel coordinate back to a Date
 * relative to the base date.
 *
 * @param y The absolute Y pixel coordinate
 * @param baseDate The anchor date (representing y = TOP_MARGIN)
 * @param pixelsPerMinute The current zoom level
 * @returns The Date corresponding to the Y coordinate
 */
export const yToDate = (
    y: number,
    baseDate: Date,
    pixelsPerMinute: number
): Date => {
    const minutesDiff = (y - TOP_MARGIN) / pixelsPerMinute
    return new Date(baseDate.getTime() + minutesDiff * 60000)
}

/**
 * Calculates the bounding Y coordinates and height for a time range.
 */
export const getTimeRangeBounds = (
    startAt: Date | string,
    endAt: Date | string,
    baseDate: Date,
    pixelsPerMinute: number
) => {
    const startY = dateToY(startAt, baseDate, pixelsPerMinute)
    const endY = dateToY(endAt, baseDate, pixelsPerMinute)
    return {
        top: startY,
        height: Math.max(0, endY - startY),
    }
}

/**
 * Returns absolute minutes from the base date.
 */
export const getAbsoluteBounds = (
    startAt: string,
    endAt: string | null,
    baseDate: Date
) => {
    const startDate = new Date(startAt)
    const endDate = endAt ? new Date(endAt) : startDate

    const startMin = (startDate.getTime() - baseDate.getTime()) / 60000
    const duration = Math.max(
        0,
        (endDate.getTime() - startDate.getTime()) / 60000
    )

    return {
        startMin,
        duration,
    }
}
