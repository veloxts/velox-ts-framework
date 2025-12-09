/**
 * Procedure Discovery Types
 *
 * Type definitions for the procedure discovery system that auto-scans
 * and registers procedures from the filesystem.
 *
 * @module discovery/types
 */

import type { ProcedureCollection } from '../types.js';

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Error codes for discovery operations
 *
 * Range: E40xx (discovery domain)
 */
export const DiscoveryErrorCode = {
  DIRECTORY_NOT_FOUND: 'E4001',
  NO_PROCEDURES_FOUND: 'E4002',
  INVALID_EXPORT: 'E4003',
  FILE_LOAD_ERROR: 'E4004',
  PERMISSION_DENIED: 'E4005',
  INVALID_FILE_TYPE: 'E4006',
} as const;

export type DiscoveryErrorCode = (typeof DiscoveryErrorCode)[keyof typeof DiscoveryErrorCode];

// ============================================================================
// Discovery Options
// ============================================================================

/**
 * Configuration options for procedure discovery
 */
export interface DiscoveryOptions {
  /**
   * Current working directory for resolving relative paths
   * @default process.cwd()
   */
  readonly cwd?: string;

  /**
   * Recursively scan subdirectories
   * @default false
   */
  readonly recursive?: boolean;

  /**
   * File extensions to include
   * @default ['.ts', '.js', '.mts', '.mjs']
   */
  readonly extensions?: readonly string[];

  /**
   * Patterns to exclude (simple glob patterns)
   * @default ['*.test.*', '*.spec.*', 'index.*', '*.d.ts']
   */
  readonly exclude?: readonly string[];

  /**
   * Error handling mode:
   * - 'throw': Throw on first invalid file (default)
   * - 'warn': Log warnings but continue
   * - 'silent': Skip invalid files silently
   * @default 'throw'
   */
  readonly onInvalidExport?: 'throw' | 'warn' | 'silent';
}

// ============================================================================
// Discovery Results
// ============================================================================

/**
 * Warning generated during discovery
 */
export interface DiscoveryWarning {
  /** Path to the file that caused the warning */
  readonly filePath: string;
  /** Warning message */
  readonly message: string;
  /** Error code for the warning */
  readonly code: DiscoveryErrorCode;
}

/**
 * Detailed result from verbose discovery
 */
export interface DiscoveryResult {
  /** Successfully loaded procedure collections */
  readonly collections: ProcedureCollection[];

  /** All files that were scanned */
  readonly scannedFiles: readonly string[];

  /** Files that contained valid procedure exports */
  readonly loadedFiles: readonly string[];

  /** Warnings for files that had issues (when onInvalidExport !== 'throw') */
  readonly warnings: readonly DiscoveryWarning[];
}

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Result of loading a single file
 * @internal
 */
export type LoadResult =
  | { readonly success: true; readonly collections: ProcedureCollection[] }
  | { readonly success: false; readonly code: DiscoveryErrorCode; readonly message: string };

/**
 * Options for file scanning
 * @internal
 */
export interface ScanOptions {
  readonly recursive: boolean;
  readonly extensions: readonly string[];
  readonly exclude: readonly string[];
}
