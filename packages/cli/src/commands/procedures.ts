/**
 * Procedures command - Discover and list procedures
 *
 * Provides subcommands for managing procedures:
 * - procedures:list - List all discovered procedures
 */

import {
  type DiscoveryOptions,
  discoverProceduresVerbose,
  isDiscoveryError,
  type ProcedureCollection,
} from '@veloxts/router';
import { Command } from 'commander';
import pc from 'picocolors';

// ============================================================================
// Types
// ============================================================================

interface ListOptions {
  path?: string;
  recursive?: boolean;
  json?: boolean;
}

interface ProcedureInfo {
  name: string;
  type: 'query' | 'mutation';
  hasInput: boolean;
  hasOutput: boolean;
}

interface CollectionInfo {
  namespace: string;
  procedures: ProcedureInfo[];
}

interface ListResult {
  collections: CollectionInfo[];
  scannedFiles: number;
  loadedFiles: number;
  warnings: string[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract procedure info from a collection
 */
function extractProcedureInfo(collection: ProcedureCollection): CollectionInfo {
  const procedures: ProcedureInfo[] = [];

  for (const [name, proc] of Object.entries(collection.procedures)) {
    const procedure = proc as {
      type: 'query' | 'mutation';
      inputSchema?: unknown;
      outputSchema?: unknown;
    };

    procedures.push({
      name,
      type: procedure.type,
      hasInput: procedure.inputSchema !== undefined,
      hasOutput: procedure.outputSchema !== undefined,
    });
  }

  // Sort by name for consistent output
  procedures.sort((a, b) => a.name.localeCompare(b.name));

  return {
    namespace: collection.namespace,
    procedures,
  };
}

/**
 * Format HTTP method label based on procedure type and name
 */
function formatMethodLabel(name: string, type: 'query' | 'mutation'): string {
  // Infer HTTP method from procedure name
  if (name.startsWith('get') || name.startsWith('find')) return pc.green('GET    ');
  if (name.startsWith('list')) return pc.green('GET    ');
  if (name.startsWith('create') || name.startsWith('add')) return pc.yellow('POST   ');
  if (name.startsWith('update') || name.startsWith('edit')) return pc.blue('PUT    ');
  if (name.startsWith('patch')) return pc.cyan('PATCH  ');
  if (name.startsWith('delete') || name.startsWith('remove')) return pc.red('DELETE ');

  // Fallback to procedure type
  return type === 'query' ? pc.green('GET    ') : pc.yellow('POST   ');
}

/**
 * Print human-readable output
 */
function printPrettyOutput(result: ListResult): void {
  const totalProcedures = result.collections.reduce((sum, c) => sum + c.procedures.length, 0);

  console.log();
  console.log(pc.bold('Discovered Procedures'));
  console.log(pc.dim(`─`.repeat(50)));
  console.log();

  for (const collection of result.collections) {
    console.log(pc.bold(pc.cyan(`/${collection.namespace}`)));

    for (const proc of collection.procedures) {
      const method = formatMethodLabel(proc.name, proc.type);
      const schemas = [];
      if (proc.hasInput) schemas.push('input');
      if (proc.hasOutput) schemas.push('output');
      const schemaInfo = schemas.length > 0 ? pc.dim(` (${schemas.join(', ')})`) : '';

      console.log(`  ${method} ${proc.name}${schemaInfo}`);
    }

    console.log();
  }

  // Summary
  console.log(pc.dim(`─`.repeat(50)));
  console.log(
    `${pc.bold(totalProcedures.toString())} procedures in ${pc.bold(result.collections.length.toString())} collections`
  );
  console.log(pc.dim(`Scanned ${result.scannedFiles} files, loaded ${result.loadedFiles} files`));

  // Warnings
  if (result.warnings.length > 0) {
    console.log();
    console.log(pc.yellow(`${result.warnings.length} warning(s):`));
    for (const warning of result.warnings) {
      console.log(pc.yellow(`  • ${warning}`));
    }
  }

  console.log();
}

/**
 * Print JSON output
 */
function printJsonOutput(result: ListResult): void {
  console.log(JSON.stringify(result, null, 2));
}

// ============================================================================
// Command Implementation
// ============================================================================

/**
 * Create the procedures:list command
 */
function createListCommand(): Command {
  return new Command('list')
    .description('List all discovered procedures')
    .option('-p, --path <path>', 'Path to procedures directory', './src/procedures')
    .option('-r, --recursive', 'Scan subdirectories', false)
    .option('--json', 'Output as JSON', false)
    .action(async (options: ListOptions) => {
      const proceduresPath = options.path ?? './src/procedures';

      const discoveryOptions: DiscoveryOptions = {
        recursive: options.recursive ?? false,
        onInvalidExport: 'warn',
      };

      try {
        const discovery = await discoverProceduresVerbose(proceduresPath, discoveryOptions);

        const result: ListResult = {
          collections: discovery.collections.map(extractProcedureInfo),
          scannedFiles: discovery.scannedFiles.length,
          loadedFiles: discovery.loadedFiles.length,
          warnings: discovery.warnings.map((w) => `${w.filePath}: ${w.message}`),
        };

        if (options.json) {
          printJsonOutput(result);
        } else {
          printPrettyOutput(result);
        }
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
 * Create the procedures command with subcommands
 */
export function createProceduresCommand(): Command {
  const procedures = new Command('procedures')
    .description('Procedure discovery and management commands')
    .addCommand(createListCommand());

  return procedures;
}
