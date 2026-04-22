import { describe, it, expect, beforeEach } from 'vitest';
import { useRoutineTimeTrackerStore } from './routine-time-tracker.store';

describe('useRoutineTimeTrackerStore', () => {
    beforeEach(() => {
        // Reset the store state before each test
        useRoutineTimeTrackerStore.getState().resetTracker();
    });

    it('should have a default state', () => {
        const state = useRoutineTimeTrackerStore.getState();
        expect(state.activeTimeTrackerId).toBe(null);
    });

    it('should set the active time tracker ID', () => {
        const testId = 'test-id-123';
        useRoutineTimeTrackerStore.getState().setActiveTimeTrackerId(testId);
        expect(useRoutineTimeTrackerStore.getState().activeTimeTrackerId).toBe(testId);
    });

    it('should reset the active time tracker ID', () => {
        useRoutineTimeTrackerStore.getState().setActiveTimeTrackerId('some-id');
        useRoutineTimeTrackerStore.getState().resetTracker();
        expect(useRoutineTimeTrackerStore.getState().activeTimeTrackerId).toBe(null);
    });
});
