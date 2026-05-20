import { describe, it, expect } from "vitest"
import { detectShake, calculateSnap, calculateLinkedBounds } from "./drag"

describe("drag utils", () => {
    describe("detectShake", () => {
        it("should return false if there are fewer than 4 points in history", () => {
            const history = [
                { y: 10, timestamp: 100 },
                { y: 20, timestamp: 200 },
                { y: 30, timestamp: 300 },
            ]
            expect(detectShake(history, 300)).toBe(false)
        })

        it("should return false if history is older than 400ms", () => {
            const history = [
                { y: 10, timestamp: 0 },
                { y: 20, timestamp: 100 },
                { y: 10, timestamp: 200 },
                { y: 20, timestamp: 600 }, // beyond 400ms window
            ]
            expect(detectShake(history, 650)).toBe(false)
        })

        it("should detect a valid shake gesture with >= 3 reversals and >= 15px amplitude", () => {
            const now = 500
            const history = [
                { y: 100, timestamp: now - 300 }, // start
                { y: 116, timestamp: now - 250 }, // move down +16px
                { y: 99, timestamp: now - 200 }, // move up -17px (reversal 1)
                { y: 115, timestamp: now - 150 }, // move down +16px (reversal 2)
                { y: 100, timestamp: now - 100 }, // move up -15px (reversal 3)
            ]
            expect(detectShake(history, now)).toBe(true)
        })

        it("should not detect shake if amplitude is below 15px", () => {
            const now = 500
            const history = [
                { y: 100, timestamp: now - 300 },
                { y: 105, timestamp: now - 250 }, // move down +5px
                { y: 98, timestamp: now - 200 }, // move up -7px (reversal 1)
                { y: 104, timestamp: now - 150 }, // move down +6px (reversal 2)
                { y: 100, timestamp: now - 100 }, // move up -4px (reversal 3)
            ]
            expect(detectShake(history, now)).toBe(false)
        })
    })

    describe("calculateSnap", () => {
        const ppm = 2 // 2px per minute
        const topMargin = 60

        it("should snap when close to a target within threshold", () => {
            const snapTargets = [300] // 300 minutes -> 600px + 60px = 660px
            const bypassedSnaps = new Set<number>()
            const requestedPixels = 664 // diff is 4px (< 20px threshold)

            const result = calculateSnap(
                requestedPixels,
                snapTargets,
                bypassedSnaps,
                ppm,
                null,
                topMargin
            )

            expect(result.snappedTargetVal).toBe(300)
            expect(result.shouldStartTimer).toBe(300)
            expect(result.shouldBypass).toBe(false)
            expect(result.snapOffsetMinutes).toBeCloseTo(-2) // requested was 302 mins, snapped is 300, offset is -2
        })

        it("should snap up to 20px threshold (new 2x limit)", () => {
            const snapTargets = [300] // 300 minutes -> 600px + 60px = 660px
            const bypassedSnaps = new Set<number>()
            const requestedPixels = 678 // diff is 18px (>= 10px and < 20px)

            const result = calculateSnap(
                requestedPixels,
                snapTargets,
                bypassedSnaps,
                ppm,
                null,
                topMargin
            )

            expect(result.snappedTargetVal).toBe(300)
            expect(result.shouldStartTimer).toBe(300)
        })

        it("should not snap if bypassed", () => {
            const snapTargets = [300]
            const bypassedSnaps = new Set<number>([300])
            const requestedPixels = 664

            const result = calculateSnap(
                requestedPixels,
                snapTargets,
                bypassedSnaps,
                ppm,
                null,
                topMargin
            )

            expect(result.snappedTargetVal).toBeNull()
            expect(result.shouldStartTimer).toBeNull()
        })

        it("should bypass snap if dragged past break threshold", () => {
            const snapTargets = [300] // Target pixel: 660px
            const bypassedSnaps = new Set<number>()
            const requestedPixels = 692 // diff is 32px (>= 30px break threshold)

            const result = calculateSnap(
                requestedPixels,
                snapTargets,
                bypassedSnaps,
                ppm,
                300, // already snapping to 300
                topMargin
            )

            expect(result.shouldBypass).toBe(true)
            expect(result.snappedTargetVal).toBeNull()
        })

        it("should stay snapped if already snapping and within break threshold", () => {
            const snapTargets = [300]
            const bypassedSnaps = new Set<number>()
            const requestedPixels = 675 // diff is 15px (between threshold 10px and break 30px)

            const result = calculateSnap(
                requestedPixels,
                snapTargets,
                bypassedSnaps,
                ppm,
                300, // already snapping to 300
                topMargin
            )

            expect(result.snappedTargetVal).toBe(300)
            expect(result.shouldBypass).toBe(false)
            expect(result.shouldStartTimer).toBeNull()
        })
    })

    describe("calculateLinkedBounds", () => {
        it("should calculate correct bounds for single start edge", () => {
            const linkedEdges = [
                {
                    edge: "start" as const,
                    initialStartMin: 120,
                    initialEndMin: 180,
                },
            ]
            const { absoluteMin, absoluteMax } =
                calculateLinkedBounds(linkedEdges)
            expect(absoluteMin).toBe(0)
            expect(absoluteMax).toBe(175) // initialEndMin - 5
        })

        it("should calculate correct bounds for single end edge", () => {
            const linkedEdges = [
                {
                    edge: "end" as const,
                    initialStartMin: 120,
                    initialEndMin: 180,
                },
            ]
            const { absoluteMin, absoluteMax } =
                calculateLinkedBounds(linkedEdges)
            expect(absoluteMin).toBe(125) // initialStartMin + 5
            expect(absoluteMax).toBe(24 * 60)
        })

        it("should calculate correct bounds for linked contiguous edges (start and end)", () => {
            const linkedEdges = [
                {
                    edge: "start" as const,
                    initialStartMin: 120,
                    initialEndMin: 180,
                }, // primary start edge
                {
                    edge: "end" as const,
                    initialStartMin: 60,
                    initialEndMin: 120,
                }, // linked end edge of previous card
            ]
            const { absoluteMin, absoluteMax } =
                calculateLinkedBounds(linkedEdges)
            expect(absoluteMin).toBe(65) // max of (0, 60+5)
            expect(absoluteMax).toBe(175) // min of (24*60, 180-5)
        })
    })
})
