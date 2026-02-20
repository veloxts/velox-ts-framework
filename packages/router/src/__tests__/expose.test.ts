/**
 * @veloxts/router - .expose() and .output() Tests
 *
 * Tests that:
 * - .output() only accepts Zod schemas (sets outputSchema)
 * - .expose() accepts resource schemas (sets _resourceSchema)
 * - .resource() is a deprecated alias for .expose()
 */

import type { BaseContext } from '@veloxts/core';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { executeProcedure, procedure } from '../procedure/builder.js';
import { isResourceSchema, resourceSchema } from '../resource';

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
// .expose() — Resource schemas
// ============================================================================

describe('.expose() with resource schema', () => {
  describe('untagged schema', () => {
    it('should set resourceSchema and not outputSchema', () => {
      const proc = procedure()
        .expose(ResourceUserSchema)
        .query(async () => ({
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'John',
          email: 'john@example.com',
          internalNotes: null,
        }));

      expect(proc._resourceSchema).toBeDefined();
      expect(isResourceSchema(proc._resourceSchema)).toBe(true);
      expect(proc.outputSchema).toBeUndefined();
    });

    it('should default to public projection without guard', async () => {
      const proc = procedure()
        .expose(ResourceUserSchema)
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
      expect(result).not.toHaveProperty('email');
      expect(result).not.toHaveProperty('internalNotes');
    });
  });

  describe('tagged schemas', () => {
    it('should set resourceSchema and resourceLevel for .authenticated', () => {
      const proc = procedure()
        .expose(ResourceUserSchema.authenticated)
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

    it('should project at authenticated level', async () => {
      const proc = procedure()
        .expose(ResourceUserSchema.authenticated)
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

    it('should project all fields at admin level', async () => {
      const proc = procedure()
        .expose(ResourceUserSchema.admin)
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

    it('should project only public fields at public level', async () => {
      const proc = procedure()
        .expose(ResourceUserSchema.public)
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
  });

  describe('array auto-projection', () => {
    it('should project each item in an array', async () => {
        const proc = procedure()
        .expose(ResourceUserSchema.public)
        // @ts-expect-error Will only output public
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
        ]);

      const ctx: BaseContext = {} as BaseContext;
      const result = await executeProcedure(proc, undefined, ctx);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John',
      });
      expect(result[1]).toEqual({
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Jane',
      });
    });
  });
});

// ============================================================================
// .resource() — deprecated alias for .expose()
// ============================================================================

describe('.resource() deprecated alias', () => {
  it('should work identically to .expose()', () => {
    const procExpose = procedure()
      .expose(ResourceUserSchema)
      .query(async () => ({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John',
        email: 'john@example.com',
        internalNotes: null,
      }));

    const procResource = procedure()
      .resource(ResourceUserSchema)
      .query(async () => ({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John',
        email: 'john@example.com',
        internalNotes: null,
      }));

    expect(procExpose._resourceSchema).toBeDefined();
    expect(procResource._resourceSchema).toBeDefined();
    expect(procExpose.outputSchema).toBeUndefined();
    expect(procResource.outputSchema).toBeUndefined();
  });

  it('should work with tagged schemas', () => {
    const proc = procedure()
      .resource(ResourceUserSchema.authenticated)
      .query(async () => ({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John',
        email: 'john@example.com',
        internalNotes: null,
      }));

    expect(proc._resourceSchema).toBeDefined();
    expect(proc._resourceLevel).toBe('authenticated');
  });

  it('should produce identical execution results as .expose()', async () => {
    const handler = async () => ({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'John',
      email: 'john@example.com',
      internalNotes: 'VIP',
    });

    const procExpose = procedure().expose(ResourceUserSchema.authenticated).query(handler);
    const procResource = procedure().resource(ResourceUserSchema.authenticated).query(handler);

    const ctx: BaseContext = {} as BaseContext;
    const resultExpose = await executeProcedure(procExpose, undefined, ctx);
    const resultResource = await executeProcedure(procResource, undefined, ctx);

    expect(resultExpose).toEqual(resultResource);
  });
});
