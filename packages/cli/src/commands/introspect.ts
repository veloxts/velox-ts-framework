/**
 * Introspect command - Query VeloxTS project context for AI tools
 *
 * Provides machine-readable introspection of:
 * - procedures - Procedure definitions with input/output schemas
 * - schemas - Zod validation schemas in the project
 * - routes - REST route mappings
 * - errors - Error catalog with codes and fix suggestions
 * - all - Complete project introspection
 */

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import {
  type CompiledProcedure,
  type DiscoveryOptions,
  discoverProceduresVerbose,
  getRouteSummary,
  isDiscoveryError,
  type ProcedureCollection,
} from '@veloxts/router';
import { Command } from 'commander';
import { config as loadEnv } from 'dotenv';
import pc from 'picocolors';

import { getErrorsByCategory } from '../errors/index.js';
import { extractSchemaNames, extractSchemaTypes } from '../utils/schema-patterns.js';

// ============================================================================
// Constants
// ============================================================================

/** Default API prefix for REST routes */
const DEFAULT_API_PREFIX = '/api';

// ============================================================================
// Types
// ============================================================================

interface IntrospectOptions {
  path?: string;
  recursive?: boolean;
  json?: boolean;
  apiPrefix?: string;
}

interface ProcedureIntrospection {
  namespace: string;
  name: string;
  type: 'query' | 'mutation';
  hasInput: boolean;
  hasOutput: boolean;
  guards: string[];
  route?: {
    method: string;
    path: string;
  };
}

interface SchemaIntrospection {
  name: string;
  file: string;
  typeName?: string;
}

interface RouteIntrospection {
  method: string;
  path: string;
  procedure: string;
  namespace: string;
}

interface ErrorIntrospection {
  code: string;
  name: string;
  message: string;
  fix?: string;
  docsUrl?: string;
  category: string;
}

interface IntrospectResult {
  procedures?: ProcedureIntrospection[];
  schemas?: SchemaIntrospection[];
  routes?: RouteIntrospection[];
  errors?: ErrorIntrospection[];
  summary: {
    procedureCount?: number;
    schemaCount?: number;
    routeCount?: number;
    errorCount?: number;
    scannedFiles?: number;
    warnings?: string[];
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Load environment variables from .env file if present
 */
function loadEnvironment(): void {
  const envPath = resolve(process.cwd(), '.env');
  if (existsSync(envPath)) {
    loadEnv({ path: envPath });
  }
}

/**
 * Extract procedure info with route mappings
 */
function extractProcedureIntrospection(
  collections: ProcedureCollection[],
  apiPrefix: string
): ProcedureIntrospection[] {
  const procedures: ProcedureIntrospection[] = [];
  const routeSummary = getRouteSummary(collections, apiPrefix);

  // Create route lookup by namespace + procedure name
  const routeMap = new Map<string, { method: string; path: string }>();
  for (const route of routeSummary) {
    const key = `${route.namespace}:${route.procedure}`;
    routeMap.set(key, { method: route.method, path: route.path });
  }

  for (const collection of collections) {
    for (const [name, proc] of Object.entries(collection.procedures)) {
      // Procedure type is CompiledProcedure from @veloxts/router
      const procedure = proc as CompiledProcedure;

      const key = `${collection.namespace}:${name}`;
      const route = routeMap.get(key);

      procedures.push({
        namespace: collection.namespace,
        name,
        type: procedure.type,
        hasInput: procedure.inputSchema !== undefined,
        hasOutput: procedure.outputSchema !== undefined,
        guards: procedure.guards.map((g) => g.name),
        route,
      });
    }
  }

  // Sort by namespace, then name
  procedures.sort((a, b) => {
    const nsCompare = a.namespace.localeCompare(b.namespace);
    return nsCompare !== 0 ? nsCompare : a.name.localeCompare(b.name);
  });

  return procedures;
}

/**
 * Result of schema scanning
 */
interface SchemaScanResult {
  schemas: SchemaIntrospection[];
  warnings: string[];
}

/**
 * Scan for Zod schemas in project
 */
async function scanSchemas(schemasPath: string): Promise<SchemaScanResult> {
  const schemas: SchemaIntrospection[] = [];
  const warnings: string[] = [];

  if (!existsSync(schemasPath)) {
    return { schemas, warnings };
  }

  try {
    const entries = await readdir(schemasPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.ts')) continue;
      if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.spec.ts')) continue;
      if (entry.name.endsWith('.d.ts')) continue;

      const filePath = join(schemasPath, entry.name);
      try {
        const content = await readFile(filePath, 'utf-8');

        // Use shared utilities for pattern matching
        const schemaNames = extractSchemaNames(content);
        const typeMap = extractSchemaTypes(content);

        // Build schema info
        for (const schemaName of schemaNames) {
          schemas.push({
            name: schemaName,
            file: entry.name,
            typeName: typeMap.get(schemaName),
          });
        }
      } catch (error) {
        // Track file read errors as warnings
        const message = error instanceof Error ? error.message : 'Unknown error';
        warnings.push(`Failed to read ${entry.name}: ${message}`);
      }
    }
  } catch (error) {
    // Track directory read errors as warnings
    const message = error instanceof Error ? error.message : 'Unknown error';
    warnings.push(`Failed to scan schemas directory: ${message}`);
  }

  // Sort by name
  schemas.sort((a, b) => a.name.localeCompare(b.name));

  return { schemas, warnings };
}

/**
 * Get error catalog introspection
 */
function getErrorIntrospection(): ErrorIntrospection[] {
  const errors: ErrorIntrospection[] = [];

  // Get all category codes
  const categories = ['E1', 'E2', 'E3', 'E4', 'E5', 'E9'];
  const categoryNames: Record<string, string> = {
    E1: 'Core/Runtime',
    E2: 'Generator',
    E3: 'Seeding',
    E4: 'Migration/Discovery',
    E5: 'Dev Server',
    E9: 'Configuration',
  };

  for (const prefix of categories) {
    const categoryErrors = getErrorsByCategory(prefix);
    const categoryName = categoryNames[prefix] ?? 'Unknown';

    for (const [code, def] of Object.entries(categoryErrors)) {
      errors.push({
        code,
        name: def.name,
        message: def.message,
        fix: def.fix,
        docsUrl: def.docsUrl,
        category: categoryName,
      });
    }
  }

  // Sort by code
  errors.sort((a, b) => a.code.localeCompare(b.code));

  return errors;
}

// ============================================================================
// Output Formatters
// ============================================================================

/**
 * Print procedures in human-readable format
 */
function printProcedures(procedures: ProcedureIntrospection[]): void {
  console.log();
  console.log(pc.bold('Procedures'));
  console.log(pc.dim('─'.repeat(60)));

  let currentNs = '';
  for (const proc of procedures) {
    if (proc.namespace !== currentNs) {
      currentNs = proc.namespace;
      console.log();
      console.log(pc.bold(pc.cyan(`/${currentNs}`)));
    }

    const method = proc.route?.method ?? (proc.type === 'query' ? 'GET' : 'POST');
    const methodColor =
      method === 'GET'
        ? pc.green
        : method === 'POST'
          ? pc.yellow
          : method === 'PUT'
            ? pc.blue
            : method === 'PATCH'
              ? pc.cyan
              : pc.red;

    const schemas = [];
    if (proc.hasInput) schemas.push('in');
    if (proc.hasOutput) schemas.push('out');
    const schemaInfo = schemas.length > 0 ? pc.dim(` [${schemas.join('/')}]`) : '';
    const guardInfo = proc.guards.length > 0 ? pc.magenta(` 🛡 ${proc.guards.join(', ')}`) : '';

    console.log(`  ${methodColor(method.padEnd(7))} ${proc.name}${schemaInfo}${guardInfo}`);

    if (proc.route) {
      console.log(pc.dim(`          → ${proc.route.path}`));
    }
  }

  console.log();
}

/**
 * Print schemas in human-readable format
 */
function printSchemas(schemas: SchemaIntrospection[]): void {
  console.log();
  console.log(pc.bold('Schemas'));
  console.log(pc.dim('─'.repeat(60)));

  const byFile = new Map<string, SchemaIntrospection[]>();
  for (const schema of schemas) {
    const list = byFile.get(schema.file) ?? [];
    list.push(schema);
    byFile.set(schema.file, list);
  }

  for (const [file, fileSchemas] of byFile) {
    console.log();
    console.log(pc.cyan(file));
    for (const schema of fileSchemas) {
      const typeName = schema.typeName ? pc.dim(` → ${schema.typeName}`) : '';
      console.log(`  ${schema.name}${typeName}`);
    }
  }

  console.log();
}

/**
 * Print routes in human-readable format
 */
function printRoutes(routes: RouteIntrospection[]): void {
  console.log();
  console.log(pc.bold('REST Routes'));
  console.log(pc.dim('─'.repeat(60)));

  for (const route of routes) {
    const methodColor =
      route.method === 'GET'
        ? pc.green
        : route.method === 'POST'
          ? pc.yellow
          : route.method === 'PUT'
            ? pc.blue
            : route.method === 'PATCH'
              ? pc.cyan
              : pc.red;

    console.log(`  ${methodColor(route.method.padEnd(7))} ${route.path}`);
    console.log(pc.dim(`          → ${route.namespace}.${route.procedure}`));
  }

  console.log();
}

/**
 * Print errors in human-readable format
 */
function printErrors(errors: ErrorIntrospection[]): void {
  console.log();
  console.log(pc.bold('Error Catalog') + pc.dim(' (reference documentation)'));
  console.log(pc.dim('─'.repeat(60)));
  console.log(pc.dim('These are all possible CLI error codes, not errors in your project.'));
  console.log();

  let currentCategory = '';
  for (const error of errors) {
    if (error.category !== currentCategory) {
      currentCategory = error.category;
      console.log();
      console.log(pc.bold(pc.cyan(currentCategory)));
    }

    console.log(`  ${pc.red(error.code)} ${error.name}`);
    console.log(pc.dim(`       ${error.message}`));
    if (error.fix) {
      console.log(pc.yellow(`       Fix: ${error.fix}`));
    }
  }

  console.log();
}

/**
 * Print summary
 */
function printSummary(result: IntrospectResult): void {
  console.log(pc.dim('─'.repeat(60)));
  const parts = [];
  if (result.summary.procedureCount !== undefined) {
    parts.push(`${result.summary.procedureCount} procedures`);
  }
  if (result.summary.schemaCount !== undefined) {
    parts.push(`${result.summary.schemaCount} schemas`);
  }
  if (result.summary.routeCount !== undefined) {
    parts.push(`${result.summary.routeCount} routes`);
  }
  if (result.summary.errorCount !== undefined) {
    parts.push(`${result.summary.errorCount} error codes in catalog`);
  }
  console.log(pc.bold(parts.join(' • ')));

  if (result.summary.scannedFiles !== undefined) {
    console.log(pc.dim(`Scanned ${result.summary.scannedFiles} files`));
  }

  if (result.summary.warnings && result.summary.warnings.length > 0) {
    console.log();
    console.log(pc.yellow(`${result.summary.warnings.length} warning(s):`));
    for (const warning of result.summary.warnings) {
      console.log(pc.yellow(`  • ${warning}`));
    }
  }

  console.log();
}

// ============================================================================
// Command Implementation
// ============================================================================

/**
 * Create the introspect procedures subcommand
 */
function createProceduresSubcommand(): Command {
  return new Command('procedures')
    .alias('p')
    .description('Introspect procedure definitions')
    .option('-p, --path <path>', 'Path to procedures directory', './src/procedures')
    .option('-r, --recursive', 'Scan subdirectories', false)
    .option('--api-prefix <prefix>', 'API route prefix', DEFAULT_API_PREFIX)
    .option('--json', 'Output as JSON', false)
    .action(async (options: IntrospectOptions) => {
      loadEnvironment();

      const proceduresPath = options.path ?? './src/procedures';
      const apiPrefix = options.apiPrefix ?? DEFAULT_API_PREFIX;
      const discoveryOptions: DiscoveryOptions = {
        recursive: options.recursive ?? false,
        onInvalidExport: 'warn',
      };

      try {
        const discovery = await discoverProceduresVerbose(proceduresPath, discoveryOptions);
        const procedures = extractProcedureIntrospection(discovery.collections, apiPrefix);

        const result: IntrospectResult = {
          procedures,
          summary: {
            procedureCount: procedures.length,
            scannedFiles: discovery.scannedFiles.length,
            warnings: discovery.warnings.map((w) => `${w.filePath}: ${w.message}`),
          },
        };

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printProcedures(procedures);
          printSummary(result);
        }

        process.exit(0);
      } catch (error) {
        if (isDiscoveryError(error)) {
          if (options.json) {
            console.log(JSON.stringify({ error: error.toJSON() }, null, 2));
          } else {
            console.error(pc.red(error.format()));
          }
          process.exit(1);
        }
        throw error;
      }
    });
}

/**
 * Create the introspect schemas subcommand
 */
function createSchemasSubcommand(): Command {
  return new Command('schemas')
    .alias('s')
    .description('Introspect Zod validation schemas')
    .option('-p, --path <path>', 'Path to schemas directory', './src/schemas')
    .option('--json', 'Output as JSON', false)
    .action(async (options: IntrospectOptions) => {
      const schemasPath = options.path ?? './src/schemas';
      const { schemas, warnings } = await scanSchemas(schemasPath);

      const result: IntrospectResult = {
        schemas,
        summary: {
          schemaCount: schemas.length,
          warnings: warnings.length > 0 ? warnings : undefined,
        },
      };

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        printSchemas(schemas);
        printSummary(result);
      }

      // Explicit exit to ensure process terminates after async operations
      process.exit(0);
    });
}

/**
 * Create the introspect routes subcommand
 */
function createRoutesSubcommand(): Command {
  return new Command('routes')
    .alias('r')
    .description('Introspect REST route mappings')
    .option('-p, --path <path>', 'Path to procedures directory', './src/procedures')
    .option('-r, --recursive', 'Scan subdirectories', false)
    .option('--api-prefix <prefix>', 'API route prefix', DEFAULT_API_PREFIX)
    .option('--json', 'Output as JSON', false)
    .action(async (options: IntrospectOptions) => {
      loadEnvironment();

      const proceduresPath = options.path ?? './src/procedures';
      const apiPrefix = options.apiPrefix ?? DEFAULT_API_PREFIX;
      const discoveryOptions: DiscoveryOptions = {
        recursive: options.recursive ?? false,
        onInvalidExport: 'warn',
      };

      try {
        const discovery = await discoverProceduresVerbose(proceduresPath, discoveryOptions);
        const routeSummary = getRouteSummary(discovery.collections, apiPrefix);

        const routes: RouteIntrospection[] = routeSummary.map((r) => ({
          method: r.method,
          path: r.path,
          procedure: r.procedure,
          namespace: r.namespace,
        }));

        const result: IntrospectResult = {
          routes,
          summary: {
            routeCount: routes.length,
            scannedFiles: discovery.scannedFiles.length,
          },
        };

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printRoutes(routes);
          printSummary(result);
        }

        process.exit(0);
      } catch (error) {
        if (isDiscoveryError(error)) {
          if (options.json) {
            console.log(JSON.stringify({ error: error.toJSON() }, null, 2));
          } else {
            console.error(pc.red(error.format()));
          }
          process.exit(1);
        }
        throw error;
      }
    });
}

/**
 * Create the introspect errors subcommand
 */
function createErrorsSubcommand(): Command {
  return new Command('errors')
    .alias('e')
    .description('Introspect error catalog')
    .option('--json', 'Output as JSON', false)
    .action((options: { json?: boolean }) => {
      const errors = getErrorIntrospection();

      const result: IntrospectResult = {
        errors,
        summary: {
          errorCount: errors.length,
        },
      };

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        printErrors(errors);
        printSummary(result);
      }
    });
}

/**
 * Create the introspect all subcommand
 */
function createAllSubcommand(): Command {
  return new Command('all')
    .alias('a')
    .description('Full project introspection')
    .option('-p, --path <path>', 'Path to procedures directory', './src/procedures')
    .option('-s, --schemas-path <path>', 'Path to schemas directory', './src/schemas')
    .option('-r, --recursive', 'Scan subdirectories', false)
    .option('--api-prefix <prefix>', 'API route prefix', DEFAULT_API_PREFIX)
    .option('--json', 'Output as JSON', false)
    .action(async (options: IntrospectOptions & { schemasPath?: string }) => {
      loadEnvironment();

      const proceduresPath = options.path ?? './src/procedures';
      const schemasPath = options.schemasPath ?? './src/schemas';
      const apiPrefix = options.apiPrefix ?? DEFAULT_API_PREFIX;
      const discoveryOptions: DiscoveryOptions = {
        recursive: options.recursive ?? false,
        onInvalidExport: 'warn',
      };

      try {
        // Discover procedures and routes
        const discovery = await discoverProceduresVerbose(proceduresPath, discoveryOptions);
        const procedures = extractProcedureIntrospection(discovery.collections, apiPrefix);
        const routeSummary = getRouteSummary(discovery.collections, apiPrefix);
        const routes: RouteIntrospection[] = routeSummary.map((r) => ({
          method: r.method,
          path: r.path,
          procedure: r.procedure,
          namespace: r.namespace,
        }));

        // Scan schemas
        const { schemas, warnings: schemaWarnings } = await scanSchemas(schemasPath);

        // Get errors
        const errors = getErrorIntrospection();

        // Combine warnings from procedure discovery and schema scanning
        const allWarnings = [
          ...discovery.warnings.map((w) => `${w.filePath}: ${w.message}`),
          ...schemaWarnings,
        ];

        const result: IntrospectResult = {
          procedures,
          schemas,
          routes,
          errors,
          summary: {
            procedureCount: procedures.length,
            schemaCount: schemas.length,
            routeCount: routes.length,
            errorCount: errors.length,
            scannedFiles: discovery.scannedFiles.length,
            warnings: allWarnings.length > 0 ? allWarnings : undefined,
          },
        };

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printProcedures(procedures);
          printSchemas(schemas);
          printRoutes(routes);
          printErrors(errors);
          printSummary(result);
        }

        process.exit(0);
      } catch (error) {
        if (isDiscoveryError(error)) {
          if (options.json) {
            console.log(JSON.stringify({ error: error.toJSON() }, null, 2));
          } else {
            console.error(pc.red(error.format()));
          }
          process.exit(1);
        }
        throw error;
      }
    });
}

/**
 * Create the introspect command with subcommands
 */
export function createIntrospectCommand(): Command {
  const introspect = new Command('introspect')
    .description('Introspect VeloxTS project context for AI tools')
    .addCommand(createProceduresSubcommand())
    .addCommand(createSchemasSubcommand())
    .addCommand(createRoutesSubcommand())
    .addCommand(createErrorsSubcommand())
    .addCommand(createAllSubcommand());

  return introspect;
}
