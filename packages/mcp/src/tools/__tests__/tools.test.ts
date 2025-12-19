/**
 * @veloxts/mcp - Tools Tests
 * Tests generate and migrate tools with child_process mocking
 */

import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';

import { describe, expect, it, vi } from 'vitest';

import { findProjectRoot } from '../../utils/project.js';
import {
  formatGenerateResult,
  generate,
  generateProcedure,
  generateResource,
  generateSchema,
} from '../generate.js';
import {
  formatMigrateResult,
  migrate,
  migrateFresh,
  migrateReset,
  migrateRollback,
  migrateRun,
  migrateStatus,
} from '../migrate.js';

// Mock child_process
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

// Mock project utilities
vi.mock('../../utils/project.js', () => ({
  findProjectRoot: vi.fn(),
}));

/**
 * Create a mock child process with EventEmitter
 */
function createMockChildProcess() {
  const mockProcess = new EventEmitter();
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();

  Object.assign(mockProcess, { stdout, stderr });

  return mockProcess;
}

describe('Generate Tool', () => {
  describe('generate', () => {
    it('should return error when not in a VeloxTS project', async () => {
      vi.mocked(findProjectRoot).mockReturnValue(null);

      const result = await generate({ type: 'procedure', name: 'User' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Not in a VeloxTS project');
    });

    it('should spawn velox make command with correct arguments', async () => {
      vi.mocked(findProjectRoot).mockReturnValue('/project');

      const mockProcess = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess as never);

      const promise = generate({ type: 'procedure', name: 'User' });

      // Simulate successful completion
      process.nextTick(() => {
        mockProcess.stdout?.emit('data', Buffer.from('Generated successfully'));
        mockProcess.emit('close', 0);
      });

      const result = await promise;

      expect(spawn).toHaveBeenCalledWith('npx', ['velox', 'make', 'procedure', 'User'], {
        cwd: '/project',
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      expect(result.success).toBe(true);
    });

    it('should include --crud flag when crud option is true', async () => {
      vi.mocked(findProjectRoot).mockReturnValue('/project');

      const mockProcess = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess as never);

      const promise = generate({ type: 'resource', name: 'User', crud: true });

      process.nextTick(() => {
        mockProcess.emit('close', 0);
      });

      await promise;

      expect(spawn).toHaveBeenCalledWith(
        'npx',
        ['velox', 'make', 'resource', 'User', '--crud'],
        expect.any(Object)
      );
    });

    it('should include all option flags', async () => {
      vi.mocked(findProjectRoot).mockReturnValue('/project');

      const mockProcess = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess as never);

      const promise = generate({
        type: 'procedure',
        name: 'User',
        crud: true,
        paginated: true,
        softDelete: true,
        timestamps: true,
        force: true,
        dryRun: true,
        json: true,
      });

      process.nextTick(() => {
        mockProcess.emit('close', 0);
      });

      await promise;

      expect(spawn).toHaveBeenCalledWith(
        'npx',
        [
          'velox',
          'make',
          'procedure',
          'User',
          '--crud',
          '--paginated',
          '--soft-delete',
          '--timestamps',
          '--force',
          '--dry-run',
          '--json',
        ],
        expect.any(Object)
      );
    });

    it('should parse JSON output when json flag is true', async () => {
      vi.mocked(findProjectRoot).mockReturnValue('/project');

      const mockProcess = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess as never);

      const promise = generate({ type: 'procedure', name: 'User', json: true });

      const jsonOutput = JSON.stringify({
        success: true,
        files: ['src/procedures/users.ts', 'src/schemas/user.ts'],
      });

      process.nextTick(() => {
        mockProcess.stdout?.emit('data', Buffer.from(jsonOutput));
        mockProcess.emit('close', 0);
      });

      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.files).toEqual(['src/procedures/users.ts', 'src/schemas/user.ts']);
    });

    it('should handle invalid JSON gracefully', async () => {
      vi.mocked(findProjectRoot).mockReturnValue('/project');

      const mockProcess = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess as never);

      const promise = generate({ type: 'procedure', name: 'User', json: true });

      process.nextTick(() => {
        mockProcess.stdout?.emit('data', Buffer.from('invalid json{'));
        mockProcess.emit('close', 0);
      });

      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.output).toBe('invalid json{');
      expect(result.files).toBeUndefined();
    });

    it('should handle command failure with exit code', async () => {
      vi.mocked(findProjectRoot).mockReturnValue('/project');

      const mockProcess = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess as never);

      const promise = generate({ type: 'procedure', name: 'User' });

      process.nextTick(() => {
        mockProcess.stderr?.emit('data', Buffer.from('Error: File already exists'));
        mockProcess.emit('close', 1);
      });

      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('File already exists');
    });

    it('should handle spawn error', async () => {
      vi.mocked(findProjectRoot).mockReturnValue('/project');

      const mockProcess = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess as never);

      const promise = generate({ type: 'procedure', name: 'User' });

      process.nextTick(() => {
        mockProcess.emit('error', new Error('Command not found'));
      });

      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Command not found');
    });

    it('should accumulate stdout chunks', async () => {
      vi.mocked(findProjectRoot).mockReturnValue('/project');

      const mockProcess = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess as never);

      const promise = generate({ type: 'procedure', name: 'User' });

      process.nextTick(() => {
        mockProcess.stdout?.emit('data', Buffer.from('Line 1\n'));
        mockProcess.stdout?.emit('data', Buffer.from('Line 2\n'));
        mockProcess.stdout?.emit('data', Buffer.from('Line 3'));
        mockProcess.emit('close', 0);
      });

      const result = await promise;

      expect(result.output).toBe('Line 1\nLine 2\nLine 3');
    });
  });

  describe('Helper functions', () => {
    it('generateProcedure should call generate with type=procedure', async () => {
      vi.mocked(findProjectRoot).mockReturnValue('/project');

      const mockProcess = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess as never);

      const promise = generateProcedure('User', { crud: true });

      process.nextTick(() => {
        mockProcess.emit('close', 0);
      });

      await promise;

      expect(spawn).toHaveBeenCalledWith(
        'npx',
        ['velox', 'make', 'procedure', 'User', '--crud'],
        expect.any(Object)
      );
    });

    it('generateSchema should call generate with type=schema', async () => {
      vi.mocked(findProjectRoot).mockReturnValue('/project');

      const mockProcess = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess as never);

      const promise = generateSchema('User');

      process.nextTick(() => {
        mockProcess.emit('close', 0);
      });

      await promise;

      expect(spawn).toHaveBeenCalledWith(
        'npx',
        ['velox', 'make', 'schema', 'User'],
        expect.any(Object)
      );
    });

    it('generateResource should call generate with type=resource and crud=true', async () => {
      vi.mocked(findProjectRoot).mockReturnValue('/project');

      const mockProcess = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess as never);

      const promise = generateResource('User', { paginated: true });

      process.nextTick(() => {
        mockProcess.emit('close', 0);
      });

      await promise;

      expect(spawn).toHaveBeenCalledWith(
        'npx',
        ['velox', 'make', 'resource', 'User', '--crud', '--paginated'],
        expect.any(Object)
      );
    });
  });

  describe('formatGenerateResult', () => {
    it('should format successful result without files', () => {
      const result = formatGenerateResult({
        success: true,
        type: 'procedure',
        name: 'User',
      });

      expect(result).toBe('Generated procedure: User');
    });

    it('should format successful result with files', () => {
      const result = formatGenerateResult({
        success: true,
        type: 'procedure',
        name: 'User',
        files: ['src/procedures/users.ts', 'src/schemas/user.ts'],
      });

      expect(result).toContain('Generated procedure: User');
      expect(result).toContain('Created files:');
      expect(result).toContain('- src/procedures/users.ts');
      expect(result).toContain('- src/schemas/user.ts');
    });

    it('should format failed result', () => {
      const result = formatGenerateResult({
        success: false,
        type: 'procedure',
        name: 'User',
        error: 'File already exists',
      });

      expect(result).toBe('Failed to generate procedure "User": File already exists');
    });
  });
});

describe('Migrate Tool', () => {
  describe('migrate', () => {
    it('should return error when not in a VeloxTS project', async () => {
      vi.mocked(findProjectRoot).mockReturnValue(null);

      const result = await migrate({ action: 'status' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Not in a VeloxTS project');
    });

    it('should spawn velox migrate command with correct arguments', async () => {
      vi.mocked(findProjectRoot).mockReturnValue('/project');

      const mockProcess = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess as never);

      const promise = migrate({ action: 'status' });

      process.nextTick(() => {
        mockProcess.stdout?.emit('data', Buffer.from('All migrations applied'));
        mockProcess.emit('close', 0);
      });

      const result = await promise;

      expect(spawn).toHaveBeenCalledWith('npx', ['velox', 'migrate', 'status'], {
        cwd: '/project',
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      expect(result.success).toBe(true);
    });

    it('should include --dev flag when dev option is true', async () => {
      vi.mocked(findProjectRoot).mockReturnValue('/project');

      const mockProcess = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess as never);

      const promise = migrate({ action: 'run', dev: true });

      process.nextTick(() => {
        mockProcess.emit('close', 0);
      });

      await promise;

      expect(spawn).toHaveBeenCalledWith(
        'npx',
        ['velox', 'migrate', 'run', '--dev'],
        expect.any(Object)
      );
    });

    it('should include all option flags', async () => {
      vi.mocked(findProjectRoot).mockReturnValue('/project');

      const mockProcess = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess as never);

      const promise = migrate({ action: 'run', dev: true, json: true, dryRun: true });

      process.nextTick(() => {
        mockProcess.emit('close', 0);
      });

      await promise;

      expect(spawn).toHaveBeenCalledWith(
        'npx',
        ['velox', 'migrate', 'run', '--dev', '--json', '--dry-run'],
        expect.any(Object)
      );
    });

    it('should parse JSON output when json flag is true', async () => {
      vi.mocked(findProjectRoot).mockReturnValue('/project');

      const mockProcess = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess as never);

      const promise = migrate({ action: 'status', json: true });

      const jsonOutput = JSON.stringify({
        success: true,
        migrations: [
          { name: '20240101_create_users', status: 'applied', appliedAt: '2024-01-01T00:00:00Z' },
          { name: '20240102_create_posts', status: 'pending' },
        ],
      });

      process.nextTick(() => {
        mockProcess.stdout?.emit('data', Buffer.from(jsonOutput));
        mockProcess.emit('close', 0);
      });

      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.migrations).toEqual([
        { name: '20240101_create_users', status: 'applied', appliedAt: '2024-01-01T00:00:00Z' },
        { name: '20240102_create_posts', status: 'pending' },
      ]);
    });

    it('should handle invalid JSON gracefully', async () => {
      vi.mocked(findProjectRoot).mockReturnValue('/project');

      const mockProcess = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess as never);

      const promise = migrate({ action: 'status', json: true });

      process.nextTick(() => {
        mockProcess.stdout?.emit('data', Buffer.from('invalid json{'));
        mockProcess.emit('close', 0);
      });

      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.output).toBe('invalid json{');
      expect(result.migrations).toBeUndefined();
    });

    it('should handle command failure', async () => {
      vi.mocked(findProjectRoot).mockReturnValue('/project');

      const mockProcess = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess as never);

      const promise = migrate({ action: 'run' });

      process.nextTick(() => {
        mockProcess.stderr?.emit('data', Buffer.from('Database connection failed'));
        mockProcess.emit('close', 1);
      });

      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database connection failed');
    });

    it('should handle spawn error', async () => {
      vi.mocked(findProjectRoot).mockReturnValue('/project');

      const mockProcess = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess as never);

      const promise = migrate({ action: 'status' });

      process.nextTick(() => {
        mockProcess.emit('error', new Error('Command not found'));
      });

      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Command not found');
    });
  });

  describe('Helper functions', () => {
    it('migrateStatus should call migrate with action=status', async () => {
      vi.mocked(findProjectRoot).mockReturnValue('/project');

      const mockProcess = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess as never);

      const promise = migrateStatus();

      process.nextTick(() => {
        mockProcess.emit('close', 0);
      });

      await promise;

      expect(spawn).toHaveBeenCalledWith(
        'npx',
        ['velox', 'migrate', 'status', '--json'],
        expect.any(Object)
      );
    });

    it('migrateRun should call migrate with action=run', async () => {
      vi.mocked(findProjectRoot).mockReturnValue('/project');

      const mockProcess = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess as never);

      const promise = migrateRun({ dev: true });

      process.nextTick(() => {
        mockProcess.emit('close', 0);
      });

      await promise;

      expect(spawn).toHaveBeenCalledWith(
        'npx',
        ['velox', 'migrate', 'run', '--dev', '--json'],
        expect.any(Object)
      );
    });

    it('migrateRollback should call migrate with action=rollback', async () => {
      vi.mocked(findProjectRoot).mockReturnValue('/project');

      const mockProcess = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess as never);

      const promise = migrateRollback(true);

      process.nextTick(() => {
        mockProcess.emit('close', 0);
      });

      await promise;

      expect(spawn).toHaveBeenCalledWith(
        'npx',
        ['velox', 'migrate', 'rollback', '--json', '--dry-run'],
        expect.any(Object)
      );
    });

    it('migrateFresh should call migrate with action=fresh', async () => {
      vi.mocked(findProjectRoot).mockReturnValue('/project');

      const mockProcess = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess as never);

      const promise = migrateFresh();

      process.nextTick(() => {
        mockProcess.emit('close', 0);
      });

      await promise;

      expect(spawn).toHaveBeenCalledWith(
        'npx',
        ['velox', 'migrate', 'fresh', '--json'],
        expect.any(Object)
      );
    });

    it('migrateReset should call migrate with action=reset', async () => {
      vi.mocked(findProjectRoot).mockReturnValue('/project');

      const mockProcess = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess as never);

      const promise = migrateReset();

      process.nextTick(() => {
        mockProcess.emit('close', 0);
      });

      await promise;

      expect(spawn).toHaveBeenCalledWith(
        'npx',
        ['velox', 'migrate', 'reset', '--json'],
        expect.any(Object)
      );
    });
  });

  describe('formatMigrateResult', () => {
    it('should format successful result without migrations', () => {
      const result = formatMigrateResult({
        success: true,
        action: 'status',
      });

      expect(result).toBe('Migration status completed successfully');
    });

    it('should format successful result with migrations', () => {
      const result = formatMigrateResult({
        success: true,
        action: 'status',
        migrations: [
          { name: '20240101_create_users', status: 'applied' },
          { name: '20240102_create_posts', status: 'pending' },
        ],
      });

      expect(result).toContain('Migration status completed successfully');
      expect(result).toContain('Migrations:');
      expect(result).toContain('[applied] 20240101_create_users');
      expect(result).toContain('[pending] 20240102_create_posts');
    });

    it('should format failed result', () => {
      const result = formatMigrateResult({
        success: false,
        action: 'run',
        error: 'Database connection failed',
      });

      expect(result).toBe('Migration run failed: Database connection failed');
    });
  });
});
