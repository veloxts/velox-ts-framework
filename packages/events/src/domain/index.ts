/**
 * Domain Events — barrel export
 *
 * Re-exports the DomainEvent base class, its class type, and the
 * DomainEventEmitter with its listener options.
 */

export { DomainEventEmitter, type ListenerOptions as DomainListenerOptions } from './emitter.js';
export { DomainEvent, type DomainEventClass } from './event.js';
