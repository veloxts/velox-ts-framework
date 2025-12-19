/**
 * Prisma Migration Runner
 *
 * Executes Prisma commands (db push, generate) with proper error handling
 * and user feedback.
 */

import { spawn } from 'node:child_process';

import * as p from '@clack/prompts';
import pc from 'picocolors';

import { GeneratorError, GeneratorErrorCode } from '../types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of running a Prisma command
 */
export interface PrismaCommandResult {
  /** Whether command succeeded */
  readonly success: boolean;
  /** Exit code */
  readonly exitCode: number;
  /** Standard output */
  readonly stdout: string;
  /** Standard error */
  readonly stderr: string;
}

/**
 * Options for migration operations
 */
export interface MigrationOptions {
  /** Project root directory */
  readonly cwd: string;
  /** Skip user prompts (auto-run) */
  readonly autoRun?: boolean;
  /** Skip migration entirely */
  readonly skip?: boolean;
  /** Timeout in milliseconds */
  readonly timeout?: number;
}

// ============================================================================
// Command Execution
// ============================================================================

/**
 * Execute a command and capture output
 */
function execCommand(
  command: string,
  args: string[],
  cwd: string,
  timeout = 60000
): Promise<PrismaCommandResult> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const proc = spawn(command, args, {
      cwd,
      stdio: 'pipe',
    });

    // Set timeout
    const timeoutId = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
    }, timeout);

    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timeoutId);

      if (timedOut) {
        resolve({
          success: false,
          exitCode: -1,
          stdout,
          stderr: `${stderr}\nCommand timed out`,
        });
        return;
      }

      resolve({
        success: code === 0,
        exitCode: code ?? 1,
        stdout,
        stderr,
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timeoutId);
      resolve({
        success: false,
        exitCode: 1,
        stdout,
        stderr: err.message,
      });
    });
  });
}

// ============================================================================
// Prisma Commands
// ============================================================================

/**
 * Run `prisma db push` to sync schema with database
 */
export async function runPrismaDbPush(options: MigrationOptions): Promise<PrismaCommandResult> {
  const { cwd, timeout = 60000 } = options;

  const result = await execCommand(
    'npx',
    ['prisma', 'db', 'push', '--skip-generate'],
    cwd,
    timeout
  );

  return result;
}

/**
 * Run `prisma generate` to regenerate Prisma Client
 */
export async function runPrismaGenerate(options: MigrationOptions): Promise<PrismaCommandResult> {
  const { cwd, timeout = 60000 } = options;

  const result = await execCommand('npx', ['prisma', 'generate'], cwd, timeout);

  return result;
}

/**
 * Run `prisma format` to format schema file
 */
export async function runPrismaFormat(options: MigrationOptions): Promise<PrismaCommandResult> {
  const { cwd, timeout = 30000 } = options;

  const result = await execCommand('npx', ['prisma', 'format'], cwd, timeout);

  return result;
}

// ============================================================================
// Interactive Migration Flow
// ============================================================================

/**
 * Prompt user and run database migration
 *
 * @returns true if migration was run and succeeded, false otherwise
 */
export async function promptAndRunMigration(options: MigrationOptions): Promise<boolean> {
  const { skip, autoRun } = options;

  // Skip if requested
  if (skip) {
    return false;
  }

  // Prompt user unless autoRun is enabled
  if (!autoRun) {
    const shouldMigrate = await p.confirm({
      message: 'Push schema changes to database?',
      initialValue: true,
    });

    if (p.isCancel(shouldMigrate) || !shouldMigrate) {
      console.log(pc.dim('  Skipped database migration'));
      console.log(pc.dim(`  Run manually: npx prisma db push`));
      return false;
    }
  }

  // Run db push with spinner
  const s = p.spinner();
  s.start('Pushing schema to database...');

  const pushResult = await runPrismaDbPush(options);

  if (!pushResult.success) {
    s.stop(pc.red('Database push failed'));
    console.log(pc.dim(`\n  Error: ${pushResult.stderr}`));
    console.log(pc.dim(`  Run manually: npx prisma db push`));
    return false;
  }

  s.stop(pc.green('Database schema updated'));

  // Run generate with spinner
  s.start('Generating Prisma Client...');

  const generateResult = await runPrismaGenerate(options);

  if (!generateResult.success) {
    s.stop(pc.yellow('Prisma Client generation failed'));
    console.log(pc.dim(`\n  Error: ${generateResult.stderr}`));
    console.log(pc.dim(`  Run manually: npx prisma generate`));
    return false;
  }

  s.stop(pc.green('Prisma Client generated'));

  return true;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Check if Prisma CLI is available
 */
export async function checkPrismaAvailable(cwd: string): Promise<boolean> {
  const result = await execCommand('npx', ['prisma', '--version'], cwd, 10000);
  return result.success;
}

/**
 * Validate schema before migration
 */
export async function validatePrismaSchema(cwd: string): Promise<void> {
  const result = await execCommand('npx', ['prisma', 'validate'], cwd, 30000);

  if (!result.success) {
    throw new GeneratorError(
      GeneratorErrorCode.MIGRATION_FAILED,
      'Prisma schema validation failed',
      `Error: ${result.stderr}\n\nFix the schema errors and try again.`
    );
  }
}
