/**
 * OpenAPI command - Generate OpenAPI specifications
 *
 * Provides subcommands for generating OpenAPI documentation:
 * - openapi:generate - Generate OpenAPI JSON specification from procedures
 */

import { existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';

import {
  type DiscoveryOptions,
  discoverProceduresVerbose,
  generateOpenApiSpec,
  isDiscoveryError,
  type OpenAPIGeneratorOptions,
  type OpenAPISpec,
  validateOpenApiSpec,
} from '@veloxts/router';
import { Command } from 'commander';
import { config as loadEnv } from 'dotenv';
import pc from 'picocolors';

/**
 * Load environment variables from .env file if present
 */
function loadEnvironment(): void {
  const envPath = resolve(process.cwd(), '.env');
  if (existsSync(envPath)) {
    loadEnv({ path: envPath });
  }
}

// ============================================================================
// Types
// ============================================================================

interface GenerateOptions {
  path?: string;
  output?: string;
  title?: string;
  version?: string;
  description?: string;
  server?: string[];
  prefix?: string;
  recursive?: boolean;
  pretty?: boolean;
  validate?: boolean;
  quiet?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse server URLs into OpenAPI Server objects
 */
function parseServers(servers: string[] | undefined): Array<{ url: string; description?: string }> {
  if (!servers || servers.length === 0) {
    return [];
  }

  return servers.map((server, index) => {
    // Support "url|description" format
    const [url, description] = server.split('|');
    return {
      url: url.trim(),
      description: description?.trim() ?? (index === 0 ? 'Primary server' : undefined),
    };
  });
}

/**
 * Ensure directory exists for output file
 */
async function ensureDir(filePath: string): Promise<void> {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

/**
 * Print success message with summary
 */
function printSuccess(
  outputPath: string,
  spec: OpenAPISpec,
  warnings: string[],
  quiet: boolean
): void {
  if (quiet) {
    return;
  }

  const pathCount = Object.keys(spec.paths).length;
  const tagCount = spec.tags?.length ?? 0;

  console.log();
  console.log(pc.green('✓') + pc.bold(' OpenAPI specification generated'));
  console.log();
  console.log(`  ${pc.dim('Output:')}  ${outputPath}`);
  console.log(`  ${pc.dim('Title:')}   ${spec.info.title}`);
  console.log(`  ${pc.dim('Version:')} ${spec.info.version}`);
  console.log(`  ${pc.dim('Paths:')}   ${pathCount}`);
  console.log(`  ${pc.dim('Tags:')}    ${tagCount}`);

  if (spec.servers?.length) {
    console.log(`  ${pc.dim('Servers:')} ${spec.servers.map((s) => s.url).join(', ')}`);
  }

  if (warnings.length > 0) {
    console.log();
    console.log(pc.yellow(`${warnings.length} warning(s):`));
    for (const warning of warnings) {
      console.log(pc.yellow(`  • ${warning}`));
    }
  }

  console.log();
}

// ============================================================================
// Command Implementation
// ============================================================================

/**
 * Create the openapi:generate command
 */
function createGenerateCommand(): Command {
  return new Command('generate')
    .description('Generate OpenAPI specification from procedures')
    .option('-p, --path <path>', 'Path to procedures directory', './src/procedures')
    .option('-o, --output <file>', 'Output file path', './openapi.json')
    .option('-t, --title <title>', 'API title', 'VeloxTS API')
    .option('-V, --version <version>', 'API version', '1.0.0')
    .option('-d, --description <desc>', 'API description')
    .option('-s, --server <url>', 'Server URL (can be specified multiple times)', collectOption)
    .option('--prefix <prefix>', 'API route prefix', '/api')
    .option('-r, --recursive', 'Scan subdirectories for procedures', false)
    .option('--pretty', 'Pretty-print JSON output', true)
    .option('--no-pretty', 'Minify JSON output')
    .option('--validate', 'Validate generated spec for issues', true)
    .option('--no-validate', 'Skip validation')
    .option('-q, --quiet', 'Suppress output except errors', false)
    .action(async (options: GenerateOptions) => {
      // Load .env file before importing procedure files
      loadEnvironment();

      const proceduresPath = options.path ?? './src/procedures';
      const outputPath = resolve(process.cwd(), options.output ?? './openapi.json');

      const discoveryOptions: DiscoveryOptions = {
        recursive: options.recursive ?? false,
        onInvalidExport: 'warn',
      };

      try {
        // Discover procedures
        if (!options.quiet) {
          console.log(pc.dim('Discovering procedures...'));
        }

        const discovery = await discoverProceduresVerbose(proceduresPath, discoveryOptions);

        if (discovery.collections.length === 0) {
          console.error(pc.red('Error: No procedure collections found'));
          console.error(pc.dim(`Searched in: ${proceduresPath}`));
          process.exit(1);
        }

        if (!options.quiet) {
          console.log(
            pc.dim(
              `Found ${discovery.collections.length} collection(s) with ` +
                `${discovery.collections.reduce((sum, c) => sum + Object.keys(c.procedures).length, 0)} procedure(s)`
            )
          );
        }

        // Build OpenAPI options
        const openApiOptions: OpenAPIGeneratorOptions = {
          info: {
            title: options.title ?? 'VeloxTS API',
            version: options.version ?? '1.0.0',
            description: options.description,
          },
          prefix: options.prefix ?? '/api',
          servers: parseServers(options.server),
        };

        // Generate spec
        if (!options.quiet) {
          console.log(pc.dim('Generating OpenAPI specification...'));
        }

        const spec = generateOpenApiSpec(discovery.collections, openApiOptions);

        // Validate if requested
        const warnings: string[] = [];
        if (options.validate !== false) {
          const validationWarnings = validateOpenApiSpec(spec);
          warnings.push(...validationWarnings);
        }

        // Add discovery warnings
        warnings.push(...discovery.warnings.map((w) => `${w.filePath}: ${w.message}`));

        // Write output
        await ensureDir(outputPath);
        const jsonContent = options.pretty !== false
          ? JSON.stringify(spec, null, 2)
          : JSON.stringify(spec);
        writeFileSync(outputPath, jsonContent, 'utf-8');

        // Print success message
        printSuccess(outputPath, spec, warnings, options.quiet ?? false);

        // Exit explicitly - dynamic imports may keep event loop running
        process.exit(0);
      } catch (error) {
        if (isDiscoveryError(error)) {
          console.error(pc.red(error.format()));
          process.exit(1);
        }

        throw error;
      }
    });
}

/**
 * Collect multiple option values into array
 */
function collectOption(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

/**
 * Create the openapi:serve command (placeholder for future Swagger UI serving)
 */
function createServeCommand(): Command {
  return new Command('serve')
    .description('Start a local Swagger UI server (coming soon)')
    .option('-f, --file <file>', 'OpenAPI spec file', './openapi.json')
    .option('--port <port>', 'Server port', '8080')
    .action((_options) => {
      console.log(pc.yellow('The serve command will be available in a future version.'));
      console.log(pc.dim('For now, use the swaggerUIPlugin in your Fastify app:'));
      console.log();
      console.log(pc.cyan(`  import { swaggerUIPlugin } from '@veloxts/router';`));
      console.log();
      console.log(pc.cyan(`  app.register(swaggerUIPlugin, {`));
      console.log(pc.cyan(`    routePrefix: '/docs',`));
      console.log(pc.cyan(`    collections: [userProcedures],`));
      console.log(pc.cyan(`    openapi: { info: { title: 'My API', version: '1.0.0' } },`));
      console.log(pc.cyan(`  });`));
      console.log();
      process.exit(0);
    });
}

/**
 * Create the openapi command with subcommands
 */
export function createOpenApiCommand(): Command {
  const openapi = new Command('openapi')
    .description('OpenAPI specification generation and management')
    .addCommand(createGenerateCommand())
    .addCommand(createServeCommand());

  return openapi;
}
