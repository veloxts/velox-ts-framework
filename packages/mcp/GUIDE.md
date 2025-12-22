# MCP Server Guide

The **@veloxts/mcp** package provides a Model Context Protocol (MCP) server that exposes your VeloxTS project structure to AI assistants. This enables intelligent code assistance with full awareness of your procedures, schemas, routes, and error codes.

## What is MCP?

Model Context Protocol is an open standard that enables AI assistants to access contextual information from your development environment. The VeloxTS MCP server allows Claude and other MCP-compatible AI tools to introspect your API structure programmatically.

## Installation

```bash
npm install @veloxts/mcp
```

## Quick Start

### CLI Usage

Run the MCP server as a standalone process:

```bash
# Run MCP server with stdio transport
velox-mcp

# Enable debug logging
velox-mcp --debug
```

### Programmatic Usage

```typescript
import { runMCPServer, createVeloxMCPServer } from '@veloxts/mcp';

// Run with stdio transport (for CLI integration)
await runMCPServer({ debug: true });

// Or create a custom server instance
const server = createVeloxMCPServer({
  projectRoot: '/path/to/project',
  debug: true,
});
```

## Available Resources

The MCP server exposes these read-only resources via `velox://` URIs:

**velox://procedures** - Lists all registered procedures with types, inputs, outputs, and REST route mappings

**velox://routes** - Shows REST route mappings generated from procedure naming conventions

**velox://schemas** - Displays all Zod validation schemas defined in your project

**velox://errors** - Error catalog with VeloxTS error codes, messages, and fix suggestions

**velox://project** - Project metadata including paths to procedures, schemas, and Prisma schema

## Available Tools

AI assistants can invoke these actions:

**velox_generate** - Generate VeloxTS code (procedures, schemas, resources, migrations, tests, etc.)

**velox_migrate** - Run database migrations (status, run, rollback, fresh, reset)

## Available Prompts

Reusable prompt templates for common VeloxTS tasks:

- **CREATE_PROCEDURE** - Guidance for creating type-safe API procedures
- **SETUP_AUTH** - Instructions for implementing authentication
- **ADD_VALIDATION** - Best practices for Zod schema validation
- **ERROR_HANDLING** - Error handling patterns with typed responses

## Claude Desktop Integration

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "veloxts": {
      "command": "velox-mcp",
      "args": []
    }
  }
}
```

Restart Claude Desktop. The VeloxTS context will be available when working in VeloxTS projects.

## Learn More

- **Main Package**: [@veloxts/velox](https://www.npmjs.com/package/@veloxts/velox)
- **Framework Docs**: [VeloxTS Documentation](https://github.com/veloxts/velox-ts-framework)
- **MCP Specification**: [Model Context Protocol](https://modelcontextprotocol.io)
