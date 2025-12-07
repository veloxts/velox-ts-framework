#!/usr/bin/env node

/**
 * create-velox-app CLI entry point
 *
 * Executable entry point for the project scaffolder.
 * Handles command-line arguments and initiates the scaffolding process.
 */

import { CREATE_VERSION, createVeloxApp } from './index.js';
import type { TemplateType } from './templates/index.js';
import { isValidTemplate, TEMPLATE_METADATA } from './templates/index.js';

// ============================================================================
// Help & Version
// ============================================================================

const HELP_TEXT = `
create-velox-app v${CREATE_VERSION}

Usage:
  npx create-velox-app [project-name] [options]
  pnpm create velox-app [project-name] [options]

Options:
  -t, --template <name>  Template to use (default: "default")
                         Available: default, auth
  -h, --help             Show this help message
  -v, --version          Show version number

Templates:
  default    ${TEMPLATE_METADATA.default.description}
  auth       ${TEMPLATE_METADATA.auth.description}

Examples:
  npx create-velox-app my-app                    # Interactive mode
  npx create-velox-app my-app --template=auth    # Auth template
  npx create-velox-app                           # Prompt for name
`;

// ============================================================================
// Argument Parser
// ============================================================================

interface ParsedArgs {
  projectName?: string;
  template?: TemplateType;
  help: boolean;
  version: boolean;
}

function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = {
    help: false,
    version: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Handle --help / -h
    if (arg === '-h' || arg === '--help') {
      result.help = true;
      continue;
    }

    // Handle --version / -v
    if (arg === '-v' || arg === '--version') {
      result.version = true;
      continue;
    }

    // Handle --template=<value> or -t=<value>
    if (arg.startsWith('--template=') || arg.startsWith('-t=')) {
      const value = arg.split('=')[1];
      if (isValidTemplate(value)) {
        result.template = value;
      } else {
        console.error(`Invalid template: ${value}. Available: default, auth`);
        process.exit(1);
      }
      continue;
    }

    // Handle --template <value> or -t <value>
    if (arg === '--template' || arg === '-t') {
      const value = args[i + 1];
      if (value && !value.startsWith('-')) {
        if (isValidTemplate(value)) {
          result.template = value;
          i++; // Skip next arg
        } else {
          console.error(`Invalid template: ${value}. Available: default, auth`);
          process.exit(1);
        }
      }
      continue;
    }

    // Non-flag argument is the project name
    if (!arg.startsWith('-') && !result.projectName) {
      result.projectName = arg;
    }
  }

  return result;
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Parse arguments and run scaffolder
 */
async function main() {
  try {
    const args = process.argv.slice(2);
    const parsed = parseArgs(args);

    // Handle --help
    if (parsed.help) {
      console.log(HELP_TEXT);
      process.exit(0);
    }

    // Handle --version
    if (parsed.version) {
      console.log(CREATE_VERSION);
      process.exit(0);
    }

    // Run scaffolder
    await createVeloxApp(parsed.projectName, parsed.template);
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
