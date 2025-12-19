/**
 * Path Utilities Tests
 */

import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { detectProjectType, isVeloxProject } from '../paths.js';

describe('detectProjectType', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a unique test directory
    testDir = join(tmpdir(), `velox-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it('should detect API-only project without Vinxi markers', async () => {
    // Create a package.json without Vinxi markers
    const packageJson = {
      name: 'test-api',
      dependencies: {
        '@veloxts/core': '0.1.0',
        '@veloxts/router': '0.1.0',
      },
    };
    await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    const result = await detectProjectType(testDir);

    expect(result.isVinxi).toBe(false);
    expect(result.hasWeb).toBe(false);
    expect(result.dependencies).toHaveProperty('@veloxts/core');
  });

  it('should detect Vinxi project with vinxi dependency', async () => {
    const packageJson = {
      name: 'test-fullstack',
      dependencies: {
        '@veloxts/core': '0.1.0',
        vinxi: '0.5.3',
      },
    };
    await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    const result = await detectProjectType(testDir);

    expect(result.isVinxi).toBe(true);
    expect(result.hasWeb).toBe(false);
  });

  it('should detect Vinxi project with @veloxts/web dependency', async () => {
    const packageJson = {
      name: 'test-fullstack',
      dependencies: {
        '@veloxts/core': '0.1.0',
        '@veloxts/web': '0.1.0',
      },
    };
    await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    const result = await detectProjectType(testDir);

    expect(result.isVinxi).toBe(true);
    expect(result.hasWeb).toBe(true);
  });

  it('should detect Vinxi project with @vinxi/server-functions dependency', async () => {
    const packageJson = {
      name: 'test-fullstack',
      dependencies: {
        '@veloxts/core': '0.1.0',
        '@vinxi/server-functions': '0.5.3',
      },
    };
    await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    const result = await detectProjectType(testDir);

    expect(result.isVinxi).toBe(true);
  });

  it('should detect Vinxi project by app.config.ts file', async () => {
    // Create a package.json without Vinxi markers
    const packageJson = {
      name: 'test-fullstack',
      dependencies: {
        '@veloxts/core': '0.1.0',
      },
    };
    await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    // Create app.config.ts
    await writeFile(join(testDir, 'app.config.ts'), 'export default {}');

    const result = await detectProjectType(testDir);

    expect(result.isVinxi).toBe(true);
  });

  it('should detect Vinxi project by app.config.js file', async () => {
    const packageJson = {
      name: 'test-fullstack',
      dependencies: {
        '@veloxts/core': '0.1.0',
      },
    };
    await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    // Create app.config.js
    await writeFile(join(testDir, 'app.config.js'), 'module.exports = {}');

    const result = await detectProjectType(testDir);

    expect(result.isVinxi).toBe(true);
  });

  it('should handle missing package.json with app.config', async () => {
    // Create app.config.ts without package.json
    await writeFile(join(testDir, 'app.config.ts'), 'export default {}');

    const result = await detectProjectType(testDir);

    expect(result.isVinxi).toBe(true);
    expect(result.dependencies).toEqual({});
  });

  it('should handle missing package.json without app.config', async () => {
    // Empty directory - no package.json, no app.config
    const result = await detectProjectType(testDir);

    expect(result.isVinxi).toBe(false);
    expect(result.hasWeb).toBe(false);
    expect(result.dependencies).toEqual({});
  });

  it('should include devDependencies in dependency detection', async () => {
    const packageJson = {
      name: 'test-fullstack',
      dependencies: {
        '@veloxts/core': '0.1.0',
      },
      devDependencies: {
        vinxi: '0.5.3',
      },
    };
    await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    const result = await detectProjectType(testDir);

    expect(result.isVinxi).toBe(true);
    expect(result.dependencies).toHaveProperty('vinxi');
  });
});

describe('isVeloxProject', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `velox-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it('should return true for project with @veloxts dependencies', async () => {
    const packageJson = {
      name: 'test-project',
      dependencies: {
        '@veloxts/core': '0.1.0',
      },
    };
    await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    const result = await isVeloxProject(testDir);

    expect(result).toBe(true);
  });

  it('should return false for project without @veloxts dependencies', async () => {
    const packageJson = {
      name: 'test-project',
      dependencies: {
        express: '4.18.0',
      },
    };
    await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    const result = await isVeloxProject(testDir);

    expect(result).toBe(false);
  });

  it('should return false for missing package.json', async () => {
    const result = await isVeloxProject(testDir);

    expect(result).toBe(false);
  });
});
