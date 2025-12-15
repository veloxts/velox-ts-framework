/**
 * Timing Tracker - Measures reload and startup timing
 *
 * Provides high-resolution timing for development reload events.
 * Uses process.hrtime.bigint() for nanosecond precision, then converts
 * to milliseconds for human-readable output.
 *
 * @example
 * ```typescript
 * const tracker = createTimingTracker();
 *
 * tracker.start('startup');
 * await bootApplication();
 * const duration = tracker.end('startup');
 * console.log(`Started in ${duration}ms`);
 * ```
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Represents a timing measurement with start and optional end time
 */
export interface TimingMeasurement {
  /** Start time in nanoseconds (from process.hrtime.bigint) */
  readonly startTime: bigint;
  /** End time in nanoseconds (set when measurement completes) */
  readonly endTime?: bigint;
  /** Calculated duration in milliseconds */
  readonly durationMs?: number;
}

/**
 * Well-known timing labels used throughout the HMR system
 */
export type TimingLabel =
  | 'startup'
  | 'restart'
  | 'hot-update'
  | 'shutdown'
  | 'file-change'
  | string; // Allow custom labels

// ============================================================================
// TimingTracker Class
// ============================================================================

/**
 * Tracks timing for reload operations with high precision.
 *
 * Design decisions:
 * - Uses bigint for nanosecond precision (avoids floating point issues)
 * - Converts to milliseconds only at output (human-readable)
 * - Stores measurements for later retrieval (debugging, verbose mode)
 * - Thread-safe for single-threaded Node.js (no race conditions)
 */
export class TimingTracker {
  private readonly measurements = new Map<string, TimingMeasurement>();

  /**
   * Start timing an operation.
   *
   * If a measurement with the same label already exists, it will be overwritten.
   * This is intentional - allows restarting a timer without explicit clear.
   *
   * @param label - Identifier for this timing operation
   */
  start(label: TimingLabel): void {
    this.measurements.set(label, {
      startTime: process.hrtime.bigint(),
    });
  }

  /**
   * End timing an operation and return duration in milliseconds.
   *
   * @param label - Identifier for the timing operation to end
   * @returns Duration in milliseconds (rounded to nearest integer), or 0 if not started
   */
  end(label: TimingLabel): number {
    const measurement = this.measurements.get(label);

    if (!measurement) {
      // Operation wasn't started - return 0 rather than throw
      // This makes the API forgiving for edge cases (e.g., rapid restarts)
      return 0;
    }

    const endTime = process.hrtime.bigint();
    const durationNs = endTime - measurement.startTime;
    const durationMs = Number(durationNs) / 1_000_000; // Nanoseconds to milliseconds

    // Update measurement with end time and duration
    this.measurements.set(label, {
      ...measurement,
      endTime,
      durationMs,
    });

    return Math.round(durationMs);
  }

  /**
   * Get the duration of a completed measurement without ending it.
   *
   * Useful for checking timing of operations that are still in progress
   * or retrieving past measurements.
   *
   * @param label - Identifier for the timing operation
   * @returns Duration in milliseconds if completed, elapsed time if in progress, null if not found
   */
  getDuration(label: TimingLabel): number | null {
    const measurement = this.measurements.get(label);

    if (!measurement) {
      return null;
    }

    // If measurement is complete, return stored duration
    if (measurement.durationMs !== undefined) {
      return Math.round(measurement.durationMs);
    }

    // If still in progress, calculate elapsed time
    const currentTime = process.hrtime.bigint();
    const elapsedNs = currentTime - measurement.startTime;
    return Math.round(Number(elapsedNs) / 1_000_000);
  }

  /**
   * Check if a timing operation is currently in progress (started but not ended).
   *
   * @param label - Identifier for the timing operation
   * @returns true if timing is in progress
   */
  isInProgress(label: TimingLabel): boolean {
    const measurement = this.measurements.get(label);
    return measurement !== undefined && measurement.endTime === undefined;
  }

  /**
   * Check if a timing operation has been completed.
   *
   * @param label - Identifier for the timing operation
   * @returns true if timing is complete
   */
  isComplete(label: TimingLabel): boolean {
    const measurement = this.measurements.get(label);
    return measurement !== undefined && measurement.endTime !== undefined;
  }

  /**
   * Get all measurements (for debugging and verbose output).
   *
   * @returns Read-only map of all measurements
   */
  getAllMeasurements(): ReadonlyMap<string, TimingMeasurement> {
    return this.measurements;
  }

  /**
   * Clear all measurements.
   *
   * Useful when starting a new session or after a full restart.
   */
  clear(): void {
    this.measurements.clear();
  }

  /**
   * Clear a specific measurement.
   *
   * @param label - Identifier for the timing operation to clear
   */
  clearLabel(label: TimingLabel): void {
    this.measurements.delete(label);
  }

  /**
   * Get a summary of timing statistics (for verbose mode).
   *
   * @returns Object with timing statistics
   */
  getSummary(): TimingSummary {
    let totalDuration = 0;
    let completedCount = 0;
    let inProgressCount = 0;

    for (const measurement of this.measurements.values()) {
      if (measurement.durationMs !== undefined) {
        totalDuration += measurement.durationMs;
        completedCount++;
      } else {
        inProgressCount++;
      }
    }

    return {
      totalMeasurements: this.measurements.size,
      completedMeasurements: completedCount,
      inProgressMeasurements: inProgressCount,
      totalDurationMs: Math.round(totalDuration),
    };
  }
}

/**
 * Summary of timing statistics
 */
export interface TimingSummary {
  /** Total number of measurements (completed + in progress) */
  readonly totalMeasurements: number;
  /** Number of completed measurements */
  readonly completedMeasurements: number;
  /** Number of measurements still in progress */
  readonly inProgressMeasurements: number;
  /** Sum of all completed measurement durations in milliseconds */
  readonly totalDurationMs: number;
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new TimingTracker instance.
 *
 * Factory function for consistent instantiation pattern across the codebase.
 *
 * @returns New TimingTracker instance
 */
export function createTimingTracker(): TimingTracker {
  return new TimingTracker();
}
