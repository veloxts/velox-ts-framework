/**
 * @veloxts/router - Unified .output() Tests
 * Tests that .output() accepts both Zod schemas and resource schemas,
 * with correct state management and mutual exclusion.
 */

import type { BaseContext } from '@veloxts/core';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { executeProcedure, procedure } from '../procedure/builder.js';
import { isResourceSchema, resourceSchema } from '../resource/index.js';

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
// Unified .output() — Schema Discrimination
// ============================================================================

describe('Unified .output() method', () => {
  describe('with Zod schema', () => {
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

  describe('with resource schema (untagged)', () => {
    it('should set resourceSchema and not outputSchema', () => {
      const proc = procedure()
        .output(ResourceUserSchema)
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
        .output(ResourceUserSchema)
        .query(async () => ({
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'John',
          email: 'john@example.com',
          internalNotes: 'VIP',
        }));

      const ctx: BaseContext = {} as BaseContext;
      const result = await executeProcedure(proc, undefined, ctx);

      // Without guard, defaults to public projection
      expect(result).toEqual({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John',
      });
      expect(result).not.toHaveProperty('email');
      expect(result).not.toHaveProperty('internalNotes');
    });
  });

  describe('with tagged resource schema', () => {
    it('should set resourceSchema and resourceLevel', () => {
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

    it('should project at the tagged level', async () => {
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

    it('should project all fields at admin level', async () => {
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

    it('should project only public fields at public level', async () => {
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
  });

  describe('mutual exclusion', () => {
    it('should clear resourceSchema when .output(zodSchema) is called after .output(resourceSchema)', () => {
      const proc = procedure()
        .output(ResourceUserSchema)
        .output(ZodUserSchema)
        .query(async () => ({
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'John',
          email: 'john@example.com',
        }));

      expect(proc.outputSchema).toBeDefined();
      expect(proc._resourceSchema).toBeUndefined();
    });

    it('should clear outputSchema when .output(resourceSchema) is called after .output(zodSchema)', () => {
      const proc = procedure()
        .output(ZodUserSchema)
        .output(ResourceUserSchema)
        .query(async () => ({
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'John',
          email: 'john@example.com',
          internalNotes: null,
        }));

      expect(proc._resourceSchema).toBeDefined();
      expect(proc.outputSchema).toBeUndefined();
    });

    it('should clear resourceLevel when switching from tagged resource to Zod', () => {
      const proc = procedure()
        .output(ResourceUserSchema.admin)
        .output(ZodUserSchema)
        .query(async () => ({
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'John',
          email: 'john@example.com',
        }));

      expect(proc.outputSchema).toBeDefined();
      expect(proc._resourceSchema).toBeUndefined();
      expect(proc._resourceLevel).toBeUndefined();
    });
  });
});

// ============================================================================
// Deprecated .resource() backward compatibility
// ============================================================================

describe('.resource() deprecated alias', () => {
  it('should still work identically to .output(resourceSchema)', () => {
    const procOutput = procedure()
      .output(ResourceUserSchema)
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

    // Both should set resourceSchema
    expect(procOutput._resourceSchema).toBeDefined();
    expect(procResource._resourceSchema).toBeDefined();
    expect(procOutput.outputSchema).toBeUndefined();
    expect(procResource.outputSchema).toBeUndefined();
  });

  it('should still work with tagged schemas', () => {
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

  it('should produce identical execution results', async () => {
    const handler = async () => ({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'John',
      email: 'john@example.com',
      internalNotes: 'VIP',
    });

    const procOutput = procedure().output(ResourceUserSchema.authenticated).query(handler);

    const procResource = procedure().resource(ResourceUserSchema.authenticated).query(handler);

    const ctx: BaseContext = {} as BaseContext;
    const resultOutput = await executeProcedure(procOutput, undefined, ctx);
    const resultResource = await executeProcedure(procResource, undefined, ctx);

    expect(resultOutput).toEqual(resultResource);
  });
});

// ============================================================================
// Array auto-projection
// ============================================================================

describe('.output(resourceSchema) with array results', () => {
  it('should project each item in an array', async () => {
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
