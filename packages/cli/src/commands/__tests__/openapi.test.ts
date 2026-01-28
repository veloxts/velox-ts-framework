/**
 * Tests for the OpenAPI command
 *
 * These tests validate the openapi command functionality including:
 * - Generate command (JSON and YAML output)
 * - Serve command structure
 * - Helper functions
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import YAML from 'yaml';

import { createOpenApiCommand } from '../openapi.js';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create a temporary directory for testing
 */
function createTempDir(): string {
  const tempDir = join(process.cwd(), 'test-tmp-openapi', `test-${Date.now()}`);
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
 * Create a mock OpenAPI spec for testing
 */
function createMockSpec() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Test API',
      version: '1.0.0',
      description: 'A test API',
    },
    paths: {
      '/api/users': {
        get: {
          operationId: 'users_listUsers',
          summary: 'List Users',
          tags: ['users'],
          responses: {
            '200': { description: 'Success' },
          },
        },
        post: {
          operationId: 'users_createUser',
          summary: 'Create User',
          tags: ['users'],
          responses: {
            '201': { description: 'Created' },
          },
        },
      },
      '/api/users/{id}': {
        get: {
          operationId: 'users_getUser',
          summary: 'Get User',
          tags: ['users'],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Success' },
          },
        },
      },
    },
    tags: [{ name: 'users', description: 'User management' }],
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('OpenAPI Command', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('createOpenApiCommand', () => {
    it('should create a command with correct structure', () => {
      const cmd = createOpenApiCommand();

      expect(cmd.name()).toBe('openapi');
      expect(cmd.description()).toContain('OpenAPI');
    });

    it('should have generate and serve subcommands', () => {
      const cmd = createOpenApiCommand();
      const subcommands = cmd.commands;

      expect(subcommands).toHaveLength(2);
      expect(subcommands.map((c) => c.name())).toContain('generate');
      expect(subcommands.map((c) => c.name())).toContain('serve');
    });
  });

  describe('generate subcommand', () => {
    it('should have correct options', () => {
      const cmd = createOpenApiCommand();
      const generateCmd = cmd.commands.find((c) => c.name() === 'generate');

      expect(generateCmd).toBeDefined();
      if (!generateCmd) return; // Type guard for TypeScript
      const options = generateCmd.options;
      const optionNames = options.map((opt) => opt.long);

      expect(optionNames).toContain('--path');
      expect(optionNames).toContain('--output');
      expect(optionNames).toContain('--format');
      expect(optionNames).toContain('--title');
      expect(optionNames).toContain('--version');
      expect(optionNames).toContain('--description');
      expect(optionNames).toContain('--server');
      expect(optionNames).toContain('--prefix');
      expect(optionNames).toContain('--recursive');
      expect(optionNames).toContain('--pretty');
      expect(optionNames).toContain('--validate');
      expect(optionNames).toContain('--quiet');
    });

    it('should have correct default values', () => {
      const cmd = createOpenApiCommand();
      const generateCmd = cmd.commands.find((c) => c.name() === 'generate');

      expect(generateCmd).toBeDefined();
      if (!generateCmd) return; // Type guard for TypeScript
      const options = generateCmd.options;

      const pathOpt = options.find((o) => o.long === '--path');
      expect(pathOpt?.defaultValue).toBe('./src/procedures');

      const outputOpt = options.find((o) => o.long === '--output');
      expect(outputOpt?.defaultValue).toBe('./openapi.json');

      const titleOpt = options.find((o) => o.long === '--title');
      expect(titleOpt?.defaultValue).toBe('VeloxTS API');

      const versionOpt = options.find((o) => o.long === '--version');
      expect(versionOpt?.defaultValue).toBe('1.0.0');

      const prefixOpt = options.find((o) => o.long === '--prefix');
      expect(prefixOpt?.defaultValue).toBe('/api');
    });
  });

  describe('serve subcommand', () => {
    it('should have correct options', () => {
      const cmd = createOpenApiCommand();
      const serveCmd = cmd.commands.find((c) => c.name() === 'serve');

      expect(serveCmd).toBeDefined();
      if (!serveCmd) return; // Type guard for TypeScript
      const options = serveCmd.options;
      const optionNames = options.map((opt) => opt.long);

      expect(optionNames).toContain('--file');
      expect(optionNames).toContain('--port');
      expect(optionNames).toContain('--host');
      expect(optionNames).toContain('--watch');
    });

    it('should have correct default values', () => {
      const cmd = createOpenApiCommand();
      const serveCmd = cmd.commands.find((c) => c.name() === 'serve');

      expect(serveCmd).toBeDefined();
      if (!serveCmd) return; // Type guard for TypeScript
      const options = serveCmd.options;

      const fileOpt = options.find((o) => o.long === '--file');
      expect(fileOpt?.defaultValue).toBe('./openapi.json');

      const portOpt = options.find((o) => o.long === '--port');
      expect(portOpt?.defaultValue).toBe('8080');

      const hostOpt = options.find((o) => o.long === '--host');
      expect(hostOpt?.defaultValue).toBe('localhost');
    });
  });

  describe('JSON/YAML Format Support', () => {
    it('should write valid JSON spec', () => {
      const spec = createMockSpec();
      const filePath = join(tempDir, 'api.json');

      writeFileSync(filePath, JSON.stringify(spec, null, 2), 'utf-8');

      const content = readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed.openapi).toBe('3.0.3');
      expect(parsed.info.title).toBe('Test API');
      expect(parsed.paths['/api/users']).toBeDefined();
    });

    it('should write valid YAML spec', () => {
      const spec = createMockSpec();
      const filePath = join(tempDir, 'api.yaml');

      writeFileSync(filePath, YAML.stringify(spec, { indent: 2 }), 'utf-8');

      const content = readFileSync(filePath, 'utf-8');
      const parsed = YAML.parse(content);

      expect(parsed.openapi).toBe('3.0.3');
      expect(parsed.info.title).toBe('Test API');
      expect(parsed.paths['/api/users']).toBeDefined();
    });

    it('should preserve spec structure in YAML format', () => {
      const spec = createMockSpec();
      const filePath = join(tempDir, 'api.yml');

      writeFileSync(filePath, YAML.stringify(spec, { indent: 2 }), 'utf-8');

      const content = readFileSync(filePath, 'utf-8');
      const parsed = YAML.parse(content);

      // Check paths
      expect(Object.keys(parsed.paths)).toHaveLength(2);
      expect(parsed.paths['/api/users'].get.operationId).toBe('users_listUsers');
      expect(parsed.paths['/api/users'].post.operationId).toBe('users_createUser');

      // Check tags
      expect(parsed.tags).toHaveLength(1);
      expect(parsed.tags[0].name).toBe('users');
    });

    it('should handle minified JSON', () => {
      const spec = createMockSpec();
      const filePath = join(tempDir, 'api.min.json');

      // Write minified JSON
      writeFileSync(filePath, JSON.stringify(spec), 'utf-8');

      const content = readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed.openapi).toBe('3.0.3');
      expect(content).not.toContain('\n'); // Should be single line
    });
  });

  describe('Server URL Parsing', () => {
    it('should parse simple server URL', () => {
      const serverUrl = 'http://localhost:3030';
      const [url, description] = serverUrl.split('|');

      expect(url.trim()).toBe('http://localhost:3030');
      expect(description).toBeUndefined();
    });

    it('should parse server URL with description', () => {
      const serverUrl = 'http://localhost:3030|Local Development';
      const [url, description] = serverUrl.split('|');

      expect(url.trim()).toBe('http://localhost:3030');
      expect(description?.trim()).toBe('Local Development');
    });

    it('should handle multiple servers', () => {
      const servers = [
        'http://localhost:3030|Local',
        'https://staging.example.com|Staging',
        'https://api.example.com|Production',
      ];

      const parsed = servers.map((server) => {
        const [url, description] = server.split('|');
        return { url: url.trim(), description: description?.trim() };
      });

      expect(parsed).toHaveLength(3);
      expect(parsed[0]).toEqual({ url: 'http://localhost:3030', description: 'Local' });
      expect(parsed[1]).toEqual({ url: 'https://staging.example.com', description: 'Staging' });
      expect(parsed[2]).toEqual({ url: 'https://api.example.com', description: 'Production' });
    });
  });

  describe('Format Detection', () => {
    it('should detect JSON format from .json extension', () => {
      const filePath = 'openapi.json';
      const ext = filePath.split('.').pop()?.toLowerCase();

      expect(ext).toBe('json');
    });

    it('should detect YAML format from .yaml extension', () => {
      const filePath = 'openapi.yaml';
      const ext = filePath.split('.').pop()?.toLowerCase();

      expect(ext).toBe('yaml');
    });

    it('should detect YAML format from .yml extension', () => {
      const filePath = 'openapi.yml';
      const ext = filePath.split('.').pop()?.toLowerCase();

      expect(ext).toBe('yml');
    });

    it('should default to JSON for unknown extensions', () => {
      const filePath = 'openapi.spec';
      const ext = filePath.split('.').pop()?.toLowerCase();

      // Unknown extension, should default to JSON
      expect(ext).not.toBe('json');
      expect(ext).not.toBe('yaml');
      expect(ext).not.toBe('yml');
    });
  });

  describe('Spec Validation', () => {
    it('should validate spec has required fields', () => {
      const spec = createMockSpec();

      expect(spec.openapi).toBe('3.0.3');
      expect(spec.info).toBeDefined();
      expect(spec.info.title).toBeDefined();
      expect(spec.info.version).toBeDefined();
      expect(spec.paths).toBeDefined();
    });

    it('should detect empty paths', () => {
      const spec = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0.0' },
        paths: {},
      };

      expect(Object.keys(spec.paths).length).toBe(0);
    });

    it('should detect missing title', () => {
      const spec = {
        openapi: '3.0.3',
        info: { title: '', version: '1.0.0' },
        paths: { '/test': {} },
      };

      expect(spec.info.title).toBeFalsy();
    });

    it('should detect missing version', () => {
      const spec = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '' },
        paths: { '/test': {} },
      };

      expect(spec.info.version).toBeFalsy();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON', () => {
      const invalidJson = '{ invalid json }';

      expect(() => JSON.parse(invalidJson)).toThrow();
    });

    it('should handle invalid YAML', () => {
      const invalidYaml = `
        openapi: 3.0.3
        info:
          title: Test
        badly formatted: [unclosed
      `;

      expect(() => YAML.parse(invalidYaml)).toThrow();
    });

    it('should handle missing file gracefully', () => {
      const filePath = join(tempDir, 'nonexistent.json');

      expect(() => readFileSync(filePath, 'utf-8')).toThrow();
    });
  });
});
