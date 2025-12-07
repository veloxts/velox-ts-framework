/**
 * Error Formatter - Pretty terminal output with fix suggestions
 *
 * Inspired by Laravel's Ignition error pages, this module provides
 * beautiful, informative error messages with actionable suggestions.
 *
 * @module errors/formatter
 */

import { getErrorEntry } from './catalog.js';

// ============================================================================
// ANSI Color Codes (for terminal output)
// ============================================================================

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',

  // Text colors
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // Background colors
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
} as const;

/**
 * Check if colors should be enabled
 * Respects NO_COLOR env var and TTY detection
 */
function shouldUseColors(): boolean {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR) return true;
  return process.stdout.isTTY ?? false;
}

/**
 * Apply color to text if colors are enabled
 */
function color(text: string, ...codes: (keyof typeof COLORS)[]): string {
  if (!shouldUseColors()) return text;
  const prefix = codes.map((c) => COLORS[c]).join('');
  return `${prefix}${text}${COLORS.reset}`;
}

// ============================================================================
// Formatting Helpers
// ============================================================================

/**
 * Create a horizontal divider line
 */
function divider(char = '─', length = 70): string {
  return char.repeat(length);
}

/**
 * Indent text by a number of spaces
 */
function indent(text: string, spaces = 2): string {
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => `${pad}${line}`)
    .join('\n');
}

/**
 * Wrap text to a maximum width
 */
function wrapText(text: string, maxWidth = 68): string {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxWidth) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines.join('\n');
}

// ============================================================================
// Error Location Extraction
// ============================================================================

/**
 * Extracted error location from stack trace
 */
export interface ErrorLocation {
  file: string;
  line: number;
  column?: number;
  functionName?: string;
}

/**
 * Parse stack trace to extract error location
 *
 * @param error - The error to parse
 * @returns Location info or undefined
 */
export function extractErrorLocation(error: Error): ErrorLocation | undefined {
  if (!error.stack) return undefined;

  // Skip the first line (error message) and internal frames
  const lines = error.stack.split('\n').slice(1);

  for (const line of lines) {
    // Skip internal node_modules frames
    if (line.includes('node_modules')) continue;
    if (line.includes('node:internal')) continue;

    // Match V8 stack trace format: "at functionName (file:line:col)"
    // or "at file:line:col"
    const match = line.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?/);
    if (match) {
      return {
        functionName: match[1],
        file: match[2],
        line: parseInt(match[3], 10),
        column: parseInt(match[4], 10),
      };
    }
  }

  return undefined;
}

// ============================================================================
// Error Formatting Options
// ============================================================================

/**
 * Options for error formatting
 */
export interface FormatErrorOptions {
  /** Include the stack trace (default: false in production) */
  includeStack?: boolean;

  /** Include the fix suggestion (default: true) */
  includeFix?: boolean;

  /** Include documentation link (default: true) */
  includeDocs?: boolean;

  /** Include related error codes (default: true) */
  includeSeeAlso?: boolean;

  /** Maximum width for text wrapping */
  maxWidth?: number;
}

// ============================================================================
// Main Formatting Functions
// ============================================================================

/**
 * Format an error for terminal output with fix suggestions
 *
 * @param error - The error to format
 * @param catalogCode - Optional catalog error code
 * @param options - Formatting options
 * @returns Formatted error string for terminal display
 *
 * @example
 * ```typescript
 * try {
 *   // ... code that throws
 * } catch (error) {
 *   console.error(formatError(error, 'VELOX-1001'));
 * }
 * ```
 */
export function formatError(
  error: Error,
  catalogCode?: string,
  options: FormatErrorOptions = {}
): string {
  const {
    includeStack = process.env.NODE_ENV !== 'production',
    includeFix = true,
    includeDocs = true,
    includeSeeAlso = true,
    maxWidth = 68,
  } = options;

  const entry = catalogCode ? getErrorEntry(catalogCode) : undefined;
  const location = extractErrorLocation(error);
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(color(divider('═'), 'red'));
  lines.push('');

  // Error code and title
  if (entry) {
    lines.push(
      `  ${color(entry.code, 'red', 'bold')}  ${color(entry.title, 'white', 'bold')}`
    );
  } else {
    lines.push(`  ${color(error.name, 'red', 'bold')}`);
  }
  lines.push('');

  // Error message
  lines.push(indent(wrapText(error.message, maxWidth)));
  lines.push('');

  // Location
  if (location) {
    lines.push(color(divider('─'), 'gray'));
    lines.push('');
    lines.push(`  ${color('Location:', 'cyan', 'bold')}`);
    lines.push('');
    const loc = `${location.file}:${location.line}${location.column ? `:${location.column}` : ''}`;
    lines.push(`  ${color('→', 'yellow')} ${color(loc, 'white')}`);
    if (location.functionName) {
      lines.push(`    ${color('in', 'gray')} ${color(location.functionName, 'cyan')}`);
    }
    lines.push('');
  }

  // Description from catalog
  if (entry?.description) {
    lines.push(color(divider('─'), 'gray'));
    lines.push('');
    lines.push(`  ${color('Why this happens:', 'cyan', 'bold')}`);
    lines.push('');
    lines.push(indent(wrapText(entry.description, maxWidth)));
    lines.push('');
  }

  // Fix suggestion
  if (includeFix && entry?.fix) {
    lines.push(color(divider('─'), 'gray'));
    lines.push('');
    lines.push(`  ${color('How to fix:', 'green', 'bold')}`);
    lines.push('');
    lines.push(indent(wrapText(entry.fix.suggestion, maxWidth)));

    if (entry.fix.example) {
      lines.push('');
      lines.push(`  ${color('Example:', 'yellow')}`);
      lines.push('');
      // Format code example with syntax highlighting hint
      const exampleLines = entry.fix.example.split('\n');
      for (const exLine of exampleLines) {
        if (exLine.trim().startsWith('#') || exLine.trim().startsWith('//')) {
          lines.push(`  ${color(exLine, 'gray')}`);
        } else if (exLine.trim().startsWith('+')) {
          lines.push(`  ${color(exLine, 'green')}`);
        } else if (exLine.trim().startsWith('-')) {
          lines.push(`  ${color(exLine, 'red')}`);
        } else {
          lines.push(`  ${color(exLine, 'white')}`);
        }
      }
      lines.push('');
    }
  }

  // Documentation link
  if (includeDocs && entry?.docsUrl) {
    lines.push(color(divider('─'), 'gray'));
    lines.push('');
    lines.push(`  ${color('Documentation:', 'blue', 'bold')}`);
    lines.push(`  ${color(entry.docsUrl, 'cyan')}`);
    lines.push('');
  }

  // Related errors
  if (includeSeeAlso && entry?.seeAlso && entry.seeAlso.length > 0) {
    lines.push(`  ${color('See also:', 'gray')} ${entry.seeAlso.map((c) => color(c, 'yellow')).join(', ')}`);
    lines.push('');
  }

  // Stack trace (development only)
  if (includeStack && error.stack) {
    lines.push(color(divider('─'), 'gray'));
    lines.push('');
    lines.push(`  ${color('Stack trace:', 'gray', 'bold')}`);
    lines.push('');
    const stackLines = error.stack.split('\n').slice(1, 8); // First 7 frames
    for (const stackLine of stackLines) {
      lines.push(`  ${color(stackLine.trim(), 'gray')}`);
    }
    if (error.stack.split('\n').length > 8) {
      lines.push(`  ${color('... more frames hidden', 'dim')}`);
    }
    lines.push('');
  }

  // Footer
  lines.push(color(divider('═'), 'red'));
  lines.push('');

  return lines.join('\n');
}

/**
 * Format an error for JSON API response
 * Includes catalog metadata but not stack traces
 *
 * @param error - The error to format
 * @param catalogCode - Optional catalog error code
 * @returns JSON-serializable error object
 */
export function formatErrorForApi(
  error: Error & { statusCode?: number; code?: string; fields?: Record<string, string> },
  catalogCode?: string
): Record<string, unknown> {
  const entry = catalogCode ? getErrorEntry(catalogCode) : undefined;

  const response: Record<string, unknown> = {
    error: error.name,
    message: error.message,
    statusCode: error.statusCode ?? entry?.statusCode ?? 500,
    code: catalogCode ?? error.code,
  };

  // Include field errors for validation
  if (error.fields) {
    response.fields = error.fields;
  }

  // Include fix suggestion in development
  if (process.env.NODE_ENV !== 'production' && entry?.fix) {
    response.fix = entry.fix.suggestion;
  }

  // Include docs link
  if (entry?.docsUrl) {
    response.docs = entry.docsUrl;
  }

  return response;
}

/**
 * Format a short one-line error summary
 *
 * @param error - The error
 * @param catalogCode - Optional catalog code
 * @returns One-line error string
 */
export function formatErrorOneLine(error: Error, catalogCode?: string): string {
  const entry = catalogCode ? getErrorEntry(catalogCode) : undefined;

  if (entry) {
    return `${color(entry.code, 'red')}: ${error.message}`;
  }

  return `${color(error.name, 'red')}: ${error.message}`;
}

// ============================================================================
// Error Logging Helpers
// ============================================================================

/**
 * Log an error with pretty formatting
 *
 * @param error - The error to log
 * @param catalogCode - Optional catalog error code
 */
export function logError(error: Error, catalogCode?: string): void {
  console.error(formatError(error, catalogCode));
}

/**
 * Log a warning with pretty formatting
 *
 * @param message - Warning message
 * @param suggestion - Optional fix suggestion
 */
export function logWarning(message: string, suggestion?: string): void {
  const lines: string[] = [];
  lines.push('');
  lines.push(`${color('⚠', 'yellow')}  ${color('Warning:', 'yellow', 'bold')} ${message}`);
  if (suggestion) {
    lines.push(`   ${color('→', 'gray')} ${suggestion}`);
  }
  lines.push('');
  console.warn(lines.join('\n'));
}

/**
 * Log a deprecation warning
 *
 * @param oldApi - The deprecated API
 * @param newApi - The replacement API
 * @param removeVersion - Version when it will be removed
 */
export function logDeprecation(oldApi: string, newApi: string, removeVersion?: string): void {
  const removal = removeVersion ? ` (will be removed in ${removeVersion})` : '';
  logWarning(
    `${color(oldApi, 'white')} is deprecated${removal}`,
    `Use ${color(newApi, 'green')} instead`
  );
}
