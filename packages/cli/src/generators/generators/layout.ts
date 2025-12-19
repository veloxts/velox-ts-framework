/**
 * Layout Generator
 *
 * Scaffolds RSC layout files for VeloxTS full-stack applications.
 *
 * Usage:
 *   velox make layout <name> [options]
 *
 * Examples:
 *   velox make layout root --root      # Root layout with html/body
 *   velox make layout dashboard --sidebar  # Layout with sidebar nav
 *   velox make layout admin --header --footer
 */

import { BaseGenerator } from '../base.js';
import {
  getLayoutInstructions,
  getLayoutPath,
  type LayoutOptions,
  layoutTemplate,
} from '../templates/layout.js';
import type {
  GeneratedFile,
  GeneratorConfig,
  GeneratorMetadata,
  GeneratorOption,
  GeneratorOutput,
} from '../types.js';
import { GeneratorError, GeneratorErrorCode } from '../types.js';

// ============================================================================
// Generator Implementation
// ============================================================================

/**
 * Layout generator - creates RSC layout files
 */
export class LayoutGenerator extends BaseGenerator<LayoutOptions> {
  readonly metadata: GeneratorMetadata = {
    name: 'layout',
    description: 'Generate an RSC layout component',
    longDescription: `
Scaffold a React Server Component layout for VeloxTS full-stack applications.

Layouts wrap pages and can be nested. Use --root for the root layout that
includes <html> and <body> tags. Use --sidebar, --header, or --footer to
include common UI elements.

Examples:
  velox make layout root --root         # Root layout with html/body
  velox make layout dashboard --sidebar # Layout with sidebar navigation
  velox make layout admin --header --footer
`,
    aliases: ['l', 'lay'],
    category: 'resource',
  };

  readonly options: ReadonlyArray<GeneratorOption> = [
    {
      name: 'root',
      short: 'r',
      description: 'Generate root layout with html/body tags',
      type: 'boolean',
      default: false,
    },
    {
      name: 'header',
      short: 'H',
      description: 'Include header navigation',
      type: 'boolean',
      default: false,
    },
    {
      name: 'footer',
      short: 'F',
      description: 'Include footer',
      type: 'boolean',
      default: false,
    },
    {
      name: 'sidebar',
      short: 's',
      description: 'Include sidebar navigation',
      type: 'boolean',
      default: false,
    },
  ];

  /**
   * Validate and transform raw options
   */
  validateOptions(raw: Record<string, unknown>): LayoutOptions {
    return {
      root: Boolean(raw.root ?? false),
      header: Boolean(raw.header ?? false),
      footer: Boolean(raw.footer ?? false),
      sidebar: Boolean(raw.sidebar ?? false),
    };
  }

  /**
   * Generate layout files
   */
  async generate(config: GeneratorConfig<LayoutOptions>): Promise<GeneratorOutput> {
    // Check if this is a full-stack project
    if (config.project.projectType !== 'fullstack') {
      throw new GeneratorError(
        GeneratorErrorCode.PROJECT_STRUCTURE,
        'Layout generator requires a full-stack VeloxTS project.',
        'Create a full-stack project with: npx create-velox-app my-app --full-stack'
      );
    }

    const context = this.createContext(config);
    const files: GeneratedFile[] = [];

    // Generate layout file
    const layoutContent = layoutTemplate(context);
    files.push({
      path: getLayoutPath(config.entityName, config.project),
      content: layoutContent,
    });

    return {
      files,
      postInstructions: getLayoutInstructions(config.entityName, config.options),
    };
  }
}

/**
 * Factory function for creating a LayoutGenerator instance
 */
export function createLayoutGenerator(): LayoutGenerator {
  return new LayoutGenerator();
}
