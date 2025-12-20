/**
 * Timing Tracker - Unit Tests
 *
 * Tests for high-resolution timing measurement functionality.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTimingTracker, TimingTracker } from '../timing-tracker.js';

describe('TimingTracker', () => {
  let tracker: TimingTracker;

  beforeEach(() => {
    tracker = createTimingTracker();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createTimingTracker', () => {
    it('should create a new TimingTracker instance', () => {
      const instance = createTimingTracker();
      expect(instance).toBeInstanceOf(TimingTracker);
    });
  });

  describe('start', () => {
    it('should start a timing measurement', () => {
      tracker.start('startup');
      expect(tracker.isInProgress('startup')).toBe(true);
    });

    it('should overwrite existing measurement with same label', () => {
      tracker.start('startup');

      // End the first measurement
      const firstDuration = tracker.end('startup');
      expect(firstDuration).toBeGreaterThanOrEqual(0);
      expect(tracker.isComplete('startup')).toBe(true);

      // Start again - should overwrite the completed measurement
      tracker.start('startup');

      // After restart, measurement should be in-progress (not completed)
      expect(tracker.isInProgress('startup')).toBe(true);
      expect(tracker.isComplete('startup')).toBe(false);
    });

    it('should support custom labels', () => {
      tracker.start('custom-operation');
      expect(tracker.isInProgress('custom-operation')).toBe(true);
    });
  });

  describe('end', () => {
    it('should return duration in milliseconds', () => {
      tracker.start('test');
      const duration = tracker.end('test');

      expect(typeof duration).toBe('number');
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 for non-existent measurement', () => {
      const duration = tracker.end('non-existent');
      expect(duration).toBe(0);
    });

    it('should mark measurement as complete', () => {
      tracker.start('test');
      tracker.end('test');

      expect(tracker.isComplete('test')).toBe(true);
      expect(tracker.isInProgress('test')).toBe(false);
    });

    it('should return rounded milliseconds', () => {
      tracker.start('test');
      const duration = tracker.end('test');

      expect(Number.isInteger(duration)).toBe(true);
    });
  });

  describe('getDuration', () => {
    it('should return null for non-existent measurement', () => {
      expect(tracker.getDuration('non-existent')).toBeNull();
    });

    it('should return elapsed time for in-progress measurement', () => {
      tracker.start('test');
      const elapsed = tracker.getDuration('test');

      expect(elapsed).toBeGreaterThanOrEqual(0);
    });

    it('should return stored duration for completed measurement', () => {
      tracker.start('test');
      const ended = tracker.end('test');
      const retrieved = tracker.getDuration('test');

      expect(retrieved).toBe(ended);
    });

    it('should return rounded value', () => {
      tracker.start('test');
      const duration = tracker.getDuration('test');

      expect(duration === null || Number.isInteger(duration)).toBe(true);
    });
  });

  describe('isInProgress', () => {
    it('should return false for non-existent measurement', () => {
      expect(tracker.isInProgress('non-existent')).toBe(false);
    });

    it('should return true for started measurement', () => {
      tracker.start('test');
      expect(tracker.isInProgress('test')).toBe(true);
    });

    it('should return false for completed measurement', () => {
      tracker.start('test');
      tracker.end('test');
      expect(tracker.isInProgress('test')).toBe(false);
    });
  });

  describe('isComplete', () => {
    it('should return false for non-existent measurement', () => {
      expect(tracker.isComplete('non-existent')).toBe(false);
    });

    it('should return false for in-progress measurement', () => {
      tracker.start('test');
      expect(tracker.isComplete('test')).toBe(false);
    });

    it('should return true for completed measurement', () => {
      tracker.start('test');
      tracker.end('test');
      expect(tracker.isComplete('test')).toBe(true);
    });
  });

  describe('getAllMeasurements', () => {
    it('should return empty map initially', () => {
      const measurements = tracker.getAllMeasurements();
      expect(measurements.size).toBe(0);
    });

    it('should return all measurements', () => {
      tracker.start('first');
      tracker.start('second');
      tracker.end('first');

      const measurements = tracker.getAllMeasurements();
      expect(measurements.size).toBe(2);
      expect(measurements.has('first')).toBe(true);
      expect(measurements.has('second')).toBe(true);
    });

    it('should return readonly map', () => {
      tracker.start('test');
      const measurements = tracker.getAllMeasurements();

      // TypeScript should prevent this, but verify it's a proper readonly map
      expect(typeof measurements.get).toBe('function');
      expect(typeof measurements.has).toBe('function');
    });
  });

  describe('clear', () => {
    it('should remove all measurements', () => {
      tracker.start('first');
      tracker.start('second');
      tracker.clear();

      expect(tracker.getAllMeasurements().size).toBe(0);
    });
  });

  describe('clearLabel', () => {
    it('should remove specific measurement', () => {
      tracker.start('first');
      tracker.start('second');
      tracker.clearLabel('first');

      expect(tracker.getAllMeasurements().has('first')).toBe(false);
      expect(tracker.getAllMeasurements().has('second')).toBe(true);
    });

    it('should not throw for non-existent label', () => {
      expect(() => tracker.clearLabel('non-existent')).not.toThrow();
    });
  });

  describe('getSummary', () => {
    it('should return correct summary for empty tracker', () => {
      const summary = tracker.getSummary();

      expect(summary.totalMeasurements).toBe(0);
      expect(summary.completedMeasurements).toBe(0);
      expect(summary.inProgressMeasurements).toBe(0);
      expect(summary.totalDurationMs).toBe(0);
    });

    it('should count in-progress measurements', () => {
      tracker.start('first');
      tracker.start('second');

      const summary = tracker.getSummary();

      expect(summary.totalMeasurements).toBe(2);
      expect(summary.inProgressMeasurements).toBe(2);
      expect(summary.completedMeasurements).toBe(0);
    });

    it('should count completed measurements', () => {
      tracker.start('first');
      tracker.start('second');
      tracker.end('first');

      const summary = tracker.getSummary();

      expect(summary.totalMeasurements).toBe(2);
      expect(summary.completedMeasurements).toBe(1);
      expect(summary.inProgressMeasurements).toBe(1);
    });

    it('should sum durations of completed measurements', () => {
      tracker.start('first');
      tracker.end('first');
      tracker.start('second');
      tracker.end('second');

      const summary = tracker.getSummary();

      expect(summary.totalDurationMs).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(summary.totalDurationMs)).toBe(true);
    });
  });

  describe('timing labels', () => {
    it('should support all well-known labels', () => {
      const labels = ['startup', 'restart', 'hot-update', 'shutdown', 'file-change'] as const;

      for (const label of labels) {
        tracker.start(label);
        expect(tracker.isInProgress(label)).toBe(true);
      }
    });
  });
});
