/**
 * Filesystem Utilities for Code Generation
 *
 * Safe file operations with conflict detection, directory creation,
 * and interactive prompting support.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';

import * as p from '@clack/prompts';
import pc from 'picocolors';

import type { ConflictStrategy, GeneratedFile } from '../types.js';
import { GeneratorError, GeneratorErrorCode } from '../types.js';
import { pluralize, singularize } from './naming.js';

// ============================================================================
// File Writing
// ============================================================================

/**
 * Result of writing a file
 */
export interface WriteResult {
  /** Path that was written (or would be written) */
  readonly path: string;
  /** Whether the file was actually written */
  readonly written: boolean;
  /** Whether file already existed */
  readonly existed: boolean;
  /** Action taken: created, overwritten, skipped */
  readonly action: 'created' | 'overwritten' | 'skipped';
}

/**
 * Options for file writing operations
 */
export interface WriteOptions {
  /** Conflict handling strategy */
  conflictStrategy: ConflictStrategy;
  /** Dry run mode - don't actually write */
  dryRun: boolean;
  /** Force overwrite without prompting */
  force: boolean;
  /** Base directory for relative paths */
  cwd: string;
  /** Silent mode - suppress output */
  silent?: boolean;
}

/**
 * Write a single file with conflict handling
 */
export async function writeFile(file: GeneratedFile, options: WriteOptions): Promise<WriteResult> {
  const { conflictStrategy, dryRun, force, cwd } = options;
  const fullPath = file.path.startsWith('/') ? file.path : `${cwd}/${file.path}`;
  const relativePath = relative(cwd, fullPath);
  const existed = existsSync(fullPath);

  // Handle dry run
  if (dryRun) {
    return {
      path: relativePath,
      written: false,
      existed,
      action: existed ? 'overwritten' : 'created',
    };
  }

  // Handle file conflicts
  if (existed && !force) {
    // Skip if file has skipIfExists flag
    if (file.skipIfExists) {
      return {
        path: relativePath,
        written: false,
        existed: true,
        action: 'skipped',
      };
    }

    const action = await resolveConflict(relativePath, conflictStrategy);

    if (action === 'skip') {
      return {
        path: relativePath,
        written: false,
        existed: true,
        action: 'skipped',
      };
    }

    if (action === 'error') {
      throw new GeneratorError(
        GeneratorErrorCode.FILE_ALREADY_EXISTS,
        `File already exists: ${relativePath}`,
        `Use --force to overwrite existing files, or rename your entity.`
      );
    }
  }

  // Ensure directory exists
  const dir = dirname(fullPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Write the file
  writeFileSync(fullPath, file.content, 'utf-8');

  return {
    path: relativePath,
    written: true,
    existed,
    action: existed ? 'overwritten' : 'created',
  };
}

/**
 * Write multiple files with conflict handling
 */
export async function writeFiles(
  files: ReadonlyArray<GeneratedFile>,
  options: WriteOptions
): Promise<ReadonlyArray<WriteResult>> {
  const results: WriteResult[] = [];

  for (const file of files) {
    const result = await writeFile(file, options);
    results.push(result);
  }

  return results;
}

// ============================================================================
// Conflict Resolution
// ============================================================================

/**
 * Resolve a file conflict based on strategy
 */
async function resolveConflict(
  path: string,
  strategy: ConflictStrategy
): Promise<'overwrite' | 'skip' | 'error'> {
  switch (strategy) {
    case 'overwrite':
      return 'overwrite';

    case 'skip':
      return 'skip';

    case 'error':
      return 'error';

    // case 'prompt':
    default:
      return promptConflictResolution(path);
  }
}

/**
 * Interactively prompt user to resolve a conflict
 */
async function promptConflictResolution(path: string): Promise<'overwrite' | 'skip' | 'error'> {
  const result = await p.select({
    message: `File ${pc.yellow(path)} already exists. What would you like to do?`,
    options: [
      { value: 'overwrite', label: 'Overwrite', hint: 'Replace existing file' },
      { value: 'skip', label: 'Skip', hint: 'Keep existing file' },
      { value: 'error', label: 'Cancel', hint: 'Abort generation' },
    ],
  });

  if (p.isCancel(result)) {
    throw new GeneratorError(GeneratorErrorCode.CANCELED, 'Operation canceled by user');
  }

  return result as 'overwrite' | 'skip' | 'error';
}

// ============================================================================
// File Reading
// ============================================================================

/**
 * Safely read a file, returning undefined if it doesn't exist
 */
export function readFileSafe(path: string): string | undefined {
  if (!existsSync(path)) {
    return undefined;
  }
  return readFileSync(path, 'utf-8');
}

/**
 * Check if a file exists
 */
export function fileExists(path: string): boolean {
  return existsSync(path);
}

// ============================================================================
// Directory Operations
// ============================================================================

/**
 * Ensure a directory exists, creating it if necessary
 */
export function ensureDir(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

/**
 * Check if a directory exists
 */
export function dirExists(path: string): boolean {
  return existsSync(path);
}

// ============================================================================
// Output Formatting
// ============================================================================

/**
 * Format write results for display
 */
export function formatWriteResults(results: ReadonlyArray<WriteResult>, dryRun: boolean): string {
  const lines: string[] = [];

  for (const result of results) {
    const prefix = dryRun ? '[dry-run] ' : '';
    const icon = getActionIcon(result.action);
    const actionText = getActionText(result.action, dryRun);

    lines.push(`${prefix}${icon} ${actionText} ${pc.cyan(result.path)}`);
  }

  return lines.join('\n');
}

/**
 * Get icon for action type
 */
function getActionIcon(action: WriteResult['action']): string {
  switch (action) {
    case 'created':
      return pc.green('✓');
    case 'overwritten':
      return pc.yellow('↻');
    case 'skipped':
      return pc.dim('○');
  }
}

/**
 * Get text for action type
 */
function getActionText(action: WriteResult['action'], dryRun: boolean): string {
  if (dryRun) {
    switch (action) {
      case 'created':
        return 'Would create';
      case 'overwritten':
        return 'Would overwrite';
      case 'skipped':
        return 'Would skip';
    }
  }

  switch (action) {
    case 'created':
      return 'Created';
    case 'overwritten':
      return 'Overwrote';
    case 'skipped':
      return 'Skipped';
  }
}

// ============================================================================
// JSON Output
// ============================================================================

/**
 * Format write results as JSON for machine consumption
 */
export function formatWriteResultsJson(results: ReadonlyArray<WriteResult>): string {
  return JSON.stringify(
    {
      success: true,
      files: results.map((r) => ({
        path: r.path,
        action: r.action,
        written: r.written,
      })),
    },
    null,
    2
  );
}

// ============================================================================
// Similar File Detection
// ============================================================================

/**
 * Information about a similar file that was found
 */
export interface SimilarFile {
  /** Path to the similar file */
  path: string;
  /** Why this is considered similar */
  reason: 'singular' | 'plural' | 'different-suffix' | 'exact';
  /** The file we were looking for when we found this */
  targetPath: string;
}

/**
 * Result of checking for similar files
 */
export interface SimilarFilesResult {
  /** Whether any similar files were found */
  hasSimilar: boolean;
  /** List of similar files found */
  files: SimilarFile[];
}

/**
 * Find similar files that might conflict with intended generation.
 *
 * This checks for naming variations that could indicate duplicate entities:
 * - Singular vs plural forms (user.ts vs users.ts)
 * - Different file suffixes (user.ts vs user.schema.ts)
 *
 * @example
 * findSimilarFiles('/project', 'src/procedures/user.ts', 'user')
 * // Might find: src/procedures/users.ts
 *
 * @param projectRoot - Project root directory
 * @param targetPath - Path we intend to create
 * @param entityKebab - Entity name in kebab-case (e.g., 'user', 'blog-post')
 */
export function findSimilarFiles(
  projectRoot: string,
  targetPath: string,
  entityKebab: string
): SimilarFilesResult {
  const result: SimilarFilesResult = {
    hasSimilar: false,
    files: [],
  };

  const dir = dirname(targetPath);
  const fullDir = join(projectRoot, dir);

  // If directory doesn't exist, no similar files
  if (!existsSync(fullDir)) {
    return result;
  }

  // Get all files in the directory
  let filesInDir: string[];
  try {
    filesInDir = readdirSync(fullDir);
  } catch {
    return result;
  }

  // Generate variants to check
  const singularName = singularize(entityKebab);
  const pluralName = pluralize(entityKebab);

  // Patterns to match (without extension)
  const patterns = new Set<string>([
    singularName, // user
    pluralName, // users
    `${singularName}.schema`, // user.schema
    `${pluralName}.schema`, // users.schema
  ]);

  // Get the target filename without extension
  const targetFilename = basename(targetPath);
  const targetBase = targetFilename.replace(/\.(ts|js|tsx|jsx)$/, '');

  for (const file of filesInDir) {
    // Skip non-TS/JS files
    if (!/\.(ts|js|tsx|jsx)$/.test(file)) {
      continue;
    }

    // Get base name without extension
    const fileBase = file.replace(/\.(ts|js|tsx|jsx)$/, '');
    const filePath = join(dir, file);
    const fullFilePath = join(projectRoot, filePath);

    // Skip the exact target (will be handled by normal conflict detection)
    if (filePath === targetPath) {
      continue;
    }

    // Check if this file matches any of our patterns
    if (patterns.has(fileBase)) {
      // Determine the reason
      let reason: SimilarFile['reason'];
      if (fileBase === targetBase) {
        reason = 'exact';
      } else if (fileBase === singularName || fileBase === pluralName) {
        reason = fileBase === singularName ? 'singular' : 'plural';
      } else {
        reason = 'different-suffix';
      }

      // Only report if file actually exists
      if (existsSync(fullFilePath)) {
        result.files.push({
          path: filePath,
          reason,
          targetPath,
        });
        result.hasSimilar = true;
      }
    }
  }

  return result;
}

/**
 * Check for similar files across multiple target paths
 */
export function findAllSimilarFiles(
  projectRoot: string,
  targetPaths: string[],
  entityKebab: string
): SimilarFilesResult {
  const allFiles: SimilarFile[] = [];

  for (const targetPath of targetPaths) {
    const result = findSimilarFiles(projectRoot, targetPath, entityKebab);
    allFiles.push(...result.files);
  }

  // Deduplicate by path
  const uniqueFiles = Array.from(new Map(allFiles.map((f) => [f.path, f])).values());

  return {
    hasSimilar: uniqueFiles.length > 0,
    files: uniqueFiles,
  };
}

/**
 * Format similar files warning message
 */
export function formatSimilarFilesWarning(result: SimilarFilesResult, entityName: string): string {
  if (!result.hasSimilar) {
    return '';
  }

  const lines: string[] = [
    pc.yellow(`⚠ Found existing files that may conflict with "${entityName}":`),
    '',
  ];

  for (const file of result.files) {
    const reasonText =
      file.reason === 'singular'
        ? '(singular form)'
        : file.reason === 'plural'
          ? '(plural form)'
          : file.reason === 'different-suffix'
            ? '(different naming convention)'
            : '';

    lines.push(`  ${pc.cyan(file.path)} ${pc.dim(reasonText)}`);
  }

  lines.push('');
  lines.push(pc.dim('This may indicate a duplicate entity. Options:'));
  lines.push(pc.dim('  • Use --force to create anyway'));
  lines.push(pc.dim('  • Rename your entity to avoid confusion'));
  lines.push(pc.dim('  • Delete the existing files if they are unused'));

  return lines.join('\n');
}
