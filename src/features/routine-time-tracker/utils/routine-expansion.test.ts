import { describe, it, expect } from 'vitest';
import { getRoutineInstancesForDate } from './routine-expansion';
import { createRoutineCard } from '../models/routine-card.model';
import type { RoutineCard } from '../models/routine-card.model';
import type { IsoDateTime } from '@/shared/models/base.model';

describe('routine-expansion', () => {
    // To be 100% deterministic and TZ-agnostic, we use UTC strings/dates in tests.
    const today = new Date('2026-04-25T12:00:00Z');
    const tomorrow = new Date('2026-04-26T12:00:00Z');

    it('should return non-recurring cards on their start date', () => {
        const card = createRoutineCard({
            id: '1' as any,
            title: 'One-off',
            start_at: '2026-04-25T08:00:00.000Z' as IsoDateTime,
            end_at: '2026-04-25T09:00:00.000Z' as IsoDateTime,
        });

        const instancesToday = getRoutineInstancesForDate([card], today);
        expect(instancesToday).toHaveLength(1);
        expect(instancesToday[0].id).toBe('1');

        const instancesTomorrow = getRoutineInstancesForDate([card], tomorrow);
        expect(instancesTomorrow).toHaveLength(0);
    });

    it('should expand recurring cards into virtual cards', () => {
        const master = createRoutineCard({
            id: 'master' as any,
            title: 'Daily Jog',
            start_at: '2026-04-25T08:00:00.000Z' as IsoDateTime,
            end_at: '2026-04-25T09:00:00.000Z' as IsoDateTime,
            rrule: 'FREQ=DAILY;INTERVAL=1',
        });

        const instancesToday = getRoutineInstancesForDate([master], today);
        expect(instancesToday).toHaveLength(1);
        expect(instancesToday[0]._isVirtual).toBe(true);
        expect(instancesToday[0].start_at).toBe('2026-04-25T08:00:00.000Z');

        const instancesTomorrow = getRoutineInstancesForDate([master], tomorrow);
        expect(instancesTomorrow).toHaveLength(1);
        expect(instancesTomorrow[0]._isVirtual).toBe(true);
        expect(instancesTomorrow[0].start_at).toBe('2026-04-26T08:00:00.000Z');
    });

    it('should replace virtual cards with detached instances (exceptions)', () => {
        const master = createRoutineCard({
            id: 'master' as any,
            title: 'Daily Jog',
            start_at: '2026-04-25T08:00:00.000Z' as IsoDateTime,
            end_at: '2026-04-25T09:00:00.000Z' as IsoDateTime,
            rrule: 'FREQ=DAILY;INTERVAL=1',
        });

        const exception = createRoutineCard({
            id: 'exception' as any,
            parent_routine_id: 'master' as any,
            original_recurrence_date: '2026-04-26T08:00:00.000Z' as IsoDateTime,
            title: 'Modified Jog',
            start_at: '2026-04-26T07:00:00.000Z' as IsoDateTime,
            end_at: '2026-04-26T08:00:00.000Z' as IsoDateTime,
        });

        const instancesTomorrow = getRoutineInstancesForDate([master, exception], tomorrow);
        expect(instancesTomorrow).toHaveLength(1);
        expect(instancesTomorrow[0].id).toBe('exception');
        expect(instancesTomorrow[0].title).toBe('Modified Jog');
        expect(instancesTomorrow[0]._isVirtual).toBeUndefined();
    });

    it('should skip virtual cards if a deleted detached instance exists', () => {
        const master = createRoutineCard({
            id: 'master' as any,
            title: 'Daily Jog',
            start_at: '2026-04-25T08:00:00.000Z' as IsoDateTime,
            end_at: '2026-04-25T09:00:00.000Z' as IsoDateTime,
            rrule: 'FREQ=DAILY;INTERVAL=1',
        });

        const deletedException = createRoutineCard({
            id: 'deleted' as any,
            parent_routine_id: 'master' as any,
            original_recurrence_date: '2026-04-26T08:00:00.000Z' as IsoDateTime,
            is_deleted: true,
        });

        const instancesTomorrow = getRoutineInstancesForDate([master, deletedException], tomorrow);
        expect(instancesTomorrow).toHaveLength(0);
    });
});
