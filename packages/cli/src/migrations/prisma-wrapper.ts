/**
 * Prisma CLI Wrapper
 *
 * Executes Prisma CLI commands programmatically and parses output.
 */

import { spawn } from 'node:child_process';

import type { PrismaResult } from './types.js';

// ============================================================================
// Core Execution
// ============================================================================

/**
 * Execute a Prisma CLI command
 */
export async function runPrismaCommand(
  command: string[],
  cwd: string
): Promise<PrismaResult> {
  return new Promise((resolve) => {
    const fullCommand = ['prisma', ...command];
    let stdout = '';
    let stderr = '';

    const prismaProcess = spawn('npx', fullCommand, {
      cwd,
      shell: true,
      env: process.env,
    });

    prismaProcess.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    prismaProcess.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    prismaProcess.on('error', (err) => {
      resolve({
        success: false,
        output: stdout,
        error: err.message,
        exitCode: 1,
      });
    });

    prismaProcess.on('close', (code) => {
      const exitCode = code ?? 1;
      resolve({
        success: exitCode === 0,
        output: stdout,
        error: exitCode !== 0 ? stderr || stdout : undefined,
        exitCode,
      });
    });
  });
}

/**
 * Execute a Prisma CLI command with inherited stdio (shows output in terminal)
 */
export async function runPrismaCommandInteractive(
  command: string[],
  cwd: string
): Promise<PrismaResult> {
  return new Promise((resolve) => {
    const fullCommand = ['prisma', ...command];

    const prismaProcess = spawn('npx', fullCommand, {
      cwd,
      shell: true,
      env: process.env,
      stdio: 'inherit',
    });

    prismaProcess.on('error', (err) => {
      resolve({
        success: false,
        output: '',
        error: err.message,
        exitCode: 1,
      });
    });

    prismaProcess.on('close', (code) => {
      const exitCode = code ?? 1;
      resolve({
        success: exitCode === 0,
        output: '',
        error: exitCode !== 0 ? `Prisma exited with code ${exitCode}` : undefined,
        exitCode,
      });
    });
  });
}

// ============================================================================
// Specific Commands
// ============================================================================

/**
 * Run `prisma migrate status`
 */
export async function prismaMigrateStatus(cwd: string): Promise<PrismaResult> {
  return runPrismaCommand(['migrate', 'status'], cwd);
}

/**
 * Run `prisma migrate deploy` (production)
 */
export async function prismaMigrateDeploy(cwd: string): Promise<PrismaResult> {
  return runPrismaCommandInteractive(['migrate', 'deploy'], cwd);
}

/**
 * Run `prisma migrate dev` (development)
 */
export async function prismaMigrateDev(
  cwd: string,
  name?: string
): Promise<PrismaResult> {
  const args = ['migrate', 'dev'];
  if (name) {
    args.push('--name', name);
  }
  return runPrismaCommandInteractive(args, cwd);
}

/**
 * Run `prisma migrate reset` (drop all + re-run)
 */
export async function prismaMigrateReset(
  cwd: string,
  force = false
): Promise<PrismaResult> {
  const args = ['migrate', 'reset'];
  if (force) {
    args.push('--force');
  }
  return runPrismaCommandInteractive(args, cwd);
}

/**
 * Run `prisma db push` (sync schema without migrations)
 */
export async function prismaDbPush(
  cwd: string,
  skipGenerate = false
): Promise<PrismaResult> {
  const args = ['db', 'push'];
  if (skipGenerate) {
    args.push('--skip-generate');
  }
  return runPrismaCommandInteractive(args, cwd);
}

/**
 * Run `prisma db seed`
 */
export async function prismaDbSeed(cwd: string): Promise<PrismaResult> {
  return runPrismaCommandInteractive(['db', 'seed'], cwd);
}

// ============================================================================
// Output Parsing
// ============================================================================

/**
 * Parse migration status from Prisma output
 */
export interface ParsedMigrationStatus {
  /** List of applied migrations */
  applied: string[];
  /** List of pending migrations */
  pending: string[];
  /** Whether database is in sync */
  inSync: boolean;
  /** Any warnings from Prisma */
  warnings: string[];
}

/**
 * Parse the output of `prisma migrate status`
 */
export function parseMigrateStatusOutput(output: string): ParsedMigrationStatus {
  const applied: string[] = [];
  const pending: string[] = [];
  const warnings: string[] = [];

  const lines = output.split('\n');
  let inAppliedSection = false;
  let inPendingSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect sections
    if (trimmed.includes('following migration') && trimmed.includes('applied')) {
      inAppliedSection = true;
      inPendingSection = false;
      continue;
    }

    if (trimmed.includes('following migration') && trimmed.includes('not yet applied')) {
      inAppliedSection = false;
      inPendingSection = true;
      continue;
    }

    // Parse migration names (they typically start with a timestamp)
    const migrationMatch = trimmed.match(/^(\d{14}_\S+)/);
    if (migrationMatch) {
      if (inAppliedSection) {
        applied.push(migrationMatch[1]);
      } else if (inPendingSection) {
        pending.push(migrationMatch[1]);
      }
    }

    // Detect warnings
    if (trimmed.toLowerCase().includes('warning')) {
      warnings.push(trimmed);
    }
  }

  return {
    applied,
    pending,
    inSync: pending.length === 0,
    warnings,
  };
}

/**
 * Check if Prisma is installed and available
 */
export async function isPrismaAvailable(cwd: string): Promise<boolean> {
  const result = await runPrismaCommand(['--version'], cwd);
  return result.success;
}
