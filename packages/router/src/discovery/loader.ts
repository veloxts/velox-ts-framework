/**
 * Procedure Discovery Loader
 *
 * Core logic for scanning the filesystem and loading procedure collections.
 * Uses dynamic imports with ESM-compatible file URLs.
 *
 * @module discovery/loader
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { isProcedureCollection } from '../procedure/builder.js';
import type { ProcedureCollection } from '../types.js';
import {
  type DiscoveryError,
  directoryNotFound,
  fileLoadError,
  invalidExport,
  noProceduresFound,
} from './errors.js';
import {
  DiscoveryErrorCode,
  type DiscoveryOptions,
  type DiscoveryResult,
  type DiscoveryWarning,
  type LoadResult,
  type ScanOptions,
} from './types.js';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_EXTENSIONS = ['.ts', '.js', '.mts', '.mjs'] as const;

const DEFAULT_EXCLUDE_PATTERNS = ['*.test.*', '*.spec.*', 'index.*', '*.d.ts'] as const;

// ============================================================================
// Main Discovery Functions
// ============================================================================

/**
 * Discover procedure collections from the filesystem
 *
 * Scans a directory for files exporting ProcedureCollection objects,
 * validates them at runtime, and returns type-safe results.
 *
 * @param searchPath - Absolute or relative path to procedures directory
 * @param options - Discovery configuration
 * @returns Promise resolving to discovered procedure collections
 *
 * @example Basic usage
 * ```typescript
 * const collections = await discoverProcedures('./src/procedures');
 * await app.register(rest(collections), { prefix: '/api' });
 * ```
 *
 * @example With options
 * ```typescript
 * const collections = await discoverProcedures('./src/procedures', {
 *   recursive: true,
 *   cwd: process.cwd(),
 * });
 * ```
 */
export async function discoverProcedures(
  searchPath: string,
  options: DiscoveryOptions = {}
): Promise<ProcedureCollection[]> {
  const result = await discoverProceduresVerbose(searchPath, options);
  return result.collections;
}

/**
 * Discover procedure collections with detailed results
 *
 * Same as discoverProcedures but returns additional metadata about
 * scanned files, loaded files, and any warnings.
 *
 * @param searchPath - Absolute or relative path to procedures directory
 * @param options - Discovery configuration
 * @returns Promise resolving to detailed discovery results
 *
 * @example
 * ```typescript
 * const result = await discoverProceduresVerbose('./src/procedures', {
 *   onInvalidExport: 'warn',
 * });
 *
 * console.log(`Found ${result.collections.length} collections`);
 * console.log(`Scanned ${result.scannedFiles.length} files`);
 * result.warnings.forEach(w => console.warn(w.message));
 * ```
 */
export async function discoverProceduresVerbose(
  searchPath: string,
  options: DiscoveryOptions = {}
): Promise<DiscoveryResult> {
  const {
    cwd = process.cwd(),
    recursive = false,
    extensions = DEFAULT_EXTENSIONS,
    exclude = DEFAULT_EXCLUDE_PATTERNS,
    onInvalidExport = 'throw',
  } = options;

  // Resolve to absolute path
  const absolutePath = path.isAbsolute(searchPath) ? searchPath : path.resolve(cwd, searchPath);

  // Verify directory exists
  const dirExists = await directoryExists(absolutePath);
  if (!dirExists) {
    throw directoryNotFound(absolutePath);
  }

  // Scan for procedure files
  const files = await scanForProcedureFiles(absolutePath, {
    recursive,
    extensions,
    exclude,
  });

  // Load all files in parallel
  const loadResults = await Promise.all(files.map((file) => loadProcedureFile(file)));

  // Aggregate results
  const collections: ProcedureCollection[] = [];
  const loadedFiles: string[] = [];
  const warnings: DiscoveryWarning[] = [];

  for (let i = 0; i < loadResults.length; i++) {
    const result = loadResults[i];
    const file = files[i];

    if (result.success) {
      collections.push(...result.collections);
      if (result.collections.length > 0) {
        loadedFiles.push(file);
      }
    } else if (onInvalidExport === 'throw') {
      // Re-throw as DiscoveryError
      throw createDiscoveryError(file, result.code, result.message);
    } else {
      // Add to warnings
      warnings.push({
        filePath: file,
        message: result.message,
        code: result.code,
      });

      // Log warning if mode is 'warn'
      if (onInvalidExport === 'warn') {
        console.warn(`[Discovery Warning] ${file}: ${result.message}`);
      }
    }
  }

  // Error if no procedures found
  if (collections.length === 0) {
    throw noProceduresFound(absolutePath, files.length);
  }

  return {
    collections,
    scannedFiles: files,
    loadedFiles,
    warnings,
  };
}

// ============================================================================
// File Scanning
// ============================================================================

/**
 * Scan directory for procedure files
 */
async function scanForProcedureFiles(dirPath: string, options: ScanOptions): Promise<string[]> {
  const { recursive, extensions, exclude } = options;
  const files: string[] = [];

  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // Skip excluded directories
      if (shouldExcludeDirectory(entry.name)) {
        continue;
      }

      if (recursive) {
        // Recursively scan subdirectories
        const subFiles = await scanForProcedureFiles(fullPath, options);
        files.push(...subFiles);
      }
    } else if (entry.isFile()) {
      // Check extension
      const ext = path.extname(entry.name);
      if (!extensions.includes(ext)) continue;

      // Check exclusion patterns
      if (shouldExclude(entry.name, exclude)) continue;

      files.push(fullPath);
    }
  }

  // Sort for consistent ordering
  return files.sort();
}

/**
 * Check if a filename matches any exclusion pattern
 */
function shouldExclude(filename: string, patterns: readonly string[]): boolean {
  for (const pattern of patterns) {
    if (matchSimplePattern(filename, pattern)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a directory should be excluded
 */
function shouldExcludeDirectory(dirname: string): boolean {
  const excludedDirs = ['__tests__', '__mocks__', 'node_modules', '.git'];
  return excludedDirs.includes(dirname);
}

/**
 * Simple pattern matching (supports * wildcard)
 */
function matchSimplePattern(filename: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars except *
    .replace(/\*/g, '.*'); // Convert * to .*

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(filename);
}

// ============================================================================
// File Loading
// ============================================================================

/**
 * Load a single procedure file and extract collections
 */
async function loadProcedureFile(filePath: string): Promise<LoadResult> {
  // Dynamic import using file URL for ESM compatibility
  let module: Record<string, unknown>;
  try {
    const fileUrl = pathToFileURL(filePath).href;
    module = (await import(fileUrl)) as Record<string, unknown>;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return {
      success: false,
      code: DiscoveryErrorCode.FILE_LOAD_ERROR,
      message: `Failed to load file: ${err.message}`,
    };
  }

  // Extract procedure collections from exports
  const collections: ProcedureCollection[] = [];
  const invalidExports: Array<{ name: string; reason: string }> = [];

  for (const [exportName, exportValue] of Object.entries(module)) {
    // Skip non-objects
    if (exportValue === null || typeof exportValue !== 'object') {
      continue;
    }

    // Check if it's a valid procedure collection
    if (isProcedureCollection(exportValue)) {
      collections.push(exportValue);
    } else if (looksLikeProcedureCollection(exportValue)) {
      // It has the shape but failed validation - track for error
      invalidExports.push({
        name: exportName,
        reason:
          'Object has namespace and procedures but procedures are not valid CompiledProcedures',
      });
    }
    // Other objects are silently ignored (utilities, constants, etc.)
  }

  // If we found invalid exports and no valid ones, report the error
  if (collections.length === 0 && invalidExports.length > 0) {
    const first = invalidExports[0];
    return {
      success: false,
      code: DiscoveryErrorCode.INVALID_EXPORT,
      message: `Invalid export '${first.name}': ${first.reason}`,
    };
  }

  return { success: true, collections };
}

/**
 * Check if a value looks like a procedure collection but might not be valid
 *
 * Used to provide better error messages for almost-correct exports
 */
function looksLikeProcedureCollection(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.namespace === 'string' && typeof obj.procedures === 'object';
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a directory exists
 */
async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Create a DiscoveryError from load result
 */
function createDiscoveryError(
  filePath: string,
  code: DiscoveryErrorCode,
  message: string
): DiscoveryError {
  if (code === DiscoveryErrorCode.FILE_LOAD_ERROR) {
    return fileLoadError(filePath, new Error(message));
  }
  if (code === DiscoveryErrorCode.INVALID_EXPORT) {
    // Parse export name from message
    const match = /Invalid export '([^']+)'/.exec(message);
    const exportName = match ? match[1] : 'unknown';
    return invalidExport(filePath, exportName, message);
  }
  // Fallback - shouldn't happen
  return fileLoadError(filePath, new Error(message));
}
