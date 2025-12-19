#!/usr/bin/env node

/**
 * VeloxTS MCP Server CLI
 *
 * Run the MCP server with stdio transport for integration with AI tools.
 *
 * @example
 * ```bash
 * # Run MCP server
 * velox-mcp
 *
 * # Run with debug output
 * velox-mcp --debug
 * ```
 */

import { runMCPServer } from './server.js';

// Parse command line arguments
const args = process.argv.slice(2);
const debug = args.includes('--debug') || args.includes('-d');

// Run the server
runMCPServer({ debug }).catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
