/**
 * Errors Resource
 *
 * Exposes the VeloxTS error catalog to AI tools.
 */

import { ERROR_CATALOG, getErrorsByCategory } from '@veloxts/cli';

// ============================================================================
// Types
// ============================================================================

/**
 * Error information for MCP response
 */
export interface ErrorInfo {
  code: string;
  name: string;
  message: string;
  fix?: string;
  docsUrl?: string;
  category: string;
}

/**
 * Errors resource response
 */
export interface ErrorsResourceResponse {
  errors: ErrorInfo[];
  categories: {
    prefix: string;
    name: string;
    count: number;
  }[];
  totalCount: number;
}

// ============================================================================
// Error Categories
// ============================================================================

const ERROR_CATEGORIES = [
  { prefix: 'E1', name: 'Core/Runtime' },
  { prefix: 'E2', name: 'Generator' },
  { prefix: 'E3', name: 'Seeding' },
  { prefix: 'E4', name: 'Migration' },
  { prefix: 'E5', name: 'Dev Server' },
  { prefix: 'E6', name: 'Validation' },
  { prefix: 'E7', name: 'Authentication' },
  { prefix: 'E8', name: 'Database' },
  { prefix: 'E9', name: 'Configuration' },
] as const;

// ============================================================================
// Resource Handler
// ============================================================================

/**
 * Get the category name for an error code
 */
function getErrorCategory(code: string): string {
  const prefix = code.substring(0, 2);
  const category = ERROR_CATEGORIES.find((c) => c.prefix === prefix);
  return category?.name ?? 'Unknown';
}

/**
 * Get all errors from the catalog
 */
export function getErrors(): ErrorsResourceResponse {
  const errors: ErrorInfo[] = Object.values(ERROR_CATALOG).map((def) => ({
    code: def.code,
    name: def.name,
    message: def.message,
    fix: def.fix,
    docsUrl: def.docsUrl,
    category: getErrorCategory(def.code),
  }));

  const categories = ERROR_CATEGORIES.map((cat) => ({
    prefix: cat.prefix,
    name: cat.name,
    count: getErrorsByCategory(cat.prefix).length,
  })).filter((cat) => cat.count > 0);

  return {
    errors,
    categories,
    totalCount: errors.length,
  };
}

/**
 * Get errors for a specific category
 */
export function getErrorsByPrefix(prefix: string): ErrorInfo[] {
  const defs = getErrorsByCategory(prefix);
  return defs.map((def) => ({
    code: def.code,
    name: def.name,
    message: def.message,
    fix: def.fix,
    docsUrl: def.docsUrl,
    category: getErrorCategory(def.code),
  }));
}

/**
 * Search errors by keyword
 */
export function searchErrors(query: string): ErrorInfo[] {
  const lowerQuery = query.toLowerCase();

  return Object.values(ERROR_CATALOG)
    .filter(
      (def) =>
        def.code.toLowerCase().includes(lowerQuery) ||
        def.name.toLowerCase().includes(lowerQuery) ||
        def.message.toLowerCase().includes(lowerQuery) ||
        def.fix?.toLowerCase().includes(lowerQuery)
    )
    .map((def) => ({
      code: def.code,
      name: def.name,
      message: def.message,
      fix: def.fix,
      docsUrl: def.docsUrl,
      category: getErrorCategory(def.code),
    }));
}

/**
 * Format errors response as text
 */
export function formatErrorsAsText(response: ErrorsResourceResponse): string {
  const lines: string[] = [
    '# VeloxTS Error Catalog',
    '',
    `Total errors: ${response.totalCount}`,
    '',
    '## Categories',
    '',
  ];

  for (const cat of response.categories) {
    lines.push(`- ${cat.prefix}xxx: ${cat.name} (${cat.count} errors)`);
  }

  lines.push('', '## All Errors', '');

  for (const error of response.errors) {
    lines.push(`### ${error.code}: ${error.name}`);
    lines.push(`**Message:** ${error.message}`);
    if (error.fix) {
      lines.push(`**Fix:** ${error.fix}`);
    }
    if (error.docsUrl) {
      lines.push(`**Docs:** ${error.docsUrl}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
