# @veloxts/mcp

> **Early Preview (v0.6.x)** - APIs are stabilizing but may still change.

Model Context Protocol server for VeloxTS - exposes project context (procedures, schemas, routes, errors) to AI assistants like Claude Desktop and other tools that support the Model Context Protocol.

## Quick Start

### Automatic Setup (Recommended)

The easiest way to set up the MCP server is using the VeloxTS CLI:

```bash
velox mcp init
```

This command will:
- Detect your operating system
- Locate your Claude Desktop configuration
- Add the VeloxTS MCP server configuration
- Guide you through the setup process

After running the command, **restart Claude Desktop** to activate the integration.

### Manual Setup

If you prefer to configure manually, add this to your Claude Desktop configuration:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

**Linux:** `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "veloxts": {
      "command": "npx",
      "args": ["@veloxts/mcp"]
    }
  }
}
```

## What It Does

The MCP server provides Claude Desktop with deep context about your VeloxTS project:

- **Procedures**: All API procedures with their inputs, outputs, and business logic
- **Schemas**: Zod validation schemas and type definitions
- **Routes**: REST endpoints and tRPC procedure mappings
- **Errors**: Custom error types and error handling patterns
- **Project Structure**: File organization and module boundaries

This enables Claude to:
- Suggest code that matches your existing patterns
- Understand your API surface and data models
- Generate procedures that fit seamlessly with your codebase
- Help debug issues with full context of your project

## CLI Commands

### velox mcp init

Set up Claude Desktop configuration automatically:

```bash
velox mcp init             # Interactive setup
velox mcp init --dry-run   # Preview changes without writing
velox mcp init --force     # Overwrite existing configuration
velox mcp init --json      # Output as JSON for scripting
```

Options:
- `--dry-run, -d`: Preview configuration changes without writing files
- `--force, -f`: Overwrite existing VeloxTS MCP configuration
- `--json`: Output results as JSON for automated workflows

## Troubleshooting

### Claude Desktop doesn't show VeloxTS context

1. Ensure you've restarted Claude Desktop after running `velox mcp init`
2. Check that the configuration file exists and is valid JSON
3. Verify `@veloxts/mcp` is installed in your project or globally accessible
4. Try running `npx @veloxts/mcp` manually to test the server

### Configuration file not found

Run `velox mcp init --dry-run` to see the expected configuration path for your platform. If Claude Desktop is not installed, the command will warn you.

### Permission errors

On macOS/Linux, ensure you have write access to the configuration directory:

```bash
# Check permissions
ls -la ~/Library/Application\ Support/Claude  # macOS
ls -la ~/.config/Claude                        # Linux
```

## Learn More

- [Model Context Protocol](https://modelcontextprotocol.io) - Official MCP specification
- [@veloxts/cli](https://www.npmjs.com/package/@veloxts/cli) - VeloxTS CLI tools
- [@veloxts/velox](https://www.npmjs.com/package/@veloxts/velox) - Complete VeloxTS framework

## License

MIT
