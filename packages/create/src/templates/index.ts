/**
 * Template Registry
 *
 * Central hub for all project templates.
 */

import { generateAuthTemplate } from './auth.js';
import { generateDefaultTemplate } from './default.js';
import { VELOXTS_VERSION } from './shared.js';
import type { TemplateConfig, TemplateFile, TemplateType } from './types.js';
import { getAvailableTemplates, isValidTemplate, TEMPLATE_METADATA } from './types.js';

// ============================================================================
// Re-exports
// ============================================================================

export { VELOXTS_VERSION };
export type { TemplateConfig, TemplateFile, TemplateMetadata, TemplateType } from './types.js';
export { getAvailableTemplates, isValidTemplate, TEMPLATE_METADATA };

// ============================================================================
// Template Generator
// ============================================================================

/**
 * Generate all files for a given template
 */
export function generateTemplateFiles(config: TemplateConfig): TemplateFile[] {
  switch (config.template) {
    case 'auth':
      return generateAuthTemplate(config);
    case 'default':
    default:
      return generateDefaultTemplate(config);
  }
}

/**
 * Get directories that need to be created for the template
 */
export function getTemplateDirectories(_template: TemplateType): string[] {
  const baseDirectories = [
    'src',
    'src/config',
    'src/database',
    'src/procedures',
    'src/schemas',
    'prisma',
    'public',
  ];

  // All templates use the same directory structure currently
  return baseDirectories;
}
