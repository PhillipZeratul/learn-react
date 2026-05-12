import type { IsoDateTime } from "@/shared/models/base.model"

export const PIXELS_PER_MINUTE = 1
export const TOP_MARGIN = 32
export const BOTTOM_MARGIN = 64
export const SHOW_CARD_TITLE_HEIGHT = 20
export const SHOW_CARD_TIME_HEIGHT = 44

export const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
}

export const timeToISO = (timeStr: string, dateStr?: string): IsoDateTime => {
    const datePart = dateStr || formatLocalDate(new Date())
    const [year, month, day] = datePart.split("-").map(Number)
    const [hour, minute] = timeStr.split(":").map(Number)

    // Create date in local time, then convert to UTC ISO
    const date = new Date(year, month - 1, day, hour, minute)
    return date.toISOString() as IsoDateTime
}

export const isoToTime = (isoStr: string): string => {
    const date = new Date(isoStr)
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}

export const isoToMinutes = (isoStr: string) => {
    const date = new Date(isoStr)
    return date.getHours() * 60 + date.getMinutes()
}

export const isTouchEvent = (
    e: React.MouseEvent | React.TouchEvent
): e is React.TouchEvent => {
    return "touches" in e
}

export const isCardOverlappingDate = (
    startIso: string,
    endIso: string,
    currentDate: Date
): boolean => {
    const start = new Date(startIso).getTime()
    const end = new Date(endIso).getTime()

    const startOfDay = new Date(currentDate)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(currentDate)
    endOfDay.setHours(23, 59, 59, 999)

    return start <= endOfDay.getTime() && end > startOfDay.getTime()
}

export const getVisualBoundsForDate = (
    startIso: string,
    endIso: string,
    currentDate: Date
) => {
    const start = new Date(startIso).getTime()
    const end = new Date(endIso).getTime()

    const startOfDayDate = new Date(currentDate)
    startOfDayDate.setHours(0, 0, 0, 0)
    const startOfDay = startOfDayDate.getTime()

    const endOfDayDate = new Date(currentDate)
    endOfDayDate.setHours(23, 59, 59, 999)
    const endOfDay = endOfDayDate.getTime()

    const visualStart = Math.max(start, startOfDay)
    const visualEnd = Math.min(end, endOfDay + 1) // +1 to treat end as 24:00 if needed

    const startMin = Math.floor((visualStart - startOfDay) / 60000)
    const duration = Math.ceil((visualEnd - visualStart) / 60000)

    return {
        startMin,
        duration,
        isStartClamped: start < startOfDay,
        isEndClamped: end > endOfDay,
    }
}
