/**
 * @veloxts/mcp - Static TypeScript Analyzer Tests
 * Tests the TypeScript Compiler API-based procedure discovery
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { analyzeDirectory, formatStaticAnalysisAsText } from '../static-analyzer.js';

describe('Static TypeScript Analyzer', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'velox-analyzer-test-'));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true });
  });

  describe('analyzeDirectory', () => {
    it('should parse procedures() call with AST', () => {
      writeFileSync(
        join(testDir, 'users.ts'),
        `
import { procedure, procedures, z } from '@veloxts/velox';

export const userProcedures = procedures('users', {
  getUser: procedure()
    .input(z.object({ id: z.string() }))
    .output(z.object({ id: z.string(), name: z.string() }))
    .query(async ({ input }) => input),

  createUser: procedure()
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input }) => input),
});
      `
      );

      const result = analyzeDirectory(testDir);

      expect(result.namespaces).toEqual(['users']);
      expect(result.procedures).toHaveLength(2);
      expect(result.errors).toHaveLength(0);

      const getUser = result.procedures.find((p) => p.name === 'getUser');
      expect(getUser).toMatchObject({
        name: 'getUser',
        namespace: 'users',
        type: 'query',
        hasInputSchema: true,
        hasOutputSchema: true,
        hasGuards: false,
        hasMiddleware: false,
        route: { method: 'GET', path: '/api/users/:id' },
      });

      const createUser = result.procedures.find((p) => p.name === 'createUser');
      expect(createUser).toMatchObject({
        name: 'createUser',
        namespace: 'users',
        type: 'mutation',
        hasInputSchema: true,
        hasOutputSchema: false,
        route: { method: 'POST', path: '/api/users' },
      });
    });

    it('should parse defineProcedures() call', () => {
      writeFileSync(
        join(testDir, 'posts.ts'),
        `
import { defineProcedures, procedure, z } from '@veloxts/velox';

export const postProcedures = defineProcedures('posts', {
  listPosts: procedure()
    .query(async () => []),

  deletePost: procedure()
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => input),
});
      `
      );

      const result = analyzeDirectory(testDir);

      expect(result.namespaces).toEqual(['posts']);
      expect(result.procedures).toHaveLength(2);

      const listPosts = result.procedures.find((p) => p.name === 'listPosts');
      expect(listPosts).toMatchObject({
        name: 'listPosts',
        namespace: 'posts',
        type: 'query',
        route: { method: 'GET', path: '/api/posts' },
      });

      const deletePost = result.procedures.find((p) => p.name === 'deletePost');
      expect(deletePost).toMatchObject({
        name: 'deletePost',
        namespace: 'posts',
        type: 'mutation',
        route: { method: 'DELETE', path: '/api/posts/:id' },
      });
    });

    it('should detect guards and middleware', () => {
      writeFileSync(
        join(testDir, 'protected.ts'),
        `
import { procedure, procedures, authenticated, rateLimiter } from '@veloxts/velox';

export const protectedProcedures = procedures('admin', {
  getSecrets: procedure()
    .guard(authenticated)
    .use(rateLimiter())
    .query(async () => []),
});
      `
      );

      const result = analyzeDirectory(testDir);

      expect(result.procedures).toHaveLength(1);
      expect(result.procedures[0]).toMatchObject({
        name: 'getSecrets',
        namespace: 'admin',
        hasGuards: true,
        hasMiddleware: true,
      });
    });

    it('should detect REST overrides', () => {
      writeFileSync(
        join(testDir, 'custom.ts'),
        `
import { procedure, procedures, z } from '@veloxts/velox';

export const customProcedures = procedures('custom', {
  doSomething: procedure()
    .input(z.object({ data: z.string() }))
    .rest({ method: 'PATCH', path: '/custom/action' })
    .mutation(async ({ input }) => input),
});
      `
      );

      const result = analyzeDirectory(testDir);

      expect(result.procedures).toHaveLength(1);
      expect(result.procedures[0]).toMatchObject({
        name: 'doSomething',
        namespace: 'custom',
        restOverride: { method: 'PATCH', path: '/custom/action' },
        route: { method: 'PATCH', path: '/custom/action' },
      });
    });

    it('should handle multiple files', () => {
      writeFileSync(
        join(testDir, 'users.ts'),
        `
import { procedure, procedures } from '@veloxts/velox';

export const userProcedures = procedures('users', {
  getUser: procedure().query(async () => ({})),
});
      `
      );

      writeFileSync(
        join(testDir, 'posts.ts'),
        `
import { procedure, procedures } from '@veloxts/velox';

export const postProcedures = procedures('posts', {
  getPost: procedure().query(async () => ({})),
});
      `
      );

      const result = analyzeDirectory(testDir);

      expect(result.namespaces).toContain('users');
      expect(result.namespaces).toContain('posts');
      expect(result.procedures).toHaveLength(2);
      expect(result.files).toHaveLength(2);
    });

    it('should skip excluded files', () => {
      writeFileSync(
        join(testDir, '_internal.ts'),
        `export const internal = procedures('internal', {});`
      );

      writeFileSync(
        join(testDir, 'users.test.ts'),
        `export const test = procedures('test', {});`
      );

      writeFileSync(
        join(testDir, 'users.d.ts'),
        `export type User = { id: string };`
      );

      writeFileSync(
        join(testDir, 'index.ts'),
        `export * from './users';`
      );

      writeFileSync(
        join(testDir, 'users.ts'),
        `
import { procedure, procedures } from '@veloxts/velox';

export const userProcedures = procedures('users', {
  getUser: procedure().query(async () => ({})),
});
      `
      );

      const result = analyzeDirectory(testDir);

      // Only users.ts should be analyzed
      expect(result.files).toHaveLength(1);
      expect(result.files[0]).toContain('users.ts');
      expect(result.namespaces).toEqual(['users']);
    });

    it('should handle non-existent directory gracefully', () => {
      const result = analyzeDirectory('/non/existent/path');

      expect(result.procedures).toHaveLength(0);
      expect(result.namespaces).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Error reading directory');
    });

    it('should infer type from procedure name when not explicit', () => {
      writeFileSync(
        join(testDir, 'inferred.ts'),
        `
import { procedure, procedures } from '@veloxts/velox';

// Regex fallback test - procedures without explicit .query() or .mutation()
export const inferredProcedures = procedures('inferred', {
  getUserById: procedure(),  // should infer query from 'get' prefix
  listAllItems: procedure(), // should infer query from 'list' prefix
  createNewItem: procedure(), // should infer mutation from 'create' prefix
  updateExisting: procedure(), // should infer mutation from 'update' prefix
  deleteItem: procedure(), // should infer mutation from 'delete' prefix
});
      `
      );

      const result = analyzeDirectory(testDir);

      // These may fall back to regex analysis since there's no .query()/.mutation()
      expect(result.procedures.length).toBeGreaterThan(0);
    });
  });

  describe('REST route inference', () => {
    it('should infer collection routes for list/create/add', () => {
      writeFileSync(
        join(testDir, 'items.ts'),
        `
import { procedure, procedures } from '@veloxts/velox';

export const itemProcedures = procedures('items', {
  listItems: procedure().query(async () => []),
  findItems: procedure().query(async () => []),
  searchItems: procedure().query(async () => []),
  createItem: procedure().mutation(async () => ({})),
  addItem: procedure().mutation(async () => ({})),
});
      `
      );

      const result = analyzeDirectory(testDir);

      const routes = result.procedures.map((p) => p.route);

      // Collection endpoints should not have :id
      expect(routes).toContainEqual({ method: 'GET', path: '/api/items' });
      expect(routes).toContainEqual({ method: 'POST', path: '/api/items' });
    });

    it('should infer resource routes for get/update/delete', () => {
      writeFileSync(
        join(testDir, 'items.ts'),
        `
import { procedure, procedures } from '@veloxts/velox';

export const itemProcedures = procedures('items', {
  getItem: procedure().query(async () => ({})),
  updateItem: procedure().mutation(async () => ({})),
  editItem: procedure().mutation(async () => ({})),
  patchItem: procedure().mutation(async () => ({})),
  deleteItem: procedure().mutation(async () => ({})),
  removeItem: procedure().mutation(async () => ({})),
});
      `
      );

      const result = analyzeDirectory(testDir);

      const routes = result.procedures.map((p) => p.route);

      // Resource endpoints should have :id
      expect(routes).toContainEqual({ method: 'GET', path: '/api/items/:id' });
      expect(routes).toContainEqual({ method: 'PUT', path: '/api/items/:id' });
      expect(routes).toContainEqual({ method: 'PATCH', path: '/api/items/:id' });
      expect(routes).toContainEqual({ method: 'DELETE', path: '/api/items/:id' });
    });
  });

  describe('formatStaticAnalysisAsText', () => {
    it('should format analysis result as readable text', () => {
      writeFileSync(
        join(testDir, 'users.ts'),
        `
import { procedure, procedures } from '@veloxts/velox';

export const userProcedures = procedures('users', {
  getUser: procedure()
    .guard(() => true)
    .query(async () => ({})),
  createUser: procedure().mutation(async () => ({})),
});
      `
      );

      const result = analyzeDirectory(testDir);
      const text = formatStaticAnalysisAsText(result);

      expect(text).toContain('# VeloxTS Procedures');
      expect(text).toContain('Total: 2 procedures');
      expect(text).toContain('Namespaces: users');
      expect(text).toContain('## users');
      expect(text).toContain('[Q] getUser');
      expect(text).toContain('[guarded]');
      expect(text).toContain('[M] createUser');
    });

    it('should show analysis notes for errors', () => {
      const result = analyzeDirectory('/non/existent/path');
      const text = formatStaticAnalysisAsText(result);

      expect(text).toContain('## Analysis Notes');
      expect(text).toContain('Error reading directory');
    });
  });
});
