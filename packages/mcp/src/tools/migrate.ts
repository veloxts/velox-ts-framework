/**
 * Migrate Tool
 *
 * Wraps `velox migrate` commands for AI tool invocation.
 */

import { spawn } from 'node:child_process';

import { z } from 'zod';

import { findProjectRoot } from '../utils/project.js';

// ============================================================================
// Output Validation Schemas
// ============================================================================

/**
 * Schema for migration info in JSON output
 */
const MigrationInfoSchema = z.object({
  name: z.string(),
  status: z.enum(['applied', 'pending']),
  appliedAt: z.string().optional(),
});

/**
 * Schema for velox migrate JSON output
 */
const MigrateOutputSchema = z.object({
  migrations: z.array(MigrationInfoSchema).optional(),
  success: z.boolean().optional(),
  message: z.string().optional(),
});

// ============================================================================
// Types
// ============================================================================

/**
 * Migration actions
 */
export type MigrateAction = 'status' | 'run' | 'rollback' | 'fresh' | 'reset';

/**
 * Migration options
 */
export interface MigrateOptions {
  /** Migration action to perform */
  action: MigrateAction;
  /** Development mode (creates migration from schema diff) */
  dev?: boolean;
  /** Output as JSON */
  json?: boolean;
  /** Dry run - preview without executing */
  dryRun?: boolean;
}

/**
 * Migration status info
 */
export interface MigrationInfo {
  name: string;
  status: 'applied' | 'pending';
  appliedAt?: string;
}

/**
 * Migrate tool result
 */
export interface MigrateResult {
  success: boolean;
  action: MigrateAction;
  migrations?: MigrationInfo[];
  output?: string;
  error?: string;
}

// ============================================================================
// Tool Handler
// ============================================================================

/**
 * Build CLI arguments for velox migrate command
 */
function buildArgs(options: MigrateOptions): string[] {
  const args = ['migrate', options.action];

  if (options.dev) args.push('--dev');
  if (options.json) args.push('--json');
  if (options.dryRun) args.push('--dry-run');

  return args;
}

/**
 * Execute velox migrate command
 */
export async function migrate(options: MigrateOptions): Promise<MigrateResult> {
  const projectRoot = findProjectRoot();

  if (!projectRoot) {
    return {
      success: false,
      action: options.action,
      error: 'Not in a VeloxTS project. Run this command from your project root.',
    };
  }

  const args = buildArgs(options);

  return new Promise((resolve) => {
    const child = spawn('npx', ['@veloxts/cli', ...args], {
      cwd: projectRoot,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        // Try to parse and validate JSON output if requested
        if (options.json) {
          try {
            const jsonData = JSON.parse(stdout);
            const parsed = MigrateOutputSchema.safeParse(jsonData);
            if (parsed.success) {
              resolve({
                success: true,
                action: options.action,
                migrations: parsed.data.migrations,
                output: stdout,
              });
              return;
            }
            // Invalid JSON structure - fall through to plain output
          } catch {
            // JSON parse failed - fall through to plain output
          }
        }

        resolve({
          success: true,
          action: options.action,
          output: stdout,
        });
      } else {
        resolve({
          success: false,
          action: options.action,
          error: stderr || stdout || `Command failed with exit code ${code}`,
        });
      }
    });

    child.on('error', (err) => {
      resolve({
        success: false,
        action: options.action,
        error: err.message,
      });
    });
  });
}

/**
 * Get migration status
 */
export async function migrateStatus(json = true): Promise<MigrateResult> {
  return migrate({ action: 'status', json });
}

/**
 * Run pending migrations
 */
export async function migrateRun(options?: {
  dev?: boolean;
  dryRun?: boolean;
}): Promise<MigrateResult> {
  return migrate({ action: 'run', json: true, ...options });
}

/**
 * Rollback last migration
 */
export async function migrateRollback(dryRun?: boolean): Promise<MigrateResult> {
  return migrate({ action: 'rollback', json: true, dryRun });
}

/**
 * Fresh database (drop all and re-run)
 */
export async function migrateFresh(): Promise<MigrateResult> {
  return migrate({ action: 'fresh', json: true });
}

/**
 * Reset database (rollback all and re-run)
 */
export async function migrateReset(): Promise<MigrateResult> {
  return migrate({ action: 'reset', json: true });
}

/**
 * Format migrate result as text
 */
export function formatMigrateResult(result: MigrateResult): string {
  if (result.success) {
    const lines = [`Migration ${result.action} completed successfully`];

    if (result.migrations?.length) {
      lines.push('', 'Migrations:');
      for (const migration of result.migrations) {
        const status = migration.status === 'applied' ? '[applied]' : '[pending]';
        lines.push(`  ${status} ${migration.name}`);
      }
    }

    return lines.join('\n');
  }

  return `Migration ${result.action} failed: ${result.error}`;
}
