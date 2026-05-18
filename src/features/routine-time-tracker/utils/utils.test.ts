import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
    timeToISO,
    isoToTime,
    isoToMinutes,
    formatLocalDate,
    isCardOverlappingDate,
    getVisualBoundsForDate,
} from "./utils"

describe("routine-time-tracker utils", () => {
    describe("formatLocalDate", () => {
        it("should format date as YYYY-MM-DD in local time", () => {
            const date = new Date(2026, 4, 7) // May 7, 2026
            expect(formatLocalDate(date)).toBe("2026-05-07")
        })
    })

    describe("timeToISO", () => {
        beforeEach(() => {
            vi.useFakeTimers()
            // Mocking system time to a specific local time
            vi.setSystemTime(new Date(2026, 3, 22, 10, 0, 0)) // April 22, 2026, 10:00:00 Local
        })

        afterEach(() => {
            vi.useRealTimers()
        })

        it("should convert time string to ISO with current local date by default", () => {
            const result = timeToISO("14:30")
            const expected = new Date(2026, 3, 22, 14, 30, 0).toISOString()
            expect(result).toBe(expected)
        })

        it("should handle seconds in time string", () => {
            const result = timeToISO("14:30:45")
            const expected = new Date(2026, 3, 22, 14, 30, 45).toISOString()
            expect(result).toBe(expected)
        })

        it("should convert time string to ISO with specified date", () => {
            const result = timeToISO("09:15", "2026-12-25")
            const expected = new Date(2026, 11, 25, 9, 15, 0).toISOString()
            expect(result).toBe(expected)
        })
    })

    describe("isoToTime", () => {
        it("should convert ISO string to HH:mm format", () => {
            const iso = new Date("2026-04-22T14:30:00").toISOString()
            expect(isoToTime(iso)).toBe("14:30")
        })

        it("should handle single digit hours and minutes", () => {
            const iso = new Date("2026-04-22T08:05:00").toISOString()
            expect(isoToTime(iso)).toBe("08:05")
        })

        it("should include seconds when requested", () => {
            const iso = new Date("2026-04-22T14:30:45").toISOString()
            expect(isoToTime(iso, true)).toBe("14:30:45")
        })
    })

    describe("isoToMinutes", () => {
        it("should convert ISO string to minutes since start of day", () => {
            const iso = new Date("2026-04-22T01:30:00").toISOString()
            expect(isoToMinutes(iso)).toBe(90) // 1*60 + 30
        })

        it("should handle midnight correctly", () => {
            const iso = new Date("2026-04-22T00:00:00").toISOString()
            expect(isoToMinutes(iso)).toBe(0)
        })
    })

    describe("isCardOverlappingDate", () => {
        const today = new Date(2026, 4, 12) // May 12

        it("should return true for card fully within day", () => {
            const start = new Date(2026, 4, 12, 10, 0).toISOString()
            const end = new Date(2026, 4, 12, 11, 0).toISOString()
            expect(isCardOverlappingDate(start, end, today)).toBe(true)
        })

        it("should return true for card starting yesterday and ending today", () => {
            const start = new Date(2026, 4, 11, 23, 0).toISOString()
            const end = new Date(2026, 4, 12, 1, 0).toISOString()
            expect(isCardOverlappingDate(start, end, today)).toBe(true)
        })

        it("should return true for card starting today and ending tomorrow", () => {
            const start = new Date(2026, 4, 12, 23, 0).toISOString()
            const end = new Date(2026, 4, 13, 1, 0).toISOString()
            expect(isCardOverlappingDate(start, end, today)).toBe(true)
        })

        it("should return false for card ending exactly at midnight today", () => {
            const start = new Date(2026, 4, 11, 22, 0).toISOString()
            const end = new Date(2026, 4, 12, 0, 0).toISOString()
            expect(isCardOverlappingDate(start, end, today)).toBe(false)
        })

        it("should return true for card starting exactly at midnight today", () => {
            const start = new Date(2026, 4, 12, 0, 0).toISOString()
            const end = new Date(2026, 4, 12, 1, 0).toISOString()
            expect(isCardOverlappingDate(start, end, today)).toBe(true)
        })
    })

    describe("getVisualBoundsForDate", () => {
        const today = new Date(2026, 4, 12)

        it("should return full bounds for single-day card", () => {
            const start = new Date(2026, 4, 12, 10, 0).toISOString()
            const end = new Date(2026, 4, 12, 11, 0).toISOString()
            const bounds = getVisualBoundsForDate(start, end, today)
            expect(bounds.startMin).toBe(600) // 10:00
            expect(bounds.duration).toBe(60)
            expect(bounds.isStartClamped).toBe(false)
            expect(bounds.isEndClamped).toBe(false)
        })

        it("should clamp start for yesterday-to-today card", () => {
            const start = new Date(2026, 4, 11, 23, 0).toISOString()
            const end = new Date(2026, 4, 12, 1, 0).toISOString()
            const bounds = getVisualBoundsForDate(start, end, today)
            expect(bounds.startMin).toBe(0)
            expect(bounds.duration).toBe(60) // 00:00 to 01:00
            expect(bounds.isStartClamped).toBe(true)
            expect(bounds.isEndClamped).toBe(false)
        })

        it("should clamp end for today-to-tomorrow card", () => {
            const start = new Date(2026, 4, 12, 23, 0).toISOString()
            const end = new Date(2026, 4, 13, 1, 0).toISOString()
            const bounds = getVisualBoundsForDate(start, end, today)
            expect(bounds.startMin).toBe(1380) // 23:00
            expect(bounds.duration).toBe(60) // 23:00 to 24:00
            expect(bounds.isStartClamped).toBe(false)
            expect(bounds.isEndClamped).toBe(true)
        })

        it("should clamp both for multi-day card", () => {
            const start = new Date(2026, 4, 11, 23, 0).toISOString()
            const end = new Date(2026, 4, 13, 1, 0).toISOString()
            const bounds = getVisualBoundsForDate(start, end, today)
            expect(bounds.startMin).toBe(0)
            expect(bounds.duration).toBe(1440)
            expect(bounds.isStartClamped).toBe(true)
            expect(bounds.isEndClamped).toBe(true)
        })
    })
})
