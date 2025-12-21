/**
 * Policy Generator
 *
 * Scaffolds authorization policy files for VeloxTS applications.
 *
 * Usage:
 *   velox make policy <name> [options]
 *
 * Examples:
 *   velox make policy post               # Simple policy
 *   velox make policy article --crud     # CRUD policy class
 *   velox make policy document --resource # Resource-based ABAC
 *   velox make policy comment --soft     # Include soft delete policies
 */

import { BaseGenerator } from '../base.js';
import {
  type PolicyOptions,
  getPolicyInstructions,
  getPolicyPath,
  policyTemplate,
} from '../templates/policy.js';
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
 * Policy generator - creates authorization policy files
 */
export class PolicyGenerator extends BaseGenerator<PolicyOptions> {
  readonly metadata: GeneratorMetadata = {
    name: 'policy',
    description: 'Generate authorization policy definitions',
    longDescription: `
Scaffold authorization policies for VeloxTS applications.

Policies centralize authorization logic for resources, making it
easier to maintain and test access control rules separately from
business logic.

Examples:
  velox make policy post               # Simple policy
  velox make policy article --crud     # CRUD policy class
  velox make policy document --resource # Resource-based ABAC
  velox make policy comment --soft     # Include soft delete policies
`,
    aliases: ['pol', 'auth'],
    category: 'auth',
  };

  readonly options: ReadonlyArray<GeneratorOption> = [
    {
      name: 'crud',
      short: 'c',
      description: 'Generate CRUD policy class',
      type: 'boolean',
      default: false,
    },
    {
      name: 'resource',
      short: 'r',
      description: 'Generate resource-based ABAC policy',
      type: 'boolean',
      default: false,
    },
    {
      name: 'soft',
      short: 's',
      description: 'Include soft delete policies',
      type: 'boolean',
      default: false,
    },
  ];

  /**
   * Validate and transform raw options
   */
  validateOptions(raw: Record<string, unknown>): PolicyOptions {
    return {
      crud: Boolean(raw.crud ?? false),
      resource: Boolean(raw.resource ?? false),
      softDelete: Boolean(raw.soft ?? false),
    };
  }

  /**
   * Generate policy files
   */
  async generate(config: GeneratorConfig<PolicyOptions>): Promise<GeneratorOutput> {
    const context = this.createContext(config);
    const files: GeneratedFile[] = [];

    // Generate policy file
    const policyContent = policyTemplate(context);
    files.push({
      path: getPolicyPath(config.entityName, config.project),
      content: policyContent,
    });

    return {
      files,
      postInstructions: getPolicyInstructions(config.entityName, config.options),
    };
  }
}

/**
 * Factory function for creating a PolicyGenerator instance
 */
export function createPolicyGenerator(): PolicyGenerator {
  return new PolicyGenerator();
}
