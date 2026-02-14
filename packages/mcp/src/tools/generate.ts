/**
 * Generate Tool
 *
 * Wraps `velox make` commands for AI tool invocation.
 */

import { z } from 'zod';

import { spawnCLI } from '../utils/cli.js';
import { findProjectRoot } from '../utils/project.js';

// ============================================================================
// Output Validation Schemas
// ============================================================================

/**
 * Schema for velox make JSON output
 */
const GenerateOutputSchema = z.object({
  files: z.array(z.string()).optional(),
  success: z.boolean().optional(),
  message: z.string().optional(),
});

// ============================================================================
// Types
// ============================================================================

/**
 * Generator types available via `velox make`
 */
export type GeneratorType =
  | 'procedure'
  | 'schema'
  | 'model'
  | 'migration'
  | 'test'
  | 'resource'
  | 'seeder'
  | 'factory';

/**
 * Generator options
 */
export interface GenerateOptions {
  /** Generator type */
  type: GeneratorType;
  /** Entity name (e.g., 'User', 'Post') */
  name: string;
  /** Generate full CRUD operations */
  crud?: boolean;
  /** Include pagination for list */
  paginated?: boolean;
  /** Add soft delete support */
  softDelete?: boolean;
  /** Include timestamps */
  timestamps?: boolean;
  /** Force overwrite existing files */
  force?: boolean;
  /** Dry run - preview without writing */
  dryRun?: boolean;
  /** Output as JSON */
  json?: boolean;
}

/**
 * Generate tool result
 */
export interface GenerateResult {
  success: boolean;
  type: GeneratorType;
  name: string;
  files?: string[];
  output?: string;
  error?: string;
}

// ============================================================================
// Tool Handler
// ============================================================================

/**
 * Build CLI arguments for velox make command
 */
function buildArgs(options: GenerateOptions): string[] {
  const args = ['make', options.type, options.name];

  if (options.crud) args.push('--crud');
  if (options.paginated) args.push('--paginated');
  if (options.softDelete) args.push('--soft-delete');
  if (options.timestamps) args.push('--timestamps');
  if (options.force) args.push('--force');
  if (options.dryRun) args.push('--dry-run');
  if (options.json) args.push('--json');

  return args;
}

/**
 * Execute velox make command
 *
 * @param options - Generator options
 * @param serverProjectRoot - Optional project root from server context (takes precedence over auto-detection)
 */
export async function generate(
  options: GenerateOptions,
  serverProjectRoot?: string
): Promise<GenerateResult> {
  const projectRoot = serverProjectRoot ?? findProjectRoot();

  if (!projectRoot) {
    return {
      success: false,
      type: options.type,
      name: options.name,
      error: 'Not in a VeloxTS project. Run this command from your project root.',
    };
  }

  const args = buildArgs(options);
  const result = await spawnCLI(projectRoot, args);

  if (!result.success) {
    return {
      success: false,
      type: options.type,
      name: options.name,
      error: result.stderr || result.stdout || `Command failed with exit code ${result.code}`,
    };
  }

  // Try to parse and validate JSON output if requested
  if (options.json) {
    try {
      const jsonData = JSON.parse(result.stdout);
      const parsed = GenerateOutputSchema.safeParse(jsonData);
      if (parsed.success) {
        return {
          success: true,
          type: options.type,
          name: options.name,
          files: parsed.data.files,
          output: result.stdout,
        };
      }
    } catch {
      // JSON parse failed - fall through to plain output
    }
  }

  return {
    success: true,
    type: options.type,
    name: options.name,
    output: result.stdout,
  };
}

/**
 * Generate a procedure
 */
export async function generateProcedure(
  name: string,
  options?: Partial<Omit<GenerateOptions, 'type' | 'name'>>
): Promise<GenerateResult> {
  return generate({ type: 'procedure', name, ...options });
}

/**
 * Generate a schema
 */
export async function generateSchema(
  name: string,
  options?: Partial<Omit<GenerateOptions, 'type' | 'name'>>
): Promise<GenerateResult> {
  return generate({ type: 'schema', name, ...options });
}

/**
 * Generate a full resource (procedure + schema + model)
 */
export async function generateResource(
  name: string,
  options?: Partial<Omit<GenerateOptions, 'type' | 'name'>>
): Promise<GenerateResult> {
  return generate({ type: 'resource', name, crud: true, ...options });
}

/**
 * Format generate result as text
 */
export function formatGenerateResult(result: GenerateResult): string {
  if (result.success) {
    const lines = [`Generated ${result.type}: ${result.name}`];
    if (result.files?.length) {
      lines.push('', 'Created files:');
      for (const file of result.files) {
        lines.push(`  - ${file}`);
      }
    }
    return lines.join('\n');
  }

  return `Failed to generate ${result.type} "${result.name}": ${result.error}`;
}
