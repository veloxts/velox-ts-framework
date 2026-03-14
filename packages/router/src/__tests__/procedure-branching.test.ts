/**
 * @veloxts/router - Level 3 Handler Map (Branching) Tests
 *
 * Tests the handler-map `.query()` and `.mutation()` syntax for
 * per-access-level branching via resource schema keys.
 */

import type { BaseContext } from '@veloxts/core';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { executeProcedure, isCompiledProcedure, procedure } from '../procedure/builder.js';
import { defineAccessLevels, resourceSchema } from '../resource/index.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const access = defineAccessLevels(['public', 'authenticated', 'admin'], {
  guards: {
    authenticated: (ctx: unknown) => {
      const c = ctx as { user?: { role?: string } };
      return !!c.user;
    },
    admin: (ctx: unknown) => {
      const c = ctx as { user?: { role?: string } };
      return c.user?.role === 'admin';
    },
  },
});

const UserSchema = resourceSchema(access)
  .visibleTo('id', z.string(), ['public', 'authenticated', 'admin'])
  .visibleTo('name', z.string(), ['public', 'authenticated', 'admin'])
  .visibleTo('email', z.string(), ['authenticated', 'admin'])
  .admin('secret', z.string())
  .build();

// ============================================================================
// Builder Validation
// ============================================================================

describe('Level 3: builder validation', () => {
  it('accepts a handler map keyed by schema level keys', () => {
    const proc = procedure()
      .input(z.object({ id: z.string() }))
      .output(UserSchema)
      .query({
        [UserSchema.admin.key]: async ({ input }) => ({
          id: input.id,
          name: 'Admin',
          email: 'a@b.com',
          secret: 'x',
        }),
        [UserSchema.public.key]: async ({ input }) => ({
          id: input.id,
          name: 'Public',
        }),
      });

    expect(proc).toBeDefined();
    expect(proc._handlerMap).toBeDefined();
    expect(proc.handler).toBeTypeOf('function');
    expect(proc.type).toBe('query');
  });

  it('rejects single handler when output is untagged resource schema', () => {
    expect(() =>
      procedure()
        .output(UserSchema)
        .query(async () => ({ id: '1', name: 'A' }))
    ).toThrow(/handler map required/i);
  });

  it('rejects handler map + .guard() combination', () => {
    expect(() =>
      procedure()
        .guard({ name: 'test', check: () => true, message: 'fail', statusCode: 403 })
        .output(UserSchema)
        .query({
          [UserSchema.admin.key]: async () => ({
            id: '1',
            name: 'A',
            email: 'a@b.com',
            secret: 'x',
          }),
        })
    ).toThrow(/cannot use handler map with .guard/i);
  });

  it('rejects handler map when output is a plain Zod schema', () => {
    expect(() =>
      procedure()
        .output(z.object({ id: z.string() }))
        .query({
          someKey: async () => ({ id: '1' }),
        })
    ).toThrow(/handler map can only be used/i);
  });

  it('works with mutation type', () => {
    const proc = procedure()
      .input(z.object({ name: z.string() }))
      .output(UserSchema)
      .mutation({
        [UserSchema.admin.key]: async ({ input }) => ({
          id: '1',
          name: input.name,
          email: 'a@b.com',
          secret: 'x',
        }),
        [UserSchema.public.key]: async ({ input }) => ({
          id: '1',
          name: input.name,
        }),
      });

    expect(proc.type).toBe('mutation');
    expect(proc._handlerMap).toBeDefined();
  });
});

// ============================================================================
// isCompiledProcedure
// ============================================================================

describe('Level 3: isCompiledProcedure', () => {
  it('returns true for Level 3 procedures (handler is synthesized)', () => {
    const proc = procedure()
      .output(UserSchema)
      .query({
        [UserSchema.public.key]: async () => ({ id: '1', name: 'P' }),
      });
    expect(isCompiledProcedure(proc)).toBe(true);
  });
});

// ============================================================================
// Branch Selection
// ============================================================================

describe('Level 3: branch selection', () => {
  it('selects admin branch for admin caller', async () => {
    const proc = procedure()
      .output(UserSchema)
      .query({
        [UserSchema.admin.key]: async () => ({
          id: '1',
          name: 'Admin',
          email: 'admin@test.com',
          secret: 'top-secret',
        }),
        [UserSchema.public.key]: async () => ({
          id: '1',
          name: 'Public',
        }),
      });

    const ctx = { user: { role: 'admin' } } as BaseContext;
    const result = await executeProcedure(proc, {}, ctx);
    expect(result).toEqual({
      id: '1',
      name: 'Admin',
      email: 'admin@test.com',
      secret: 'top-secret',
    });
  });

  it('selects authenticated branch for authenticated caller', async () => {
    const proc = procedure()
      .output(UserSchema)
      .query({
        [UserSchema.admin.key]: async () => ({
          id: '1',
          name: 'Admin',
          email: 'admin@test.com',
          secret: 'top-secret',
        }),
        [UserSchema.authenticated.key]: async () => ({
          id: '1',
          name: 'Auth',
          email: 'auth@test.com',
        }),
        [UserSchema.public.key]: async () => ({
          id: '1',
          name: 'Public',
        }),
      });

    const ctx = { user: { role: 'user' } } as BaseContext;
    const result = await executeProcedure(proc, {}, ctx);
    expect(result).toEqual({
      id: '1',
      name: 'Auth',
      email: 'auth@test.com',
    });
  });

  it('selects public branch for unauthenticated caller', async () => {
    const proc = procedure()
      .output(UserSchema)
      .query({
        [UserSchema.admin.key]: async () => ({
          id: '1',
          name: 'Admin',
          email: 'a@b.com',
          secret: 'x',
        }),
        [UserSchema.public.key]: async () => ({
          id: '1',
          name: 'Public',
        }),
      });

    const ctx = {} as BaseContext;
    const result = await executeProcedure(proc, {}, ctx);
    expect(result).toEqual({ id: '1', name: 'Public' });
  });

  it('falls through to next lower branch when exact match missing', async () => {
    const proc = procedure()
      .output(UserSchema)
      .query({
        [UserSchema.admin.key]: async () => ({
          id: '1',
          name: 'Admin',
          email: 'a@b.com',
          secret: 'x',
        }),
        // authenticated not defined — falls through to public
        [UserSchema.public.key]: async () => ({
          id: '1',
          name: 'Public',
        }),
      });

    // Authenticated user but no authenticated handler → falls to public
    const ctx = { user: { role: 'user' } } as BaseContext;
    const result = await executeProcedure(proc, {}, ctx);
    expect(result).toEqual({ id: '1', name: 'Public' });
  });

  it('returns 403 when no branch matches and no public fallback', async () => {
    const proc = procedure()
      .output(UserSchema)
      .query({
        [UserSchema.admin.key]: async () => ({
          id: '1',
          name: 'Admin',
          email: 'a@b.com',
          secret: 'x',
        }),
      });

    const ctx = {} as BaseContext;
    await expect(executeProcedure(proc, {}, ctx)).rejects.toThrow(/no matching branch/i);
  });

  it('evaluates guards most-privileged-first', async () => {
    const callOrder: string[] = [];
    const orderedAccess = defineAccessLevels(['public', 'authenticated', 'admin'], {
      guards: {
        authenticated: () => {
          callOrder.push('authenticated');
          return true;
        },
        admin: () => {
          callOrder.push('admin');
          return false;
        },
      },
    });

    const Schema = resourceSchema(orderedAccess)
      .public('id', z.string())
      .authenticated('email', z.string())
      .admin('secret', z.string())
      .build();

    const proc = procedure()
      .output(Schema)
      .query({
        [Schema.admin.key]: async () => ({ id: '1', email: 'a@b.com', secret: 'x' }),
        [Schema.authenticated.key]: async () => ({ id: '1', email: 'a@b.com' }),
        [Schema.public.key]: async () => ({ id: '1' }),
      });

    await executeProcedure(proc, {}, {} as BaseContext);
    expect(callOrder).toEqual(['admin', 'authenticated']);
  });

  it('auto-projects through the selected level visibility', async () => {
    const proc = procedure()
      .output(UserSchema)
      .query({
        [UserSchema.authenticated.key]: async () => ({
          id: '1',
          name: 'Auth',
          email: 'auth@test.com',
          secret: 'should-be-stripped',
        }),
        [UserSchema.public.key]: async () => ({
          id: '1',
          name: 'Public',
        }),
      });

    // Authenticated user — handler returns secret but projection strips it
    const ctx = { user: { role: 'user' } } as BaseContext;
    const result = await executeProcedure(proc, {}, ctx);
    expect(result).toEqual({
      id: '1',
      name: 'Auth',
      email: 'auth@test.com',
    });
    expect(result).not.toHaveProperty('secret');
  });

  it('auto-projects arrays element-wise', async () => {
    const proc = procedure()
      .output(UserSchema)
      .query({
        [UserSchema.public.key]: async () => [
          { id: '1', name: 'A', email: 'a@b.com', secret: 'x' },
          { id: '2', name: 'B', email: 'b@c.com', secret: 'y' },
        ],
      });

    const result = await executeProcedure(proc, {}, {} as BaseContext);
    expect(result).toEqual([
      { id: '1', name: 'A' },
      { id: '2', name: 'B' },
    ]);
  });

  it('passes input to the selected handler', async () => {
    const proc = procedure()
      .input(z.object({ id: z.string() }))
      .output(UserSchema)
      .query({
        [UserSchema.public.key]: async ({ input }) => ({
          id: input.id,
          name: `User ${input.id}`,
        }),
      });

    const result = await executeProcedure(proc, { id: '42' }, {} as BaseContext);
    expect(result).toEqual({ id: '42', name: 'User 42' });
  });
});

// ============================================================================
// Custom Access Levels
// ============================================================================

describe('Level 3: custom access levels', () => {
  const customAccess = defineAccessLevels(['public', 'reviewer', 'editor', 'admin'], {
    guards: {
      reviewer: (ctx: unknown) => {
        const c = ctx as { user?: { role?: string } };
        return ['reviewer', 'editor', 'admin'].includes(c.user?.role ?? '');
      },
      editor: (ctx: unknown) => {
        const c = ctx as { user?: { role?: string } };
        return ['editor', 'admin'].includes(c.user?.role ?? '');
      },
      admin: (ctx: unknown) => {
        const c = ctx as { user?: { role?: string } };
        return c.user?.role === 'admin';
      },
    },
    groups: { staff: ['editor', 'admin'] },
  });

  const ArticleSchema = resourceSchema(customAccess)
    .visibleTo('title', z.string(), ['public', 'reviewer', 'editor', 'admin'])
    .visibleTo('notes', z.string(), ['reviewer', 'editor', 'admin'])
    .visibleTo('draft', z.string(), ['editor', 'admin'])
    .admin('auditLog', z.string())
    .build();

  it('selects correct branch for custom levels', async () => {
    const proc = procedure()
      .output(ArticleSchema)
      .query({
        [ArticleSchema.admin.key]: async () => ({
          title: 'T',
          notes: 'N',
          draft: 'D',
          auditLog: 'A',
        }),
        [ArticleSchema.editor.key]: async () => ({
          title: 'T',
          notes: 'N',
          draft: 'D',
        }),
        [ArticleSchema.reviewer.key]: async () => ({
          title: 'T',
          notes: 'N',
        }),
        [ArticleSchema.public.key]: async () => ({
          title: 'T',
        }),
      });

    // Editor gets editor branch
    const editorCtx = { user: { role: 'editor' } } as BaseContext;
    const editorResult = await executeProcedure(proc, {}, editorCtx);
    expect(editorResult).toEqual({ title: 'T', notes: 'N', draft: 'D' });
    expect(editorResult).not.toHaveProperty('auditLog');

    // Reviewer gets reviewer branch
    const reviewerCtx = { user: { role: 'reviewer' } } as BaseContext;
    const reviewerResult = await executeProcedure(proc, {}, reviewerCtx);
    expect(reviewerResult).toEqual({ title: 'T', notes: 'N' });

    // Public gets public branch
    const publicResult = await executeProcedure(proc, {}, {} as BaseContext);
    expect(publicResult).toEqual({ title: 'T' });
  });
});
