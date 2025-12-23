/**
 * Template Compiler
 *
 * Reads template source files from disk and applies placeholder replacements.
 * Source files are actual TypeScript/TSX that can be linted and type-checked.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { applyPlaceholders, processConditionals } from './placeholders.js';
import type { TemplateConfig, TemplateFile } from './types.js';

// ============================================================================
// Path Resolution
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Cached source directory path (memoized for performance) */
let cachedSourceDir: string | null = null;

/**
 * Get the path to the source directory.
 *
 * Source files are located at:
 * - Development: packages/create/src/templates/source/
 * - Production (npm): packages/create/src/templates/source/ (included via files array)
 *
 * We try multiple paths to handle both development and production scenarios:
 * 1. Relative to compiled dist/templates/compiler.js -> ../../src/templates/source
 * 2. Relative to source (when running ts-node or similar)
 *
 * Result is memoized since the path doesn't change during execution.
 */
function getSourceDir(): string {
  if (cachedSourceDir !== null) {
    return cachedSourceDir;
  }

  // Try path relative to dist (production build)
  const distRelativePath = path.join(__dirname, '..', '..', 'src', 'templates', 'source');
  if (fs.existsSync(distRelativePath)) {
    cachedSourceDir = distRelativePath;
    return cachedSourceDir;
  }

  // Fallback to path relative to src (development with ts-node/tsx)
  const srcRelativePath = path.join(__dirname, 'source');
  if (fs.existsSync(srcRelativePath)) {
    cachedSourceDir = srcRelativePath;
    return cachedSourceDir;
  }

  throw new Error(
    `Template source directory not found. Checked:\n` +
      `  - ${distRelativePath}\n` +
      `  - ${srcRelativePath}`
  );
}

// ============================================================================
// Template Reading
// ============================================================================

/**
 * Read a template source file from disk.
 *
 * @param relativePath - Path relative to source/ directory (e.g., 'web/main.tsx')
 * @returns File content as string
 * @throws Error if file not found
 */
export function readTemplateSource(relativePath: string): string {
  const sourcePath = path.join(getSourceDir(), relativePath);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Template source file not found: ${relativePath}`);
  }

  return fs.readFileSync(sourcePath, 'utf-8');
}

/**
 * Read and compile a template source file.
 *
 * 1. Reads the source file
 * 2. Processes conditional blocks
 * 3. Applies placeholder replacements
 *
 * @param relativePath - Path relative to source/ directory
 * @param config - Template configuration
 * @returns Compiled template content
 */
export function compileTemplate(relativePath: string, config: TemplateConfig): string {
  const content = readTemplateSource(relativePath);
  const withConditionals = processConditionals(content, config);
  return applyPlaceholders(withConditionals, config);
}

/**
 * Read and compile a template, returning as a TemplateFile.
 *
 * @param sourcePath - Path relative to source/ directory
 * @param outputPath - Path where the file will be written in the generated project
 * @param config - Template configuration
 * @returns TemplateFile with path and compiled content
 */
export function compileTemplateFile(
  sourcePath: string,
  outputPath: string,
  config: TemplateConfig
): TemplateFile {
  return {
    path: outputPath,
    content: compileTemplate(sourcePath, config),
  };
}

// ============================================================================
// Batch Compilation
// ============================================================================

/**
 * Mapping of source path to output path.
 */
export interface TemplatePath {
  /** Path relative to source/ directory */
  source: string;
  /** Path where file will be written in generated project */
  output: string;
}

/**
 * Compile multiple template files in batch.
 *
 * @param paths - Array of source/output path mappings
 * @param config - Template configuration
 * @returns Array of compiled TemplateFiles
 */
export function compileTemplates(paths: TemplatePath[], config: TemplateConfig): TemplateFile[] {
  return paths.map(({ source, output }) => compileTemplateFile(source, output, config));
}

// ============================================================================
// Source File Discovery
// ============================================================================

/**
 * Check if a source file exists.
 *
 * @param relativePath - Path relative to source/ directory
 * @returns true if file exists
 */
export function sourceFileExists(relativePath: string): boolean {
  const sourcePath = path.join(getSourceDir(), relativePath);
  return fs.existsSync(sourcePath);
}

/**
 * List all files in a source directory.
 *
 * @param relativeDir - Directory path relative to source/
 * @returns Array of file paths relative to source/
 */
export function listSourceFiles(relativeDir: string): string[] {
  const dirPath = path.join(getSourceDir(), relativeDir);

  if (!fs.existsSync(dirPath)) {
    return [];
  }

  const files: string[] = [];

  function walkDir(currentPath: string, basePath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      const relativePath = path.join(basePath, entry.name);

      if (entry.isDirectory()) {
        walkDir(fullPath, relativePath);
      } else {
        files.push(relativePath);
      }
    }
  }

  walkDir(dirPath, relativeDir);
  return files;
}
