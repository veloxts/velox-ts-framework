/**
 * Schema Converter
 *
 * Converts Zod schemas to JSON Schema format for OpenAPI specifications.
 *
 * @module @veloxts/router/openapi/schema-converter
 */

import type { ZodType } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import type { JSONSchema } from './types.js';

// ============================================================================
// Schema Conversion
// ============================================================================

/**
 * Options for Zod to JSON Schema conversion
 */
export interface SchemaConversionOptions {
  /**
   * Schema name for $ref generation
   */
  name?: string;

  /**
   * Target specification format
   * @default 'openApi3'
   */
  target?: 'jsonSchema7' | 'jsonSchema2019-09' | 'openApi3';

  /**
   * How to handle $ref references
   * - 'none': Inline all definitions (default)
   * - 'root': Use $ref at root level
   * - 'seen': Use $ref for seen schemas
   * @default 'none'
   */
  refStrategy?: 'none' | 'root' | 'seen';

  /**
   * Base path for $ref URIs
   * @default '#/components/schemas'
   */
  basePath?: string[];

  /**
   * Remove default values from schema
   * @default false
   */
  removeDefaults?: boolean;
}

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

  const {
    name,
    target = 'openApi3',
    refStrategy = 'none',
    basePath = ['components', 'schemas'],
    removeDefaults = false,
  } = options;

  try {
    // Cast needed because zod-to-json-schema types don't include all options we use
    const result = zodToJsonSchema(schema, {
      name,
      target,
      $refStrategy: refStrategy,
      basePath,
      // OpenAPI 3.0 doesn't support $schema
      removeAdditionalStrategy: 'passthrough',
    } as unknown as Record<string, unknown>);

    // Clean up the schema for OpenAPI compatibility
    const cleaned = cleanJsonSchema(result as JSONSchema, { removeDefaults });

    return cleaned;
  } catch (error) {
    // Log error but don't fail - return a generic schema
    console.warn('[VeloxTS] Failed to convert Zod schema to JSON Schema:', error);
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
