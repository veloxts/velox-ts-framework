/**
 * Sync Detector
 *
 * Scans a project's `src/procedures/` and `src/schemas/` directories to
 * discover existing generated files. The result is an `ExistingCodeMap`
 * consumed by the prompter stage to decide whether each model needs
 * generation, regeneration, or can be skipped.
 */

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { singularize, toPascalCase } from '../generators/utils/naming.js';
import type { ExistingCodeMap, SyncModelInfo } from './types.js';

/**
 * Detect existing procedure and schema files that correspond to known
 * Prisma models.
 *
 * @param projectRoot - Absolute path to the project root directory
 * @param models - Model metadata produced by the analyzer stage
 * @returns Map of model names to their existing file paths
 */
export function detectExisting(
  projectRoot: string,
  models: readonly SyncModelInfo[]
): ExistingCodeMap {
  const modelNames = new Set(models.map((m) => m.name));

  const procedures = scanProcedures(projectRoot, modelNames);
  const schemas = scanSchemas(projectRoot, modelNames);

  return { procedures, schemas };
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Scan `src/procedures/` for `.ts` files that match known model names.
 *
 * Excludes `index.ts` and anything inside `__tests__/`.
 * Converts kebab-case/plural filenames to PascalCase singular for matching.
 */
function scanProcedures(
  projectRoot: string,
  modelNames: ReadonlySet<string>
): ReadonlyMap<string, string> {
  const proceduresDir = join(projectRoot, 'src', 'procedures');
  const result = new Map<string, string>();

  if (!existsSync(proceduresDir)) {
    return result;
  }

  const entries = readdirSync(proceduresDir, { withFileTypes: true });

  for (const entry of entries) {
    // Skip directories (including __tests__/) and non-.ts files
    if (entry.isDirectory()) {
      continue;
    }

    const fileName = entry.name;

    // Skip non-.ts files and index.ts
    if (!fileName.endsWith('.ts') || fileName === 'index.ts') {
      continue;
    }

    // Extract base name: "users.ts" -> "users", "friend-requests.ts" -> "friend-requests"
    const baseName = fileName.slice(0, -3);

    // Convert to PascalCase singular: "users" -> "User", "friend-requests" -> "FriendRequest"
    const modelName = toPascalCase(singularize(baseName));

    if (modelNames.has(modelName)) {
      result.set(modelName, join(proceduresDir, fileName));
    }
  }

  return result;
}

/**
 * Scan `src/schemas/` for `.schema.ts` files that match known model names.
 *
 * Excludes `index.ts` and anything inside `__tests__/`.
 * Strips the `.schema.ts` suffix, then converts to PascalCase singular.
 */
function scanSchemas(
  projectRoot: string,
  modelNames: ReadonlySet<string>
): ReadonlyMap<string, string> {
  const schemasDir = join(projectRoot, 'src', 'schemas');
  const result = new Map<string, string>();

  if (!existsSync(schemasDir)) {
    return result;
  }

  const entries = readdirSync(schemasDir, { withFileTypes: true });

  for (const entry of entries) {
    // Skip directories (including __tests__/) and non-.schema.ts files
    if (entry.isDirectory()) {
      continue;
    }

    const fileName = entry.name;

    // Skip files that are not *.schema.ts, and skip index.ts
    if (!fileName.endsWith('.schema.ts') || fileName === 'index.ts') {
      continue;
    }

    // Extract base name: "post.schema.ts" -> "post", "friend-requests.schema.ts" -> "friend-requests"
    const baseName = fileName.slice(0, -'.schema.ts'.length);

    // Convert to PascalCase singular: "posts" -> "Post", "friend-requests" -> "FriendRequest"
    const modelName = toPascalCase(singularize(baseName));

    if (modelNames.has(modelName)) {
      result.set(modelName, join(schemasDir, fileName));
    }
  }

  return result;
}
