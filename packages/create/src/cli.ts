#!/usr/bin/env node

/**
 * create-velox-app CLI entry point
 *
 * Executable entry point for the project scaffolder.
 * Handles command-line arguments and initiates the scaffolding process.
 */

import { CREATE_VERSION, createVeloxApp } from './index.js';
import type { DatabaseType, TemplateType } from './templates/index.js';
import {
  DATABASE_METADATA,
  getAvailableDatabases,
  getAvailableTemplates,
  isDatabaseAvailable,
  isValidDatabase,
  TEMPLATE_METADATA,
} from './templates/index.js';
import { resolveTemplateAlias, TEMPLATE_ALIASES } from './templates/types.js';

// ============================================================================
// Constants
// ============================================================================

/** Get list of available template names for error messages */
function getTemplateNames(): string {
  const templates = getAvailableTemplates().map((t) => t.type);
  const aliases = Object.keys(TEMPLATE_ALIASES);
  return [...templates, ...aliases].join(', ');
}

/** Get list of available database names for error messages */
function getDatabaseNames(): string {
  return getAvailableDatabases()
    .filter((db) => !db.disabled)
    .map((db) => db.type)
    .join(', ');
}

// ============================================================================
// Help & Version
// ============================================================================

const HELP_TEXT = `
create-velox-app v${CREATE_VERSION}

Usage:
  npx create-velox-app [project-name] [options]
  pnpm create velox-app [project-name] [options]

Options:
  -t, --template <name>  Template to use (default: "spa")
                         Available: ${getTemplateNames()}
  -d, --database <name>  Database to use (default: "sqlite")
                         Available: ${getDatabaseNames()}
  --pm <manager>         Package manager to use (npm, pnpm, yarn)
                         Skips interactive prompt if specified
  -h, --help             Show this help message
  -v, --version          Show version number

Template Shortcuts:
  --spa        ${TEMPLATE_METADATA.spa.description}
  --auth       ${TEMPLATE_METADATA.auth.description}
  --trpc       ${TEMPLATE_METADATA.trpc.description}
  --rsc        ${TEMPLATE_METADATA.rsc.description}
  --rsc-auth   ${TEMPLATE_METADATA['rsc-auth'].description}
  --default    Alias for --spa
  --fullstack  Alias for --rsc

Databases:
  sqlite     ${DATABASE_METADATA.sqlite.hint}
  postgresql ${DATABASE_METADATA.postgresql.hint}

Examples:
  npx create-velox-app my-app                        # Interactive mode
  npx create-velox-app my-app --auth                 # Auth template (shortcut)
  npx create-velox-app my-app --rsc -d postgresql    # RSC with PostgreSQL
  npx create-velox-app my-app --template=spa         # SPA + API template
  npx create-velox-app my-app --pm npm               # Non-interactive (npm)
  npx create-velox-app                               # Prompt for all options
`;

// ============================================================================
// Argument Parser
// ============================================================================

/** Valid package manager types */
export type PackageManagerType = 'npm' | 'pnpm' | 'yarn';

/** @internal Exported for testing */
export interface ParsedArgs {
  projectName?: string;
  template?: TemplateType;
  database?: DatabaseType;
  packageManager?: PackageManagerType;
  help: boolean;
  version: boolean;
}

/** Valid package managers */
const VALID_PACKAGE_MANAGERS = new Set<PackageManagerType>(['npm', 'pnpm', 'yarn']);

/** Template shorthand flags (--auth, --spa, etc.) */
const TEMPLATE_FLAGS = new Set([
  '--spa',
  '--auth',
  '--trpc',
  '--rsc',
  '--rsc-auth',
  '--default', // alias for spa
  '--fullstack', // alias for rsc
]);

/** @internal Exported for testing */
export function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = {
    help: false,
    version: false,
  };

  const unexpectedArgs: string[] = [];
  let templateFlagSeen = false;
  let databaseFlagSeen = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Handle --help / -h
    if (arg === '-h' || arg === '--help') {
      result.help = true;
      continue;
    }

    // Handle template shorthand flags (--auth, --spa, --rsc, etc.)
    if (TEMPLATE_FLAGS.has(arg)) {
      if (templateFlagSeen) {
        console.error('Error: Template specified multiple times');
        process.exit(1);
      }
      templateFlagSeen = true;

      const templateName = arg.slice(2); // Remove '--' prefix
      const resolved = resolveTemplateAlias(templateName);
      if (resolved) {
        result.template = resolved;
      }
      continue;
    }

    // Handle --version / -v
    if (arg === '-v' || arg === '--version') {
      result.version = true;
      continue;
    }

    // Handle --template=<value> or -t=<value>
    if (arg.startsWith('--template=') || arg.startsWith('-t=')) {
      // Check for duplicate flag
      if (templateFlagSeen) {
        console.error('Error: --template flag specified multiple times');
        process.exit(1);
      }
      templateFlagSeen = true;

      const value = arg.split('=')[1];
      if (!value) {
        console.error(`Error: --template requires a value. Available: ${getTemplateNames()}`);
        process.exit(1);
      }
      const resolved = resolveTemplateAlias(value);
      if (resolved) {
        result.template = resolved;
      } else {
        console.error(`Invalid template: ${value}. Available: ${getTemplateNames()}`);
        process.exit(1);
      }
      continue;
    }

    // Handle --template <value> or -t <value>
    if (arg === '--template' || arg === '-t') {
      // Check for duplicate flag
      if (templateFlagSeen) {
        console.error('Error: --template flag specified multiple times');
        process.exit(1);
      }
      templateFlagSeen = true;

      const value = args[i + 1];
      if (!value || value.startsWith('-')) {
        console.error(`Error: --template requires a value. Available: ${getTemplateNames()}`);
        process.exit(1);
      }
      const resolved = resolveTemplateAlias(value);
      if (resolved) {
        result.template = resolved;
        i++; // Skip next arg
      } else {
        console.error(`Invalid template: ${value}. Available: ${getTemplateNames()}`);
        process.exit(1);
      }
      continue;
    }

    // Handle --database=<value> or -d=<value>
    if (arg.startsWith('--database=') || arg.startsWith('-d=')) {
      // Check for duplicate flag
      if (databaseFlagSeen) {
        console.error('Error: --database flag specified multiple times');
        process.exit(1);
      }
      databaseFlagSeen = true;

      const value = arg.split('=')[1];
      if (!value) {
        console.error(`Error: --database requires a value. Available: ${getDatabaseNames()}`);
        process.exit(1);
      }
      if (isValidDatabase(value)) {
        if (!isDatabaseAvailable(value)) {
          console.error(
            `Database "${value}" is not yet available. Available: ${getDatabaseNames()}`
          );
          process.exit(1);
        }
        result.database = value;
      } else {
        console.error(`Invalid database: ${value}. Available: ${getDatabaseNames()}`);
        process.exit(1);
      }
      continue;
    }

    // Handle --database <value> or -d <value>
    if (arg === '--database' || arg === '-d') {
      // Check for duplicate flag
      if (databaseFlagSeen) {
        console.error('Error: --database flag specified multiple times');
        process.exit(1);
      }
      databaseFlagSeen = true;

      const value = args[i + 1];
      if (!value || value.startsWith('-')) {
        console.error(`Error: --database requires a value. Available: ${getDatabaseNames()}`);
        process.exit(1);
      }
      if (isValidDatabase(value)) {
        if (!isDatabaseAvailable(value)) {
          console.error(
            `Database "${value}" is not yet available. Available: ${getDatabaseNames()}`
          );
          process.exit(1);
        }
        result.database = value;
        i++; // Skip next arg
      } else {
        console.error(`Invalid database: ${value}. Available: ${getDatabaseNames()}`);
        process.exit(1);
      }
      continue;
    }

    // Handle --pm=<value>
    if (arg.startsWith('--pm=')) {
      const value = arg.split('=')[1];
      if (!value) {
        console.error('Error: --pm requires a value. Available: npm, pnpm, yarn');
        process.exit(1);
      }
      if (VALID_PACKAGE_MANAGERS.has(value as PackageManagerType)) {
        result.packageManager = value as PackageManagerType;
      } else {
        console.error(`Invalid package manager: ${value}. Available: npm, pnpm, yarn`);
        process.exit(1);
      }
      continue;
    }

    // Handle --pm <value>
    if (arg === '--pm') {
      const value = args[i + 1];
      if (!value || value.startsWith('-')) {
        console.error('Error: --pm requires a value. Available: npm, pnpm, yarn');
        process.exit(1);
      }
      if (VALID_PACKAGE_MANAGERS.has(value as PackageManagerType)) {
        result.packageManager = value as PackageManagerType;
        i++; // Skip next arg
      } else {
        console.error(`Invalid package manager: ${value}. Available: npm, pnpm, yarn`);
        process.exit(1);
      }
      continue;
    }

    // Non-flag argument
    if (!arg.startsWith('-')) {
      if (!result.projectName) {
        result.projectName = arg;
      } else {
        // Track unexpected positional arguments
        unexpectedArgs.push(arg);
      }
    }
  }

  // Warn about unexpected arguments
  if (unexpectedArgs.length > 0) {
    console.warn(`Warning: Unexpected arguments ignored: ${unexpectedArgs.join(', ')}`);
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
    await createVeloxApp(parsed.projectName, parsed.template, parsed.database, parsed.packageManager);
  } catch (error) {
    // Handle unexpected errors with actionable guidance
    if (error instanceof Error) {
      console.error(`\nError: ${error.message}`);

      // Provide contextual help based on error type
      const msg = error.message.toLowerCase();
      if (msg.includes('eacces') || msg.includes('permission')) {
        console.error(
          '\nTry running with appropriate permissions or choose a different directory.'
        );
      } else if (msg.includes('enospc') || msg.includes('no space')) {
        console.error('\nInsufficient disk space. Free up some space and try again.');
      } else if (
        msg.includes('enotfound') ||
        msg.includes('network') ||
        msg.includes('etimedout')
      ) {
        console.error('\nCheck your internet connection and try again.');
      } else if (msg.includes('already exists')) {
        console.error('\nChoose a different project name or remove the existing directory.');
      }
    } else {
      console.error('\nAn unexpected error occurred');
      console.error(
        'Please report this issue at: https://github.com/veloxts/velox-ts-framework/issues'
      );
    }
    process.exit(1);
  }
}

// Run the CLI
main();
