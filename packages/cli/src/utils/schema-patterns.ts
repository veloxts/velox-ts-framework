/**
 * Schema Detection Patterns
 *
 * Shared regex patterns for detecting Zod schemas in TypeScript files.
 * Used by both CLI introspection and MCP server.
 */

/**
 * Pattern to match schema exports
 * Matches: export const FooSchema = z.object(...)
 */
export const SCHEMA_EXPORT_PATTERN = /export\s+const\s+(\w+Schema)\s*=/g;

/**
 * Pattern to match type exports derived from schemas
 * Matches: export type Foo = z.infer<typeof FooSchema>
 */
export const SCHEMA_TYPE_PATTERN = /export\s+type\s+(\w+)\s*=\s*z\.infer<typeof\s+(\w+Schema)>/g;

/**
 * Extract schema names from file content
 */
export function extractSchemaNames(content: string): Set<string> {
  const schemaNames = new Set<string>();
  for (const match of content.matchAll(SCHEMA_EXPORT_PATTERN)) {
    schemaNames.add(match[1]);
  }
  return schemaNames;
}

/**
 * Extract type-to-schema mappings from file content
 * Returns a map of schemaName -> typeName
 */
export function extractSchemaTypes(content: string): Map<string, string> {
  const typeMap = new Map<string, string>();
  for (const match of content.matchAll(SCHEMA_TYPE_PATTERN)) {
    const typeName = match[1];
    const schemaName = match[2];
    typeMap.set(schemaName, typeName);
  }
  return typeMap;
}
