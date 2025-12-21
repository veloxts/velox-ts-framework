/**
 * Middleware Generator
 *
 * Scaffolds middleware files for VeloxTS applications.
 *
 * Usage:
 *   velox make middleware <name> [options]
 *
 * Examples:
 *   velox make middleware request-logger     # Custom middleware
 *   velox make middleware timing --timing    # Request timing
 *   velox make middleware logger --logging   # Structured logging
 *   velox make middleware limiter --rate     # Rate limiting
 *   velox make middleware cors --cors        # CORS handling
 */

import { BaseGenerator } from '../base.js';
import {
  type MiddlewareOptions,
  getMiddlewareInstructions,
  getMiddlewarePath,
  middlewareTemplate,
} from '../templates/middleware.js';
import type {
  GeneratedFile,
  GeneratorConfig,
  GeneratorMetadata,
  GeneratorOption,
  GeneratorOutput,
} from '../types.js';

// ============================================================================
// Generator Implementation
// ============================================================================

/**
 * Middleware generator - creates middleware files
 */
export class MiddlewareGenerator extends BaseGenerator<MiddlewareOptions> {
  readonly metadata: GeneratorMetadata = {
    name: 'middleware',
    description: 'Generate Fastify middleware plugins',
    longDescription: `
Scaffold middleware for VeloxTS applications.

Middleware runs on every request and can modify the request/response
or perform side effects like logging, rate limiting, and CORS handling.

Examples:
  velox make middleware request-logger     # Custom middleware
  velox make middleware timing --timing    # Request timing
  velox make middleware logger --logging   # Structured logging
  velox make middleware limiter --rate     # Rate limiting
  velox make middleware cors --cors        # CORS handling
`,
    aliases: ['mw', 'mid'],
    category: 'infrastructure',
  };

  readonly options: ReadonlyArray<GeneratorOption> = [
    {
      name: 'timing',
      short: 't',
      description: 'Generate request timing middleware',
      type: 'boolean',
      default: false,
    },
    {
      name: 'logging',
      short: 'l',
      description: 'Generate structured logging middleware',
      type: 'boolean',
      default: false,
    },
    {
      name: 'rate',
      short: 'r',
      description: 'Generate rate limiting middleware',
      type: 'boolean',
      default: false,
    },
    {
      name: 'cors',
      short: 'c',
      description: 'Generate CORS middleware',
      type: 'boolean',
      default: false,
    },
  ];

  /**
   * Validate and transform raw options
   */
  validateOptions(raw: Record<string, unknown>): MiddlewareOptions {
    return {
      timing: Boolean(raw.timing ?? false),
      logging: Boolean(raw.logging ?? false),
      rateLimit: Boolean(raw.rate ?? false),
      cors: Boolean(raw.cors ?? false),
    };
  }

  /**
   * Generate middleware files
   */
  async generate(config: GeneratorConfig<MiddlewareOptions>): Promise<GeneratorOutput> {
    const context = this.createContext(config);
    const files: GeneratedFile[] = [];

    // Generate middleware file
    const middlewareContent = middlewareTemplate(context);
    files.push({
      path: getMiddlewarePath(config.entityName, config.project),
      content: middlewareContent,
    });

    return {
      files,
      postInstructions: getMiddlewareInstructions(config.entityName, config.options),
    };
  }
}

/**
 * Factory function for creating a MiddlewareGenerator instance
 */
export function createMiddlewareGenerator(): MiddlewareGenerator {
  return new MiddlewareGenerator();
}
