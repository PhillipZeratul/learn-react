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
