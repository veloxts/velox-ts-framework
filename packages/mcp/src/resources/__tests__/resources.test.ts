/**
 * @veloxts/mcp - Resource Extractors Tests
 * Tests resource extraction functions with mocked dependencies
 */

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';

import type { ProcedureCollection } from '@veloxts/router';
import { discoverProceduresVerbose, getRouteSummary } from '@veloxts/router';
import { describe, expect, it, vi } from 'vitest';

import { getProceduresPath, getSchemasPath } from '../../utils/project.js';
import { getErrors, getErrorsByPrefix, searchErrors } from '../errors.js';
import { getProcedures, getProceduresByNamespace, getProceduresByType } from '../procedures.js';
import { getRoutes, getRoutesByMethod, getRoutesByNamespace } from '../routes.js';
import { getSchemas, searchSchemas } from '../schemas.js';

// Mock dependencies
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock('@veloxts/router', () => ({
  discoverProceduresVerbose: vi.fn(),
  getRouteSummary: vi.fn(),
}));

vi.mock('@veloxts/cli', () => ({
  extractSchemaNames: vi.fn(),
  extractSchemaTypes: vi.fn(),
  ERROR_CATALOG: {
    NOT_FOUND: {
      code: 'E1001',
      name: 'NotFound',
      message: 'Resource not found',
      fix: 'Check the resource ID',
      docsUrl: 'https://veloxts.dev/errors/E1001',
    },
    VALIDATION_ERROR: {
      code: 'E6001',
      name: 'ValidationError',
      message: 'Input validation failed',
      fix: 'Check your input data',
      docsUrl: 'https://veloxts.dev/errors/E6001',
    },
    UNAUTHORIZED: {
      code: 'E7001',
      name: 'Unauthorized',
      message: 'Authentication required',
      fix: 'Login to continue',
    },
  },
  getErrorsByCategory: vi.fn((prefix: string) => {
    const catalog = {
      NOT_FOUND: {
        code: 'E1001',
        name: 'NotFound',
        message: 'Resource not found',
        fix: 'Check the resource ID',
        docsUrl: 'https://veloxts.dev/errors/E1001',
      },
      VALIDATION_ERROR: {
        code: 'E6001',
        name: 'ValidationError',
        message: 'Input validation failed',
        fix: 'Check your input data',
        docsUrl: 'https://veloxts.dev/errors/E6001',
      },
      UNAUTHORIZED: {
        code: 'E7001',
        name: 'Unauthorized',
        message: 'Authentication required',
        fix: 'Login to continue',
      },
    };
    return Object.values(catalog).filter((err) => err.code.startsWith(prefix));
  }),
}));

vi.mock('../../utils/project.js', () => ({
  getProceduresPath: vi.fn(),
  getSchemasPath: vi.fn(),
}));

describe('Procedures Resource', () => {
  describe('getProcedures', () => {
    it('should return empty response when procedures path not found', async () => {
      vi.mocked(getProceduresPath).mockReturnValue(null);

      const result = await getProcedures('/project');

      expect(result).toEqual({
        procedures: [],
        namespaces: [],
        totalCount: 0,
        queries: 0,
        mutations: 0,
      });
    });

    it('should return empty response when discovery fails', async () => {
      vi.mocked(getProceduresPath).mockReturnValue('/project/src/procedures');
      vi.mocked(discoverProceduresVerbose).mockRejectedValue(new Error('Discovery failed'));

      const result = await getProcedures('/project');

      expect(result).toEqual({
        procedures: [],
        namespaces: [],
        totalCount: 0,
        queries: 0,
        mutations: 0,
      });
    });

    it('should extract procedure information from collections', async () => {
      vi.mocked(getProceduresPath).mockReturnValue('/project/src/procedures');

      const mockCollections: ProcedureCollection[] = [
        {
          namespace: 'users',
          procedures: {
            getUser: {
              type: 'query',
              inputSchema: {} as never,
              outputSchema: {} as never,
              guards: [],
              middlewares: [],
              handler: vi.fn() as never,
            },
            createUser: {
              type: 'mutation',
              inputSchema: {} as never,
              outputSchema: {} as never,
              guards: [vi.fn() as never],
              middlewares: [],
              handler: vi.fn() as never,
            },
          },
        },
      ];

      vi.mocked(discoverProceduresVerbose).mockResolvedValue({
        collections: mockCollections,
        scannedFiles: ['users.ts'],
        loadedFiles: ['users.ts'],
        warnings: [],
      });

      vi.mocked(getRouteSummary).mockReturnValue([
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
      ]);

      const result = await getProcedures('/project');

      expect(result.totalCount).toBe(2);
      expect(result.queries).toBe(1);
      expect(result.mutations).toBe(1);
      expect(result.namespaces).toEqual(['users']);
      expect(result.procedures).toHaveLength(2);

      const getUserProc = result.procedures.find((p) => p.name === 'getUser');
      expect(getUserProc).toMatchObject({
        name: 'getUser',
        namespace: 'users',
        type: 'query',
        hasInputSchema: true,
        hasOutputSchema: true,
        guardCount: 0,
        route: {
          method: 'GET',
          path: '/api/users/:id',
        },
      });

      const createUserProc = result.procedures.find((p) => p.name === 'createUser');
      expect(createUserProc).toMatchObject({
        name: 'createUser',
        namespace: 'users',
        type: 'mutation',
        guardCount: 1,
      });
    });

    it('should include discovery info', async () => {
      vi.mocked(getProceduresPath).mockReturnValue('/project/src/procedures');

      vi.mocked(discoverProceduresVerbose).mockResolvedValue({
        collections: [],
        scannedFiles: ['users.ts', 'posts.ts'],
        loadedFiles: ['users.ts'],
        warnings: ['Failed to load posts.ts'],
      });

      vi.mocked(getRouteSummary).mockReturnValue([]);

      const result = await getProcedures('/project');

      expect(result.discoveryInfo).toEqual({
        scannedFiles: 2,
        loadedFiles: 1,
        warnings: 1,
      });
    });
  });

  describe('getProceduresByNamespace', () => {
    it('should filter procedures by namespace', async () => {
      vi.mocked(getProceduresPath).mockReturnValue('/project/src/procedures');

      const mockCollections: ProcedureCollection[] = [
        {
          namespace: 'users',
          procedures: {
            getUser: {
              type: 'query',
              handler: vi.fn() as never,
            },
          },
        },
        {
          namespace: 'posts',
          procedures: {
            getPost: {
              type: 'query',
              handler: vi.fn() as never,
            },
          },
        },
      ];

      vi.mocked(discoverProceduresVerbose).mockResolvedValue({
        collections: mockCollections,
        scannedFiles: [],
        loadedFiles: [],
        warnings: [],
      });

      vi.mocked(getRouteSummary).mockReturnValue([]);

      const result = await getProceduresByNamespace('/project', 'users');

      expect(result).toHaveLength(1);
      expect(result[0].namespace).toBe('users');
      expect(result[0].name).toBe('getUser');
    });
  });

  describe('getProceduresByType', () => {
    it('should filter procedures by type', async () => {
      vi.mocked(getProceduresPath).mockReturnValue('/project/src/procedures');

      const mockCollections: ProcedureCollection[] = [
        {
          namespace: 'users',
          procedures: {
            getUser: {
              type: 'query',
              handler: vi.fn() as never,
            },
            createUser: {
              type: 'mutation',
              handler: vi.fn() as never,
            },
          },
        },
      ];

      vi.mocked(discoverProceduresVerbose).mockResolvedValue({
        collections: mockCollections,
        scannedFiles: [],
        loadedFiles: [],
        warnings: [],
      });

      vi.mocked(getRouteSummary).mockReturnValue([]);

      const queries = await getProceduresByType('/project', 'query');
      const mutations = await getProceduresByType('/project', 'mutation');

      expect(queries).toHaveLength(1);
      expect(queries[0].type).toBe('query');
      expect(mutations).toHaveLength(1);
      expect(mutations[0].type).toBe('mutation');
    });
  });
});

describe('Routes Resource', () => {
  describe('getRoutes', () => {
    it('should return empty response when procedures path not found', async () => {
      vi.mocked(getProceduresPath).mockReturnValue(null);

      const result = await getRoutes('/project');

      expect(result).toEqual({
        routes: [],
        totalCount: 0,
        byMethod: {},
        byNamespace: {},
      });
    });

    it('should return empty response when discovery fails', async () => {
      vi.mocked(getProceduresPath).mockReturnValue('/project/src/procedures');
      vi.mocked(discoverProceduresVerbose).mockRejectedValue(new Error('Failed'));

      const result = await getRoutes('/project');

      expect(result).toEqual({
        routes: [],
        totalCount: 0,
        byMethod: {},
        byNamespace: {},
      });
    });

    it('should extract route information from procedures', async () => {
      vi.mocked(getProceduresPath).mockReturnValue('/project/src/procedures');

      const mockCollections: ProcedureCollection[] = [
        {
          namespace: 'users',
          procedures: {
            getUser: { type: 'query', handler: vi.fn() as never },
            createUser: { type: 'mutation', handler: vi.fn() as never },
          },
        },
      ];

      vi.mocked(discoverProceduresVerbose).mockResolvedValue({
        collections: mockCollections,
        scannedFiles: [],
        loadedFiles: [],
        warnings: [],
      });

      vi.mocked(getRouteSummary).mockReturnValue([
        { method: 'GET', path: '/api/users/:id', namespace: 'users', procedure: 'getUser' },
        { method: 'POST', path: '/api/users', namespace: 'users', procedure: 'createUser' },
      ]);

      const result = await getRoutes('/project');

      expect(result.totalCount).toBe(2);
      expect(result.byMethod).toEqual({ GET: 1, POST: 1 });
      expect(result.byNamespace).toEqual({ users: 2 });
      expect(result.routes).toEqual([
        { method: 'GET', path: '/api/users/:id', namespace: 'users', procedure: 'getUser' },
        { method: 'POST', path: '/api/users', namespace: 'users', procedure: 'createUser' },
      ]);
    });

    it('should count routes by method and namespace', async () => {
      vi.mocked(getProceduresPath).mockReturnValue('/project/src/procedures');

      vi.mocked(discoverProceduresVerbose).mockResolvedValue({
        collections: [],
        scannedFiles: [],
        loadedFiles: [],
        warnings: [],
      });

      vi.mocked(getRouteSummary).mockReturnValue([
        { method: 'GET', path: '/api/users/:id', namespace: 'users', procedure: 'getUser' },
        { method: 'GET', path: '/api/users', namespace: 'users', procedure: 'listUsers' },
        { method: 'POST', path: '/api/posts', namespace: 'posts', procedure: 'createPost' },
      ]);

      const result = await getRoutes('/project');

      expect(result.byMethod).toEqual({ GET: 2, POST: 1 });
      expect(result.byNamespace).toEqual({ users: 2, posts: 1 });
    });
  });

  describe('getRoutesByMethod', () => {
    it('should filter routes by HTTP method', async () => {
      vi.mocked(getProceduresPath).mockReturnValue('/project/src/procedures');

      vi.mocked(discoverProceduresVerbose).mockResolvedValue({
        collections: [],
        scannedFiles: [],
        loadedFiles: [],
        warnings: [],
      });

      vi.mocked(getRouteSummary).mockReturnValue([
        { method: 'GET', path: '/api/users/:id', namespace: 'users', procedure: 'getUser' },
        { method: 'POST', path: '/api/users', namespace: 'users', procedure: 'createUser' },
      ]);

      const getRoutes = await getRoutesByMethod('/project', 'GET');
      const postRoutes = await getRoutesByMethod('/project', 'post'); // Test case insensitive

      expect(getRoutes).toHaveLength(1);
      expect(getRoutes[0].method).toBe('GET');
      expect(postRoutes).toHaveLength(1);
      expect(postRoutes[0].method).toBe('POST');
    });
  });

  describe('getRoutesByNamespace', () => {
    it('should filter routes by namespace', async () => {
      vi.mocked(getProceduresPath).mockReturnValue('/project/src/procedures');

      vi.mocked(discoverProceduresVerbose).mockResolvedValue({
        collections: [],
        scannedFiles: [],
        loadedFiles: [],
        warnings: [],
      });

      vi.mocked(getRouteSummary).mockReturnValue([
        { method: 'GET', path: '/api/users/:id', namespace: 'users', procedure: 'getUser' },
        { method: 'GET', path: '/api/posts/:id', namespace: 'posts', procedure: 'getPost' },
      ]);

      const userRoutes = await getRoutesByNamespace('/project', 'users');

      expect(userRoutes).toHaveLength(1);
      expect(userRoutes[0].namespace).toBe('users');
    });
  });
});

describe('Schemas Resource', () => {
  describe('getSchemas', () => {
    it('should return empty response when schemas path not found', async () => {
      vi.mocked(getSchemasPath).mockReturnValue(null);

      const result = await getSchemas('/project');

      expect(result).toEqual({
        schemas: [],
        totalCount: 0,
        files: [],
      });
    });

    it('should return empty response when schemas path does not exist', async () => {
      vi.mocked(getSchemasPath).mockReturnValue('/project/src/schemas');
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await getSchemas('/project');

      expect(result).toEqual({
        schemas: [],
        totalCount: 0,
        files: [],
      });
    });

    it('should scan and extract schema information', async () => {
      vi.mocked(getSchemasPath).mockReturnValue('/project/src/schemas');
      vi.mocked(existsSync).mockReturnValue(true);

      vi.mocked(readdir).mockResolvedValue([
        { name: 'user.ts', isFile: () => true, isDirectory: () => false } as never,
        { name: 'post.ts', isFile: () => true, isDirectory: () => false } as never,
      ]);

      vi.mocked(readFile).mockImplementation(async (path) => {
        if (typeof path === 'string' && path.includes('user.ts')) {
          return 'export const UserSchema = z.object({ id: z.string() });';
        }
        if (typeof path === 'string' && path.includes('post.ts')) {
          return 'export const PostSchema = z.object({ title: z.string() });';
        }
        return '';
      });

      // Mock extractSchemaNames and extractSchemaTypes from @veloxts/cli
      const { extractSchemaNames, extractSchemaTypes } = await import('@veloxts/cli');
      vi.mocked(extractSchemaNames).mockImplementation((content: string) => {
        if (content.includes('UserSchema')) return ['UserSchema'];
        if (content.includes('PostSchema')) return ['PostSchema'];
        return [];
      });

      vi.mocked(extractSchemaTypes).mockReturnValue(
        new Map([
          ['UserSchema', 'User'],
          ['PostSchema', 'Post'],
        ])
      );

      const result = await getSchemas('/project');

      expect(result.totalCount).toBe(2);
      expect(result.files).toEqual(['user.ts', 'post.ts']);
      expect(result.schemas).toHaveLength(2);
      expect(result.schemas).toContainEqual({
        name: 'UserSchema',
        file: 'user.ts',
        typeName: 'User',
      });
      expect(result.schemas).toContainEqual({
        name: 'PostSchema',
        file: 'post.ts',
        typeName: 'Post',
      });
    });

    it('should skip non-TypeScript files', async () => {
      vi.mocked(getSchemasPath).mockReturnValue('/project/src/schemas');
      vi.mocked(existsSync).mockReturnValue(true);

      vi.mocked(readdir).mockResolvedValue([
        { name: 'user.ts', isFile: () => true, isDirectory: () => false } as never,
        { name: 'README.md', isFile: () => true, isDirectory: () => false } as never,
        { name: 'test.test.ts', isFile: () => true, isDirectory: () => false } as never,
        { name: 'types.d.ts', isFile: () => true, isDirectory: () => false } as never,
      ]);

      vi.mocked(readFile).mockResolvedValue(
        'export const UserSchema = z.object({ id: z.string() });'
      );

      const { extractSchemaNames, extractSchemaTypes } = await import('@veloxts/cli');
      vi.mocked(extractSchemaNames).mockReturnValue(['UserSchema']);
      vi.mocked(extractSchemaTypes).mockReturnValue(new Map());

      const result = await getSchemas('/project');

      // Only user.ts should be processed
      expect(result.files).toEqual(['user.ts']);
    });

    it('should handle file read errors gracefully', async () => {
      vi.mocked(getSchemasPath).mockReturnValue('/project/src/schemas');
      vi.mocked(existsSync).mockReturnValue(true);

      vi.mocked(readdir).mockResolvedValue([
        { name: 'user.ts', isFile: () => true, isDirectory: () => false } as never,
        { name: 'error.ts', isFile: () => true, isDirectory: () => false } as never,
      ]);

      vi.mocked(readFile).mockImplementation(async (path) => {
        if (typeof path === 'string' && path.includes('error.ts')) {
          throw new Error('Permission denied');
        }
        return 'export const UserSchema = z.object({});';
      });

      const { extractSchemaNames, extractSchemaTypes } = await import('@veloxts/cli');
      vi.mocked(extractSchemaNames).mockReturnValue(['UserSchema']);
      vi.mocked(extractSchemaTypes).mockReturnValue(new Map());

      const result = await getSchemas('/project');

      expect(result.warnings).toBeDefined();
      expect(result.warnings).toContainEqual(expect.stringContaining('error.ts'));
      expect(result.files).toEqual(['user.ts']);
    });

    it('should handle directory read errors', async () => {
      vi.mocked(getSchemasPath).mockReturnValue('/project/src/schemas');
      vi.mocked(existsSync).mockReturnValue(true);

      vi.mocked(readdir).mockRejectedValue(new Error('Permission denied'));

      const result = await getSchemas('/project');

      expect(result.warnings).toBeDefined();
      expect(result.warnings).toContainEqual(expect.stringContaining('schemas directory'));
    });
  });

  describe('searchSchemas', () => {
    it('should search schemas by name, type, and file', async () => {
      vi.mocked(getSchemasPath).mockReturnValue('/project/src/schemas');
      vi.mocked(existsSync).mockReturnValue(true);

      vi.mocked(readdir).mockResolvedValue([
        { name: 'user.ts', isFile: () => true, isDirectory: () => false } as never,
      ]);

      vi.mocked(readFile).mockResolvedValue('export const UserSchema = z.object({});');

      const { extractSchemaNames, extractSchemaTypes } = await import('@veloxts/cli');
      vi.mocked(extractSchemaNames).mockReturnValue(['UserSchema', 'CreateUserSchema']);
      vi.mocked(extractSchemaTypes).mockReturnValue(
        new Map([
          ['UserSchema', 'User'],
          ['CreateUserSchema', 'CreateUser'],
        ])
      );

      const resultByName = await searchSchemas('/project', 'User');
      expect(resultByName).toHaveLength(2);

      const resultByType = await searchSchemas('/project', 'CreateUser');
      expect(resultByType).toHaveLength(1);
      expect(resultByType[0].name).toBe('CreateUserSchema');

      const resultByFile = await searchSchemas('/project', 'user.ts');
      expect(resultByFile).toHaveLength(2);
    });

    it('should perform case-insensitive search', async () => {
      vi.mocked(getSchemasPath).mockReturnValue('/project/src/schemas');
      vi.mocked(existsSync).mockReturnValue(true);

      vi.mocked(readdir).mockResolvedValue([
        { name: 'user.ts', isFile: () => true, isDirectory: () => false } as never,
      ]);

      vi.mocked(readFile).mockResolvedValue('export const UserSchema = z.object({});');

      const { extractSchemaNames, extractSchemaTypes } = await import('@veloxts/cli');
      vi.mocked(extractSchemaNames).mockReturnValue(['UserSchema']);
      vi.mocked(extractSchemaTypes).mockReturnValue(new Map([['UserSchema', 'User']]));

      const result = await searchSchemas('/project', 'USER');
      expect(result).toHaveLength(1);
    });
  });
});

describe('Errors Resource', () => {
  describe('getErrors', () => {
    it('should return all errors from catalog', () => {
      const result = getErrors();

      expect(result.totalCount).toBe(3);
      expect(result.errors).toHaveLength(3);
      expect(result.categories.length).toBeGreaterThan(0);
    });

    it('should categorize errors correctly', () => {
      const result = getErrors();

      const e1Error = result.errors.find((e) => e.code === 'E1001');
      expect(e1Error?.category).toBe('Core/Runtime');

      const e6Error = result.errors.find((e) => e.code === 'E6001');
      expect(e6Error?.category).toBe('Validation');

      const e7Error = result.errors.find((e) => e.code === 'E7001');
      expect(e7Error?.category).toBe('Authentication');
    });

    it('should include category counts', () => {
      const result = getErrors();

      const coreCategory = result.categories.find((c) => c.prefix === 'E1');
      expect(coreCategory?.count).toBe(1);

      const validationCategory = result.categories.find((c) => c.prefix === 'E6');
      expect(validationCategory?.count).toBe(1);
    });

    it('should include all error properties', () => {
      const result = getErrors();

      const error = result.errors.find((e) => e.code === 'E1001');
      expect(error).toMatchObject({
        code: 'E1001',
        name: 'NotFound',
        message: 'Resource not found',
        fix: 'Check the resource ID',
        docsUrl: 'https://veloxts.dev/errors/E1001',
        category: 'Core/Runtime',
      });
    });
  });

  describe('getErrorsByPrefix', () => {
    it('should filter errors by category prefix', () => {
      const e1Errors = getErrorsByPrefix('E1');
      expect(e1Errors).toHaveLength(1);
      expect(e1Errors[0].code).toBe('E1001');

      const e6Errors = getErrorsByPrefix('E6');
      expect(e6Errors).toHaveLength(1);
      expect(e6Errors[0].code).toBe('E6001');
    });

    it('should return empty array for unknown prefix', () => {
      const errors = getErrorsByPrefix('E9');
      expect(errors).toEqual([]);
    });
  });

  describe('searchErrors', () => {
    it('should search errors by code', () => {
      const result = searchErrors('E1001');
      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('E1001');
    });

    it('should search errors by name', () => {
      const result = searchErrors('NotFound');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('NotFound');
    });

    it('should search errors by message', () => {
      const result = searchErrors('validation');
      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('E6001');
    });

    it('should search errors by fix suggestion', () => {
      const result = searchErrors('resource ID');
      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('E1001');
    });

    it('should perform case-insensitive search', () => {
      const result = searchErrors('NOTFOUND');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('NotFound');
    });

    it('should return empty array when no matches', () => {
      const result = searchErrors('xyz123nonexistent');
      expect(result).toEqual([]);
    });
  });
});
