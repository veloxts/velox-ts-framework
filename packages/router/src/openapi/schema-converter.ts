/**
 * Schema Converter
 *
 * Converts Zod schemas to JSON Schema format for OpenAPI specifications.
 *
 * @module @veloxts/router/openapi/schema-converter
 */

import { createLogger } from '@veloxts/core';
import { type ZodType, z } from 'zod';

import type { ResourceSchema, RuntimeField } from '../resource/schema.js';
import { isFieldVisibleToLevel } from '../resource/visibility.js';
import type { JSONSchema } from './types.js';

const log = createLogger('router');

// ============================================================================
// Schema Conversion
// ============================================================================

/**
 * Options for Zod to JSON Schema conversion
 */
export interface SchemaConversionOptions {
  /**
   * Target specification format
   * @default 'openApi3'
   */
  target?: 'jsonSchema7' | 'jsonSchema2019-09' | 'openApi3';

  /**
   * Remove default values from schema
   * @default false
   */
  removeDefaults?: boolean;
}

/**
 * Maps our target names to Zod 4's native `z.toJSONSchema()` target names.
 *
 * | Our name             | Zod 4 target     | Notes                                         |
 * |----------------------|------------------|-----------------------------------------------|
 * | `openApi3`           | `openapi-3.0`    | Default for OpenAPI spec generation           |
 * | `jsonSchema7`        | `draft-07`       | JSON Schema Draft 07                          |
 * | `jsonSchema2019-09`  | `draft-2020-12`  | Zod 4 has no 2019-09 target; 2020-12 is the  |
 * |                      |                  | closest superset and is forwards-compatible   |
 */
const TARGET_MAP: Record<string, string> = {
  openApi3: 'openapi-3.0',
  jsonSchema7: 'draft-07',
  'jsonSchema2019-09': 'draft-2020-12',
};

/**
 * Converts a Zod schema to JSON Schema format for OpenAPI
 *
 * @param schema - Zod schema to convert
 * @param options - Conversion options
 * @returns JSON Schema representation
 *
 * @example
 * ```typescript
 * const UserSchema = z.object({
 *   id: z.string().uuid(),
 *   email: z.string().email(),
 *   name: z.string().min(1).max(100),
 * });
 *
 * const jsonSchema = zodSchemaToJsonSchema(UserSchema);
 * // {
 * //   type: 'object',
 * //   properties: {
 * //     id: { type: 'string', format: 'uuid' },
 * //     email: { type: 'string', format: 'email' },
 * //     name: { type: 'string', minLength: 1, maxLength: 100 },
 * //   },
 * //   required: ['id', 'email', 'name'],
 * // }
 * ```
 */
export function zodSchemaToJsonSchema(
  schema: ZodType | undefined,
  options: SchemaConversionOptions = {}
): JSONSchema | undefined {
  if (!schema) {
    return undefined;
  }

  const { target = 'openApi3', removeDefaults = false } = options;

  try {
    const result = z.toJSONSchema(schema, {
      target: TARGET_MAP[target] ?? 'openapi-3.0',
      unrepresentable: 'any',
      reused: 'inline',
    });

    // Clean up the schema for OpenAPI compatibility
    const cleaned = cleanJsonSchema(result as JSONSchema, { removeDefaults });

    return cleaned;
  } catch (error) {
    // Log error but don't fail - return a generic schema
    log.warn('Failed to convert Zod schema to JSON Schema:', error);
    return { type: 'object' };
  }
}

/**
 * Cleans up JSON Schema for OpenAPI compatibility
 *
 * Removes properties that aren't valid in OpenAPI 3.0
 */
function cleanJsonSchema(
  schema: JSONSchema,
  options: { removeDefaults?: boolean } = {}
): JSONSchema {
  const cleaned: JSONSchema = { ...schema };

  // Remove $schema as OpenAPI doesn't use it
  delete cleaned.$schema;

  // Remove definitions if using inline mode
  delete cleaned.definitions;

  // Optionally remove defaults
  if (options.removeDefaults) {
    delete cleaned.default;
  }

  // Recursively clean nested schemas
  if (cleaned.properties) {
    const cleanedProps: Record<string, JSONSchema> = {};
    for (const [key, value] of Object.entries(cleaned.properties)) {
      cleanedProps[key] = cleanJsonSchema(value as JSONSchema, options);
    }
    cleaned.properties = cleanedProps;
  }

  if (cleaned.items) {
    if (Array.isArray(cleaned.items)) {
      cleaned.items = cleaned.items.map((item) => cleanJsonSchema(item as JSONSchema, options));
    } else {
      cleaned.items = cleanJsonSchema(cleaned.items as JSONSchema, options);
    }
  }

  if (cleaned.additionalProperties && typeof cleaned.additionalProperties === 'object') {
    cleaned.additionalProperties = cleanJsonSchema(cleaned.additionalProperties, options);
  }

  // Clean composition keywords
  for (const keyword of ['allOf', 'anyOf', 'oneOf'] as const) {
    if (cleaned[keyword]) {
      cleaned[keyword] = (cleaned[keyword] as JSONSchema[]).map((s) => cleanJsonSchema(s, options));
    }
  }

  if (cleaned.not) {
    cleaned.not = cleanJsonSchema(cleaned.not, options);
  }

  return cleaned;
}

// ============================================================================
// Schema Manipulation
// ============================================================================

/**
 * Removes specified properties from a JSON Schema
 *
 * Useful for removing path parameters from request body schemas
 *
 * @param schema - Original JSON Schema
 * @param propertyNames - Properties to remove
 * @returns New schema without specified properties
 *
 * @example
 * ```typescript
 * const schema = {
 *   type: 'object',
 *   properties: { id: { type: 'string' }, name: { type: 'string' } },
 *   required: ['id', 'name'],
 * };
 *
 * const bodySchema = removeSchemaProperties(schema, ['id']);
 * // { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] }
 * ```
 */
export function removeSchemaProperties(
  schema: JSONSchema | undefined,
  propertyNames: string[]
): JSONSchema | undefined {
  if (!schema || schema.type !== 'object' || !schema.properties) {
    return schema;
  }

  const properties = { ...(schema.properties as Record<string, JSONSchema>) };
  const required = [...((schema.required as string[]) ?? [])];

  for (const name of propertyNames) {
    delete properties[name];
    const idx = required.indexOf(name);
    if (idx !== -1) {
      required.splice(idx, 1);
    }
  }

  // If no properties left, return undefined
  if (Object.keys(properties).length === 0) {
    return undefined;
  }

  return {
    ...schema,
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

/**
 * Extracts specific properties from a JSON Schema
 *
 * @param schema - Original JSON Schema
 * @param propertyNames - Properties to extract
 * @returns New schema with only specified properties
 */
export function extractSchemaProperties(
  schema: JSONSchema | undefined,
  propertyNames: string[]
): JSONSchema | undefined {
  if (!schema || schema.type !== 'object' || !schema.properties) {
    return undefined;
  }

  const sourceProps = schema.properties as Record<string, JSONSchema>;
  const sourceRequired = (schema.required as string[]) ?? [];

  const properties: Record<string, JSONSchema> = {};
  const required: string[] = [];

  for (const name of propertyNames) {
    if (sourceProps[name]) {
      properties[name] = sourceProps[name];
      if (sourceRequired.includes(name)) {
        required.push(name);
      }
    }
  }

  if (Object.keys(properties).length === 0) {
    return undefined;
  }

  return {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

/**
 * Merges multiple JSON Schemas into one
 *
 * Uses allOf composition for complex cases
 *
 * @param schemas - Schemas to merge
 * @returns Merged schema
 */
export function mergeSchemas(...schemas: (JSONSchema | undefined)[]): JSONSchema | undefined {
  const validSchemas = schemas.filter((s): s is JSONSchema => s !== undefined);

  if (validSchemas.length === 0) {
    return undefined;
  }

  if (validSchemas.length === 1) {
    return validSchemas[0];
  }

  // If all are objects, merge properties directly
  if (validSchemas.every((s) => s.type === 'object')) {
    const mergedProperties: Record<string, JSONSchema> = {};
    const mergedRequired: string[] = [];

    for (const schema of validSchemas) {
      if (schema.properties) {
        Object.assign(mergedProperties, schema.properties);
      }
      if (schema.required) {
        mergedRequired.push(...(schema.required as string[]));
      }
    }

    return {
      type: 'object',
      properties: mergedProperties,
      required: [...new Set(mergedRequired)],
    };
  }

  // Use allOf for complex merges
  return { allOf: validSchemas };
}

/**
 * Creates a simple string schema for path parameters
 *
 * @param format - Optional format (e.g., 'uuid', 'date')
 * @returns JSON Schema for string parameter
 */
export function createStringSchema(format?: string): JSONSchema {
  const schema: JSONSchema = { type: 'string' };
  if (format) {
    schema.format = format;
  }
  return schema;
}

/**
 * Checks if a schema has any properties
 */
export function schemaHasProperties(schema: JSONSchema | undefined): boolean {
  if (!schema) return false;
  if (schema.type !== 'object') return false;
  if (!schema.properties) return false;
  return Object.keys(schema.properties).length > 0;
}

// ============================================================================
// Resource Schema to JSON Schema
// ============================================================================

/**
 * Converts a ResourceSchema to JSON Schema for OpenAPI, filtered by visibility level
 *
 * Iterates the resource's field definitions and includes only fields
 * visible at the given access level. Nested resource schemas are
 * converted recursively.
 *
 * @param schema - The resource schema
 * @param level - The access level to generate documentation for (defaults to 'public')
 * @returns JSON Schema with only the fields visible at the given level
 */
export function resourceSchemaToJsonSchema(
  schema: ResourceSchema,
  level: string = 'public'
): JSONSchema {
  const properties: Record<string, JSONSchema> = {};
  const required: string[] = [];

  for (const field of schema.fields) {
    if (!isFieldVisibleToLevel(field as RuntimeField, level)) {
      continue;
    }

    if (field.nestedSchema) {
      // Nested relation — recurse
      const nestedJsonSchema = resourceSchemaToJsonSchema(field.nestedSchema, level);
      if (field.cardinality === 'many') {
        properties[field.name] = { type: 'array', items: nestedJsonSchema };
      } else {
        properties[field.name] = { ...nestedJsonSchema, nullable: true };
      }
    } else if (field.schema) {
      // Scalar field with Zod schema
      const fieldJsonSchema = zodSchemaToJsonSchema(field.schema);
      if (fieldJsonSchema) {
        properties[field.name] = fieldJsonSchema;
      }
    } else {
      // Field without schema — generic
      properties[field.name] = {};
    }

    required.push(field.name);
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

/**
 * Converts a resource schema to JSON Schema for Level 3 branched procedures
 *
 * Includes ALL fields from the resource schema. Fields visible at the
 * lowest level (first in the levels array) are marked as required;
 * higher-level-only fields are optional.
 *
 * @param schema - The resource schema (must have _levelConfig for custom levels)
 * @returns JSON Schema with all fields, non-public fields optional
 */
export function resourceSchemaToJsonSchemaForBranching(
  schema: ResourceSchema
): JSONSchema {
  const properties: Record<string, JSONSchema> = {};
  const required: string[] = [];

  // Determine the lowest (most accessible) level
  const schemaWithConfig = schema as ResourceSchema & {
    _levelConfig?: { levels: readonly string[] };
  };
  const lowestLevel = schemaWithConfig._levelConfig?.levels[0] ?? 'public';

  for (const field of schema.fields) {
    const runtimeField = field as RuntimeField;

    if (field.nestedSchema) {
      const nestedJsonSchema = resourceSchemaToJsonSchemaForBranching(field.nestedSchema);
      if (field.cardinality === 'many') {
        properties[field.name] = { type: 'array', items: nestedJsonSchema };
      } else {
        properties[field.name] = { ...nestedJsonSchema, nullable: true };
      }
    } else if (field.schema) {
      const fieldJsonSchema = zodSchemaToJsonSchema(field.schema);
      if (fieldJsonSchema) {
        properties[field.name] = fieldJsonSchema;
      }
    } else {
      properties[field.name] = {};
    }

    // Only public/lowest-level fields are required
    if (isFieldVisibleToLevel(runtimeField, lowestLevel)) {
      required.push(field.name);
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}
