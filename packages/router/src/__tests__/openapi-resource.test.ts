/**
 * @veloxts/router - OpenAPI Resource Schema Tests
 * Tests that resource schemas are correctly converted to JSON Schema
 * for OpenAPI documentation generation.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { resourceSchemaToJsonSchema } from '../openapi/schema-converter.js';
import { resourceSchema } from '../resource/index.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const UserSchema = resourceSchema()
  .public('id', z.string().uuid())
  .public('name', z.string())
  .authenticated('email', z.string().email())
  .authenticated('createdAt', z.date())
  .admin('internalNotes', z.string().nullable())
  .build();

// ============================================================================
// Resource Schema to JSON Schema conversion
// ============================================================================

describe('resourceSchemaToJsonSchema', () => {
  it('should include only public fields at public level', () => {
    const jsonSchema = resourceSchemaToJsonSchema(UserSchema, 'public');

    expect(jsonSchema.type).toBe('object');
    expect(jsonSchema.properties).toBeDefined();
    expect(Object.keys(jsonSchema.properties ?? {})).toEqual(['id', 'name']);
    expect(jsonSchema.required).toEqual(['id', 'name']);
  });

  it('should include public + authenticated fields at authenticated level', () => {
    const jsonSchema = resourceSchemaToJsonSchema(UserSchema, 'authenticated');

    expect(Object.keys(jsonSchema.properties ?? {})).toEqual(['id', 'name', 'email', 'createdAt']);
    expect(jsonSchema.required).toEqual(['id', 'name', 'email', 'createdAt']);
  });

  it('should include all fields at admin level', () => {
    const jsonSchema = resourceSchemaToJsonSchema(UserSchema, 'admin');

    expect(Object.keys(jsonSchema.properties ?? {})).toEqual([
      'id',
      'name',
      'email',
      'createdAt',
      'internalNotes',
    ]);
    expect(jsonSchema.required).toEqual(['id', 'name', 'email', 'createdAt', 'internalNotes']);
  });

  it('should default to public level when not specified', () => {
    const jsonSchema = resourceSchemaToJsonSchema(UserSchema);

    expect(Object.keys(jsonSchema.properties ?? {})).toEqual(['id', 'name']);
  });

  it('should convert Zod field schemas to JSON Schema format', () => {
    const jsonSchema = resourceSchemaToJsonSchema(UserSchema, 'public');
    const props = jsonSchema.properties ?? {};

    // id field should be a string type
    expect(props.id).toBeDefined();
    expect(props.id.type).toBe('string');
  });

  it('should handle empty schemas', () => {
    const emptySchema = resourceSchema().build();
    const jsonSchema = resourceSchemaToJsonSchema(emptySchema, 'public');

    expect(jsonSchema.type).toBe('object');
    expect(jsonSchema.properties).toEqual({});
  });

  describe('nested relations', () => {
    it('should handle hasOne relations', () => {
      const OrgSchema = resourceSchema()
        .public('id', z.string())
        .public('name', z.string())
        .admin('taxId', z.string())
        .build();

      const UserWithOrgSchema = resourceSchema()
        .public('id', z.string())
        .hasOne('organization', OrgSchema, 'public')
        .build();

      const jsonSchema = resourceSchemaToJsonSchema(UserWithOrgSchema, 'public');
      const props = jsonSchema.properties ?? {};

      expect(props.organization).toBeDefined();
      expect(props.organization.nullable).toBe(true);
      // Nested schema should only show public fields
      const nestedProps = props.organization.properties ?? {};
      expect(nestedProps).toBeDefined();
      expect(Object.keys(nestedProps)).toEqual(['id', 'name']);
    });

    it('should handle hasMany relations', () => {
      const PostSchema = resourceSchema()
        .public('id', z.string())
        .public('title', z.string())
        .authenticated('draft', z.boolean())
        .build();

      const UserWithPostsSchema = resourceSchema()
        .public('id', z.string())
        .hasMany('posts', PostSchema, 'public')
        .build();

      const jsonSchema = resourceSchemaToJsonSchema(UserWithPostsSchema, 'public');
      const props = jsonSchema.properties ?? {};

      expect(props.posts).toBeDefined();
      expect(props.posts.type).toBe('array');
      expect(props.posts.items).toBeDefined();
      const itemProps = props.posts.items?.properties ?? {};
      expect(Object.keys(itemProps)).toEqual(['id', 'title']);
    });

    it('should filter nested relations by visibility', () => {
      const PostSchema = resourceSchema()
        .public('id', z.string())
        .public('title', z.string())
        .build();

      const UserWithPostsSchema = resourceSchema()
        .public('id', z.string())
        .hasMany('posts', PostSchema, 'authenticated')
        .build();

      // At public level, authenticated relation should not be included
      const publicJsonSchema = resourceSchemaToJsonSchema(UserWithPostsSchema, 'public');
      expect(publicJsonSchema.properties?.posts).toBeUndefined();

      // At authenticated level, it should be included
      const authJsonSchema = resourceSchemaToJsonSchema(UserWithPostsSchema, 'authenticated');
      expect(authJsonSchema.properties?.posts).toBeDefined();
    });
  });
});
