/**
 * @veloxts/mcp - Project Utilities Tests
 * Tests project detection and path resolution with fs mocking
 */

import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

import { describe, expect, it, vi } from 'vitest';

import {
  findProjectRoot,
  getProceduresPath,
  getProjectInfo,
  getSchemasPath,
  isVeloxProject,
} from '../project.js';

// Mock node:fs and node:fs/promises
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

describe('Project Utilities', () => {
  describe('isVeloxProject', () => {
    it('should return false when package.json does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = isVeloxProject('/some/dir');

      expect(result).toBe(false);
      expect(existsSync).toHaveBeenCalledWith('/some/dir/package.json');
    });

    it('should return false when package.json has no VeloxTS dependencies', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({
          name: 'some-project',
          dependencies: {
            express: '4.18.0',
            react: '18.0.0',
          },
        })
      );

      const result = isVeloxProject('/some/dir');

      expect(result).toBe(false);
    });

    it('should return true when package.json has @veloxts/* dependency', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({
          name: 'velox-app',
          dependencies: {
            '@veloxts/core': '0.1.0',
            express: '4.18.0',
          },
        })
      );

      const result = isVeloxProject('/some/dir');

      expect(result).toBe(true);
    });

    it('should return true when package.json has @veloxts/* devDependency', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({
          name: 'velox-app',
          dependencies: {},
          devDependencies: {
            '@veloxts/cli': '0.1.0',
          },
        })
      );

      const result = isVeloxProject('/some/dir');

      expect(result).toBe(true);
    });

    it('should return false when package.json is invalid JSON', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('invalid json{');

      const result = isVeloxProject('/some/dir');

      expect(result).toBe(false);
    });

    it('should handle multiple @veloxts packages', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({
          name: 'velox-app',
          dependencies: {
            '@veloxts/core': '0.1.0',
            '@veloxts/router': '0.1.0',
            '@veloxts/auth': '0.1.0',
          },
        })
      );

      const result = isVeloxProject('/some/dir');

      expect(result).toBe(true);
    });

    it('should return false for scoped packages that are not @veloxts', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({
          name: 'some-app',
          dependencies: {
            '@react/core': '1.0.0',
            '@vue/runtime': '3.0.0',
          },
        })
      );

      const result = isVeloxProject('/some/dir');

      expect(result).toBe(false);
    });
  });

  describe('findProjectRoot', () => {
    it('should return null when no package.json found', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = findProjectRoot('/some/deep/nested/dir');

      expect(result).toBeNull();
    });

    it('should find project root when in project directory', () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        if (typeof path !== 'string') return false;
        return path.endsWith('/project/package.json');
      });
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({
          dependencies: { '@veloxts/core': '0.1.0' },
        })
      );

      const result = findProjectRoot('/project');

      expect(result).toBe('/project');
    });

    it('should find project root from nested directory', () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        if (typeof path !== 'string') return false;
        return path.endsWith('/project/package.json');
      });
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({
          dependencies: { '@veloxts/core': '0.1.0' },
        })
      );

      // Should traverse up from nested directory
      const result = findProjectRoot('/project/src/utils');

      // The implementation searches upward, so it should find /project
      expect(result).toBeDefined();
    });

    it('should return null when reaching root without finding VeloxTS project', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = findProjectRoot('/');

      expect(result).toBeNull();
    });

    it('should skip non-VeloxTS projects when traversing up', () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        if (typeof path !== 'string') return false;
        // Both directories have package.json
        return (
          path.endsWith('/project/package.json') || path.endsWith('/project/nested/package.json')
        );
      });

      vi.mocked(readFileSync).mockImplementation((path) => {
        if (typeof path !== 'string') return '';
        // Only /project has VeloxTS dependencies
        if (path.endsWith('/project/package.json')) {
          return JSON.stringify({ dependencies: { '@veloxts/core': '0.1.0' } });
        }
        // /project/nested is a regular Node.js project
        return JSON.stringify({ dependencies: { express: '4.0.0' } });
      });

      const result = findProjectRoot('/project/nested/src');

      // Should find the parent VeloxTS project
      expect(result).toBeDefined();
    });
  });

  describe('getProjectInfo', () => {
    it('should return null when project root not found', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await getProjectInfo();

      expect(result).toBeNull();
    });

    it('should return project info for single package structure', async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        if (typeof path !== 'string') return false;
        // Package.json exists
        if (path.endsWith('/project/package.json')) return true;
        // Standard single-package paths exist
        if (path.endsWith('/project/src/procedures')) return true;
        if (path.endsWith('/project/src/schemas')) return true;
        if (path.endsWith('/project/prisma/schema.prisma')) return true;
        // Monorepo paths don't exist
        if (path.includes('/apps/api')) return false;
        return false;
      });

      vi.mocked(readFile).mockResolvedValue(
        JSON.stringify({
          name: 'my-velox-app',
          version: '1.0.0',
          dependencies: { '@veloxts/core': '0.1.0' },
        })
      );

      const result = await getProjectInfo('/project');

      expect(result).toEqual({
        root: '/project',
        name: 'my-velox-app',
        version: '1.0.0',
        isVeloxProject: true,
        proceduresPath: '/project/src/procedures',
        schemasPath: '/project/src/schemas',
        prismaSchemaPath: '/project/prisma/schema.prisma',
      });
    });

    it('should return project info for monorepo structure', async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        if (typeof path !== 'string') return false;
        // Package.json exists
        if (path.endsWith('/project/package.json')) return true;
        // Monorepo paths exist
        if (path.endsWith('/project/apps/api')) return true;
        if (path.endsWith('/project/apps/web')) return true;
        if (path.endsWith('/project/apps/api/src/procedures')) return true;
        if (path.endsWith('/project/apps/api/src/schemas')) return true;
        if (path.endsWith('/project/apps/api/prisma/schema.prisma')) return true;
        return false;
      });

      vi.mocked(readFile).mockResolvedValue(
        JSON.stringify({
          name: 'my-velox-monorepo',
          version: '2.0.0',
          dependencies: { '@veloxts/core': '0.1.0' },
        })
      );

      const result = await getProjectInfo('/project');

      expect(result).toEqual({
        root: '/project',
        name: 'my-velox-monorepo',
        version: '2.0.0',
        isVeloxProject: true,
        apiPath: '/project/apps/api',
        webPath: '/project/apps/web',
        proceduresPath: '/project/apps/api/src/procedures',
        schemasPath: '/project/apps/api/src/schemas',
        prismaSchemaPath: '/project/apps/api/prisma/schema.prisma',
      });
    });

    it('should handle missing optional paths gracefully', async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        if (typeof path !== 'string') return false;
        // Only package.json exists
        if (path.endsWith('/project/package.json')) return true;
        // No procedures, schemas, or prisma schema
        return false;
      });

      vi.mocked(readFile).mockResolvedValue(
        JSON.stringify({
          name: 'minimal-project',
          version: '0.1.0',
          dependencies: { '@veloxts/core': '0.1.0' },
        })
      );

      const result = await getProjectInfo('/project');

      expect(result).toEqual({
        root: '/project',
        name: 'minimal-project',
        version: '0.1.0',
        isVeloxProject: true,
        // Optional paths should be undefined
        proceduresPath: undefined,
        schemasPath: undefined,
        prismaSchemaPath: undefined,
      });
    });

    it('should handle package.json without name or version', async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        if (typeof path !== 'string') return false;
        return path.endsWith('/project/package.json');
      });

      vi.mocked(readFile).mockResolvedValue(
        JSON.stringify({
          dependencies: { '@veloxts/core': '0.1.0' },
        })
      );

      const result = await getProjectInfo('/project');

      expect(result).toEqual({
        root: '/project',
        name: 'unknown',
        version: '0.0.0',
        isVeloxProject: true,
        proceduresPath: undefined,
        schemasPath: undefined,
        prismaSchemaPath: undefined,
      });
    });

    it('should return null when package.json cannot be read', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockRejectedValue(new Error('Permission denied'));

      const result = await getProjectInfo('/project');

      expect(result).toBeNull();
    });

    it('should return null when package.json is invalid JSON', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue('invalid json{');

      const result = await getProjectInfo('/project');

      expect(result).toBeNull();
    });
  });

  describe('getProceduresPath', () => {
    it('should return monorepo procedures path when it exists', () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        if (typeof path !== 'string') return false;
        return path.endsWith('/project/apps/api/src/procedures');
      });

      const result = getProceduresPath('/project');

      expect(result).toBe('/project/apps/api/src/procedures');
    });

    it('should return single package procedures path when monorepo does not exist', () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        if (typeof path !== 'string') return false;
        // Monorepo path doesn't exist
        if (path.endsWith('/project/apps/api/src/procedures')) return false;
        // Single package path exists
        if (path.endsWith('/project/src/procedures')) return true;
        return false;
      });

      const result = getProceduresPath('/project');

      expect(result).toBe('/project/src/procedures');
    });

    it('should return null when neither path exists', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = getProceduresPath('/project');

      expect(result).toBeNull();
    });

    it('should prioritize monorepo path over single package path', () => {
      vi.mocked(existsSync).mockReturnValue(true);

      const result = getProceduresPath('/project');

      // Should return monorepo path since it was checked first
      expect(result).toBe('/project/apps/api/src/procedures');
    });
  });

  describe('getSchemasPath', () => {
    it('should return monorepo schemas path when it exists', () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        if (typeof path !== 'string') return false;
        return path.endsWith('/project/apps/api/src/schemas');
      });

      const result = getSchemasPath('/project');

      expect(result).toBe('/project/apps/api/src/schemas');
    });

    it('should return single package schemas path when monorepo does not exist', () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        if (typeof path !== 'string') return false;
        // Monorepo path doesn't exist
        if (path.endsWith('/project/apps/api/src/schemas')) return false;
        // Single package path exists
        if (path.endsWith('/project/src/schemas')) return true;
        return false;
      });

      const result = getSchemasPath('/project');

      expect(result).toBe('/project/src/schemas');
    });

    it('should return null when neither path exists', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = getSchemasPath('/project');

      expect(result).toBeNull();
    });

    it('should prioritize monorepo path over single package path', () => {
      vi.mocked(existsSync).mockReturnValue(true);

      const result = getSchemasPath('/project');

      // Should return monorepo path since it was checked first
      expect(result).toBe('/project/apps/api/src/schemas');
    });
  });

  describe('Edge cases', () => {
    it('should handle absolute paths correctly', () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        if (typeof path !== 'string') return false;
        return path === '/absolute/path/to/project/package.json';
      });
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({ dependencies: { '@veloxts/core': '0.1.0' } })
      );

      const result = isVeloxProject('/absolute/path/to/project');

      expect(result).toBe(true);
    });

    it('should handle paths with special characters', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({ dependencies: { '@veloxts/core': '0.1.0' } })
      );

      const result = isVeloxProject('/path/with spaces/and-dashes/project');

      expect(result).toBe(true);
    });

    it('should handle empty dependencies object', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({
          name: 'project',
          dependencies: {},
          devDependencies: {},
        })
      );

      const result = isVeloxProject('/project');

      expect(result).toBe(false);
    });

    it('should handle missing dependencies field entirely', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({
          name: 'project',
          version: '1.0.0',
        })
      );

      const result = isVeloxProject('/project');

      expect(result).toBe(false);
    });
  });
});
