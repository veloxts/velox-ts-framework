/**
 * MCP command - Model Context Protocol configuration
 *
 * Provides subcommands for managing MCP server integration:
 * - mcp:init - Set up Claude Desktop configuration for VeloxTS MCP server
 */

import { homedir, platform } from 'node:os';
import { join } from 'node:path';

import * as p from '@clack/prompts';
import { Command } from 'commander';
import pc from 'picocolors';

import { error, formatCommand, formatPath, info, success, warning } from '../utils/output.js';
import { createDirectory, fileExists, readJsonFile, writeJsonFile } from '../utils/paths.js';

// ============================================================================
// Types
// ============================================================================

interface McpInitOptions {
  dryRun: boolean;
  force: boolean;
  json: boolean;
}

interface ClaudeDesktopConfig {
  mcpServers?: {
    [key: string]: {
      command: string;
      args: string[];
      env?: Record<string, string>;
    };
  };
  [key: string]: unknown;
}

interface McpInitResult {
  success: boolean;
  action: 'created' | 'updated' | 'exists' | 'error';
  configPath: string;
  message: string;
  instructions?: string;
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

const MCP_SERVER_NAME = 'veloxts';
const MCP_SERVER_CONFIG = {
  command: 'npx',
  args: ['@veloxts/mcp'],
};

// ============================================================================
// Command Factory
// ============================================================================

/**
 * Create the mcp command with subcommands
 */
export function createMcpCommand(): Command {
  const mcp = new Command('mcp').description('Model Context Protocol server configuration');

  mcp.addCommand(createMcpInitCommand());

  return mcp;
}

/**
 * Create the mcp:init subcommand
 */
function createMcpInitCommand(): Command {
  return new Command('init')
    .description('Set up Claude Desktop configuration for VeloxTS MCP server')
    .option('-d, --dry-run', 'Preview changes without writing files', false)
    .option('-f, --force', 'Overwrite existing VeloxTS MCP configuration', false)
    .option('--json', 'Output results as JSON', false)
    .action(async (options: McpInitOptions) => {
      await runMcpInit(options);
    })
    .addHelpText(
      'after',
      `
Examples:
  ${formatCommand('velox mcp:init')}              Set up MCP server configuration
  ${formatCommand('velox mcp:init --dry-run')}    Preview configuration changes
  ${formatCommand('velox mcp:init --force')}      Overwrite existing configuration
  ${formatCommand('velox mcp:init --json')}       Output as JSON for scripting

About:
  The MCP (Model Context Protocol) server exposes your VeloxTS project's
  context to Claude Desktop and other AI assistants. This command automates
  the configuration process.

  After running this command, restart Claude Desktop to use the MCP server.
`
    );
}

// ============================================================================
// Platform Detection
// ============================================================================

/**
 * Get the Claude Desktop configuration path for the current platform
 */
function getClaudeConfigPath(): string | null {
  const platformName = platform();

  switch (platformName) {
    case 'darwin': // macOS
      return join(
        homedir(),
        'Library',
        'Application Support',
        'Claude',
        'claude_desktop_config.json'
      );
    case 'win32': // Windows
      return join(process.env.APPDATA || '', 'Claude', 'claude_desktop_config.json');
    case 'linux':
      return join(homedir(), '.config', 'Claude', 'claude_desktop_config.json');
    default:
      return null;
  }
}

// ============================================================================
// Configuration Management
// ============================================================================

/**
 * Check if Claude Desktop is likely installed
 */
function isClaudeDesktopInstalled(configPath: string): boolean {
  // Check if parent directory exists (more reliable than checking for config file)
  const configDir = join(configPath, '..');
  return fileExists(configDir);
}

/**
 * Read existing Claude Desktop configuration
 */
async function readClaudeConfig(configPath: string): Promise<ClaudeDesktopConfig | null> {
  if (!fileExists(configPath)) {
    return null;
  }

  try {
    const config = await readJsonFile<ClaudeDesktopConfig>(configPath);
    return config;
  } catch (err) {
    throw new Error(
      `Failed to parse Claude Desktop configuration: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Check if VeloxTS MCP server is already configured
 */
function isVeloxMcpConfigured(config: ClaudeDesktopConfig | null): boolean {
  if (!config?.mcpServers) {
    return false;
  }

  return MCP_SERVER_NAME in config.mcpServers;
}

/**
 * Add or update VeloxTS MCP server configuration
 */
function addVeloxMcpConfig(config: ClaudeDesktopConfig | null): ClaudeDesktopConfig {
  const newConfig: ClaudeDesktopConfig = config ?? {};

  if (!newConfig.mcpServers) {
    newConfig.mcpServers = {};
  }

  newConfig.mcpServers[MCP_SERVER_NAME] = MCP_SERVER_CONFIG;

  return newConfig;
}

/**
 * Write Claude Desktop configuration
 */
async function writeClaudeConfig(configPath: string, config: ClaudeDesktopConfig): Promise<void> {
  const configDir = join(configPath, '..');

  // Ensure directory exists
  if (!fileExists(configDir)) {
    await createDirectory(configDir);
  }

  await writeJsonFile(configPath, config);
}

// ============================================================================
// Command Implementation
// ============================================================================

/**
 * Run the mcp:init command
 */
async function runMcpInit(options: McpInitOptions): Promise<void> {
  const { dryRun, force, json } = options;
  const isInteractive = !json;

  try {
    // Detect platform and config path
    const configPath = getClaudeConfigPath();

    if (!configPath) {
      const result: McpInitResult = {
        success: false,
        action: 'error',
        configPath: 'unknown',
        message: 'Unsupported platform',
        error: `Platform '${platform()}' is not supported`,
      };

      if (json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        error('Unsupported platform.');
        info(`This command supports macOS, Windows, and Linux.`);
        info(`Your platform: ${platform()}`);
      }
      process.exit(1);
    }

    // Check if Claude Desktop is installed
    if (!isClaudeDesktopInstalled(configPath) && isInteractive) {
      warning('Claude Desktop may not be installed.');
      console.log('');
      console.log(
        `  ${pc.dim('Expected config directory:')} ${formatPath(join(configPath, '..'))}`
      );
      console.log('');

      const shouldContinue = await p.confirm({
        message: 'Continue anyway?',
        initialValue: false,
      });

      if (p.isCancel(shouldContinue) || !shouldContinue) {
        info('Setup cancelled.');
        return;
      }
    }

    // Read existing configuration
    let config: ClaudeDesktopConfig | null = null;
    let configExists = false;

    try {
      config = await readClaudeConfig(configPath);
      configExists = config !== null;
    } catch (err) {
      const result: McpInitResult = {
        success: false,
        action: 'error',
        configPath,
        message: 'Failed to read configuration',
        error: err instanceof Error ? err.message : String(err),
      };

      if (json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        error('Failed to read Claude Desktop configuration.');
        console.log(`  ${pc.dim('Path:')} ${formatPath(configPath)}`);
        console.log(`  ${pc.dim('Error:')} ${err instanceof Error ? err.message : String(err)}`);
        console.log('');
        info('The configuration file may be corrupted or have invalid JSON.');
        info('You can manually delete it and run this command again.');
      }
      process.exit(1);
    }

    // Check if VeloxTS MCP is already configured
    const isAlreadyConfigured = isVeloxMcpConfigured(config);

    if (isAlreadyConfigured && !force) {
      const result: McpInitResult = {
        success: true,
        action: 'exists',
        configPath,
        message: 'VeloxTS MCP server is already configured',
      };

      if (json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        info('VeloxTS MCP server is already configured.');
        console.log('');
        console.log(`  ${pc.dim('Config path:')} ${formatPath(configPath)}`);
        console.log('');
        warning(`Use ${formatCommand('--force')} to overwrite the existing configuration.`);
      }
      return;
    }

    // Show what will be done
    if (isInteractive && !dryRun) {
      console.log('');
      if (isAlreadyConfigured) {
        info('Updating VeloxTS MCP server configuration:');
      } else if (configExists) {
        info('Adding VeloxTS MCP server to existing configuration:');
      } else {
        info('Creating Claude Desktop configuration:');
      }
      console.log('');
      console.log(`  ${pc.dim('Path:')} ${formatPath(configPath)}`);
      console.log(`  ${pc.dim('Server:')} ${MCP_SERVER_NAME}`);
      console.log(
        `  ${pc.dim('Command:')} ${MCP_SERVER_CONFIG.command} ${MCP_SERVER_CONFIG.args.join(' ')}`
      );
      console.log('');
    }

    // Add VeloxTS MCP configuration
    const newConfig = addVeloxMcpConfig(config);

    // Dry run mode
    if (dryRun) {
      const result: McpInitResult = {
        success: true,
        action: configExists ? 'updated' : 'created',
        configPath,
        message: 'Dry run - no changes made',
      };

      if (json) {
        console.log(
          JSON.stringify(
            {
              ...result,
              dryRun: true,
              preview: newConfig,
            },
            null,
            2
          )
        );
      } else {
        console.log('Configuration preview:');
        console.log('');
        console.log(JSON.stringify(newConfig, null, 2));
        console.log('');
        warning('Dry run mode - no changes made.');
        console.log(`  ${pc.dim('Remove --dry-run to apply changes.')}`);
      }
      return;
    }

    // Write configuration
    try {
      await writeClaudeConfig(configPath, newConfig);
    } catch (err) {
      const result: McpInitResult = {
        success: false,
        action: 'error',
        configPath,
        message: 'Failed to write configuration',
        error: err instanceof Error ? err.message : String(err),
      };

      if (json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        error('Failed to write Claude Desktop configuration.');
        console.log(`  ${pc.dim('Path:')} ${formatPath(configPath)}`);
        console.log(`  ${pc.dim('Error:')} ${err instanceof Error ? err.message : String(err)}`);
        console.log('');

        // Check for permission errors
        if (err instanceof Error && err.message.includes('EACCES')) {
          info('You may not have write permission to this directory.');
          info('Try running this command with appropriate permissions.');
        }
      }
      process.exit(1);
    }

    // Success!
    const action = isAlreadyConfigured ? 'updated' : configExists ? 'updated' : 'created';
    const result: McpInitResult = {
      success: true,
      action,
      configPath,
      message: 'VeloxTS MCP server configured successfully',
      instructions: 'Restart Claude Desktop to activate the MCP server',
    };

    if (json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      success('VeloxTS MCP server configured successfully!');
      console.log('');
      console.log(`  ${pc.dim('Config path:')} ${formatPath(configPath)}`);
      console.log('');
      info('Next steps:');
      console.log(`  ${pc.dim('1.')} Restart Claude Desktop`);
      console.log(`  ${pc.dim('2.')} Open Claude Desktop`);
      console.log(
        `  ${pc.dim('3.')} The VeloxTS MCP server will provide project context automatically`
      );
      console.log('');
    }
  } catch (err) {
    const result: McpInitResult = {
      success: false,
      action: 'error',
      configPath: 'unknown',
      message: 'Unexpected error',
      error: err instanceof Error ? err.message : String(err),
    };

    if (json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      error('An unexpected error occurred.');
      console.log(`  ${pc.dim('Error:')} ${err instanceof Error ? err.message : String(err)}`);
    }
    process.exit(1);
  }
}
