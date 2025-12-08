/**
 * Filesystem Utilities for Code Generation
 *
 * Safe file operations with conflict detection, directory creation,
 * and interactive prompting support.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative } from 'node:path';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import type { ConflictStrategy, GeneratedFile } from '../types.js';
import { GeneratorError, GeneratorErrorCode } from '../types.js';

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
export async function writeFile(
  file: GeneratedFile,
  options: WriteOptions
): Promise<WriteResult> {
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

    case 'prompt':
    default:
      return promptConflictResolution(path);
  }
}

/**
 * Interactively prompt user to resolve a conflict
 */
async function promptConflictResolution(
  path: string
): Promise<'overwrite' | 'skip' | 'error'> {
  const result = await p.select({
    message: `File ${pc.yellow(path)} already exists. What would you like to do?`,
    options: [
      { value: 'overwrite', label: 'Overwrite', hint: 'Replace existing file' },
      { value: 'skip', label: 'Skip', hint: 'Keep existing file' },
      { value: 'error', label: 'Cancel', hint: 'Abort generation' },
    ],
  });

  if (p.isCancel(result)) {
    throw new GeneratorError(
      GeneratorErrorCode.CANCELED,
      'Operation canceled by user'
    );
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
export function formatWriteResults(
  results: ReadonlyArray<WriteResult>,
  dryRun: boolean
): string {
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
export function formatWriteResultsJson(
  results: ReadonlyArray<WriteResult>
): string {
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
