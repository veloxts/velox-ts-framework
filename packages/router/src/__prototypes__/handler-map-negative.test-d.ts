/**
 * Negative type tests — verify that invalid keys produce compile errors.
 *
 * Each block should produce a TypeScript error. We test by asserting
 * that invalid constructions don't type-check.
 */

import { expectTypeOf } from 'expect-type';

import type {
  SymbolHandlerMap,
  StringHandlerMap,
  TestSchema,
  BrandedTestSchema,
} from './handler-map-keys.js';
import {
  ADMIN_KEY,
  AUTH_KEY,
  PUBLIC_KEY,
} from './handler-map-keys.js';

// ============================================================================
// Symbol approach: verify invalid keys are rejected
// ============================================================================

// Test: A random symbol should NOT be assignable to the handler map
{
  type Map = SymbolHandlerMap<TestSchema, { id: string }>;

  // Only the three declared symbol keys should be valid
  // A fresh symbol should NOT be a valid key
  declare const FAKE_KEY: unique symbol;
  type FakeKey = typeof FAKE_KEY;

  // FakeKey should NOT be a key of Map
  // If this passes, it means TypeScript properly rejects unknown symbols
  type HasFakeKey = FakeKey extends keyof Map ? true : false;
  expectTypeOf<HasFakeKey>().toEqualTypeOf<false>();
}

// Test: The symbol keys that ARE valid should be in keyof Map
{
  type Map = SymbolHandlerMap<TestSchema, { id: string }>;

  type HasAdminKey = typeof ADMIN_KEY extends keyof Map ? true : false;
  type HasAuthKey = typeof AUTH_KEY extends keyof Map ? true : false;
  type HasPublicKey = typeof PUBLIC_KEY extends keyof Map ? true : false;

  expectTypeOf<HasAdminKey>().toEqualTypeOf<true>();
  expectTypeOf<HasAuthKey>().toEqualTypeOf<true>();
  expectTypeOf<HasPublicKey>().toEqualTypeOf<true>();
}

// ============================================================================
// Branded string approach: verify invalid keys are rejected
// ============================================================================

// Test: An arbitrary string should NOT be a valid key
{
  type Map = StringHandlerMap<BrandedTestSchema, { id: string }>;

  // Only 'admin', 'authenticated', 'public' should be valid
  type HasFakeKey = 'moderator' extends keyof Map ? true : false;
  expectTypeOf<HasFakeKey>().toEqualTypeOf<false>();

  // Valid keys should work
  type HasAdmin = 'admin' extends keyof Map ? true : false;
  type HasAuth = 'authenticated' extends keyof Map ? true : false;
  type HasPublic = 'public' extends keyof Map ? true : false;

  expectTypeOf<HasAdmin>().toEqualTypeOf<true>();
  expectTypeOf<HasAuth>().toEqualTypeOf<true>();
  expectTypeOf<HasPublic>().toEqualTypeOf<true>();
}

// Test: Empty map is allowed (all keys optional)
{
  type Map = SymbolHandlerMap<TestSchema, { id: string }>;
  const emptyMap: Map = {};
  expectTypeOf(emptyMap).toMatchTypeOf<Map>();
}
