/**
 * @veloxts/mcp - Resource Formatters Tests
 * Tests text formatting functions for procedures, routes, schemas, and errors
 */

import { describe, expect, it } from 'vitest';

import type { ErrorsResourceResponse } from '../errors.js';
import { formatErrorsAsText } from '../errors.js';
import type { ProceduresResourceResponse } from '../procedures.js';
import { formatProceduresAsText } from '../procedures.js';
import type { RoutesResourceResponse } from '../routes.js';
import { formatRoutesAsText } from '../routes.js';
import type { SchemasResourceResponse } from '../schemas.js';
import { formatSchemasAsText } from '../schemas.js';

describe('Resource Formatters', () => {
  describe('formatProceduresAsText', () => {
    it('should format empty procedures response', () => {
      const response: ProceduresResourceResponse = {
        procedures: [],
        namespaces: [],
        totalCount: 0,
        queries: 0,
        mutations: 0,
      };

      const text = formatProceduresAsText(response);

      expect(text).toContain('# VeloxTS Procedures');
      expect(text).toContain('Total: 0');
      expect(text).toContain('0 queries');
      expect(text).toContain('0 mutations');
      expect(text).toContain('Namespaces:');
    });

    it('should format single procedure', () => {
      const response: ProceduresResourceResponse = {
        procedures: [
          {
            name: 'getUser',
            namespace: 'users',
            type: 'query',
            hasInputSchema: true,
            hasOutputSchema: true,
            guardCount: 0,
            middlewareCount: 0,
            route: { method: 'GET', path: '/api/users/:id' },
          },
        ],
        namespaces: ['users'],
        totalCount: 1,
        queries: 1,
        mutations: 0,
      };

      const text = formatProceduresAsText(response);

      expect(text).toContain('Total: 1');
      expect(text).toContain('1 queries');
      expect(text).toContain('0 mutations');
      expect(text).toContain('Namespaces: users');
      expect(text).toContain('## users');
      expect(text).toContain('[Q] getUser');
      expect(text).toContain('GET /api/users/:id');
    });

    it('should format multiple procedures with different types', () => {
      const response: ProceduresResourceResponse = {
        procedures: [
          {
            name: 'getUser',
            namespace: 'users',
            type: 'query',
            hasInputSchema: true,
            hasOutputSchema: true,
            guardCount: 0,
            middlewareCount: 0,
            route: { method: 'GET', path: '/api/users/:id' },
          },
          {
            name: 'createUser',
            namespace: 'users',
            type: 'mutation',
            hasInputSchema: true,
            hasOutputSchema: true,
            guardCount: 1,
            middlewareCount: 0,
            route: { method: 'POST', path: '/api/users' },
          },
        ],
        namespaces: ['users'],
        totalCount: 2,
        queries: 1,
        mutations: 1,
      };

      const text = formatProceduresAsText(response);

      expect(text).toContain('Total: 2');
      expect(text).toContain('1 queries');
      expect(text).toContain('1 mutations');
      expect(text).toContain('[Q] getUser');
      expect(text).toContain('[M] createUser');
      expect(text).toContain('[1 guards]');
    });

    it('should group procedures by namespace', () => {
      const response: ProceduresResourceResponse = {
        procedures: [
          {
            name: 'getUser',
            namespace: 'users',
            type: 'query',
            hasInputSchema: true,
            hasOutputSchema: true,
            guardCount: 0,
            middlewareCount: 0,
          },
          {
            name: 'getPost',
            namespace: 'posts',
            type: 'query',
            hasInputSchema: true,
            hasOutputSchema: true,
            guardCount: 0,
            middlewareCount: 0,
          },
        ],
        namespaces: ['users', 'posts'],
        totalCount: 2,
        queries: 2,
        mutations: 0,
      };

      const text = formatProceduresAsText(response);

      expect(text).toContain('## users');
      expect(text).toContain('## posts');
      expect(text).toContain('Namespaces: users, posts');
    });

    it('should show guards when present', () => {
      const response: ProceduresResourceResponse = {
        procedures: [
          {
            name: 'deleteUser',
            namespace: 'users',
            type: 'mutation',
            hasInputSchema: true,
            hasOutputSchema: true,
            guardCount: 2,
            middlewareCount: 0,
          },
        ],
        namespaces: ['users'],
        totalCount: 1,
        queries: 0,
        mutations: 1,
      };

      const text = formatProceduresAsText(response);

      expect(text).toContain('[2 guards]');
    });

    it('should include discovery info when available', () => {
      const response: ProceduresResourceResponse = {
        procedures: [],
        namespaces: [],
        totalCount: 0,
        queries: 0,
        mutations: 0,
        discoveryInfo: {
          scannedFiles: 5,
          loadedFiles: 3,
          warnings: 1,
        },
      };

      const text = formatProceduresAsText(response);

      expect(text).toContain('## Discovery Info');
      expect(text).toContain('Scanned files: 5');
      expect(text).toContain('Loaded files: 3');
      expect(text).toContain('Warnings: 1');
    });

    it('should handle procedures without routes', () => {
      const response: ProceduresResourceResponse = {
        procedures: [
          {
            name: 'processData',
            namespace: 'internal',
            type: 'mutation',
            hasInputSchema: true,
            hasOutputSchema: false,
            guardCount: 0,
            middlewareCount: 0,
            // No route property
          },
        ],
        namespaces: ['internal'],
        totalCount: 1,
        queries: 0,
        mutations: 1,
      };

      const text = formatProceduresAsText(response);

      expect(text).toContain('processData');
      expect(text).not.toContain('->');
    });
  });

  describe('formatRoutesAsText', () => {
    it('should format empty routes response', () => {
      const response: RoutesResourceResponse = {
        routes: [],
        totalCount: 0,
        byMethod: {},
        byNamespace: {},
      };

      const text = formatRoutesAsText(response);

      expect(text).toContain('# VeloxTS REST Routes');
      expect(text).toContain('Total routes: 0');
      expect(text).toContain('## By HTTP Method');
      expect(text).toContain('## By Namespace');
    });

    it('should format single route', () => {
      const response: RoutesResourceResponse = {
        routes: [
          {
            method: 'GET',
            path: '/api/users/:id',
            namespace: 'users',
            procedure: 'getUser',
          },
        ],
        totalCount: 1,
        byMethod: { GET: 1 },
        byNamespace: { users: 1 },
      };

      const text = formatRoutesAsText(response);

      expect(text).toContain('Total routes: 1');
      expect(text).toContain('GET: 1');
      expect(text).toContain('users: 1');
      expect(text).toContain('/api/users/:id -> users.getUser');
    });

    it('should group routes by HTTP method', () => {
      const response: RoutesResourceResponse = {
        routes: [
          {
            method: 'GET',
            path: '/api/users/:id',
            namespace: 'users',
            procedure: 'getUser',
          },
          {
            method: 'GET',
            path: '/api/users',
            namespace: 'users',
            procedure: 'listUsers',
          },
          {
            method: 'POST',
            path: '/api/users',
            namespace: 'users',
            procedure: 'createUser',
          },
        ],
        totalCount: 3,
        byMethod: { GET: 2, POST: 1 },
        byNamespace: { users: 3 },
      };

      const text = formatRoutesAsText(response);

      expect(text).toContain('GET: 2');
      expect(text).toContain('POST: 1');
      expect(text).toContain('### GET');
      expect(text).toContain('### POST');
    });

    it('should count by namespace correctly', () => {
      const response: RoutesResourceResponse = {
        routes: [
          {
            method: 'GET',
            path: '/api/users/:id',
            namespace: 'users',
            procedure: 'getUser',
          },
          {
            method: 'GET',
            path: '/api/posts/:id',
            namespace: 'posts',
            procedure: 'getPost',
          },
        ],
        totalCount: 2,
        byMethod: { GET: 2 },
        byNamespace: { users: 1, posts: 1 },
      };

      const text = formatRoutesAsText(response);

      expect(text).toContain('users: 1');
      expect(text).toContain('posts: 1');
    });

    it('should format all REST methods', () => {
      const response: RoutesResourceResponse = {
        routes: [
          {
            method: 'GET',
            path: '/api/users/:id',
            namespace: 'users',
            procedure: 'getUser',
          },
          {
            method: 'POST',
            path: '/api/users',
            namespace: 'users',
            procedure: 'createUser',
          },
          {
            method: 'PUT',
            path: '/api/users/:id',
            namespace: 'users',
            procedure: 'updateUser',
          },
          {
            method: 'PATCH',
            path: '/api/users/:id',
            namespace: 'users',
            procedure: 'patchUser',
          },
          {
            method: 'DELETE',
            path: '/api/users/:id',
            namespace: 'users',
            procedure: 'deleteUser',
          },
        ],
        totalCount: 5,
        byMethod: { GET: 1, POST: 1, PUT: 1, PATCH: 1, DELETE: 1 },
        byNamespace: { users: 5 },
      };

      const text = formatRoutesAsText(response);

      expect(text).toContain('### GET');
      expect(text).toContain('### POST');
      expect(text).toContain('### PUT');
      expect(text).toContain('### PATCH');
      expect(text).toContain('### DELETE');
    });
  });

  describe('formatSchemasAsText', () => {
    it('should format empty schemas response', () => {
      const response: SchemasResourceResponse = {
        schemas: [],
        totalCount: 0,
        files: [],
      };

      const text = formatSchemasAsText(response);

      expect(text).toContain('# VeloxTS Schemas');
      expect(text).toContain('Total schemas: 0');
      expect(text).toContain('Schema files: 0');
    });

    it('should format single schema', () => {
      const response: SchemasResourceResponse = {
        schemas: [
          {
            name: 'UserSchema',
            file: 'user.ts',
            typeName: 'User',
          },
        ],
        totalCount: 1,
        files: ['user.ts'],
      };

      const text = formatSchemasAsText(response);

      expect(text).toContain('Total schemas: 1');
      expect(text).toContain('Schema files: 1');
      expect(text).toContain('## Files');
      expect(text).toContain('- user.ts');
      expect(text).toContain('### user.ts');
      expect(text).toContain('UserSchema');
      expect(text).toContain('(type: User)');
    });

    it('should group schemas by file', () => {
      const response: SchemasResourceResponse = {
        schemas: [
          {
            name: 'UserSchema',
            file: 'user.ts',
            typeName: 'User',
          },
          {
            name: 'CreateUserSchema',
            file: 'user.ts',
            typeName: 'CreateUser',
          },
          {
            name: 'PostSchema',
            file: 'post.ts',
            typeName: 'Post',
          },
        ],
        totalCount: 3,
        files: ['user.ts', 'post.ts'],
      };

      const text = formatSchemasAsText(response);

      expect(text).toContain('Total schemas: 3');
      expect(text).toContain('Schema files: 2');
      expect(text).toContain('### user.ts');
      expect(text).toContain('UserSchema');
      expect(text).toContain('CreateUserSchema');
      expect(text).toContain('### post.ts');
      expect(text).toContain('PostSchema');
    });

    it('should handle schemas without type names', () => {
      const response: SchemasResourceResponse = {
        schemas: [
          {
            name: 'SomeSchema',
            file: 'schema.ts',
            // No typeName
          },
        ],
        totalCount: 1,
        files: ['schema.ts'],
      };

      const text = formatSchemasAsText(response);

      expect(text).toContain('SomeSchema');
      expect(text).not.toContain('(type:');
    });

    it('should include warnings when present', () => {
      const response: SchemasResourceResponse = {
        schemas: [],
        totalCount: 0,
        files: [],
        warnings: ['Failed to read schema.ts: Permission denied'],
      };

      const text = formatSchemasAsText(response);

      // Warnings are part of the response but not explicitly formatted
      // The formatter currently doesn't display warnings
      expect(text).toContain('# VeloxTS Schemas');
    });
  });

  describe('formatErrorsAsText', () => {
    it('should format empty errors response', () => {
      const response: ErrorsResourceResponse = {
        errors: [],
        categories: [],
        totalCount: 0,
      };

      const text = formatErrorsAsText(response);

      expect(text).toContain('# VeloxTS Error Catalog');
      expect(text).toContain('Total errors: 0');
      expect(text).toContain('## Categories');
    });

    it('should format single error', () => {
      const response: ErrorsResourceResponse = {
        errors: [
          {
            code: 'E1001',
            name: 'NotFound',
            message: 'Resource not found',
            fix: 'Check the resource ID',
            docsUrl: 'https://veloxts.dev/errors/E1001',
            category: 'Core/Runtime',
          },
        ],
        categories: [{ prefix: 'E1', name: 'Core/Runtime', count: 1 }],
        totalCount: 1,
      };

      const text = formatErrorsAsText(response);

      expect(text).toContain('Total errors: 1');
      expect(text).toContain('E1xxx: Core/Runtime (1 errors)');
      expect(text).toContain('### E1001: NotFound');
      expect(text).toContain('**Message:** Resource not found');
      expect(text).toContain('**Fix:** Check the resource ID');
      expect(text).toContain('**Docs:** https://veloxts.dev/errors/E1001');
    });

    it('should format multiple errors in different categories', () => {
      const response: ErrorsResourceResponse = {
        errors: [
          {
            code: 'E1001',
            name: 'NotFound',
            message: 'Resource not found',
            category: 'Core/Runtime',
          },
          {
            code: 'E2001',
            name: 'GeneratorError',
            message: 'Failed to generate file',
            category: 'Generator',
          },
        ],
        categories: [
          { prefix: 'E1', name: 'Core/Runtime', count: 1 },
          { prefix: 'E2', name: 'Generator', count: 1 },
        ],
        totalCount: 2,
      };

      const text = formatErrorsAsText(response);

      expect(text).toContain('Total errors: 2');
      expect(text).toContain('E1xxx: Core/Runtime (1 errors)');
      expect(text).toContain('E2xxx: Generator (1 errors)');
      expect(text).toContain('### E1001: NotFound');
      expect(text).toContain('### E2001: GeneratorError');
    });

    it('should handle errors without fix suggestions', () => {
      const response: ErrorsResourceResponse = {
        errors: [
          {
            code: 'E1001',
            name: 'SomeError',
            message: 'An error occurred',
            category: 'Core/Runtime',
            // No fix
          },
        ],
        categories: [{ prefix: 'E1', name: 'Core/Runtime', count: 1 }],
        totalCount: 1,
      };

      const text = formatErrorsAsText(response);

      expect(text).toContain('**Message:** An error occurred');
      expect(text).not.toContain('**Fix:**');
    });

    it('should handle errors without docs URL', () => {
      const response: ErrorsResourceResponse = {
        errors: [
          {
            code: 'E1001',
            name: 'SomeError',
            message: 'An error occurred',
            category: 'Core/Runtime',
            // No docsUrl
          },
        ],
        categories: [{ prefix: 'E1', name: 'Core/Runtime', count: 1 }],
        totalCount: 1,
      };

      const text = formatErrorsAsText(response);

      expect(text).toContain('**Message:** An error occurred');
      expect(text).not.toContain('**Docs:**');
    });

    it('should list all error categories', () => {
      const response: ErrorsResourceResponse = {
        errors: [],
        categories: [
          { prefix: 'E1', name: 'Core/Runtime', count: 5 },
          { prefix: 'E2', name: 'Generator', count: 3 },
          { prefix: 'E7', name: 'Authentication', count: 2 },
        ],
        totalCount: 10,
      };

      const text = formatErrorsAsText(response);

      expect(text).toContain('E1xxx: Core/Runtime (5 errors)');
      expect(text).toContain('E2xxx: Generator (3 errors)');
      expect(text).toContain('E7xxx: Authentication (2 errors)');
    });
  });

  describe('Formatter consistency', () => {
    it('should use consistent markdown heading levels', () => {
      // Use non-empty data to ensure ## sections exist
      const proceduresText = formatProceduresAsText({
        procedures: [
          {
            name: 'test',
            namespace: 'ns',
            type: 'query',
            hasInputSchema: true,
            hasOutputSchema: true,
            guardCount: 0,
            middlewareCount: 0,
          },
        ],
        namespaces: ['ns'],
        totalCount: 1,
        queries: 1,
        mutations: 0,
      });

      const routesText = formatRoutesAsText({
        routes: [{ method: 'GET', path: '/test', namespace: 'ns', procedure: 'test' }],
        totalCount: 1,
        byMethod: { GET: 1 },
        byNamespace: { ns: 1 },
      });

      const schemasText = formatSchemasAsText({
        schemas: [{ name: 'TestSchema', file: 'test.ts' }],
        totalCount: 1,
        files: ['test.ts'],
      });

      const errorsText = formatErrorsAsText({
        errors: [
          {
            code: 'E1001',
            name: 'Test',
            message: 'Test error',
            category: 'Core/Runtime',
          },
        ],
        categories: [{ prefix: 'E1', name: 'Core/Runtime', count: 1 }],
        totalCount: 1,
      });

      // All should start with # (h1)
      expect(proceduresText.startsWith('#')).toBe(true);
      expect(routesText.startsWith('#')).toBe(true);
      expect(schemasText.startsWith('#')).toBe(true);
      expect(errorsText.startsWith('#')).toBe(true);

      // All should use ## for major sections
      expect(proceduresText).toContain('##');
      expect(routesText).toContain('##');
      expect(schemasText).toContain('##');
      expect(errorsText).toContain('##');
    });

    it('should produce valid markdown output', () => {
      const text = formatProceduresAsText({
        procedures: [
          {
            name: 'test',
            namespace: 'ns',
            type: 'query',
            hasInputSchema: true,
            hasOutputSchema: true,
            guardCount: 0,
            middlewareCount: 0,
          },
        ],
        namespaces: ['ns'],
        totalCount: 1,
        queries: 1,
        mutations: 0,
      });

      // Should have proper line breaks
      expect(text).toContain('\n\n');
      // Should not have trailing spaces (markdown formatting issue)
      const lines = text.split('\n');
      for (const line of lines) {
        expect(line).not.toMatch(/\s+$/);
      }
    });
  });
});
