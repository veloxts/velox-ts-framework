/**
 * Page Generator
 *
 * Scaffolds RSC page files for VeloxTS full-stack applications.
 *
 * Usage:
 *   velox make page <name> [options]
 *
 * Examples:
 *   velox make page home              # Simple server component page
 *   velox make page dashboard --client # Client component with interactivity
 *   velox make page users --loading    # Include loading skeleton
 */

import { BaseGenerator } from '../base.js';
import {
  getPageInstructions,
  getPagePath,
  loadingTemplate,
  type PageOptions,
  pageTemplate,
} from '../templates/page.js';
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
 * Page generator - creates RSC page files
 */
export class PageGenerator extends BaseGenerator<PageOptions> {
  readonly metadata: GeneratorMetadata = {
    name: 'page',
    description: 'Generate an RSC page component',
    longDescription: `
Scaffold a React Server Component page for VeloxTS full-stack applications.

By default, creates a server component that renders on the server.
Use --client for interactive components that hydrate on the client.
Use --loading to include a loading skeleton for React Suspense.

Examples:
  velox make page home              # Simple server component page
  velox make page dashboard --client # Client component with interactivity
  velox make page users --loading    # Include loading skeleton
`,
    aliases: ['pg'],
    category: 'resource',
  };

  readonly options: ReadonlyArray<GeneratorOption> = [
    {
      name: 'client',
      short: 'c',
      description: 'Generate a client component with "use client" directive',
      type: 'boolean',
      default: false,
    },
    {
      name: 'loading',
      short: 'l',
      description: 'Include a loading skeleton component',
      type: 'boolean',
      default: false,
    },
    {
      name: 'fetch',
      short: 'f',
      description: 'Include data fetching example',
      type: 'boolean',
      default: false,
    },
  ];

  /**
   * Validate and transform raw options
   */
  validateOptions(raw: Record<string, unknown>): PageOptions {
    return {
      client: Boolean(raw.client ?? false),
      loading: Boolean(raw.loading ?? false),
      fetch: Boolean(raw.fetch ?? false),
    };
  }

  /**
   * Generate page files
   */
  async generate(config: GeneratorConfig<PageOptions>): Promise<GeneratorOutput> {
    // Check if this is a full-stack project
    if (config.project.projectType !== 'fullstack') {
      throw new GeneratorError(
        GeneratorErrorCode.PROJECT_STRUCTURE,
        'Page generator requires a full-stack VeloxTS project.',
        'Create a full-stack project with: npx create-velox-app my-app --full-stack'
      );
    }

    const context = this.createContext(config);
    const files: GeneratedFile[] = [];

    // Generate main page file
    const pageContent = pageTemplate(context);
    files.push({
      path: getPagePath(config.entityName, config.project),
      content: pageContent,
    });

    // Generate loading file if requested
    if (config.options.loading) {
      const loadingContent = loadingTemplate(context);
      files.push({
        path: getPagePath('_loading', config.project),
        content: loadingContent,
        skipIfExists: true, // Don't overwrite existing loading file
      });
    }

    return {
      files,
      postInstructions: getPageInstructions(config.entityName, config.options),
    };
  }
}

/**
 * Factory function for creating a PageGenerator instance
 */
export function createPageGenerator(): PageGenerator {
  return new PageGenerator();
}
