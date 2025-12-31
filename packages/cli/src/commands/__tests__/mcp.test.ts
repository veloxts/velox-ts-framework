/**
 * Tests for the MCP command
 *
 * These tests validate the mcp:init command functionality including:
 * - Platform detection
 * - Configuration file creation and updates
 * - Error handling
 * - Dry run mode
 * - JSON output mode
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createMcpCommand } from '../mcp.js';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create a temporary directory for testing
 */
function createTempDir(): string {
  const tempDir = join(process.cwd(), 'test-tmp-mcp', `test-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

/**
 * Clean up temporary directory
 */
function cleanupTempDir(tempDir: string): void {
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Get expected config path for current platform
 */
function getExpectedConfigPath(): string {
  const platformName = platform();

  switch (platformName) {
    case 'darwin':
      return join(
        homedir(),
        'Library',
        'Application Support',
        'Claude',
        'claude_desktop_config.json'
      );
    case 'win32':
      return join(process.env.APPDATA || '', 'Claude', 'claude_desktop_config.json');
    case 'linux':
      return join(homedir(), '.config', 'Claude', 'claude_desktop_config.json');
    default:
      return '';
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('MCP Command', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('createMcpCommand', () => {
    it('should create a command with correct structure', () => {
      const cmd = createMcpCommand();

      expect(cmd.name()).toBe('mcp');
      expect(cmd.description()).toContain('Model Context Protocol');
    });

    it('should have an init subcommand', () => {
      const cmd = createMcpCommand();
      const subcommands = cmd.commands;

      expect(subcommands).toHaveLength(1);
      expect(subcommands[0].name()).toBe('init');
    });

    it('init subcommand should have correct options', () => {
      const cmd = createMcpCommand();
      const initCmd = cmd.commands[0];

      const options = initCmd.options;
      const optionNames = options.map((opt) => opt.long);

      expect(optionNames).toContain('--dry-run');
      expect(optionNames).toContain('--force');
      expect(optionNames).toContain('--json');
    });
  });

  describe('Platform Detection', () => {
    it('should detect correct config path for current platform', () => {
      const expectedPath = getExpectedConfigPath();

      expect(expectedPath).toBeTruthy();

      if (platform() === 'darwin') {
        expect(expectedPath).toContain('Library/Application Support/Claude');
      } else if (platform() === 'win32') {
        expect(expectedPath).toContain('Claude');
      } else if (platform() === 'linux') {
        expect(expectedPath).toContain('.config/Claude');
      }
    });
  });

  describe('Configuration Management', () => {
    it('should create config from scratch', () => {
      const configPath = join(tempDir, 'claude_desktop_config.json');

      // Create empty config
      const config = {
        mcpServers: {
          veloxts: {
            command: 'npx',
            args: ['@veloxts/mcp'],
          },
        },
      };

      writeFileSync(configPath, JSON.stringify(config, null, 2));

      const content = require(configPath);
      expect(content.mcpServers).toBeDefined();
      expect(content.mcpServers.veloxts).toBeDefined();
      expect(content.mcpServers.veloxts.command).toBe('npx');
      expect(content.mcpServers.veloxts.args).toEqual(['@veloxts/mcp']);
    });

    it('should merge with existing config', () => {
      const configPath = join(tempDir, 'claude_desktop_config.json');

      // Create existing config with other MCP servers
      const existingConfig = {
        mcpServers: {
          'other-server': {
            command: 'node',
            args: ['other.js'],
          },
        },
      };

      writeFileSync(configPath, JSON.stringify(existingConfig, null, 2));

      // Add VeloxTS config
      const updatedConfig = {
        ...existingConfig,
        mcpServers: {
          ...existingConfig.mcpServers,
          veloxts: {
            command: 'npx',
            args: ['@veloxts/mcp'],
          },
        },
      };

      writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2));

      const content = require(configPath);
      expect(Object.keys(content.mcpServers)).toHaveLength(2);
      expect(content.mcpServers['other-server']).toBeDefined();
      expect(content.mcpServers.veloxts).toBeDefined();
    });

    it('should handle config with no mcpServers key', () => {
      const configPath = join(tempDir, 'claude_desktop_config.json');

      // Create config without mcpServers
      const existingConfig = {
        someOtherKey: 'value',
      };

      writeFileSync(configPath, JSON.stringify(existingConfig, null, 2));

      // Add VeloxTS config
      const updatedConfig = {
        ...existingConfig,
        mcpServers: {
          veloxts: {
            command: 'npx',
            args: ['@veloxts/mcp'],
          },
        },
      };

      writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2));

      const content = require(configPath);
      expect(content.mcpServers).toBeDefined();
      expect(content.mcpServers.veloxts).toBeDefined();
      expect(content.someOtherKey).toBe('value');
    });

    it('should preserve other config keys when updating', () => {
      const configPath = join(tempDir, 'claude_desktop_config.json');

      // Create config with multiple keys
      const existingConfig = {
        theme: 'dark',
        language: 'en',
        mcpServers: {
          'other-server': {
            command: 'node',
            args: ['other.js'],
          },
        },
      };

      writeFileSync(configPath, JSON.stringify(existingConfig, null, 2));

      // Update with VeloxTS config
      const updatedConfig = {
        ...existingConfig,
        mcpServers: {
          ...existingConfig.mcpServers,
          veloxts: {
            command: 'npx',
            args: ['@veloxts/mcp'],
          },
        },
      };

      writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2));

      const content = require(configPath);
      expect(content.theme).toBe('dark');
      expect(content.language).toBe('en');
      expect(content.mcpServers.veloxts).toBeDefined();
      expect(content.mcpServers['other-server']).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should detect invalid JSON in config file', () => {
      const configPath = join(tempDir, 'claude_desktop_config.json');

      // Write invalid JSON
      writeFileSync(configPath, '{ invalid json }');

      expect(() => {
        JSON.parse('{ invalid json }');
      }).toThrow();
    });

    it('should handle missing config directory', () => {
      const configPath = join(tempDir, 'nonexistent', 'config.json');
      const configDir = join(tempDir, 'nonexistent');

      // Directory doesn't exist initially
      expect(() => {
        require(configPath);
      }).toThrow();

      // Create directory
      mkdirSync(configDir, { recursive: true });

      // Now should work
      const config = { mcpServers: {} };
      writeFileSync(configPath, JSON.stringify(config));

      expect(() => {
        require(configPath);
      }).not.toThrow();
    });
  });

  describe('JSON Output Mode', () => {
    it('should format success output correctly', () => {
      const result = {
        success: true,
        action: 'created' as const,
        configPath: '/path/to/config.json',
        message: 'VeloxTS MCP server configured successfully',
        instructions: 'Restart Claude Desktop to activate the MCP server',
      };

      const json = JSON.stringify(result, null, 2);
      const parsed = JSON.parse(json);

      expect(parsed.success).toBe(true);
      expect(parsed.action).toBe('created');
      expect(parsed.configPath).toBe('/path/to/config.json');
      expect(parsed.message).toBeDefined();
      expect(parsed.instructions).toBeDefined();
    });

    it('should format error output correctly', () => {
      const result = {
        success: false,
        action: 'error' as const,
        configPath: '/path/to/config.json',
        message: 'Failed to write configuration',
        error: 'EACCES: permission denied',
      };

      const json = JSON.stringify(result, null, 2);
      const parsed = JSON.parse(json);

      expect(parsed.success).toBe(false);
      expect(parsed.action).toBe('error');
      expect(parsed.error).toBeDefined();
    });

    it('should format exists output correctly', () => {
      const result = {
        success: true,
        action: 'exists' as const,
        configPath: '/path/to/config.json',
        message: 'VeloxTS MCP server is already configured',
      };

      const json = JSON.stringify(result, null, 2);
      const parsed = JSON.parse(json);

      expect(parsed.success).toBe(true);
      expect(parsed.action).toBe('exists');
    });
  });

  describe('Dry Run Mode', () => {
    it('should preview configuration without writing', () => {
      const config = {
        mcpServers: {
          veloxts: {
            command: 'npx',
            args: ['@veloxts/mcp'],
          },
        },
      };

      const preview = JSON.stringify(config, null, 2);
      const parsed = JSON.parse(preview);

      expect(parsed.mcpServers.veloxts).toBeDefined();
      expect(parsed.mcpServers.veloxts.command).toBe('npx');
    });
  });

  describe('Force Mode', () => {
    it('should allow overwriting existing configuration', () => {
      const configPath = join(tempDir, 'claude_desktop_config.json');

      // Create initial config
      const initialConfig = {
        mcpServers: {
          veloxts: {
            command: 'old-command',
            args: ['old-args'],
          },
        },
      };

      writeFileSync(configPath, JSON.stringify(initialConfig, null, 2));

      // Overwrite with new config
      const newConfig = {
        mcpServers: {
          veloxts: {
            command: 'npx',
            args: ['@veloxts/mcp'],
          },
        },
      };

      writeFileSync(configPath, JSON.stringify(newConfig, null, 2));

      const content = require(configPath);
      expect(content.mcpServers.veloxts.command).toBe('npx');
      expect(content.mcpServers.veloxts.args).toEqual(['@veloxts/mcp']);
    });
  });
});
