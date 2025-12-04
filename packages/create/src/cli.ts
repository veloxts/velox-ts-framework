#!/usr/bin/env node

/**
 * create-velox-app CLI entry point
 *
 * Executable entry point for the project scaffolder.
 * Handles command-line arguments and initiates the scaffolding process.
 */

import { CREATE_VERSION, createVeloxApp } from './index.js';

// ============================================================================
// Help & Version
// ============================================================================

const HELP_TEXT = `
create-velox-app v${CREATE_VERSION}

Usage:
  npx create-velox-app [project-name]
  pnpm create velox-app [project-name]

Options:
  -h, --help      Show this help message
  -v, --version   Show version number

Examples:
  npx create-velox-app my-app
  npx create-velox-app           # Interactive mode
`;

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Parse arguments and run scaffolder
 */
async function main() {
  try {
    // Get arguments
    const args = process.argv.slice(2);

    // Handle --help
    if (args.includes('-h') || args.includes('--help')) {
      console.log(HELP_TEXT);
      process.exit(0);
    }

    // Handle --version
    if (args.includes('-v') || args.includes('--version')) {
      console.log(CREATE_VERSION);
      process.exit(0);
    }

    // Get project name (first non-flag argument)
    const projectName = args.find((arg) => !arg.startsWith('-'));

    // Run scaffolder
    await createVeloxApp(projectName);
  } catch (error) {
    // Handle unexpected errors
    if (error instanceof Error) {
      console.error(`\nError: ${error.message}`);
    } else {
      console.error('\nAn unexpected error occurred');
    }
    process.exit(1);
  }
}

// Run the CLI
main();
