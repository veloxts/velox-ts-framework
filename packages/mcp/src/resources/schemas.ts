/**
 * Schemas Resource
 *
 * Exposes Zod schema information to AI tools.
 */

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { extractSchemaNames as extractNames, extractSchemaTypes } from '@veloxts/cli';

import { getSchemasPath } from '../utils/project.js';

// ============================================================================
// Types
// ============================================================================

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
  /** Warnings encountered during schema scanning */
  warnings?: string[];
}

// ============================================================================
// Schema Detection
// ============================================================================

/**
 * Extract schema information from file content
 * Uses shared utilities from @veloxts/cli
 */
function extractSchemaInfo(content: string, filePath: string): SchemaInfo[] {
  const schemaNames = extractNames(content);
  const typeMap = extractSchemaTypes(content);

  const schemas: SchemaInfo[] = [];
  for (const schemaName of schemaNames) {
    schemas.push({
      name: schemaName,
      file: filePath,
      typeName: typeMap.get(schemaName),
    });
  }

  return schemas;
}

/**
 * Result of schema file scanning
 */
interface SchemaScanResult {
  files: { file: string; content: string }[];
  warnings: string[];
}

/**
 * Scan a directory for schema files
 */
async function scanSchemaFiles(schemasPath: string): Promise<SchemaScanResult> {
  const files: { file: string; content: string }[] = [];
  const warnings: string[] = [];

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
      } catch (error) {
        // Track file read errors as warnings
        const message = error instanceof Error ? error.message : 'Unknown error';
        warnings.push(`Failed to read ${entry.name}: ${message}`);
      }
    }
  } catch (error) {
    // Track directory read errors as warnings
    const message = error instanceof Error ? error.message : 'Unknown error';
    warnings.push(`Failed to scan schemas directory: ${message}`);
  }

  return { files, warnings };
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

  const { files: schemaFiles, warnings } = await scanSchemaFiles(schemasPath);
  const allSchemas: SchemaInfo[] = [];
  const files: string[] = [];

  for (const { file, content } of schemaFiles) {
    const schemas = extractSchemaInfo(content, file);
    if (schemas.length > 0) {
      files.push(file);
      allSchemas.push(...schemas);
    }
  }

  return {
    schemas: allSchemas,
    totalCount: allSchemas.length,
    files,
    warnings: warnings.length > 0 ? warnings : undefined,
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
