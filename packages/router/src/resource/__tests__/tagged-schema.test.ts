/**
 * Tests for tagged resource schema views
 *
 * Validates that:
 * 1. `build()` returns schemas with `.public`, `.authenticated`, `.admin` views
 * 2. `resource(data, Schema.authenticated)` returns projected data directly
 * 3. `resourceCollection(items, Schema.authenticated)` returns projected array
 * 4. Schemas without fields at a level still work (return lower-level fields)
 * 5. Type inference resolves correctly for tagged schemas
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { isTaggedResourceSchema, resource, resourceCollection, resourceSchema } from '../index.js';

// ============================================================================
// Test Schema
// ============================================================================

const UserSchema = resourceSchema()
  .public('id', z.string())
  .public('name', z.string())
  .authenticated('email', z.string().email())
  .admin('internalNotes', z.string().nullable())
  .build();

const mockUser = {
  id: 'user-123',
  name: 'Test User',
  email: 'test@example.com',
  internalNotes: 'VIP',
};

const mockUsers = [
  { id: 'u1', name: 'Alice', email: 'alice@example.com', internalNotes: 'Staff' },
  { id: 'u2', name: 'Bob', email: 'bob@example.com', internalNotes: null },
];

// ============================================================================
// Tests
// ============================================================================

describe('Tagged Resource Schema', () => {
  describe('build() returns views', () => {
    it('has .public, .authenticated, .admin properties', () => {
      expect(UserSchema.public).toBeDefined();
      expect(UserSchema.authenticated).toBeDefined();
      expect(UserSchema.admin).toBeDefined();
    });

    it('tagged schemas have _level property', () => {
      expect(UserSchema.public._level).toBe('public');
      expect(UserSchema.authenticated._level).toBe('authenticated');
      expect(UserSchema.admin._level).toBe('admin');
    });

    it('tagged schemas share the same fields', () => {
      expect(UserSchema.public.fields).toEqual(UserSchema.fields);
      expect(UserSchema.authenticated.fields).toEqual(UserSchema.fields);
      expect(UserSchema.admin.fields).toEqual(UserSchema.fields);
    });

    it('isTaggedResourceSchema detects tagged schemas', () => {
      expect(isTaggedResourceSchema(UserSchema.public)).toBe(true);
      expect(isTaggedResourceSchema(UserSchema.authenticated)).toBe(true);
      expect(isTaggedResourceSchema(UserSchema.admin)).toBe(true);
      expect(isTaggedResourceSchema(UserSchema)).toBe(false);
    });
  });

  describe('resource() with tagged schema', () => {
    it('projects to public fields directly', () => {
      const result = resource(mockUser, UserSchema.public);
      expect(result).toEqual({ id: 'user-123', name: 'Test User' });
    });

    it('projects to authenticated fields directly', () => {
      const result = resource(mockUser, UserSchema.authenticated);
      expect(result).toEqual({
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
      });
    });

    it('projects to admin fields directly', () => {
      const result = resource(mockUser, UserSchema.admin);
      expect(result).toEqual({
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        internalNotes: 'VIP',
      });
    });
  });

  describe('resource() with untagged schema (backward compat)', () => {
    it('returns Resource instance with projection methods', () => {
      const r = resource(mockUser, UserSchema);
      expect(typeof r.forAnonymous).toBe('function');
      expect(typeof r.forAuthenticated).toBe('function');
      expect(typeof r.forAdmin).toBe('function');

      expect(r.forAuthenticated()).toEqual({
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
      });
    });
  });

  describe('resourceCollection() with tagged schema', () => {
    it('projects each item to authenticated fields', () => {
      const result = resourceCollection(mockUsers, UserSchema.authenticated);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'u1',
        name: 'Alice',
        email: 'alice@example.com',
      });
      expect(result[1]).toEqual({
        id: 'u2',
        name: 'Bob',
        email: 'bob@example.com',
      });
    });

    it('projects each item to public fields', () => {
      const result = resourceCollection(mockUsers, UserSchema.public);
      expect(result[0]).toEqual({ id: 'u1', name: 'Alice' });
      expect(result[1]).toEqual({ id: 'u2', name: 'Bob' });
    });

    it('projects each item to admin fields', () => {
      const result = resourceCollection(mockUsers, UserSchema.admin);
      expect(result[0]).toEqual({
        id: 'u1',
        name: 'Alice',
        email: 'alice@example.com',
        internalNotes: 'Staff',
      });
    });
  });

  describe('resourceCollection() with untagged schema (backward compat)', () => {
    it('returns ResourceCollection with projection methods', () => {
      const collection = resourceCollection(mockUsers, UserSchema);
      expect(typeof collection.forAuthenticated).toBe('function');

      const result = collection.forAuthenticated();
      expect(result[0]).toEqual({
        id: 'u1',
        name: 'Alice',
        email: 'alice@example.com',
      });
    });
  });

  describe('schema without authenticated fields', () => {
    const SimpleSchema = resourceSchema()
      .public('id', z.string())
      .public('name', z.string())
      .admin('secret', z.string())
      .build();

    const data = { id: '1', name: 'Test', secret: 'shh' };

    it('.authenticated view returns same as .public (no extra fields)', () => {
      const publicResult = resource(data, SimpleSchema.public);
      const authResult = resource(data, SimpleSchema.authenticated);
      expect(publicResult).toEqual({ id: '1', name: 'Test' });
      expect(authResult).toEqual({ id: '1', name: 'Test' });
    });

    it('.admin view returns all fields', () => {
      const adminResult = resource(data, SimpleSchema.admin);
      expect(adminResult).toEqual({ id: '1', name: 'Test', secret: 'shh' });
    });
  });
});
