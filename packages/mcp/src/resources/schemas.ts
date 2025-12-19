/**
 * Schemas Resource
 *
 * Exposes Zod schema information to AI tools.
 */

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { getSchemasPath } from '../utils/project.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Schema field information
 */
export interface SchemaFieldInfo {
  /** Field name */
  name: string;
  /** Field type description */
  type: string;
  /** Whether the field is optional */
  optional: boolean;
}

/**
 * Information about a schema
 */
export interface SchemaInfo {
  /** Schema name (e.g., 'UserSchema') */
  name: string;
  /** File where the schema is defined */
  file: string;
  /** Inferred type name if available */
  typeName?: string;
  /** Brief description of the schema */
  description?: string;
}

/**
 * Schemas resource response
 */
export interface SchemasResourceResponse {
  schemas: SchemaInfo[];
  totalCount: number;
  files: string[];
}

// ============================================================================
// Schema Detection
// ============================================================================

/**
 * Pattern to match schema exports
 * Matches: export const FooSchema = z.object(...)
 */
const SCHEMA_PATTERN = /export\s+const\s+(\w+Schema)\s*=/g;

/**
 * Pattern to match type exports derived from schemas
 * Matches: export type Foo = z.infer<typeof FooSchema>
 */
const TYPE_PATTERN = /export\s+type\s+(\w+)\s*=\s*z\.infer<typeof\s+(\w+Schema)>/g;

/**
 * Extract schema names from file content
 */
function extractSchemaNames(content: string, filePath: string): SchemaInfo[] {
  const schemas: SchemaInfo[] = [];
  const schemaNames = new Set<string>();

  // Find all schema exports
  for (const match of content.matchAll(SCHEMA_PATTERN)) {
    const schemaName = match[1];
    if (!schemaNames.has(schemaName)) {
      schemaNames.add(schemaName);
      schemas.push({
        name: schemaName,
        file: filePath,
      });
    }
  }

  // Find associated type exports
  const typeMap = new Map<string, string>();
  for (const match of content.matchAll(TYPE_PATTERN)) {
    const typeName = match[1];
    const schemaName = match[2];
    typeMap.set(schemaName, typeName);
  }

  // Add type names to schemas
  for (const schema of schemas) {
    const typeName = typeMap.get(schema.name);
    if (typeName) {
      schema.typeName = typeName;
    }
  }

  return schemas;
}

/**
 * Scan a directory for schema files
 */
async function scanSchemaFiles(schemasPath: string): Promise<{ file: string; content: string }[]> {
  const files: { file: string; content: string }[] = [];

  try {
    const entries = await readdir(schemasPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.ts')) continue;
      if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.spec.ts')) continue;
      if (entry.name.endsWith('.d.ts')) continue;

      const filePath = join(schemasPath, entry.name);
      try {
        const content = await readFile(filePath, 'utf-8');
        files.push({ file: entry.name, content });
      } catch {
        // Skip files we can't read
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return files;
}

// ============================================================================
// Resource Handler
// ============================================================================

/**
 * Discover and return schema information for a project
 */
export async function getSchemas(projectRoot: string): Promise<SchemasResourceResponse> {
  const schemasPath = getSchemasPath(projectRoot);

  if (!schemasPath || !existsSync(schemasPath)) {
    return {
      schemas: [],
      totalCount: 0,
      files: [],
    };
  }

  const schemaFiles = await scanSchemaFiles(schemasPath);
  const allSchemas: SchemaInfo[] = [];
  const files: string[] = [];

  for (const { file, content } of schemaFiles) {
    const schemas = extractSchemaNames(content, file);
    if (schemas.length > 0) {
      files.push(file);
      allSchemas.push(...schemas);
    }
  }

  return {
    schemas: allSchemas,
    totalCount: allSchemas.length,
    files,
  };
}

/**
 * Search schemas by name
 */
export async function searchSchemas(projectRoot: string, query: string): Promise<SchemaInfo[]> {
  const response = await getSchemas(projectRoot);
  const lowerQuery = query.toLowerCase();

  return response.schemas.filter(
    (s) =>
      s.name.toLowerCase().includes(lowerQuery) ||
      s.typeName?.toLowerCase().includes(lowerQuery) ||
      s.file.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Format schemas response as text
 */
export function formatSchemasAsText(response: SchemasResourceResponse): string {
  const lines: string[] = [
    '# VeloxTS Schemas',
    '',
    `Total schemas: ${response.totalCount}`,
    `Schema files: ${response.files.length}`,
    '',
    '## Files',
    '',
  ];

  for (const file of response.files) {
    lines.push(`- ${file}`);
  }

  lines.push('', '## Schemas', '');

  // Group by file
  const byFile = new Map<string, SchemaInfo[]>();
  for (const schema of response.schemas) {
    const list = byFile.get(schema.file) ?? [];
    list.push(schema);
    byFile.set(schema.file, list);
  }

  for (const [file, schemas] of byFile) {
    lines.push(`### ${file}`);
    for (const schema of schemas) {
      const typeName = schema.typeName ? ` (type: ${schema.typeName})` : '';
      lines.push(`- ${schema.name}${typeName}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
