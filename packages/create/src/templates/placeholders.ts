/**
 * Template Placeholder System
 *
 * Handles placeholder replacement in template source files.
 * Uses simple string replacement for maximum speed.
 */

import { VELOXTS_VERSION } from './shared.js';
import type { TemplateConfig } from './types.js';

// ============================================================================
// Placeholder Definitions
// ============================================================================

/**
 * All supported placeholders and their descriptions.
 * Placeholders use the format __PLACEHOLDER_NAME__
 */
export const PLACEHOLDERS = {
  PROJECT_NAME: '__PROJECT_NAME__',
  PACKAGE_MANAGER: '__PACKAGE_MANAGER__',
  VELOXTS_VERSION: '__VELOXTS_VERSION__',
  RUN_CMD: '__RUN_CMD__',
  API_PORT: '__API_PORT__',
  WEB_PORT: '__WEB_PORT__',
} as const;

// ============================================================================
// Placeholder Replacement
// ============================================================================

/**
 * Get the run command for the package manager.
 */
function getRunCommand(packageManager: TemplateConfig['packageManager']): string {
  return packageManager === 'npm' ? 'npm run' : packageManager;
}

/**
 * Apply placeholder replacements to template content.
 *
 * Uses replaceAll for fast, simple string replacement.
 * No dependencies, no parsing overhead.
 *
 * @param content - Template content with placeholders
 * @param config - Template configuration
 * @returns Content with placeholders replaced
 */
export function applyPlaceholders(content: string, config: TemplateConfig): string {
  const replacements: Record<string, string> = {
    [PLACEHOLDERS.PROJECT_NAME]: config.projectName,
    [PLACEHOLDERS.PACKAGE_MANAGER]: config.packageManager,
    [PLACEHOLDERS.VELOXTS_VERSION]: VELOXTS_VERSION,
    [PLACEHOLDERS.RUN_CMD]: getRunCommand(config.packageManager),
    [PLACEHOLDERS.API_PORT]: '3210',
    [PLACEHOLDERS.WEB_PORT]: '8080',
  };

  let result = content;
  for (const [placeholder, value] of Object.entries(replacements)) {
    result = result.replaceAll(placeholder, value);
  }

  return result;
}

/**
 * Apply placeholders to JSON content (handles proper escaping).
 */
export function applyPlaceholdersToJson(
  content: Record<string, unknown>,
  config: TemplateConfig
): string {
  const jsonString = JSON.stringify(content, null, 2);
  return applyPlaceholders(jsonString, config);
}

// ============================================================================
// Conditional Content
// ============================================================================

/**
 * Conditional block markers for template-specific content.
 * Use these in source files to mark sections that should only appear in certain templates.
 */
export const CONDITIONALS = {
  AUTH_START: '/* @if auth */',
  AUTH_END: '/* @endif auth */',
  DEFAULT_START: '/* @if default */',
  DEFAULT_END: '/* @endif default */',
} as const;

/**
 * Process conditional blocks in template content.
 *
 * @param content - Template content with conditional blocks
 * @param template - Which template is being generated
 * @returns Content with appropriate blocks included/removed
 */
export function processConditionals(
  content: string,
  template: TemplateConfig['template']
): string {
  let result = content;

  // Process auth conditionals
  const authPattern = new RegExp(
    `${escapeRegex(CONDITIONALS.AUTH_START)}[\\s\\S]*?${escapeRegex(CONDITIONALS.AUTH_END)}`,
    'g'
  );

  if (template === 'auth') {
    // Keep auth content but remove markers
    result = result.replaceAll(CONDITIONALS.AUTH_START, '');
    result = result.replaceAll(CONDITIONALS.AUTH_END, '');
  } else {
    // Remove entire auth blocks
    result = result.replace(authPattern, '');
  }

  // Process default conditionals
  const defaultPattern = new RegExp(
    `${escapeRegex(CONDITIONALS.DEFAULT_START)}[\\s\\S]*?${escapeRegex(CONDITIONALS.DEFAULT_END)}`,
    'g'
  );

  if (template === 'default') {
    // Keep default content but remove markers
    result = result.replaceAll(CONDITIONALS.DEFAULT_START, '');
    result = result.replaceAll(CONDITIONALS.DEFAULT_END, '');
  } else {
    // Remove entire default blocks
    result = result.replace(defaultPattern, '');
  }

  return result;
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
