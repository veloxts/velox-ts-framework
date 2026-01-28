/**
 * Tests for schema-converter module
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  createStringSchema,
  extractSchemaProperties,
  mergeSchemas,
  removeSchemaProperties,
  schemaHasProperties,
  zodSchemaToJsonSchema,
} from '../schema-converter.js';

describe('schema-converter', () => {
  describe('zodSchemaToJsonSchema', () => {
    it('converts simple object schema', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const result = zodSchemaToJsonSchema(schema);
      expect(result?.type).toBe('object');
      expect(result?.properties).toHaveProperty('name');
      expect(result?.properties).toHaveProperty('age');
    });

    it('converts string with email format', () => {
      const schema = z.string().email();
      const result = zodSchemaToJsonSchema(schema);
      expect(result?.type).toBe('string');
      expect(result?.format).toBe('email');
    });

    it('converts string with uuid format', () => {
      const schema = z.string().uuid();
      const result = zodSchemaToJsonSchema(schema);
      expect(result?.type).toBe('string');
      expect(result?.format).toBe('uuid');
    });

    it('converts string with min/max constraints', () => {
      const schema = z.string().min(1).max(100);
      const result = zodSchemaToJsonSchema(schema);
      expect(result?.minLength).toBe(1);
      expect(result?.maxLength).toBe(100);
    });

    it('converts number with min/max constraints', () => {
      const schema = z.number().min(0).max(100);
      const result = zodSchemaToJsonSchema(schema);
      expect(result?.minimum).toBe(0);
      expect(result?.maximum).toBe(100);
    });

    it('converts array schema', () => {
      const schema = z.array(z.string());
      const result = zodSchemaToJsonSchema(schema);
      expect(result?.type).toBe('array');
      expect(result?.items).toHaveProperty('type', 'string');
    });

    it('converts enum schema', () => {
      const schema = z.enum(['active', 'inactive', 'pending']);
      const result = zodSchemaToJsonSchema(schema);
      expect(result?.enum).toEqual(['active', 'inactive', 'pending']);
    });

    it('handles nullable types', () => {
      const schema = z.string().nullable();
      const result = zodSchemaToJsonSchema(schema);
      // zod-to-json-schema represents nullable as anyOf
      expect(result?.anyOf ?? result?.nullable).toBeDefined();
    });

    it('handles optional types', () => {
      const schema = z.object({
        name: z.string(),
        nickname: z.string().optional(),
      });

      const result = zodSchemaToJsonSchema(schema);
      expect(result?.required).toContain('name');
      expect(result?.required).not.toContain('nickname');
    });

    it('returns undefined for undefined input', () => {
      const result = zodSchemaToJsonSchema(undefined);
      expect(result).toBeUndefined();
    });

    it('removes $schema property', () => {
      const schema = z.object({ name: z.string() });
      const result = zodSchemaToJsonSchema(schema);
      expect(result?.$schema).toBeUndefined();
    });

    it('preserves schema-level description', () => {
      const schema = z
        .object({
          name: z.string(),
        })
        .describe('A user object representing a registered user');

      const result = zodSchemaToJsonSchema(schema);
      expect(result?.description).toBe('A user object representing a registered user');
    });

    it('preserves field-level descriptions', () => {
      const schema = z.object({
        email: z.string().email().describe('The user email address for authentication'),
        name: z.string().min(1).max(100).describe('Display name shown in the UI'),
      });

      const result = zodSchemaToJsonSchema(schema);
      const properties = result?.properties as Record<string, { description?: string }>;

      expect(properties?.email?.description).toBe('The user email address for authentication');
      expect(properties?.name?.description).toBe('Display name shown in the UI');
    });

    it('preserves descriptions for nested objects', () => {
      const AddressSchema = z
        .object({
          street: z.string().describe('Street address'),
          city: z.string().describe('City name'),
        })
        .describe('Physical mailing address');

      const schema = z.object({
        user: z
          .object({
            name: z.string().describe('Full name'),
            address: AddressSchema,
          })
          .describe('User profile information'),
      });

      const result = zodSchemaToJsonSchema(schema);
      const properties = result?.properties as Record<
        string,
        { description?: string; properties?: Record<string, { description?: string }> }
      >;

      expect(properties?.user?.description).toBe('User profile information');
    });

    it('preserves array item descriptions', () => {
      const schema = z.array(z.string().describe('Tag identifier')).describe('List of tags');

      const result = zodSchemaToJsonSchema(schema);
      expect(result?.description).toBe('List of tags');

      const items = result?.items as { description?: string };
      expect(items?.description).toBe('Tag identifier');
    });

    it('preserves enum descriptions', () => {
      const schema = z.enum(['active', 'inactive', 'pending']).describe('Current account status');

      const result = zodSchemaToJsonSchema(schema);
      expect(result?.description).toBe('Current account status');
    });
  });

  describe('removeSchemaProperties', () => {
    it('removes specified properties', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
        },
        required: ['id', 'name', 'email'],
      };

      const result = removeSchemaProperties(schema, ['id']);
      expect(result?.properties).not.toHaveProperty('id');
      expect(result?.properties).toHaveProperty('name');
      expect(result?.required).not.toContain('id');
    });

    it('returns undefined when all properties removed', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      };

      const result = removeSchemaProperties(schema, ['id']);
      expect(result).toBeUndefined();
    });

    it('returns original for non-object schemas', () => {
      const schema = { type: 'string' as const };
      const result = removeSchemaProperties(schema, ['id']);
      expect(result).toEqual(schema);
    });

    it('returns original for schemas without properties', () => {
      const schema = { type: 'object' as const };
      const result = removeSchemaProperties(schema, ['id']);
      expect(result).toEqual(schema);
    });

    it('handles schemas without required array', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
        },
      };

      const result = removeSchemaProperties(schema, ['id']);
      expect(result?.properties).not.toHaveProperty('id');
      expect(result?.required).toBeUndefined();
    });
  });

  describe('extractSchemaProperties', () => {
    it('extracts specified properties', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
        },
        required: ['id', 'name'],
      };

      const result = extractSchemaProperties(schema, ['id', 'name']);
      expect(Object.keys(result?.properties ?? {})).toEqual(['id', 'name']);
      expect(result?.required).toEqual(['id', 'name']);
    });

    it('returns undefined for non-object schemas', () => {
      const schema = { type: 'string' as const };
      const result = extractSchemaProperties(schema, ['id']);
      expect(result).toBeUndefined();
    });

    it('returns undefined when no properties match', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          name: { type: 'string' },
        },
      };

      const result = extractSchemaProperties(schema, ['id']);
      expect(result).toBeUndefined();
    });

    it('only includes required for extracted properties', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
        },
        required: ['id', 'email'],
      };

      const result = extractSchemaProperties(schema, ['name', 'email']);
      expect(result?.required).toEqual(['email']);
    });
  });

  describe('mergeSchemas', () => {
    it('merges object schemas', () => {
      const schema1 = {
        type: 'object' as const,
        properties: { name: { type: 'string' } },
        required: ['name'],
      };
      const schema2 = {
        type: 'object' as const,
        properties: { email: { type: 'string' } },
        required: ['email'],
      };

      const result = mergeSchemas(schema1, schema2);
      expect(result?.properties).toHaveProperty('name');
      expect(result?.properties).toHaveProperty('email');
      expect(result?.required).toContain('name');
      expect(result?.required).toContain('email');
    });

    it('returns single schema unchanged', () => {
      const schema = {
        type: 'object' as const,
        properties: { name: { type: 'string' } },
      };

      const result = mergeSchemas(schema);
      expect(result).toEqual(schema);
    });

    it('returns undefined for no schemas', () => {
      const result = mergeSchemas();
      expect(result).toBeUndefined();
    });

    it('filters undefined schemas', () => {
      const schema = {
        type: 'object' as const,
        properties: { name: { type: 'string' } },
      };

      const result = mergeSchemas(undefined, schema, undefined);
      expect(result).toEqual(schema);
    });

    it('uses allOf for non-object schemas', () => {
      const schema1 = { type: 'string' as const };
      const schema2 = { type: 'number' as const };

      const result = mergeSchemas(schema1, schema2);
      expect(result?.allOf).toEqual([schema1, schema2]);
    });

    it('deduplicates required properties', () => {
      const schema1 = {
        type: 'object' as const,
        properties: { name: { type: 'string' } },
        required: ['name'],
      };
      const schema2 = {
        type: 'object' as const,
        properties: { email: { type: 'string' } },
        required: ['name', 'email'],
      };

      const result = mergeSchemas(schema1, schema2);
      const required = result?.required as string[];
      expect(required.filter((r) => r === 'name')).toHaveLength(1);
    });
  });

  describe('createStringSchema', () => {
    it('creates basic string schema', () => {
      const result = createStringSchema();
      expect(result).toEqual({ type: 'string' });
    });

    it('creates string schema with format', () => {
      const result = createStringSchema('uuid');
      expect(result).toEqual({ type: 'string', format: 'uuid' });
    });
  });

  describe('schemaHasProperties', () => {
    it('returns true for schema with properties', () => {
      const schema = {
        type: 'object' as const,
        properties: { name: { type: 'string' } },
      };
      expect(schemaHasProperties(schema)).toBe(true);
    });

    it('returns false for empty properties', () => {
      const schema = {
        type: 'object' as const,
        properties: {},
      };
      expect(schemaHasProperties(schema)).toBe(false);
    });

    it('returns false for non-object schema', () => {
      const schema = { type: 'string' as const };
      expect(schemaHasProperties(schema)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(schemaHasProperties(undefined)).toBe(false);
    });

    it('returns false for schema without properties', () => {
      const schema = { type: 'object' as const };
      expect(schemaHasProperties(schema)).toBe(false);
    });
  });
});
