/**
 * Error Parser - Analyzes development errors and provides actionable feedback
 *
 * Parses error messages and stack traces to identify error types, extract
 * file locations, and generate helpful suggestions for resolution.
 *
 * Inspired by Vite's error overlay and Next.js's error page patterns.
 *
 * @example
 * ```typescript
 * const parsed = parseDevError(error);
 *
 * console.log(parsed.type);        // 'syntax-error'
 * console.log(parsed.filePath);    // 'src/procedures/users.ts'
 * console.log(parsed.line);        // 42
 * console.log(parsed.suggestion);  // 'Check for missing closing bracket...'
 * ```
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Categories of development errors for targeted handling
 */
export type DevErrorType =
  | 'syntax-error' // TypeScript/JavaScript syntax errors
  | 'module-not-found' // Missing imports or unresolved modules
  | 'type-error' // TypeScript type mismatches
  | 'runtime-error' // Errors during code execution
  | 'hmr-failure' // Hot module replacement specific errors
  | 'database-error' // Prisma/database connection errors
  | 'port-in-use' // Server port already bound
  | 'permission-denied' // File system permission issues
  | 'unknown'; // Unclassified errors

/**
 * Parsed error with extracted metadata and suggestions
 */
export interface ParsedDevError {
  /** Original error object */
  readonly originalError: Error;
  /** Classified error type */
  readonly type: DevErrorType;
  /** Clean, user-friendly error message */
  readonly message: string;
  /** File path where error originated (if extractable) */
  readonly filePath?: string;
  /** Line number (if extractable) */
  readonly line?: number;
  /** Column number (if extractable) */
  readonly column?: number;
  /** Actionable suggestion for fixing the error */
  readonly suggestion?: string;
  /** Related documentation or help link */
  readonly helpUrl?: string;
  /** Whether this error is likely recoverable via file edit */
  readonly isRecoverable: boolean;
  /** Code frame snippet around the error (if available) */
  readonly codeFrame?: string;
}

/**
 * Pattern for matching file locations in error messages
 */
interface LocationPattern {
  readonly regex: RegExp;
  readonly fileGroup: number;
  readonly lineGroup: number;
  readonly columnGroup?: number;
}

// ============================================================================
// Error Detection Patterns
// ============================================================================

/**
 * Patterns to identify error types from messages
 */
const ERROR_TYPE_PATTERNS: ReadonlyArray<{
  readonly type: DevErrorType;
  readonly patterns: readonly RegExp[];
}> = [
  {
    type: 'syntax-error',
    patterns: [
      /SyntaxError/i,
      /Unexpected token/i,
      /Missing semicolon/i,
      /Unexpected end of input/i,
      /Invalid or unexpected token/i,
      /Unterminated string/i,
      /Expression expected/i,
      /Declaration or statement expected/i,
    ],
  },
  {
    type: 'module-not-found',
    patterns: [
      /Cannot find module/i,
      /Module not found/i,
      /ERR_MODULE_NOT_FOUND/i,
      /Cannot resolve module/i,
      /Unable to resolve/i,
      /Could not resolve/i,
    ],
  },
  {
    type: 'type-error',
    patterns: [
      /TypeError/i,
      /Type '.*' is not assignable/i,
      /Property '.*' does not exist/i,
      /Argument of type/i,
      /Cannot read propert/i,
      /is not a function/i,
      /undefined is not/i,
      /null is not/i,
    ],
  },
  {
    type: 'database-error',
    patterns: [
      /PrismaClient/i,
      /P\d{4}:/i, // Prisma error codes like P1001
      /Connection refused/i,
      /ECONNREFUSED.*5432/i, // PostgreSQL
      /ECONNREFUSED.*3306/i, // MySQL
      /database.*does not exist/i,
      /relation.*does not exist/i,
    ],
  },
  {
    type: 'port-in-use',
    patterns: [/EADDRINUSE/i, /address already in use/i, /port.*already.*bound/i],
  },
  {
    type: 'permission-denied',
    patterns: [/EACCES/i, /EPERM/i, /permission denied/i, /access denied/i],
  },
  {
    type: 'hmr-failure',
    patterns: [
      /hot-hook/i,
      /HMR.*failed/i,
      /Hot.*update.*failed/i,
      /Cannot apply update/i,
      /Module.*cannot be hot-updated/i,
    ],
  },
];

/**
 * Patterns to extract file locations from error messages and stacks
 */
const LOCATION_PATTERNS: readonly LocationPattern[] = [
  // TypeScript/esbuild: path/file.ts:10:5
  {
    regex: /([^\s(]+\.(?:ts|tsx|js|jsx|mjs|cjs)):(\d+):(\d+)/,
    fileGroup: 1,
    lineGroup: 2,
    columnGroup: 3,
  },
  // Node.js: at Function (path/file.ts:10:5)
  { regex: /at\s+.*\(([^)]+):(\d+):(\d+)\)/, fileGroup: 1, lineGroup: 2, columnGroup: 3 },
  // Node.js: at path/file.ts:10:5
  { regex: /at\s+([^\s]+):(\d+):(\d+)/, fileGroup: 1, lineGroup: 2, columnGroup: 3 },
  // ESLint/Prettier style: path/file.ts(10,5)
  {
    regex: /([^\s(]+\.(?:ts|tsx|js|jsx))\((\d+),(\d+)\)/,
    fileGroup: 1,
    lineGroup: 2,
    columnGroup: 3,
  },
  // Simple: path/file.ts:10
  { regex: /([^\s:]+\.(?:ts|tsx|js|jsx|mjs|cjs)):(\d+)(?:\s|$|:)/, fileGroup: 1, lineGroup: 2 },
];

/**
 * Suggestions mapped to error types
 */
const ERROR_SUGGESTIONS: Readonly<Record<DevErrorType, string>> = {
  'syntax-error':
    'Check for missing brackets, parentheses, or semicolons. Ensure all strings and template literals are properly closed.',
  'module-not-found':
    'Verify the import path is correct. Check if the module is installed (run pnpm install) and the file extension matches your imports.',
  'type-error':
    'Check that all variables are properly typed and initialized. Verify the types match between function arguments and parameters.',
  'runtime-error':
    'Add console.log statements or use a debugger to trace the code path. Check for null/undefined values.',
  'hmr-failure':
    'This file may be outside HMR boundaries. Try editing a file in src/procedures/, src/schemas/, or src/handlers/ instead.',
  'database-error':
    'Ensure your database is running and accessible. Check DATABASE_URL in .env matches your database configuration. Run `velox migrate:status` to check migration status.',
  'port-in-use':
    'Another process is using this port. Stop other servers or use a different port with --port flag.',
  'permission-denied':
    'Check file permissions. You may need to run with elevated privileges or fix ownership of the files.',
  unknown:
    'Check the full error message and stack trace for clues. Consider searching for the error message online.',
};

/**
 * Help URLs for common error types
 */
const ERROR_HELP_URLS: Readonly<Partial<Record<DevErrorType, string>>> = {
  'database-error': 'https://www.prisma.io/docs/reference/api-reference/error-reference',
  'module-not-found': 'https://nodejs.org/api/esm.html#resolution-algorithm',
};

// ============================================================================
// Core Parser Functions
// ============================================================================

/**
 * Parse a development error into structured, actionable information.
 *
 * @param error - The error to parse
 * @returns Parsed error with type, location, and suggestions
 */
export function parseDevError(error: Error): ParsedDevError {
  const errorText = formatErrorText(error);
  const type = detectErrorType(errorText);
  const location = extractLocation(errorText);
  const message = cleanErrorMessage(error.message);
  const suggestion = generateSuggestion(type, errorText);
  const codeFrame = extractCodeFrame(errorText);

  return {
    originalError: error,
    type,
    message,
    filePath: location?.filePath,
    line: location?.line,
    column: location?.column,
    suggestion,
    helpUrl: ERROR_HELP_URLS[type],
    isRecoverable: isErrorRecoverable(type),
    codeFrame,
  };
}

/**
 * Combine error message and stack for comprehensive analysis
 */
function formatErrorText(error: Error): string {
  const parts: string[] = [error.message];

  if (error.stack) {
    parts.push(error.stack);
  }

  // Include cause if present (Error.cause in ES2022+)
  // Use proper type narrowing instead of type assertion
  if ('cause' in error && error.cause instanceof Error) {
    parts.push(`Caused by: ${error.cause.message}`);
    if (error.cause.stack) {
      parts.push(error.cause.stack);
    }
  }

  return parts.join('\n');
}

/**
 * Detect the error type from error text
 */
function detectErrorType(errorText: string): DevErrorType {
  for (const { type, patterns } of ERROR_TYPE_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(errorText)) {
        return type;
      }
    }
  }
  return 'unknown';
}

/**
 * Extract file location from error text
 */
function extractLocation(
  errorText: string
): { filePath: string; line: number; column?: number } | null {
  for (const pattern of LOCATION_PATTERNS) {
    const match = pattern.regex.exec(errorText);
    if (match) {
      const filePath = match[pattern.fileGroup];
      const line = parseInt(match[pattern.lineGroup], 10);
      const column = pattern.columnGroup ? parseInt(match[pattern.columnGroup], 10) : undefined;

      // Skip internal node_modules paths unless they're the only match
      if (!filePath.includes('node_modules/') || !hasUserCodeLocation(errorText)) {
        return { filePath, line, column };
      }
    }
  }
  return null;
}

/**
 * Check if error text contains a user code location (not node_modules)
 */
function hasUserCodeLocation(errorText: string): boolean {
  for (const pattern of LOCATION_PATTERNS) {
    const regex = new RegExp(pattern.regex.source, 'g');
    let match = regex.exec(errorText);

    while (match !== null) {
      const filePath = match[pattern.fileGroup];
      if (!filePath.includes('node_modules/')) {
        return true;
      }
      match = regex.exec(errorText);
    }
  }
  return false;
}

/**
 * Clean up error message for display
 */
// ANSI escape code pattern - built from string to avoid control character lint warning
const ANSI_PATTERN = new RegExp(`${String.fromCharCode(0x1b)}\\[[0-9;]*m`, 'g');

function cleanErrorMessage(message: string): string {
  // Remove ANSI color codes
  let cleaned = message.replace(ANSI_PATTERN, '');

  // Remove excessive whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Truncate very long messages
  const maxLength = 200;
  if (cleaned.length > maxLength) {
    cleaned = `${cleaned.slice(0, maxLength)}...`;
  }

  return cleaned;
}

/**
 * Generate contextual suggestion based on error type and content
 */
function generateSuggestion(type: DevErrorType, errorText: string): string {
  // Start with base suggestion for the error type
  let suggestion = ERROR_SUGGESTIONS[type];

  // Add contextual enhancements
  if (type === 'module-not-found') {
    // Extract module name for more specific advice
    const moduleMatch = /Cannot find module ['"]([^'"]+)['"]/i.exec(errorText);
    if (moduleMatch) {
      const moduleName = moduleMatch[1];
      if (moduleName.startsWith('.') || moduleName.startsWith('/')) {
        suggestion = `Check that the file '${moduleName}' exists and the path is correct relative to the importing file.`;
      } else if (moduleName.startsWith('@')) {
        suggestion = `Install the package: pnpm add ${moduleName}`;
      } else {
        suggestion = `Install the package: pnpm add ${moduleName}`;
      }
    }
  }

  if (type === 'database-error') {
    // Check for specific Prisma errors
    if (/P1001/i.test(errorText)) {
      suggestion =
        'Cannot reach database server. Ensure your database is running and DATABASE_URL is correct.';
    } else if (/P1002/i.test(errorText)) {
      suggestion =
        'Database server timed out. Check if the database is overloaded or the connection is slow.';
    } else if (/P1003/i.test(errorText)) {
      suggestion =
        'Database does not exist. Run `velox migrate:run` to create and migrate the database.';
    } else if (/P2002/i.test(errorText)) {
      suggestion = 'Unique constraint violation. A record with this value already exists.';
    } else if (/P2025/i.test(errorText)) {
      suggestion = 'Record not found. The requested record does not exist in the database.';
    }
  }

  if (type === 'syntax-error') {
    // Check for common syntax issues
    if (/Unexpected token.*export/i.test(errorText)) {
      suggestion =
        'Ensure you\'re using ES modules syntax. Check that "type": "module" is in your package.json.';
    } else if (/Unexpected token.*import/i.test(errorText)) {
      suggestion =
        'Check that your Node.js version supports ES modules (v14+) and "type": "module" is in package.json.';
    }
  }

  return suggestion;
}

/**
 * Extract code frame from error text if present
 */
function extractCodeFrame(errorText: string): string | undefined {
  // Look for code frame patterns (common in esbuild, TypeScript, etc.)
  // Pattern: line numbers followed by code, with > marking error line
  const frameMatch = /(?:^|\n)((?:\s*\d+\s*│[^\n]*\n)+)/m.exec(errorText);
  if (frameMatch) {
    return frameMatch[1].trim();
  }

  // Alternative pattern: > marking with pipe separators
  const altFrameMatch = /(?:^|\n)((?:\s*>?\s*\d+\s*\|[^\n]*\n)+)/m.exec(errorText);
  if (altFrameMatch) {
    return altFrameMatch[1].trim();
  }

  return undefined;
}

/**
 * Determine if error is recoverable by editing files
 */
function isErrorRecoverable(type: DevErrorType): boolean {
  const recoverableTypes: readonly DevErrorType[] = [
    'syntax-error',
    'module-not-found',
    'type-error',
    'runtime-error',
    'hmr-failure',
  ];

  return recoverableTypes.includes(type);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if an error is a development-time error vs a fatal/configuration error
 */
export function isDevelopmentError(error: Error): boolean {
  const parsed = parseDevError(error);
  return parsed.isRecoverable;
}

/**
 * Get a short, displayable error type label
 */
export function getErrorTypeLabel(type: DevErrorType): string {
  const labels: Record<DevErrorType, string> = {
    'syntax-error': 'Syntax Error',
    'module-not-found': 'Module Not Found',
    'type-error': 'Type Error',
    'runtime-error': 'Runtime Error',
    'hmr-failure': 'HMR Failed',
    'database-error': 'Database Error',
    'port-in-use': 'Port In Use',
    'permission-denied': 'Permission Denied',
    unknown: 'Error',
  };
  return labels[type];
}

/**
 * Format parsed error for console output
 */
export function formatParsedError(parsed: ParsedDevError): string {
  const parts: string[] = [];

  // Error type and message
  parts.push(`${getErrorTypeLabel(parsed.type)}: ${parsed.message}`);

  // Location
  if (parsed.filePath) {
    let location = `  at ${parsed.filePath}`;
    if (parsed.line) {
      location += `:${parsed.line}`;
      if (parsed.column) {
        location += `:${parsed.column}`;
      }
    }
    parts.push(location);
  }

  // Code frame
  if (parsed.codeFrame) {
    parts.push('');
    parts.push(parsed.codeFrame);
  }

  // Suggestion
  if (parsed.suggestion) {
    parts.push('');
    parts.push(`  Suggestion: ${parsed.suggestion}`);
  }

  // Help URL
  if (parsed.helpUrl) {
    parts.push(`  More info: ${parsed.helpUrl}`);
  }

  return parts.join('\n');
}
