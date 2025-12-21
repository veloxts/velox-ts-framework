/**
 * Exception Generator
 *
 * Scaffolds custom exception class files for VeloxTS applications.
 *
 * Usage:
 *   velox make exception <name> [options]
 *
 * Examples:
 *   velox make exception payment          # Simple exception
 *   velox make exception api --http       # HTTP-aware exceptions
 *   velox make exception form --validation # Validation exceptions
 *   velox make exception order --domain   # Domain exceptions
 *   velox make exception auth --codes     # Include error code enum
 */

import { BaseGenerator } from '../base.js';
import {
  type ExceptionOptions,
  exceptionTemplate,
  getExceptionInstructions,
  getExceptionPath,
} from '../templates/exception.js';
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
 * Exception generator - creates custom exception class files
 */
export class ExceptionGenerator extends BaseGenerator<ExceptionOptions> {
  readonly metadata: GeneratorMetadata = {
    name: 'exception',
    description: 'Generate custom exception classes',
    longDescription: `
Scaffold custom exception classes for VeloxTS applications.

Exceptions provide structured error handling with type safety,
error codes, and metadata for debugging and API responses.

Examples:
  velox make exception payment          # Simple exception
  velox make exception api --http       # HTTP-aware exceptions
  velox make exception form --validation # Validation exceptions
  velox make exception order --domain   # Domain exceptions
  velox make exception auth --codes     # Include error code enum
`,
    aliases: ['ex', 'err', 'error'],
    category: 'infrastructure',
  };

  readonly options: ReadonlyArray<GeneratorOption> = [
    {
      name: 'http',
      short: 'h',
      description: 'Generate HTTP-aware exceptions with status codes',
      type: 'boolean',
      default: false,
    },
    {
      name: 'validation',
      short: 'v',
      description: 'Generate validation exception with field errors',
      type: 'boolean',
      default: false,
    },
    {
      name: 'domain',
      short: 'd',
      description: 'Generate domain-specific exception hierarchy',
      type: 'boolean',
      default: false,
    },
    {
      name: 'codes',
      short: 'c',
      description: 'Include error code enum',
      type: 'boolean',
      default: false,
    },
  ];

  /**
   * Validate and transform raw options
   */
  validateOptions(raw: Record<string, unknown>): ExceptionOptions {
    return {
      http: Boolean(raw.http ?? false),
      validation: Boolean(raw.validation ?? false),
      domain: Boolean(raw.domain ?? false),
      codes: Boolean(raw.codes ?? false),
    };
  }

  /**
   * Generate exception files
   */
  async generate(config: GeneratorConfig<ExceptionOptions>): Promise<GeneratorOutput> {
    const context = this.createContext(config);
    const files: GeneratedFile[] = [];

    // Generate exception file
    const exceptionContent = exceptionTemplate(context);
    files.push({
      path: getExceptionPath(config.entityName, config.project),
      content: exceptionContent,
    });

    return {
      files,
      postInstructions: getExceptionInstructions(config.entityName, config.options),
    };
  }
}

/**
 * Factory function for creating an ExceptionGenerator instance
 */
export function createExceptionGenerator(): ExceptionGenerator {
  return new ExceptionGenerator();
}
