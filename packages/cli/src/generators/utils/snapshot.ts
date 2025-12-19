/**
 * Snapshot and Rollback System
 *
 * Creates snapshots of files before modification and enables rollback
 * if any operation fails. Provides transaction-like safety for file operations.
 */

import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';

import pc from 'picocolors';

// ============================================================================
// Types
// ============================================================================

/**
 * Snapshot of file states before modification
 *
 * Note: These properties are intentionally mutable since the snapshot
 * is populated incrementally as files are created/modified.
 */
export interface FileSnapshot {
  /** Files that were created (didn't exist before) - mutated by trackCreated() */
  createdFiles: string[];
  /** Files that were modified (original content saved) - mutated by saveOriginal() */
  modifiedFiles: Map<string, string>;
}

/**
 * Options for snapshot operations
 */
export interface SnapshotOptions {
  /** Whether to log rollback actions */
  readonly verbose?: boolean;
}

// ============================================================================
// Snapshot Management
// ============================================================================

/**
 * Create a new empty snapshot
 */
export function createSnapshot(): FileSnapshot {
  return {
    createdFiles: [],
    modifiedFiles: new Map(),
  };
}

/**
 * Save original file content before modification
 *
 * Call this before modifying any existing file.
 */
export function saveOriginal(snapshot: FileSnapshot, filePath: string): void {
  // Don't save if already tracked
  if (snapshot.modifiedFiles.has(filePath)) {
    return;
  }

  // Only save if file exists
  if (existsSync(filePath)) {
    const content = readFileSync(filePath, 'utf-8');
    snapshot.modifiedFiles.set(filePath, content);
  }
}

/**
 * Track a newly created file
 *
 * Call this after creating a new file.
 */
export function trackCreated(snapshot: FileSnapshot, filePath: string): void {
  // Only track if not already tracked as modified
  if (!snapshot.modifiedFiles.has(filePath) && !snapshot.createdFiles.includes(filePath)) {
    snapshot.createdFiles.push(filePath);
  }
}

// ============================================================================
// Rollback Operations
// ============================================================================

/**
 * Rollback all changes from a snapshot
 *
 * - Deletes files that were created
 * - Restores files that were modified to their original state
 */
export function rollback(snapshot: FileSnapshot, options: SnapshotOptions = {}): RollbackResult {
  const { verbose = false } = options;
  const deletedFiles: string[] = [];
  const restoredFiles: string[] = [];
  const errors: string[] = [];

  // Delete created files
  for (const filePath of snapshot.createdFiles) {
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
        deletedFiles.push(filePath);
        if (verbose) {
          console.log(pc.dim(`  Deleted: ${filePath}`));
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to delete ${filePath}: ${message}`);
    }
  }

  // Restore modified files
  for (const [filePath, originalContent] of snapshot.modifiedFiles) {
    try {
      writeFileSync(filePath, originalContent, 'utf-8');
      restoredFiles.push(filePath);
      if (verbose) {
        console.log(pc.dim(`  Restored: ${filePath}`));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to restore ${filePath}: ${message}`);
    }
  }

  return {
    success: errors.length === 0,
    deletedFiles,
    restoredFiles,
    errors,
  };
}

/**
 * Result of a rollback operation
 */
export interface RollbackResult {
  /** Whether rollback completed without errors */
  readonly success: boolean;
  /** Files that were deleted */
  readonly deletedFiles: string[];
  /** Files that were restored */
  readonly restoredFiles: string[];
  /** Errors encountered during rollback */
  readonly errors: string[];
}

// ============================================================================
// Transaction-like Operations
// ============================================================================

/**
 * Execute an operation with automatic rollback on failure
 *
 * @example
 * const result = await executeWithRollback(async (snapshot) => {
 *   // Save originals before modifying
 *   saveOriginal(snapshot, 'prisma/schema.prisma');
 *
 *   // Modify files...
 *   writeFileSync('prisma/schema.prisma', newContent);
 *
 *   // Track newly created files
 *   trackCreated(snapshot, 'src/procedures/post.ts');
 *
 *   // If any error is thrown, all changes are rolled back
 *   return { success: true };
 * });
 */
export async function executeWithRollback<T>(
  operation: (snapshot: FileSnapshot) => Promise<T>,
  options: SnapshotOptions = {}
): Promise<T> {
  const snapshot = createSnapshot();

  try {
    return await operation(snapshot);
  } catch (error) {
    // Rollback on error
    if (options.verbose) {
      console.log(pc.yellow('\n  Rolling back changes...'));
    }

    const result = rollback(snapshot, options);

    if (!result.success) {
      console.error(pc.red('  Warning: Some files could not be restored:'));
      for (const err of result.errors) {
        console.error(pc.red(`    - ${err}`));
      }
    } else if (options.verbose) {
      console.log(pc.dim('  Rollback complete.'));
    }

    throw error;
  }
}

/**
 * Clear a snapshot (for manual cleanup after success)
 */
export function clearSnapshot(snapshot: FileSnapshot): void {
  snapshot.createdFiles.length = 0;
  snapshot.modifiedFiles.clear();
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get summary of changes tracked in snapshot
 */
export function getSnapshotSummary(snapshot: FileSnapshot): string {
  const lines: string[] = [];

  if (snapshot.createdFiles.length > 0) {
    lines.push(`Created files (${snapshot.createdFiles.length}):`);
    for (const file of snapshot.createdFiles) {
      lines.push(`  - ${file}`);
    }
  }

  if (snapshot.modifiedFiles.size > 0) {
    lines.push(`Modified files (${snapshot.modifiedFiles.size}):`);
    for (const file of snapshot.modifiedFiles.keys()) {
      lines.push(`  - ${file}`);
    }
  }

  return lines.join('\n');
}

/**
 * Check if snapshot has any tracked changes
 */
export function hasChanges(snapshot: FileSnapshot): boolean {
  return snapshot.createdFiles.length > 0 || snapshot.modifiedFiles.size > 0;
}
