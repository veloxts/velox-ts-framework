/**
 * DomainEvent Base Class
 *
 * Abstract base class for internal server-side domain events used in
 * business logic (e.g., OrderCreated, UserRegistered). These are distinct
 * from broadcast events (WebSocket/SSE) which are client-facing.
 */

// =============================================================================
// DomainEvent
// =============================================================================

/**
 * Abstract base class for all domain events.
 *
 * Domain events represent meaningful occurrences within the business domain
 * (e.g., "OrderCreated", "OrderFulfilled"). They carry typed payloads and
 * support optional correlation IDs for distributed tracing.
 *
 * @example
 * ```typescript
 * interface OrderCreatedData {
 *   orderId: string;
 *   customerId: string;
 *   total: number;
 * }
 *
 * class OrderCreatedEvent extends DomainEvent<OrderCreatedData> {}
 *
 * const event = new OrderCreatedEvent(
 *   { orderId: 'order-123', customerId: 'cust-456', total: 99.99 },
 *   { correlationId: 'req-abc' }
 * );
 *
 * console.log(OrderCreatedEvent.name); // 'OrderCreatedEvent'
 * ```
 */
export abstract class DomainEvent<TData extends Record<string, unknown> = Record<string, unknown>> {
  /** The typed payload carried by this event. */
  readonly data: TData;

  /** The date/time at which this event was instantiated. */
  readonly timestamp: Date;

  /** Optional correlation ID for distributed tracing across services. */
  readonly correlationId?: string;

  constructor(data: TData, options?: { correlationId?: string }) {
    this.data = data;
    this.timestamp = new Date();
    this.correlationId = options?.correlationId;
  }
}

// =============================================================================
// DomainEventClass
// =============================================================================

/**
 * Type representing the constructor signature of a concrete DomainEvent subclass.
 *
 * Use this when you need to hold a reference to an event class itself
 * (e.g., to register listeners or dispatch by class reference).
 *
 * @example
 * ```typescript
 * function on<TData extends Record<string, unknown>>(
 *   EventClass: DomainEventClass<TData>,
 *   handler: (event: DomainEvent<TData>) => void,
 * ): void {
 *   // register handler keyed by EventClass.name
 * }
 * ```
 */
export type DomainEventClass<TData extends Record<string, unknown> = Record<string, unknown>> = {
  new (data: TData, options?: { correlationId?: string }): DomainEvent<TData>;
  readonly name: string;
};
