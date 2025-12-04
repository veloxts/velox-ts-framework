/**
 * @veloxts/orm - Type Guards and Type Utilities Tests
 */

import { describe, expect, it } from 'vitest';

import { isDatabaseClient } from '../types.js';

describe('isDatabaseClient', () => {
  it('should return true for valid database client', () => {
    const validClient = {
      $connect: async () => {},
      $disconnect: async () => {},
    };

    expect(isDatabaseClient(validClient)).toBe(true);
  });

  it('should return true for client with additional properties', () => {
    const clientWithExtras = {
      $connect: async () => {},
      $disconnect: async () => {},
      user: { findMany: () => [] },
      post: { findMany: () => [] },
    };

    expect(isDatabaseClient(clientWithExtras)).toBe(true);
  });

  it('should return false for null', () => {
    expect(isDatabaseClient(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isDatabaseClient(undefined)).toBe(false);
  });

  it('should return false for primitive values', () => {
    expect(isDatabaseClient('string')).toBe(false);
    expect(isDatabaseClient(123)).toBe(false);
    expect(isDatabaseClient(true)).toBe(false);
  });

  it('should return false for empty object', () => {
    expect(isDatabaseClient({})).toBe(false);
  });

  it('should return false for object missing $connect', () => {
    const missing$connect = {
      $disconnect: async () => {},
    };

    expect(isDatabaseClient(missing$connect)).toBe(false);
  });

  it('should return false for object missing $disconnect', () => {
    const missing$disconnect = {
      $connect: async () => {},
    };

    expect(isDatabaseClient(missing$disconnect)).toBe(false);
  });

  it('should return false if $connect is not a function', () => {
    const invalid = {
      $connect: 'not a function',
      $disconnect: async () => {},
    };

    expect(isDatabaseClient(invalid)).toBe(false);
  });

  it('should return false if $disconnect is not a function', () => {
    const invalid = {
      $connect: async () => {},
      $disconnect: 'not a function',
    };

    expect(isDatabaseClient(invalid)).toBe(false);
  });

  it('should return false for array', () => {
    expect(isDatabaseClient([])).toBe(false);
  });

  it('should return false for function (typeof check)', () => {
    const fn = () => {};
    // Even with these properties, a function fails the typeof === 'object' check
    (fn as unknown as Record<string, unknown>).$connect = async () => {};
    (fn as unknown as Record<string, unknown>).$disconnect = async () => {};

    // Functions fail because typeof fn === 'function', not 'object'
    expect(isDatabaseClient(fn)).toBe(false);
  });
});
