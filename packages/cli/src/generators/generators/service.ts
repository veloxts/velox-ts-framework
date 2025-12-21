/**
 * Service Generator
 *
 * Scaffolds service class files for VeloxTS applications.
 *
 * Usage:
 *   velox make service <name> [options]
 *
 * Examples:
 *   velox make service payment          # Simple service
 *   velox make service user --crud      # CRUD service with Prisma
 *   velox make service order --events   # Service with event emission
 *   velox make service cache --cache    # Service with caching
 *   velox make service auth --inject    # Injectable service (DI)
 */

import { BaseGenerator } from '../base.js';
import {
  type ServiceOptions,
  getServiceInstructions,
  getServicePath,
  serviceTemplate,
} from '../templates/service.js';
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
 * Service generator - creates service class files
 */
export class ServiceGenerator extends BaseGenerator<ServiceOptions> {
  readonly metadata: GeneratorMetadata = {
    name: 'service',
    description: 'Generate service classes for business logic',
    longDescription: `
Scaffold service classes for VeloxTS applications.

Services encapsulate business logic separately from procedures,
allowing reuse across multiple endpoints and easier testing.

Examples:
  velox make service payment          # Simple service
  velox make service user --crud      # CRUD service with Prisma
  velox make service order --events   # Service with event emission
  velox make service cache --cache    # Service with caching layer
  velox make service auth --inject    # Injectable service (DI)
`,
    aliases: ['svc', 'srv'],
    category: 'infrastructure',
  };

  readonly options: ReadonlyArray<GeneratorOption> = [
    {
      name: 'crud',
      short: 'c',
      description: 'Generate CRUD service with Prisma integration',
      type: 'boolean',
      default: false,
    },
    {
      name: 'cache',
      short: 'a',
      description: 'Include caching layer',
      type: 'boolean',
      default: false,
    },
    {
      name: 'events',
      short: 'e',
      description: 'Include event emitter for side effects',
      type: 'boolean',
      default: false,
    },
    {
      name: 'inject',
      short: 'i',
      description: 'Generate injectable service for DI',
      type: 'boolean',
      default: false,
    },
  ];

  /**
   * Validate and transform raw options
   */
  validateOptions(raw: Record<string, unknown>): ServiceOptions {
    return {
      crud: Boolean(raw.crud ?? false),
      cache: Boolean(raw.cache ?? false),
      events: Boolean(raw.events ?? false),
      injectable: Boolean(raw.inject ?? false),
    };
  }

  /**
   * Generate service files
   */
  async generate(config: GeneratorConfig<ServiceOptions>): Promise<GeneratorOutput> {
    const context = this.createContext(config);
    const files: GeneratedFile[] = [];

    // Generate service file
    const serviceContent = serviceTemplate(context);
    files.push({
      path: getServicePath(config.entityName, config.project),
      content: serviceContent,
    });

    return {
      files,
      postInstructions: getServiceInstructions(config.entityName, config.options),
    };
  }
}

/**
 * Factory function for creating a ServiceGenerator instance
 */
export function createServiceGenerator(): ServiceGenerator {
  return new ServiceGenerator();
}
