/**
 * @veloxts/router - DomainError REST Serialization Tests
 *
 * Verifies that when a procedure throws a DomainError subclass, the REST
 * response includes the correct `code`, `data`, `statusCode`, and `message`
 * fields, serialised via VeloxApp's Fastify error handler.
 */

import { DomainError, veloxApp } from '@veloxts/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { defineProcedures, procedure } from '../procedure/builder.js';
import { registerRestRoutes } from '../rest/index.js';

// ---------------------------------------------------------------------------
// Concrete DomainError subclasses used across all tests
// ---------------------------------------------------------------------------

class InsufficientStock extends DomainError<{
  sku: string;
  requested: number;
  available: number;
}> {
  readonly code = 'INSUFFICIENT_STOCK' as const;
  readonly status = 422;
  readonly message = 'Not enough inventory';
}

class SubscriptionLimitExceeded extends DomainError<{
  plan: string;
  limit: number;
  current: number;
}> {
  readonly code = 'SUBSCRIPTION_LIMIT_EXCEEDED' as const;
  readonly status = 403;
  readonly message = 'Subscription limit reached';
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DomainError serialization through Fastify error handler', () => {
  let app: Awaited<ReturnType<typeof veloxApp>>;

  beforeEach(async () => {
    app = await veloxApp({ port: 0, logger: false });
  });

  afterEach(async () => {
    if (app.isRunning) {
      await app.stop();
    }
  });

  it('should return 422 with code, data, statusCode, and message for InsufficientStock', async () => {
    const collection = defineProcedures('products', {
      getProduct: procedure()
        .input(z.object({ id: z.string() }))
        .query(async () => {
          throw new InsufficientStock({ sku: 'WIDGET-99', requested: 10, available: 3 });
        }),
    });

    registerRestRoutes(app.server, [collection]);
    await app.start();

    const response = await app.server.inject({
      method: 'GET',
      url: '/api/products/1',
    });

    expect(response.statusCode).toBe(422);

    const body = response.json<{
      error: string;
      message: string;
      statusCode: number;
      code: string;
      data: { sku: string; requested: number; available: number };
    }>();

    expect(body.error).toBe('InsufficientStock');
    expect(body.message).toBe('Not enough inventory');
    expect(body.statusCode).toBe(422);
    expect(body.code).toBe('INSUFFICIENT_STOCK');
    expect(body.data).toEqual({ sku: 'WIDGET-99', requested: 10, available: 3 });
  });

  it('should return 403 with correct fields for SubscriptionLimitExceeded', async () => {
    const collection = defineProcedures('subscriptions', {
      createSubscription: procedure()
        .input(z.object({ plan: z.string() }))
        .mutation(async () => {
          throw new SubscriptionLimitExceeded({ plan: 'free', limit: 100, current: 100 });
        }),
    });

    registerRestRoutes(app.server, [collection]);
    await app.start();

    const response = await app.server.inject({
      method: 'POST',
      url: '/api/subscriptions',
      payload: { plan: 'free' },
    });

    expect(response.statusCode).toBe(403);

    const body = response.json<{
      error: string;
      message: string;
      statusCode: number;
      code: string;
      data: { plan: string; limit: number; current: number };
    }>();

    expect(body.error).toBe('SubscriptionLimitExceeded');
    expect(body.message).toBe('Subscription limit reached');
    expect(body.statusCode).toBe(403);
    expect(body.code).toBe('SUBSCRIPTION_LIMIT_EXCEEDED');
    expect(body.data).toEqual({ plan: 'free', limit: 100, current: 100 });
  });

  it('should include all four required fields (code, data, statusCode, message) in every DomainError response', async () => {
    const collection = defineProcedures('items', {
      listItems: procedure().query(async () => {
        throw new InsufficientStock({ sku: 'ABC', requested: 5, available: 0 });
      }),
    });

    registerRestRoutes(app.server, [collection]);
    await app.start();

    const response = await app.server.inject({
      method: 'GET',
      url: '/api/items',
    });

    expect(response.statusCode).toBe(422);

    const body = response.json<Record<string, unknown>>();

    // Verify all four required fields are present
    expect(body).toHaveProperty('code');
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('statusCode');
    expect(body).toHaveProperty('message');

    // The `data` field must be the structured payload, not null/undefined
    expect(body.data).toEqual({ sku: 'ABC', requested: 5, available: 0 });
  });

  it('should match the statusCode in the HTTP header with the statusCode field in the body', async () => {
    const collection = defineProcedures('orders', {
      getOrder: procedure()
        .input(z.object({ id: z.string() }))
        .query(async () => {
          throw new SubscriptionLimitExceeded({ plan: 'pro', limit: 50, current: 50 });
        }),
    });

    registerRestRoutes(app.server, [collection]);
    await app.start();

    const response = await app.server.inject({
      method: 'GET',
      url: '/api/orders/999',
    });

    const body = response.json<{ statusCode: number }>();

    // HTTP status code must match the body statusCode field
    expect(response.statusCode).toBe(body.statusCode);
    expect(response.statusCode).toBe(403);
  });
});
