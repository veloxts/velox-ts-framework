/**
 * DomainEventEmitter
 *
 * Typed in-process event emitter for domain events. Used internally by the
 * procedure builder's `.emits()` method and by `ctx.events.emit()` for
 * imperative usage.
 *
 * Listeners receive `event.data` (the typed payload), not the event instance.
 * Sequential listeners run first (in registration order), then concurrent
 * listeners run via Promise.allSettled. Listener errors are caught and logged
 * — they must never propagate to the caller, since the mutation already succeeded.
 */

import { createLogger } from '@veloxts/core';

import type { DomainEvent, DomainEventClass } from './event.js';

const log = createLogger('events');

// =============================================================================
// Listener options
// =============================================================================

export interface ListenerOptions {
  /**
   * When true, this listener executes in registration order, awaiting
   * completion before the next sequential listener starts.
   *
   * Sequential listeners all complete before concurrent listeners begin.
   *
   * @default false
   */
  sequential?: boolean;

  /**
   * Placeholder — stored but not yet implemented.
   *
   * TODO (v1.1): Implement automatic retry logic for retryable listeners
   * using an exponential back-off strategy with configurable attempts.
   *
   * @default false
   */
  retryable?: boolean;
}

// =============================================================================
// Internal listener entry
// =============================================================================

interface ListenerEntry<TData extends Record<string, unknown>> {
  handler: (data: TData) => void | Promise<void>;
  sequential: boolean;
  retryable: boolean;
}

// =============================================================================
// DomainEventEmitter
// =============================================================================

/**
 * Typed in-process domain event emitter.
 *
 * @example
 * ```typescript
 * const emitter = new DomainEventEmitter();
 *
 * emitter.on(OrderCreatedEvent, async (data) => {
 *   await sendConfirmationEmail(data.orderId);
 * });
 *
 * // In a mutation:
 * await emitter.emit(new OrderCreatedEvent({ orderId: 'order-123', total: 99.99 }));
 * ```
 */
export class DomainEventEmitter {
  /**
   * Registry keyed by `eventName`. Each value is an array of listener entries
   * typed as `ListenerEntry<Record<string, unknown>>` so they can be stored
   * together in one map — we narrow the type at registration/retrieval time.
   */
  private readonly _listeners = new Map<string, ListenerEntry<Record<string, unknown>>[]>();

  // ---------------------------------------------------------------------------
  // on()
  // ---------------------------------------------------------------------------

  /**
   * Register a typed listener for a domain event class.
   *
   * The handler receives `event.data` — the typed payload — not the event
   * instance itself.
   *
   * @param eventClass  - The domain event class (used as the key via `.eventName`).
   * @param handler     - Called with the event's `data` payload on each emit.
   * @param options     - `{ sequential?, retryable? }`
   */
  on<TData extends Record<string, unknown>>(
    eventClass: DomainEventClass<TData>,
    handler: (data: TData) => void | Promise<void>,
    options: ListenerOptions = {}
  ): void {
    const { sequential = false, retryable = false } = options;
    const key = eventClass.eventName;

    if (!this._listeners.has(key)) {
      this._listeners.set(key, []);
    }

    // Cast: we store all handlers as (data: Record<string, unknown>) => … but
    // they are only invoked with the correctly-typed payload for their key.
    const entry: ListenerEntry<Record<string, unknown>> = {
      handler: handler as (data: Record<string, unknown>) => void | Promise<void>,
      sequential,
      retryable,
    };

    this._listeners.get(key)?.push(entry);
  }

  // ---------------------------------------------------------------------------
  // off()
  // ---------------------------------------------------------------------------

  /**
   * Remove a previously registered listener.
   *
   * @param eventClass - The domain event class the listener was registered for.
   * @param handler    - The exact handler reference passed to `on()`.
   */
  off<TData extends Record<string, unknown>>(
    eventClass: DomainEventClass<TData>,
    handler: (data: TData) => void | Promise<void>
  ): void {
    const key = eventClass.eventName;
    const entries = this._listeners.get(key);

    if (!entries) return;

    const filtered = entries.filter(
      (entry) =>
        entry.handler !== (handler as (data: Record<string, unknown>) => void | Promise<void>)
    );

    if (filtered.length === 0) {
      this._listeners.delete(key);
    } else {
      this._listeners.set(key, filtered);
    }
  }

  // ---------------------------------------------------------------------------
  // emit()
  // ---------------------------------------------------------------------------

  /**
   * Fire a domain event to all registered listeners.
   *
   * Execution order:
   * 1. Sequential listeners run first, in registration order (each awaited).
   * 2. Concurrent listeners run together via Promise.allSettled.
   *
   * Errors from any listener are caught and logged — they never propagate
   * to the caller. The mutation that triggered the event already succeeded.
   *
   * @param event - The domain event instance to dispatch.
   */
  async emit<TData extends Record<string, unknown>>(event: DomainEvent<TData>): Promise<void> {
    const key = (event.constructor as unknown as { eventName: string }).eventName;
    const entries = this._listeners.get(key);

    if (!entries || entries.length === 0) return;

    const sequential = entries.filter((e) => e.sequential);
    const concurrent = entries.filter((e) => !e.sequential);

    // --- Sequential listeners (in registration order) ---
    for (const entry of sequential) {
      try {
        await entry.handler(event.data);
      } catch (err) {
        // Listener errors must never propagate — the mutation already succeeded.
        // Log the error and continue to the next listener.
        log.error(`Sequential listener for "${key}" threw an error:`, err);
      }
    }

    // --- Concurrent listeners (all at once) ---
    if (concurrent.length > 0) {
      const results = await Promise.allSettled(
        concurrent.map((entry) => entry.handler(event.data))
      );

      for (const result of results) {
        if (result.status === 'rejected') {
          log.error(
            `Concurrent listener for "${key}" threw an error:`,
            result.reason
          );
        }
      }
    }
  }
}
