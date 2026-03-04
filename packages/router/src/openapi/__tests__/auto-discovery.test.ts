/**
 * Tests for swagger auto-discovery via the collection registry
 */

import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { defineProcedures, procedure } from '../../procedure/builder.js';
import { clearCollectionRegistry, registerCollections } from '../../rest/registry.js';
import { generateOpenApiSpec, generateOpenApiSpecFromRegistry } from '../generator.js';
import { getOpenApiSpec } from '../plugin.js';
import type { OpenAPIGeneratorOptions } from '../types.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const defaultOptions: OpenAPIGeneratorOptions = {
  info: { title: 'Test API', version: '1.0.0' },
};

const userProcedures = defineProcedures('users', {
  listUsers: procedure()
    .output(z.array(z.object({ id: z.string(), name: z.string() })))
    .query(async () => []),
  getUser: procedure()
    .input(z.object({ id: z.string() }))
    .output(z.object({ id: z.string(), name: z.string() }))
    .query(async ({ input }) => ({ id: input.id, name: 'Test' })),
});

const loterieProcedures = defineProcedures('results', {
  listResults: procedure()
    .output(z.array(z.object({ id: z.string(), numbers: z.array(z.number()) })))
    .query(async () => []),
});

const postProcedures = defineProcedures('posts', {
  createPost: procedure()
    .input(z.object({ title: z.string() }))
    .mutation(async ({ input }) => ({ id: '1', title: input.title })),
});

// ============================================================================
// generateOpenApiSpecFromRegistry
// ============================================================================

describe('generateOpenApiSpecFromRegistry', () => {
  afterEach(() => {
    clearCollectionRegistry();
  });

  it('generates correct paths with per-entry prefixes', () => {
    const entries = [
      { collection: userProcedures, prefix: '/api' },
      { collection: loterieProcedures, prefix: '/loterie' },
    ];

    const spec = generateOpenApiSpecFromRegistry(entries, defaultOptions);

    // Users under /api
    expect(spec.paths['/api/users']).toBeDefined();
    expect(spec.paths['/api/users/{id}']).toBeDefined();

    // Loterie under /loterie
    expect(spec.paths['/loterie/results']).toBeDefined();

    // Should NOT have cross-prefix paths
    expect(spec.paths['/api/results']).toBeUndefined();
    expect(spec.paths['/loterie/users']).toBeUndefined();
  });

  it('produces tags for all namespaces', () => {
    const entries = [
      { collection: userProcedures, prefix: '/api' },
      { collection: loterieProcedures, prefix: '/loterie' },
    ];

    const spec = generateOpenApiSpecFromRegistry(entries, defaultOptions);
    const tagNames = spec.tags?.map((t) => t.name) ?? [];

    expect(tagNames).toContain('users');
    expect(tagNames).toContain('results');
  });

  it('deduplicates tags when same namespace appears under different prefixes', () => {
    const usersApiV1 = defineProcedures('users', {
      listUsers: procedure().query(async () => []),
    });
    const usersApiV2 = defineProcedures('users', {
      listUsers: procedure().query(async () => []),
    });

    const entries = [
      { collection: usersApiV1, prefix: '/v1' },
      { collection: usersApiV2, prefix: '/v2' },
    ];

    const spec = generateOpenApiSpecFromRegistry(entries, defaultOptions);
    const usersTags = spec.tags?.filter((t) => t.name === 'users') ?? [];

    expect(usersTags).toHaveLength(1);
  });

  it('returns empty paths for empty entries', () => {
    const spec = generateOpenApiSpecFromRegistry([], defaultOptions);

    expect(Object.keys(spec.paths)).toHaveLength(0);
  });

  it('generates correct operation IDs per namespace', () => {
    const entries = [
      { collection: userProcedures, prefix: '/api' },
      { collection: postProcedures, prefix: '/api' },
    ];

    const spec = generateOpenApiSpecFromRegistry(entries, defaultOptions);

    expect(spec.paths['/api/users']?.get?.operationId).toBe('users_listUsers');
    expect(spec.paths['/api/posts']?.post?.operationId).toBe('posts_createPost');
  });
});

// ============================================================================
// Backward compatibility: generateOpenApiSpec delegates correctly
// ============================================================================

describe('generateOpenApiSpec backward compatibility', () => {
  it('uses options.prefix for all collections', () => {
    const spec = generateOpenApiSpec([userProcedures, loterieProcedures], {
      ...defaultOptions,
      prefix: '/api',
    });

    // Both use the single /api prefix
    expect(spec.paths['/api/users']).toBeDefined();
    expect(spec.paths['/api/results']).toBeDefined();
  });

  it('defaults to /api when prefix omitted', () => {
    const spec = generateOpenApiSpec([userProcedures], defaultOptions);

    expect(spec.paths['/api/users']).toBeDefined();
  });
});

// ============================================================================
// Auto-discovery via getOpenApiSpec / swaggerPlugin options
// ============================================================================

describe('auto-discovery via getOpenApiSpec', () => {
  afterEach(() => {
    clearCollectionRegistry();
  });

  it('uses registry when collections is omitted', () => {
    registerCollections([userProcedures], '/api');
    registerCollections([loterieProcedures], '/loterie');

    const spec = getOpenApiSpec({
      openapi: defaultOptions,
    });

    expect(spec.paths['/api/users']).toBeDefined();
    expect(spec.paths['/api/users/{id}']).toBeDefined();
    expect(spec.paths['/loterie/results']).toBeDefined();
  });

  it('uses registry when collections is empty array', () => {
    registerCollections([userProcedures], '/api');

    const spec = getOpenApiSpec({
      openapi: defaultOptions,
      collections: [],
    });

    // Empty array triggers auto-discovery
    expect(spec.paths['/api/users']).toBeDefined();
  });

  it('prefers explicit collections over registry', () => {
    registerCollections([userProcedures], '/api');
    registerCollections([loterieProcedures], '/loterie');

    const spec = getOpenApiSpec({
      openapi: { ...defaultOptions, prefix: '/api' },
      collections: [userProcedures],
    });

    // Only explicit collection should appear
    expect(spec.paths['/api/users']).toBeDefined();
    // Registry-only collection should NOT appear
    expect(spec.paths['/loterie/results']).toBeUndefined();
  });

  it('returns empty spec when nothing registered and no collections', () => {
    const spec = getOpenApiSpec({
      openapi: defaultOptions,
    });

    expect(Object.keys(spec.paths)).toHaveLength(0);
  });
});
