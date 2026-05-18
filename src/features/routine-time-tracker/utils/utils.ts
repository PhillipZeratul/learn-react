import type { IsoDateTime } from "@/shared/models/base.model"

export const BASE_PIXELS_PER_MINUTE = 1
export const TOP_MARGIN = 32
export const BOTTOM_MARGIN = 64
export const SHOW_CARD_TITLE_HEIGHT = 20
export const SHOW_CARD_TIME_HEIGHT = 44

export const getNowISO = (): IsoDateTime => {
    return new Date().toISOString() as IsoDateTime
}

export const getMinuteNow = (): IsoDateTime => {
    const rounded = new Date()
    rounded.setSeconds(0, 0)
    rounded.setMilliseconds(0)
    return rounded.toISOString() as IsoDateTime
}

export const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
}

export const timeToISO = (timeStr: string, dateStr?: string): IsoDateTime => {
    const datePart = dateStr || formatLocalDate(new Date())
    const [year, month, day] = datePart.split("-").map(Number)
    const parts = timeStr.split(":").map(Number)
    const hour = parts[0]
    const minute = parts[1]
    const second = parts[2] || 0

    // Create date in local time, then convert to UTC ISO
    const date = new Date(year, month - 1, day, hour, minute, second)
    return date.toISOString() as IsoDateTime
}

export const isoToTime = (isoStr: string, includeSeconds = true): string => {
    const date = new Date(isoStr)
    const h = String(date.getHours()).padStart(2, "0")
    const m = String(date.getMinutes()).padStart(2, "0")
    const s = String(date.getSeconds()).padStart(2, "0")
    return includeSeconds ? `${h}:${m}:${s}` : `${h}:${m}`
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
    endIso: string | null,
    currentDate: Date
): boolean => {
    const start = new Date(startIso).getTime()
    const end = endIso ? new Date(endIso).getTime() : new Date().getTime()

    const startOfDay = new Date(currentDate)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(currentDate)
    endOfDay.setHours(23, 59, 59, 999)

    return start <= endOfDay.getTime() && end > startOfDay.getTime()
}

export const getVisualBoundsForDate = (
    startIso: string,
    endIso: string | null,
    currentDate: Date
) => {
    const start = new Date(startIso).getTime()
    const end = endIso ? new Date(endIso).getTime() : new Date().getTime()

    const startOfDayDate = new Date(currentDate)
    startOfDayDate.setHours(0, 0, 0, 0)
    const startOfDay = startOfDayDate.getTime()

    const endOfDayDate = new Date(currentDate)
    endOfDayDate.setHours(23, 59, 59, 999)
    const endOfDay = endOfDayDate.getTime()

    const visualStart = Math.max(start, startOfDay)
    const visualEnd = Math.min(end, endOfDay + 1) // +1 to treat end as 24:00 if needed

    const startMin = (visualStart - startOfDay) / 60000
    const duration = (visualEnd - visualStart) / 60000

    return {
        startMin,
        duration,
        isStartClamped: start < startOfDay,
        isEndClamped: end > endOfDay,
    }
}

/**
 * HSV Color Utilities
 */

export interface HSV {
    h: number // 0-360
    s: number // 0-100
    v: number // 0-100
}

export const hexToHsv = (hex: string): HSV => {
    // Remove # if present
    hex = hex.replace(/^#/, "")

    // Parse RGB
    const r = parseInt(hex.substring(0, 2), 16) / 255
    const g = parseInt(hex.substring(2, 4), 16) / 255
    const b = parseInt(hex.substring(4, 6), 16) / 255

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const delta = max - min

    let h = 0
    if (delta !== 0) {
        if (max === r) h = ((g - b) / delta) % 6
        else if (max === g) h = (b - r) / delta + 2
        else h = (r - g) / delta + 4
        h = Math.round(h * 60)
        if (h < 0) h += 360
    }

    const s = max === 0 ? 0 : Math.round((delta / max) * 100)
    const v = Math.round(max * 100)

    return { h, s, v }
}

export const hsvToHex = ({ h, s, v }: HSV): string => {
    s /= 100
    v /= 100

    const c = v * s
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
    const m = v - c

    let r = 0,
        g = 0,
        b = 0
    if (h >= 0 && h < 60) {
        r = c
        g = x
        b = 0
    } else if (h >= 60 && h < 120) {
        r = x
        g = c
        b = 0
    } else if (h >= 120 && h < 180) {
        r = 0
        g = c
        b = x
    } else if (h >= 180 && h < 240) {
        r = 0
        g = x
        b = c
    } else if (h >= 240 && h < 300) {
        r = x
        g = 0
        b = c
    } else if (h >= 300 && h <= 360) {
        r = c
        g = 0
        b = x
    }

    const toHex = (n: number) => {
        const hex = Math.round((n + m) * 255).toString(16)
        return hex.length === 1 ? "0" + hex : hex
    }

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}
