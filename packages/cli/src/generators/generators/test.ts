/**
 * Test Generator
 *
 * Generates Vitest test files for VeloxTS applications.
 */

import { BaseGenerator } from '../base.js';
import { generateTestFiles, getTestInstructions, type TestOptions } from '../templates/test.js';
import type {
  GeneratorConfig,
  GeneratorMetadata,
  GeneratorOption,
  GeneratorOutput,
} from '../types.js';

// ============================================================================
// Generator Metadata
// ============================================================================

const metadata: GeneratorMetadata = {
  name: 'test',
  description: 'Generate Vitest test files',
  category: 'test',
  aliases: ['t', 'spec'],
};

// ============================================================================
// Generator Options
// ============================================================================

const options: GeneratorOption[] = [
  {
    name: 'type',
    type: 'string',
    description: 'Test type: unit, integration, or e2e',
    default: 'unit',
    flag: '-T, --type <type>',
  },
  {
    name: 'target',
    type: 'string',
    description: 'Target to test: procedure, schema, model, service, or generic',
    default: 'generic',
    flag: '-G, --target <target>',
  },
];

// ============================================================================
// Validation
// ============================================================================

const validTypes = ['unit', 'integration', 'e2e'] as const;
const validTargets = ['procedure', 'schema', 'model', 'service', 'generic'] as const;

type ValidType = (typeof validTypes)[number];
type ValidTarget = (typeof validTargets)[number];

function isValidType(value: string): value is ValidType {
  return validTypes.includes(value as ValidType);
}

function isValidTarget(value: string): value is ValidTarget {
  return validTargets.includes(value as ValidTarget);
}

// ============================================================================
// Generator Class
// ============================================================================

/**
 * Test generator implementation
 */
export class TestGenerator extends BaseGenerator<TestOptions> {
  readonly metadata: GeneratorMetadata = metadata;
  readonly options: ReadonlyArray<GeneratorOption> = options;

  /**
   * Validate test-specific options
   */
  validateOptions(rawOptions: Record<string, unknown>): TestOptions {
    const typeValue = String(rawOptions.type ?? 'unit');
    const targetValue = String(rawOptions.target ?? 'generic');

    // Validate type
    if (!isValidType(typeValue)) {
      throw new Error(
        `Invalid test type: "${typeValue}". Valid types are: ${validTypes.join(', ')}`
      );
    }

    // Validate target
    if (!isValidTarget(targetValue)) {
      throw new Error(
        `Invalid test target: "${targetValue}". Valid targets are: ${validTargets.join(', ')}`
      );
    }

    return {
      type: typeValue,
      target: targetValue,
    };
  }

  /**
   * Generate test files
   */
  async generate(config: GeneratorConfig<TestOptions>): Promise<GeneratorOutput> {
    const ctx = this.createContext(config);
    const files = generateTestFiles(ctx);

    return {
      files,
      postInstructions: getTestInstructions(ctx.entity.pascal, config.options),
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new test generator instance
 */
export function createTestGenerator(): TestGenerator {
  return new TestGenerator();
}
