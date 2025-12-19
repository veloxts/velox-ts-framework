/**
 * VeloxTS MCP Server
 *
 * Model Context Protocol server that exposes VeloxTS project context to AI tools.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { getPromptTemplate, listPromptTemplates } from './prompts/index.js';
import {
  formatErrorsAsText,
  formatProceduresAsText,
  formatRoutesAsText,
  formatSchemasAsText,
  getErrors,
  getProcedures,
  getRoutes,
  getSchemas,
} from './resources/index.js';
import { formatGenerateResult, type GeneratorType, generate } from './tools/generate.js';
import { formatMigrateResult, type MigrateAction, migrate } from './tools/migrate.js';
import { findProjectRoot, getProjectInfo } from './utils/project.js';

// ============================================================================
// Tool Argument Schemas (Zod validation)
// ============================================================================

/**
 * Schema for velox_generate tool arguments
 */
const GenerateArgsSchema = z.object({
  type: z
    .enum(['procedure', 'schema', 'model', 'migration', 'test', 'resource', 'seeder', 'factory'])
    .describe('Type of code to generate'),
  name: z.string().min(1).describe('Entity name (e.g., User, Post)'),
  crud: z.boolean().optional().describe('Generate full CRUD operations'),
  dryRun: z.boolean().optional().describe('Preview without writing files'),
});

/**
 * Schema for velox_migrate tool arguments
 */
const MigrateArgsSchema = z.object({
  action: z
    .enum(['status', 'run', 'rollback', 'fresh', 'reset'])
    .describe('Migration action to perform'),
  dev: z.boolean().optional().describe('Development mode (creates migration from schema diff)'),
  dryRun: z.boolean().optional().describe('Preview without executing'),
});

// ============================================================================
// Types
// ============================================================================

/**
 * Server configuration options
 */
export interface VeloxMCPServerOptions {
  /** Project root directory (auto-detected if not specified) */
  projectRoot?: string;
  /** Enable debug logging */
  debug?: boolean;
  /** Server name */
  name?: string;
  /** Server version */
  version?: string;
}

// ============================================================================
// Server Factory
// ============================================================================

/**
 * Create a VeloxTS MCP server
 */
export function createVeloxMCPServer(options: VeloxMCPServerOptions = {}): Server {
  const projectRoot = options.projectRoot ?? findProjectRoot() ?? process.cwd();
  const debug = options.debug ?? false;
  const serverName = options.name ?? 'veloxts-mcp';
  const serverVersion = options.version ?? '0.5.0';

  const server = new Server(
    {
      name: serverName,
      version: serverVersion,
    },
    {
      capabilities: {
        resources: {},
        tools: {},
        prompts: {},
      },
    }
  );

  // Debug logging helper
  const log = debug ? (message: string) => console.error(`[${serverName}] ${message}`) : () => {};

  // ===========================================================================
  // Resources
  // ===========================================================================

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    log('Listing resources');

    return {
      resources: [
        {
          uri: 'velox://procedures',
          name: 'VeloxTS Procedures',
          description:
            'List all registered procedures with their types, inputs, outputs, and routes',
          mimeType: 'text/plain',
        },
        {
          uri: 'velox://routes',
          name: 'REST Routes',
          description: 'REST route mappings generated from procedures',
          mimeType: 'text/plain',
        },
        {
          uri: 'velox://schemas',
          name: 'Zod Schemas',
          description: 'All Zod validation schemas in the project',
          mimeType: 'text/plain',
        },
        {
          uri: 'velox://errors',
          name: 'Error Catalog',
          description: 'VeloxTS error codes with messages and fix suggestions',
          mimeType: 'text/plain',
        },
        {
          uri: 'velox://project',
          name: 'Project Info',
          description: 'VeloxTS project information and structure',
          mimeType: 'text/plain',
        },
      ],
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    log(`Reading resource: ${uri}`);

    switch (uri) {
      case 'velox://procedures': {
        const data = await getProcedures(projectRoot);
        return {
          contents: [
            {
              uri,
              mimeType: 'text/plain',
              text: formatProceduresAsText(data),
            },
          ],
        };
      }

      case 'velox://routes': {
        const data = await getRoutes(projectRoot);
        return {
          contents: [
            {
              uri,
              mimeType: 'text/plain',
              text: formatRoutesAsText(data),
            },
          ],
        };
      }

      case 'velox://schemas': {
        const data = await getSchemas(projectRoot);
        return {
          contents: [
            {
              uri,
              mimeType: 'text/plain',
              text: formatSchemasAsText(data),
            },
          ],
        };
      }

      case 'velox://errors': {
        const data = getErrors();
        return {
          contents: [
            {
              uri,
              mimeType: 'text/plain',
              text: formatErrorsAsText(data),
            },
          ],
        };
      }

      case 'velox://project': {
        const info = await getProjectInfo(projectRoot);
        const text = info
          ? [
              '# VeloxTS Project',
              '',
              `Name: ${info.name}`,
              `Version: ${info.version}`,
              `Root: ${info.root}`,
              '',
              '## Paths',
              info.apiPath ? `API: ${info.apiPath}` : null,
              info.webPath ? `Web: ${info.webPath}` : null,
              info.proceduresPath ? `Procedures: ${info.proceduresPath}` : null,
              info.schemasPath ? `Schemas: ${info.schemasPath}` : null,
              info.prismaSchemaPath ? `Prisma Schema: ${info.prismaSchemaPath}` : null,
            ]
              .filter(Boolean)
              .join('\n')
          : 'No VeloxTS project detected in current directory.';

        return {
          contents: [
            {
              uri,
              mimeType: 'text/plain',
              text,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown resource: ${uri}`);
    }
  });

  // ===========================================================================
  // Tools
  // ===========================================================================

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    log('Listing tools');

    return {
      tools: [
        {
          name: 'velox_generate',
          description: 'Generate VeloxTS code (procedures, schemas, resources, etc.)',
          inputSchema: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: [
                  'procedure',
                  'schema',
                  'model',
                  'migration',
                  'test',
                  'resource',
                  'seeder',
                  'factory',
                ],
                description: 'Type of code to generate',
              },
              name: {
                type: 'string',
                description: 'Entity name (e.g., User, Post)',
              },
              crud: {
                type: 'boolean',
                description: 'Generate full CRUD operations',
              },
              dryRun: {
                type: 'boolean',
                description: 'Preview without writing files',
              },
            },
            required: ['type', 'name'],
          },
        },
        {
          name: 'velox_migrate',
          description: 'Run database migrations',
          inputSchema: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                enum: ['status', 'run', 'rollback', 'fresh', 'reset'],
                description: 'Migration action to perform',
              },
              dev: {
                type: 'boolean',
                description: 'Development mode (creates migration from schema diff)',
              },
              dryRun: {
                type: 'boolean',
                description: 'Preview without executing',
              },
            },
            required: ['action'],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    log(`Calling tool: ${name}`);

    switch (name) {
      case 'velox_generate': {
        // Validate arguments with Zod
        const parsed = GenerateArgsSchema.safeParse(args);
        if (!parsed.success) {
          const errors = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
          return {
            content: [
              {
                type: 'text',
                text: `Invalid arguments for velox_generate:\n${errors.join('\n')}`,
              },
            ],
            isError: true,
          };
        }

        const result = await generate({
          type: parsed.data.type as GeneratorType,
          name: parsed.data.name,
          crud: parsed.data.crud,
          dryRun: parsed.data.dryRun,
          json: true,
        });

        return {
          content: [
            {
              type: 'text',
              text: formatGenerateResult(result),
            },
          ],
          isError: !result.success,
        };
      }

      case 'velox_migrate': {
        // Validate arguments with Zod
        const parsed = MigrateArgsSchema.safeParse(args);
        if (!parsed.success) {
          const errors = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
          return {
            content: [
              {
                type: 'text',
                text: `Invalid arguments for velox_migrate:\n${errors.join('\n')}`,
              },
            ],
            isError: true,
          };
        }

        const result = await migrate({
          action: parsed.data.action as MigrateAction,
          dev: parsed.data.dev,
          dryRun: parsed.data.dryRun,
          json: true,
        });

        return {
          content: [
            {
              type: 'text',
              text: formatMigrateResult(result),
            },
          ],
          isError: !result.success,
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  // ===========================================================================
  // Prompts
  // ===========================================================================

  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    log('Listing prompts');

    const prompts = listPromptTemplates();

    return {
      prompts: prompts.map((p) => ({
        name: p.name,
        description: p.description,
      })),
    };
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name } = request.params;
    log(`Getting prompt: ${name}`);

    const template = getPromptTemplate(name);

    if (!template) {
      throw new Error(`Unknown prompt: ${name}`);
    }

    return {
      description: template.description,
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: template.content,
          },
        },
      ],
    };
  });

  return server;
}

/**
 * Run the MCP server with stdio transport
 */
export async function runMCPServer(options: VeloxMCPServerOptions = {}): Promise<void> {
  const server = createVeloxMCPServer(options);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
