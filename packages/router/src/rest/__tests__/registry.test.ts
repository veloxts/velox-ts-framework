/**
 * Tests for the collection registry
 */

import { afterEach, describe, expect, it } from 'vitest';

import { defineProcedures, procedure } from '../../procedure/builder.js';
import {
  clearCollectionRegistry,
  getRegisteredCollections,
  registerCollections,
} from '../registry.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const userProcedures = defineProcedures('users', {
  listUsers: procedure().query(async () => []),
});

const postProcedures = defineProcedures('posts', {
  listPosts: procedure().query(async () => []),
});

const loterieProcedures = defineProcedures('results', {
  listResults: procedure().query(async () => []),
});

// ============================================================================
// Tests
// ============================================================================

describe('collection registry', () => {
  afterEach(() => {
    clearCollectionRegistry();
  });

  it('starts empty', () => {
    expect(getRegisteredCollections()).toEqual([]);
  });

  it('registers a single collection with prefix', () => {
    registerCollections([userProcedures], '/api');

    const registered = getRegisteredCollections();
    expect(registered).toHaveLength(1);
    expect(registered[0].collection).toBe(userProcedures);
    expect(registered[0].prefix).toBe('/api');
  });

  it('registers multiple collections with the same prefix', () => {
    registerCollections([userProcedures, postProcedures], '/api');

    const registered = getRegisteredCollections();
    expect(registered).toHaveLength(2);
    expect(registered[0].prefix).toBe('/api');
    expect(registered[1].prefix).toBe('/api');
  });

  it('accumulates across multiple calls with different prefixes', () => {
    registerCollections([userProcedures], '/api');
    registerCollections([loterieProcedures], '/loterie');

    const registered = getRegisteredCollections();
    expect(registered).toHaveLength(2);
    expect(registered[0].prefix).toBe('/api');
    expect(registered[1].prefix).toBe('/loterie');
  });

  it('returns a readonly snapshot', () => {
    registerCollections([userProcedures], '/api');
    const result = getRegisteredCollections();

    expect(Array.isArray(result)).toBe(true);
  });

  it('clears all entries', () => {
    registerCollections([userProcedures], '/api');
    registerCollections([loterieProcedures], '/loterie');
    expect(getRegisteredCollections()).toHaveLength(2);

    clearCollectionRegistry();
    expect(getRegisteredCollections()).toHaveLength(0);
  });

  it('can register again after clearing', () => {
    registerCollections([userProcedures], '/api');
    clearCollectionRegistry();
    registerCollections([postProcedures], '/v2');

    const registered = getRegisteredCollections();
    expect(registered).toHaveLength(1);
    expect(registered[0].collection).toBe(postProcedures);
    expect(registered[0].prefix).toBe('/v2');
  });
});
