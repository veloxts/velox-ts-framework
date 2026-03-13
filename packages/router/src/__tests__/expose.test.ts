/**
 * @veloxts/router - .output() Tests
 *
 * Tests that:
 * - .output() accepts Zod schemas (sets outputSchema)
 * - .output() accepts tagged resource views (sets _resourceSchema + _resourceLevel)
 */

import type { BaseContext } from '@veloxts/core';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { executeProcedure, procedure } from '../procedure/builder.js';
import { resourceSchema } from '../resource';

// ============================================================================
// Test Fixtures
// ============================================================================

const ZodUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
});

const ResourceUserSchema = resourceSchema()
  .public('id', z.string().uuid())
  .public('name', z.string())
  .authenticated('email', z.string().email())
  .admin('internalNotes', z.string().nullable())
  .build();

// ============================================================================
// .output() — Zod-only
// ============================================================================

describe('.output() with Zod schema', () => {
  it('should set outputSchema and not resourceSchema', () => {
    const proc = procedure()
      .output(ZodUserSchema)
      .query(async () => ({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John',
        email: 'john@example.com',
      }));

    expect(proc.outputSchema).toBeDefined();
    expect(proc._resourceSchema).toBeUndefined();
  });

  it('should validate output via Zod schema', async () => {
    const proc = procedure()
      .output(z.object({ count: z.number() }))
      .query(async () => ({ count: 42 }));

    const ctx: BaseContext = {} as BaseContext;
    const result = await executeProcedure(proc, undefined, ctx);
    expect(result).toEqual({ count: 42 });
  });

  it('should reject invalid output via Zod schema', async () => {
    const proc = procedure()
      .output(z.object({ count: z.number() }))
      .query(async () => ({ count: 'not-a-number' }) as unknown as { count: number });

    const ctx: BaseContext = {} as BaseContext;
    await expect(executeProcedure(proc, undefined, ctx)).rejects.toThrow();
  });
});

// ============================================================================
// .output() with tagged resource views (Level 2)
// ============================================================================

describe('.output() with tagged resource views (Level 2)', () => {
  it('accepts a tagged resource view and sets _resourceSchema + _resourceLevel', () => {
    const proc = procedure()
      .output(ResourceUserSchema.authenticated)
      .query(async () => ({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John',
        email: 'john@example.com',
        internalNotes: null,
      }));

    expect(proc._resourceSchema).toBeDefined();
    expect(proc._resourceLevel).toBe('authenticated');
    expect(proc.outputSchema).toBeUndefined();
  });

  it('auto-projects handler result through tagged level', async () => {
    const proc = procedure()
      .output(ResourceUserSchema.authenticated)
      .query(async () => ({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John',
        email: 'john@example.com',
        internalNotes: 'VIP',
      }));

    const ctx: BaseContext = {} as BaseContext;
    const result = await executeProcedure(proc, undefined, ctx);

    expect(result).toEqual({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'John',
      email: 'john@example.com',
    });
    expect(result).not.toHaveProperty('internalNotes');
  });

  it('projects all fields at admin level', async () => {
    const proc = procedure()
      .output(ResourceUserSchema.admin)
      .query(async () => ({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John',
        email: 'john@example.com',
        internalNotes: 'VIP',
      }));

    const ctx: BaseContext = {} as BaseContext;
    const result = await executeProcedure(proc, undefined, ctx);

    expect(result).toEqual({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'John',
      email: 'john@example.com',
      internalNotes: 'VIP',
    });
  });

  it('projects only public fields at public level', async () => {
    const proc = procedure()
      .output(ResourceUserSchema.public)
      .query(async () => ({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John',
        email: 'john@example.com',
        internalNotes: 'VIP',
      }));

    const ctx: BaseContext = {} as BaseContext;
    const result = await executeProcedure(proc, undefined, ctx);

    expect(result).toEqual({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'John',
    });
  });

  it('still accepts plain Zod schemas (Level 1 unchanged)', () => {
    const proc = procedure()
      .output(z.object({ id: z.string() }))
      .query(async () => ({ id: '1' }));

    expect(proc._resourceSchema).toBeUndefined();
    expect(proc.outputSchema).toBeDefined();
  });

  it('auto-projects each item in an array result', async () => {
    const proc = procedure()
      .output(ResourceUserSchema.public)
      .query(async () => [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'John',
          email: 'john@example.com',
          internalNotes: 'VIP',
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'Jane',
          email: 'jane@example.com',
          internalNotes: null,
        },
      ] as unknown as { id: string; name: string });

    const ctx: BaseContext = {} as BaseContext;
    const result = await executeProcedure(proc, undefined, ctx);

    expect(Array.isArray(result)).toBe(true);
    const arr = result as unknown as Array<Record<string, unknown>>;
    expect(arr).toHaveLength(2);
    expect(arr[0]).toEqual({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'John',
    });
    expect(arr[1]).toEqual({
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Jane',
    });
  });
});
