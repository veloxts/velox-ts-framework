/**
 * Template Types
 *
 * Shared types for the create-velox-app template system.
 */

// ============================================================================
// Template Types
// ============================================================================

/**
 * Available template types
 */
export type TemplateType = 'default' | 'auth';

/**
 * Template metadata for CLI display
 */
export interface TemplateMetadata {
  type: TemplateType;
  label: string;
  description: string;
  hint?: string;
}

/**
 * Template configuration passed to generator functions
 */
export interface TemplateConfig {
  projectName: string;
  packageManager: 'npm' | 'pnpm' | 'yarn';
  template: TemplateType;
}

/**
 * Interface for template generators
 */
export interface TemplateGenerator {
  /**
   * Generate all files for this template
   */
  generateFiles(config: TemplateConfig): TemplateFile[];
}

/**
 * A single template file to be written
 */
export interface TemplateFile {
  /**
   * Relative path from project root (e.g., 'src/index.ts')
   */
  path: string;
  /**
   * File content
   */
  content: string;
}

// ============================================================================
// Template Registry
// ============================================================================

/**
 * Available templates with their metadata
 */
export const TEMPLATE_METADATA: Record<TemplateType, TemplateMetadata> = {
  default: {
    type: 'default',
    label: 'API (Default)',
    description: 'REST API with user CRUD operations',
    hint: 'Basic API setup without authentication',
  },
  auth: {
    type: 'auth',
    label: 'Full Auth',
    description: 'Complete JWT authentication with login, register, guards',
    hint: 'Includes rate limiting, token rotation, password hashing',
  },
};

/**
 * Get all available template types
 */
export function getAvailableTemplates(): TemplateMetadata[] {
  return Object.values(TEMPLATE_METADATA);
}

/**
 * Check if a template type is valid
 */
export function isValidTemplate(template: string): template is TemplateType {
  return template in TEMPLATE_METADATA;
}
