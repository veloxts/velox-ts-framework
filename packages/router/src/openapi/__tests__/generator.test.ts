/**
 * Tests for generator module
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { defineProcedures, procedure } from '../../procedure/builder.js';
import { generateOpenApiSpec, getOpenApiRouteSummary, validateOpenApiSpec } from '../generator.js';

// Create test procedure collections
const userProcedures = defineProcedures('users', {
  getUser: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        email: z.string().email(),
      })
    )
    .query(async ({ input }) => ({
      id: input.id,
      name: 'Test User',
      email: 'test@example.com',
    })),

  listUsers: procedure()
    .input(
      z.object({
        page: z.number().optional(),
        limit: z.number().optional(),
      })
    )
    .output(
      z.array(
        z.object({
          id: z.string().uuid(),
          name: z.string(),
        })
      )
    )
    .query(async () => []),

  createUser: procedure()
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
      })
    )
    .output(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        email: z.string().email(),
      })
    )
    .mutation(async ({ input }) => ({
      id: 'new-id',
      name: input.name,
      email: input.email,
    })),

  updateUser: procedure()
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().optional(),
        email: z.string().email().optional(),
      })
    )
    .mutation(async ({ input }) => ({
      id: input.id,
      name: input.name ?? 'Updated',
      email: input.email ?? 'updated@example.com',
    })),

  deleteUser: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async () => undefined),
});

// Create protected procedure collection
const adminProcedures = defineProcedures('admin', {
  listStats: procedure()
    .guard({ name: 'authenticated', check: () => true })
    .output(z.array(z.object({ count: z.number() })))
    .query(async () => [{ count: 100 }]),

  deleteUser: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .guard({ name: 'hasRole:admin', check: () => true })
    .mutation(async () => undefined),
});

describe('generator', () => {
  describe('generateOpenApiSpec', () => {
    it('generates valid OpenAPI 3.0.3 spec', () => {
      const spec = generateOpenApiSpec([userProcedures], {
        info: { title: 'Test API', version: '1.0.0' },
      });

      expect(spec.openapi).toBe('3.0.3');
      expect(spec.info.title).toBe('Test API');
      expect(spec.info.version).toBe('1.0.0');
    });

    it('includes paths for all procedures', () => {
      const spec = generateOpenApiSpec([userProcedures], {
        info: { title: 'Test API', version: '1.0.0' },
      });

      expect(spec.paths['/api/users/{id}']).toBeDefined();
      expect(spec.paths['/api/users']).toBeDefined();
    });

    it('uses correct HTTP methods', () => {
      const spec = generateOpenApiSpec([userProcedures], {
        info: { title: 'Test API', version: '1.0.0' },
      });

      // GET /users/:id
      expect(spec.paths['/api/users/{id}']?.get).toBeDefined();
      // GET /users
      expect(spec.paths['/api/users']?.get).toBeDefined();
      // POST /users
      expect(spec.paths['/api/users']?.post).toBeDefined();
      // PUT /users/:id
      expect(spec.paths['/api/users/{id}']?.put).toBeDefined();
      // DELETE /users/:id
      expect(spec.paths['/api/users/{id}']?.delete).toBeDefined();
    });

    it('generates operation IDs', () => {
      const spec = generateOpenApiSpec([userProcedures], {
        info: { title: 'Test API', version: '1.0.0' },
      });

      const getUser = spec.paths['/api/users/{id}']?.get;
      expect(getUser?.operationId).toBe('users_getUser');
    });

    it('generates summaries from procedure names', () => {
      const spec = generateOpenApiSpec([userProcedures], {
        info: { title: 'Test API', version: '1.0.0' },
      });

      const getUser = spec.paths['/api/users/{id}']?.get;
      expect(getUser?.summary).toBe('Get User');
    });

    it('includes tags from namespace', () => {
      const spec = generateOpenApiSpec([userProcedures], {
        info: { title: 'Test API', version: '1.0.0' },
      });

      expect(spec.tags).toContainEqual({ name: 'users', description: undefined });
      const getUser = spec.paths['/api/users/{id}']?.get;
      expect(getUser?.tags).toContain('users');
    });

    it('includes tag descriptions', () => {
      const spec = generateOpenApiSpec([userProcedures], {
        info: { title: 'Test API', version: '1.0.0' },
        tagDescriptions: { users: 'User management' },
      });

      expect(spec.tags).toContainEqual({
        name: 'users',
        description: 'User management',
      });
    });

    it('includes path parameters', () => {
      const spec = generateOpenApiSpec([userProcedures], {
        info: { title: 'Test API', version: '1.0.0' },
      });

      const getUser = spec.paths['/api/users/{id}']?.get;
      const idParam = getUser?.parameters?.find((p) => p.name === 'id');
      expect(idParam).toBeDefined();
      expect(idParam?.in).toBe('path');
      expect(idParam?.required).toBe(true);
    });

    it('includes query parameters for GET', () => {
      const spec = generateOpenApiSpec([userProcedures], {
        info: { title: 'Test API', version: '1.0.0' },
      });

      const listUsers = spec.paths['/api/users']?.get;
      const pageParam = listUsers?.parameters?.find((p) => p.name === 'page');
      expect(pageParam).toBeDefined();
      expect(pageParam?.in).toBe('query');
    });

    it('includes request body for POST', () => {
      const spec = generateOpenApiSpec([userProcedures], {
        info: { title: 'Test API', version: '1.0.0' },
      });

      const createUser = spec.paths['/api/users']?.post;
      expect(createUser?.requestBody).toBeDefined();
      expect(createUser?.requestBody?.content['application/json']).toBeDefined();
    });

    it('uses 201 for POST', () => {
      const spec = generateOpenApiSpec([userProcedures], {
        info: { title: 'Test API', version: '1.0.0' },
      });

      const createUser = spec.paths['/api/users']?.post;
      expect(createUser?.responses['201']).toBeDefined();
    });

    it('uses 204 for DELETE', () => {
      const spec = generateOpenApiSpec([userProcedures], {
        info: { title: 'Test API', version: '1.0.0' },
      });

      const deleteUser = spec.paths['/api/users/{id}']?.delete;
      expect(deleteUser?.responses['204']).toBeDefined();
    });

    it('includes error responses', () => {
      const spec = generateOpenApiSpec([userProcedures], {
        info: { title: 'Test API', version: '1.0.0' },
      });

      const getUser = spec.paths['/api/users/{id}']?.get;
      expect(getUser?.responses['400']).toBeDefined();
      expect(getUser?.responses['404']).toBeDefined();
      expect(getUser?.responses['500']).toBeDefined();
    });

    it('includes security schemes for protected routes', () => {
      const spec = generateOpenApiSpec([adminProcedures], {
        info: { title: 'Test API', version: '1.0.0' },
      });

      expect(spec.components?.securitySchemes?.bearerAuth).toBeDefined();
    });

    it('includes security requirements for protected operations', () => {
      const spec = generateOpenApiSpec([adminProcedures], {
        info: { title: 'Test API', version: '1.0.0' },
      });

      const listStats = spec.paths['/api/admin']?.get;
      expect(listStats?.security).toBeDefined();
      expect(listStats?.security).toContainEqual({ bearerAuth: [] });
    });

    it('includes 401 and 403 for protected routes', () => {
      const spec = generateOpenApiSpec([adminProcedures], {
        info: { title: 'Test API', version: '1.0.0' },
      });

      const listStats = spec.paths['/api/admin']?.get;
      expect(listStats?.responses['401']).toBeDefined();
      expect(listStats?.responses['403']).toBeDefined();
    });

    it('uses custom prefix', () => {
      const spec = generateOpenApiSpec([userProcedures], {
        info: { title: 'Test API', version: '1.0.0' },
        prefix: '/v1',
      });

      expect(spec.paths['/v1/users/{id}']).toBeDefined();
    });

    it('includes servers', () => {
      const spec = generateOpenApiSpec([userProcedures], {
        info: { title: 'Test API', version: '1.0.0' },
        servers: [
          { url: 'http://localhost:3030', description: 'Local' },
          { url: 'https://api.example.com', description: 'Production' },
        ],
      });

      expect(spec.servers).toHaveLength(2);
      expect(spec.servers?.[0].url).toBe('http://localhost:3030');
    });

    it('includes description in info', () => {
      const spec = generateOpenApiSpec([userProcedures], {
        info: {
          title: 'Test API',
          version: '1.0.0',
          description: 'A test API',
        },
      });

      expect(spec.info.description).toBe('A test API');
    });

    it('includes external docs', () => {
      const spec = generateOpenApiSpec([userProcedures], {
        info: { title: 'Test API', version: '1.0.0' },
        externalDocs: {
          url: 'https://docs.example.com',
          description: 'API Documentation',
        },
      });

      expect(spec.externalDocs?.url).toBe('https://docs.example.com');
    });

    it('includes default security', () => {
      const spec = generateOpenApiSpec([userProcedures], {
        info: { title: 'Test API', version: '1.0.0' },
        defaultSecurity: [{ bearerAuth: [] }],
      });

      expect(spec.security).toContainEqual({ bearerAuth: [] });
    });

    it('combines multiple collections', () => {
      const spec = generateOpenApiSpec([userProcedures, adminProcedures], {
        info: { title: 'Test API', version: '1.0.0' },
      });

      expect(spec.tags).toContainEqual({ name: 'users', description: undefined });
      expect(spec.tags).toContainEqual({ name: 'admin', description: undefined });
      expect(spec.paths['/api/users/{id}']).toBeDefined();
      expect(spec.paths['/api/admin']).toBeDefined();
    });
  });

  describe('getOpenApiRouteSummary', () => {
    it('returns route summaries', () => {
      const routes = getOpenApiRouteSummary([userProcedures]);

      expect(routes).toContainEqual({
        method: 'GET',
        path: '/api/users/{id}',
        operationId: 'users_getUser',
        namespace: 'users',
      });
    });

    it('uses custom prefix', () => {
      const routes = getOpenApiRouteSummary([userProcedures], '/v2');

      const getUser = routes.find((r) => r.operationId === 'users_getUser');
      expect(getUser?.path).toBe('/v2/users/{id}');
    });
  });

  describe('validateOpenApiSpec', () => {
    it('returns empty array for valid spec', () => {
      const spec = generateOpenApiSpec([userProcedures], {
        info: { title: 'Test API', version: '1.0.0' },
      });

      const warnings = validateOpenApiSpec(spec);
      expect(warnings).toEqual([]);
    });

    it('warns about empty paths', () => {
      const spec = generateOpenApiSpec([], {
        info: { title: 'Test API', version: '1.0.0' },
      });

      const warnings = validateOpenApiSpec(spec);
      expect(warnings).toContain('OpenAPI spec has no paths defined');
    });

    it('warns about missing title', () => {
      const spec = {
        openapi: '3.0.3' as const,
        info: { title: '', version: '1.0.0' },
        paths: { '/test': { get: { responses: {} } } },
      };

      const warnings = validateOpenApiSpec(spec);
      expect(warnings).toContain('OpenAPI spec is missing info.title');
    });

    it('warns about missing version', () => {
      const spec = {
        openapi: '3.0.3' as const,
        info: { title: 'Test', version: '' },
        paths: { '/test': { get: { responses: {} } } },
      };

      const warnings = validateOpenApiSpec(spec);
      expect(warnings).toContain('OpenAPI spec is missing info.version');
    });

    it('warns about duplicate operationIds', () => {
      const spec = {
        openapi: '3.0.3' as const,
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/test1': { get: { operationId: 'duplicate', responses: {} } },
          '/test2': { get: { operationId: 'duplicate', responses: {} } },
        },
      };

      const warnings = validateOpenApiSpec(spec);
      expect(warnings).toContain('Duplicate operationId: duplicate');
    });
  });
});
