/**
 * OpenAPI command - Generate and serve OpenAPI specifications
 *
 * Provides subcommands for generating and serving OpenAPI documentation:
 * - openapi generate - Generate OpenAPI JSON/YAML specification from procedures
 * - openapi serve - Start a local Swagger UI server
 */

import { createServer } from 'node:http';
import { existsSync, readFileSync, watch, writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';

import YAML from 'yaml';

import {
  type DiscoveryOptions,
  discoverProceduresVerbose,
  generateOpenApiSpec,
  generateSwaggerUIHtml,
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

type OutputFormat = 'json' | 'yaml';

interface GenerateOptions {
  path?: string;
  output?: string;
  format?: OutputFormat;
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

interface ServeOptions {
  file?: string;
  port?: string;
  host?: string;
  watch?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Detect output format from file extension
 */
function detectFormat(outputPath: string, explicitFormat?: OutputFormat): OutputFormat {
  if (explicitFormat) {
    return explicitFormat;
  }

  const ext = extname(outputPath).toLowerCase();
  if (ext === '.yaml' || ext === '.yml') {
    return 'yaml';
  }

  return 'json';
}

/**
 * Serialize OpenAPI spec to string
 */
function serializeSpec(spec: OpenAPISpec, format: OutputFormat, pretty: boolean): string {
  if (format === 'yaml') {
    return YAML.stringify(spec, { indent: 2 });
  }

  return pretty ? JSON.stringify(spec, null, 2) : JSON.stringify(spec);
}

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
  quiet: boolean,
  format: OutputFormat = 'json'
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
  console.log(`  ${pc.dim('Format:')}  ${format.toUpperCase()}`);
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
    .option('-f, --format <format>', 'Output format (json or yaml), auto-detected from file extension if not specified')
    .option('-t, --title <title>', 'API title', 'VeloxTS API')
    .option('-V, --version <version>', 'API version', '1.0.0')
    .option('-d, --description <desc>', 'API description')
    .option('-s, --server <url>', 'Server URL (can be specified multiple times)', collectOption)
    .option('--prefix <prefix>', 'API route prefix', '/api')
    .option('-r, --recursive', 'Scan subdirectories for procedures', false)
    .option('--pretty', 'Pretty-print output', true)
    .option('--no-pretty', 'Minify output')
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

        // Determine output format
        const format = detectFormat(outputPath, options.format as OutputFormat | undefined);

        // Write output
        await ensureDir(outputPath);
        const content = serializeSpec(spec, format, options.pretty !== false);
        writeFileSync(outputPath, content, 'utf-8');

        // Print success message
        printSuccess(outputPath, spec, warnings, options.quiet ?? false, format);

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
 * Create the openapi:serve command
 */
function createServeCommand(): Command {
  return new Command('serve')
    .description('Start a local Swagger UI server to preview OpenAPI documentation')
    .option('-f, --file <file>', 'OpenAPI spec file (JSON or YAML)', './openapi.json')
    .option('--port <port>', 'Server port', '8080')
    .option('--host <host>', 'Host to bind', 'localhost')
    .option('-w, --watch', 'Watch for file changes and hot-reload', false)
    .action(async (options: ServeOptions) => {
      const filePath = resolve(process.cwd(), options.file ?? './openapi.json');
      const port = parseInt(options.port ?? '8080', 10);
      const host = options.host ?? 'localhost';
      const watchMode = options.watch ?? false;

      // Validate port number
      if (isNaN(port) || port < 1 || port > 65535) {
        console.error(pc.red(`Error: Invalid port number: ${options.port}. Must be between 1-65535.`));
        process.exit(1);
      }

      // Verify spec file exists
      if (!existsSync(filePath)) {
        console.error(pc.red(`Error: OpenAPI spec file not found: ${filePath}`));
        console.log(pc.dim('Run `velox openapi generate` first to create the spec.'));
        process.exit(1);
      }

      // Load spec file
      let spec: OpenAPISpec;
      try {
        spec = loadSpecFile(filePath);
      } catch (error) {
        console.error(pc.red(`Error: Failed to parse OpenAPI spec: ${(error as Error).message}`));
        process.exit(1);
      }

      // Generate Swagger UI HTML
      const title = spec.info?.title ?? 'API Documentation';
      let htmlContent = generateSwaggerUIHtml({
        specUrl: '/openapi.json',
        title,
        config: { tryItOutEnabled: true },
      });

      // Create HTTP server
      const server = createServer((req, res) => {
        // Handle CORS
        res.setHeader('Access-Control-Allow-Origin', '*');

        if (req.url === '/' || req.url === '/index.html') {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(htmlContent);
        } else if (req.url === '/openapi.json') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(spec, null, 2));
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        }
      });

      // Watch for file changes
      let watcher: ReturnType<typeof watch> | undefined;
      let debounceTimer: ReturnType<typeof setTimeout> | undefined;

      if (watchMode) {
        watcher = watch(filePath, () => {
          // Debounce rapid changes
          if (debounceTimer) {
            clearTimeout(debounceTimer);
          }

          debounceTimer = setTimeout(() => {
            try {
              spec = loadSpecFile(filePath);
              htmlContent = generateSwaggerUIHtml({
                specUrl: '/openapi.json',
                title: spec.info?.title ?? 'API Documentation',
                config: { tryItOutEnabled: true },
              });
              console.log(pc.green('✓') + pc.dim(' Spec reloaded'));
            } catch (error) {
              console.error(pc.yellow('⚠') + pc.dim(` Failed to reload spec: ${(error as Error).message}`));
            } finally {
              debounceTimer = undefined;
            }
          }, 100);
        });
      }

      // Handle graceful shutdown
      const shutdown = () => {
        console.log();
        console.log(pc.dim('Shutting down...'));
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
        watcher?.close();
        server.close(() => {
          process.exit(0);
        });
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);

      // Start server
      server.listen(port, host, () => {
        console.log();
        console.log(pc.green('✓') + pc.bold(' Swagger UI server started'));
        console.log();
        console.log(`  ${pc.dim('URL:')}     http://${host}:${port}`);
        console.log(`  ${pc.dim('Spec:')}    ${filePath}`);
        console.log(`  ${pc.dim('Title:')}   ${title}`);
        if (watchMode) {
          console.log(`  ${pc.dim('Watch:')}   ${pc.green('enabled')}`);
        }
        console.log();
        console.log(pc.dim('Press Ctrl+C to stop'));
        console.log();
      });
    });
}

/**
 * Load and parse an OpenAPI spec file (JSON or YAML)
 */
function loadSpecFile(filePath: string): OpenAPISpec {
  const content = readFileSync(filePath, 'utf-8');
  const ext = extname(filePath).toLowerCase();

  if (ext === '.yaml' || ext === '.yml') {
    return YAML.parse(content) as OpenAPISpec;
  }

  return JSON.parse(content) as OpenAPISpec;
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
