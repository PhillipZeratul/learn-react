import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { timeToISO, isoToTime, isoToMinutes, isTouchEvent } from './utils';

describe('routine-time-tracker utils', () => {
    describe('timeToISO', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-04-22T10:00:00Z'));
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should convert time string to ISO with current date by default', () => {
            const result = timeToISO('14:30');
            // Assuming system timezone is UTC for tests
            expect(result).toBe(new Date('2026-04-22T14:30:00').toISOString());
        });

        it('should convert time string to ISO with specified date', () => {
            const result = timeToISO('09:15', '2026-12-25');
            expect(result).toBe(new Date('2026-12-25T09:15:00').toISOString());
        });
    });

    describe('isoToTime', () => {
        it('should convert ISO string to HH:mm format', () => {
            const iso = new Date('2026-04-22T14:30:00').toISOString();
            expect(isoToTime(iso)).toBe('14:30');
        });

        it('should handle single digit hours and minutes', () => {
            const iso = new Date('2026-04-22T08:05:00').toISOString();
            expect(isoToTime(iso)).toBe('08:05');
        });
    });

    describe('isoToMinutes', () => {
        it('should convert ISO string to minutes since start of day', () => {
            const iso = new Date('2026-04-22T01:30:00').toISOString();
            expect(isoToMinutes(iso)).toBe(90); // 1*60 + 30
        });

        it('should handle midnight correctly', () => {
            const iso = new Date('2026-04-22T00:00:00').toISOString();
            expect(isoToMinutes(iso)).toBe(0);
        });
    });

    describe('isTouchEvent', () => {
        it('should return true for touch events', () => {
            const event = { touches: [] } as unknown as React.TouchEvent;
            expect(isTouchEvent(event)).toBe(true);
        });

        it('should return false for mouse events', () => {
            const event = {} as unknown as React.MouseEvent;
            expect(isTouchEvent(event)).toBe(false);
        });
    });
});
