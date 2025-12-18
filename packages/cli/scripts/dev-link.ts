#!/usr/bin/env tsx
/**
 * VeloxTS CLI Development Mode
 *
 * Watches CLI source files and auto-rebuilds on changes.
 * Provides a fast feedback loop for CLI development.
 *
 * Usage: pnpm dev:link
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as p from '@clack/prompts';
import pc from 'picocolors';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface BuildState {
  isFirstBuild: boolean;
  hasErrors: boolean;
  errorBuffer: string[];
}

function main(): void {
  const cliRoot = resolve(__dirname, '..');
  const playgroundRoot = resolve(__dirname, '../../../apps/playground');

  p.intro(pc.bgCyan(pc.black(' VeloxTS CLI Dev Mode ')));

  console.log(pc.dim('Watching CLI for changes...'));
  console.log(pc.dim(`CLI: ${cliRoot}`));
  console.log(pc.dim(`Playground: ${playgroundRoot}`));
  console.log('');

  const state: BuildState = {
    isFirstBuild: true,
    hasErrors: false,
    errorBuffer: [],
  };

  // Start TypeScript watch mode
  const tsc = spawn('npx', ['tsc', '--watch', '--preserveWatchOutput'], {
    cwd: cliRoot,
    stdio: 'pipe',
  });

  setupOutputHandlers(tsc, state, playgroundRoot);
  setupShutdownHandlers(tsc);
}

function setupOutputHandlers(tsc: ChildProcess, state: BuildState, playgroundRoot: string): void {
  tsc.stdout?.on('data', (data: Buffer) => {
    const output = data.toString();
    const lines = output.split('\n');

    for (const line of lines) {
      handleOutputLine(line, state, playgroundRoot);
    }
  });

  tsc.stderr?.on('data', (data: Buffer) => {
    console.error(pc.red(data.toString()));
  });

  tsc.on('exit', (code) => {
    if (code !== 0) {
      p.log.error(`Watch mode exited with code ${code}`);
      process.exit(code ?? 1);
    }
  });
}

function handleOutputLine(line: string, state: BuildState, playgroundRoot: string): void {
  const trimmed = line.trim();
  if (!trimmed) return;

  // TypeScript watch mode outputs
  if (trimmed.includes('Starting compilation')) {
    state.hasErrors = false;
    state.errorBuffer = [];
    console.log(pc.dim('Compiling...'));
  } else if (trimmed.includes('error TS')) {
    state.hasErrors = true;
    state.errorBuffer.push(line);
    console.log(pc.red(line));
  } else if (trimmed.includes('Found') && trimmed.includes('error')) {
    // "Found 0 errors" or "Found 3 errors"
    const match = trimmed.match(/Found (\d+) error/);
    const errorCount = match ? Number.parseInt(match[1], 10) : 0;

    if (errorCount === 0) {
      if (state.isFirstBuild) {
        p.log.success('Initial build complete');
        state.isFirstBuild = false;
        showInstructions(playgroundRoot);
      } else {
        p.log.success('Rebuild complete');
      }
    } else {
      p.log.error(`Build failed with ${errorCount} error(s)`);
    }
  } else if (trimmed.includes('Watching for file changes')) {
    // Ready state - already handled by "Found 0 errors"
  }
}

function showInstructions(playgroundPath: string): void {
  console.log('');
  console.log(pc.bold('Ready for testing!'));
  console.log('');
  console.log(pc.dim('Open a new terminal and run:'));
  console.log('');
  console.log(`  ${pc.cyan(`cd ${playgroundPath}`)}`);
  console.log('');
  console.log(`  ${pc.cyan('pnpm velox --help')}              ${pc.dim('# CLI help')}`);
  console.log(`  ${pc.cyan('pnpm velox make r Post --crud')}  ${pc.dim('# Generate resource')}`);
  console.log(`  ${pc.cyan('pnpm velox procedures list')}     ${pc.dim('# List procedures')}`);
  console.log(`  ${pc.cyan('pnpm velox dev')}                 ${pc.dim('# Start dev server')}`);
  console.log('');
  console.log(pc.dim('This terminal will auto-rebuild on file changes.'));
  console.log(pc.dim('Press Ctrl+C to stop.'));
  console.log('');
}

function setupShutdownHandlers(tsc: ChildProcess): void {
  const shutdown = (): void => {
    console.log('');
    p.log.info('Shutting down...');
    tsc.kill('SIGTERM');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
