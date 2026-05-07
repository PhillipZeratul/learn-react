import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { timeToISO, isoToTime, isoToMinutes, isTouchEvent, formatLocalDate } from './utils';

describe('routine-time-tracker utils', () => {
    describe('formatLocalDate', () => {
        it('should format date as YYYY-MM-DD in local time', () => {
            const date = new Date(2026, 4, 7); // May 7, 2026
            expect(formatLocalDate(date)).toBe('2026-05-07');
        });
    });

    describe('timeToISO', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            // Mocking system time to a specific local time
            vi.setSystemTime(new Date(2026, 3, 22, 10, 0, 0)); // April 22, 2026, 10:00:00 Local
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should convert time string to ISO with current local date by default', () => {
            const result = timeToISO('14:30');
            const expected = new Date(2026, 3, 22, 14, 30, 0).toISOString();
            expect(result).toBe(expected);
        });

        it('should convert time string to ISO with specified date', () => {
            const result = timeToISO('09:15', '2026-12-25');
            const expected = new Date(2026, 11, 25, 9, 15, 0).toISOString();
            expect(result).toBe(expected);
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
