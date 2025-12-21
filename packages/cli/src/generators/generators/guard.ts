/**
 * Guard Generator
 *
 * Scaffolds auth guard files for VeloxTS applications.
 *
 * Usage:
 *   velox make guard <name> [options]
 *
 * Examples:
 *   velox make guard subscriber          # Simple guard
 *   velox make guard admin --role        # Role-based guard
 *   velox make guard post --permission   # Permission-based guard
 *   velox make guard document --owner    # Ownership guard
 *   velox make guard access --composite  # Composite guards
 */

import { BaseGenerator } from '../base.js';
import {
  type GuardOptions,
  getGuardInstructions,
  getGuardPath,
  guardTemplate,
} from '../templates/guard.js';
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
 * Guard generator - creates auth guard files
 */
export class GuardGenerator extends BaseGenerator<GuardOptions> {
  readonly metadata: GeneratorMetadata = {
    name: 'guard',
    description: 'Generate authentication guard definitions',
    longDescription: `
Scaffold authentication guards for VeloxTS procedures.

Guards protect procedures by checking user authentication, roles,
permissions, or custom conditions before allowing execution.

Examples:
  velox make guard subscriber          # Simple guard
  velox make guard admin --role        # Role-based guard
  velox make guard post --permission   # Permission-based guard
  velox make guard document --owner    # Ownership guard
  velox make guard access --composite  # Composite guards
`,
    aliases: ['g', 'grd'],
    category: 'auth',
  };

  readonly options: ReadonlyArray<GeneratorOption> = [
    {
      name: 'role',
      short: 'r',
      description: 'Generate role-based guard',
      type: 'boolean',
      default: false,
    },
    {
      name: 'permission',
      short: 'p',
      description: 'Generate permission-based guard',
      type: 'boolean',
      default: false,
    },
    {
      name: 'owner',
      short: 'o',
      description: 'Generate ownership guard',
      type: 'boolean',
      default: false,
    },
    {
      name: 'composite',
      short: 'c',
      description: 'Generate composite guard utilities',
      type: 'boolean',
      default: false,
    },
  ];

  /**
   * Validate and transform raw options
   */
  validateOptions(raw: Record<string, unknown>): GuardOptions {
    return {
      role: Boolean(raw.role ?? false),
      permission: Boolean(raw.permission ?? false),
      ownership: Boolean(raw.owner ?? false),
      composite: Boolean(raw.composite ?? false),
    };
  }

  /**
   * Generate guard files
   */
  async generate(config: GeneratorConfig<GuardOptions>): Promise<GeneratorOutput> {
    const context = this.createContext(config);
    const files: GeneratedFile[] = [];

    // Generate guard file
    const guardContent = guardTemplate(context);
    files.push({
      path: getGuardPath(config.entityName, config.project),
      content: guardContent,
    });

    return {
      files,
      postInstructions: getGuardInstructions(config.entityName, config.options),
    };
  }
}

/**
 * Factory function for creating a GuardGenerator instance
 */
export function createGuardGenerator(): GuardGenerator {
  return new GuardGenerator();
}
