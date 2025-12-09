/**
 * SeederRunner Tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SeederError } from '../errors.js';
import { SeederRunner } from '../runner.js';
import type { PrismaClientLike, Seeder, SeederContext } from '../types.js';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockPrisma(): PrismaClientLike {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
    $executeRawUnsafe: vi.fn().mockResolvedValue(0),
    $disconnect: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockSeeder(name: string, dependencies: string[] = []): Seeder {
  const runSpy = vi.fn().mockResolvedValue(undefined);
  return {
    name,
    dependencies,
    run: runSpy,
  };
}

function createMockSeederWithTruncate(
  name: string,
  dependencies: string[] = []
): Seeder & { truncate: ReturnType<typeof vi.fn> } {
  const runSpy = vi.fn().mockResolvedValue(undefined);
  const truncateSpy = vi.fn().mockResolvedValue(undefined);
  return {
    name,
    dependencies,
    run: runSpy,
    truncate: truncateSpy,
  };
}

interface MockSeederRegistry {
  register: ReturnType<typeof vi.fn>;
  registerMany: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  getOrThrow: ReturnType<typeof vi.fn>;
  has: ReturnType<typeof vi.fn>;
  getInOrder: ReturnType<typeof vi.fn>;
  getByNames: ReturnType<typeof vi.fn>;
  validateDependencies: ReturnType<typeof vi.fn>;
  size: number;
}

function createMockRegistry(): MockSeederRegistry {
  return {
    register: vi.fn(),
    registerMany: vi.fn(),
    get: vi.fn(),
    getOrThrow: vi.fn(),
    has: vi.fn().mockReturnValue(false),
    getInOrder: vi.fn().mockReturnValue([]),
    getByNames: vi.fn().mockReturnValue([]),
    validateDependencies: vi.fn(),
    size: 0,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('SeederRunner', () => {
  let prisma: PrismaClientLike;
  let registry: MockSeederRegistry;
  let runner: SeederRunner;
  let originalEnv: string | undefined;

  beforeEach(() => {
    prisma = createMockPrisma();
    registry = createMockRegistry();
    // Cast is safe here because we're testing with a mock that has all required methods
    runner = new SeederRunner(prisma, registry as unknown as Parameters<typeof SeederRunner>[1]);
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('creates factory registry from prisma client', () => {
      expect(runner).toBeDefined();
      expect(runner).toBeInstanceOf(SeederRunner);
    });
  });

  describe('runAll()', () => {
    it('executes all seeders from registry in order', async () => {
      process.env.NODE_ENV = 'development';
      const seeder1 = createMockSeeder('seeder1');
      const seeder2 = createMockSeeder('seeder2');
      registry.getInOrder.mockReturnValue([seeder1, seeder2]);

      const result = await runner.runAll();

      expect(registry.getInOrder).toHaveBeenCalledWith('development');
      expect(seeder1.run).toHaveBeenCalledOnce();
      expect(seeder2.run).toHaveBeenCalledOnce();
      expect(result.total).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('uses environment from options', async () => {
      const seeder = createMockSeeder('seeder1');
      registry.getInOrder.mockReturnValue([seeder]);

      await runner.runAll({ environment: 'production' });

      expect(registry.getInOrder).toHaveBeenCalledWith('production');
    });

    it('detects environment when not provided', async () => {
      process.env.NODE_ENV = 'test';
      const seeder = createMockSeeder('seeder1');
      registry.getInOrder.mockReturnValue([seeder]);

      await runner.runAll();

      expect(registry.getInOrder).toHaveBeenCalledWith('test');
    });

    it('returns BatchSeederResult with correct counts', async () => {
      const seeder1 = createMockSeeder('seeder1');
      const seeder2 = createMockSeeder('seeder2');
      registry.getInOrder.mockReturnValue([seeder1, seeder2]);

      const result = await runner.runAll();

      expect(result).toMatchObject({
        total: 2,
        successful: 2,
        failed: 0,
        skipped: 0,
      });
      expect(result.results).toHaveLength(2);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('run()', () => {
    it('executes specific seeders by name', async () => {
      process.env.NODE_ENV = 'development';
      const seeder1 = createMockSeeder('seeder1');
      const seeder2 = createMockSeeder('seeder2');
      registry.getByNames.mockReturnValue([seeder1, seeder2]);

      const result = await runner.run(['seeder1', 'seeder2']);

      expect(registry.getByNames).toHaveBeenCalledWith(['seeder1', 'seeder2'], 'development');
      expect(seeder1.run).toHaveBeenCalledOnce();
      expect(seeder2.run).toHaveBeenCalledOnce();
      expect(result.total).toBe(2);
      expect(result.successful).toBe(2);
    });

    it('includes dependencies via getByNames', async () => {
      process.env.NODE_ENV = 'development';
      const seeder = createMockSeeder('seeder1', ['dependency1']);
      registry.getByNames.mockReturnValue([seeder]);

      await runner.run(['seeder1']);

      expect(registry.getByNames).toHaveBeenCalledWith(['seeder1'], 'development');
    });

    it('returns BatchSeederResult with correct counts', async () => {
      const seeder = createMockSeeder('seeder1');
      registry.getByNames.mockReturnValue([seeder]);

      const result = await runner.run(['seeder1']);

      expect(result).toMatchObject({
        total: 1,
        successful: 1,
        failed: 0,
        skipped: 0,
      });
      expect(result.results).toHaveLength(1);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('fresh()', () => {
    it('truncates in reverse order before seeding', async () => {
      const executionOrder: string[] = [];
      const seeder1 = createMockSeederWithTruncate('seeder1');
      const seeder2 = createMockSeederWithTruncate('seeder2');

      seeder1.truncate.mockImplementation(async () => {
        executionOrder.push('truncate1');
      });
      seeder2.truncate.mockImplementation(async () => {
        executionOrder.push('truncate2');
      });
      vi.mocked(seeder1.run).mockImplementation(async () => {
        executionOrder.push('run1');
      });
      vi.mocked(seeder2.run).mockImplementation(async () => {
        executionOrder.push('run2');
      });

      registry.getInOrder.mockReturnValue([seeder1, seeder2]);

      await runner.fresh();

      // Truncate in reverse order (seeder2 first), then run in order
      expect(executionOrder).toEqual(['truncate2', 'truncate1', 'run1', 'run2']);
    });

    it('skips truncation in dry run mode', async () => {
      const seeder = createMockSeederWithTruncate('seeder1');
      registry.getInOrder.mockReturnValue([seeder]);

      await runner.fresh({ dryRun: true });

      expect(seeder.truncate).not.toHaveBeenCalled();
      expect(seeder.run).not.toHaveBeenCalled();
    });

    it('calls truncate() only on seeders that have it', async () => {
      const seeder1 = createMockSeederWithTruncate('seeder1');
      const seeder2 = createMockSeeder('seeder2');
      registry.getInOrder.mockReturnValue([seeder1, seeder2]);

      await runner.fresh();

      expect(seeder1.truncate).toHaveBeenCalled();
      expect(seeder1.run).toHaveBeenCalled();
      expect(seeder2.run).toHaveBeenCalled();
    });
  });

  describe('executeSeeders()', () => {
    it('executes seeders sequentially', async () => {
      const executionOrder: string[] = [];
      const seeder1 = createMockSeeder('seeder1');
      const seeder2 = createMockSeeder('seeder2');

      vi.mocked(seeder1.run).mockImplementation(async () => {
        executionOrder.push('seeder1');
      });
      vi.mocked(seeder2.run).mockImplementation(async () => {
        executionOrder.push('seeder2');
      });

      registry.getInOrder.mockReturnValue([seeder1, seeder2]);

      await runner.runAll();

      expect(executionOrder).toEqual(['seeder1', 'seeder2']);
    });

    it('stops on first failure', async () => {
      const seeder1 = createMockSeeder('seeder1');
      const seeder2 = createMockSeeder('seeder2');
      const seeder3 = createMockSeeder('seeder3');

      vi.mocked(seeder2.run).mockRejectedValue(new Error('Seeder failed'));
      registry.getInOrder.mockReturnValue([seeder1, seeder2, seeder3]);

      const result = await runner.runAll();

      expect(seeder1.run).toHaveBeenCalled();
      expect(seeder2.run).toHaveBeenCalled();
      expect(seeder3.run).not.toHaveBeenCalled();
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
    });

    it('calculates skipped count correctly', async () => {
      const seeder1 = createMockSeeder('seeder1');
      const seeder2 = createMockSeeder('seeder2');
      const seeder3 = createMockSeeder('seeder3');
      const seeder4 = createMockSeeder('seeder4');

      vi.mocked(seeder2.run).mockRejectedValue(new Error('Failed'));
      registry.getInOrder.mockReturnValue([seeder1, seeder2, seeder3, seeder4]);

      const result = await runner.runAll();

      expect(result.skipped).toBe(2);
      expect(result.total).toBe(4);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
    });

    it('returns proper BatchSeederResult shape', async () => {
      const seeder = createMockSeeder('seeder1');
      registry.getInOrder.mockReturnValue([seeder]);

      const result = await runner.runAll();

      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('successful');
      expect(result).toHaveProperty('failed');
      expect(result).toHaveProperty('skipped');
      expect(result).toHaveProperty('duration');
      expect(Array.isArray(result.results)).toBe(true);
    });
  });

  describe('executeSeeder()', () => {
    it('calls seeder.run() with context', async () => {
      const seeder = createMockSeeder('seeder1');
      registry.getInOrder.mockReturnValue([seeder]);

      await runner.runAll();

      expect(seeder.run).toHaveBeenCalledOnce();
      const context = vi.mocked(seeder.run).mock.calls[0][0];
      expect(context).toHaveProperty('db');
      expect(context).toHaveProperty('factory');
      expect(context).toHaveProperty('environment');
      expect(context).toHaveProperty('log');
      expect(context).toHaveProperty('runSeeder');
    });

    it('returns success result on success', async () => {
      const seeder = createMockSeeder('seeder1');
      registry.getInOrder.mockReturnValue([seeder]);

      const result = await runner.runAll();

      expect(result.results[0]).toMatchObject({
        name: 'seeder1',
        success: true,
      });
      expect(result.results[0].duration).toBeGreaterThanOrEqual(0);
    });

    it('returns failure result with error message on error', async () => {
      const seeder = createMockSeeder('seeder1');
      vi.mocked(seeder.run).mockRejectedValue(new Error('Test error'));
      registry.getInOrder.mockReturnValue([seeder]);

      const result = await runner.runAll();

      expect(result.results[0]).toMatchObject({
        name: 'seeder1',
        success: false,
        error: 'Test error',
      });
      expect(result.results[0].duration).toBeGreaterThanOrEqual(0);
    });

    it('handles non-Error throws (string)', async () => {
      const seeder = createMockSeeder('seeder1');
      vi.mocked(seeder.run).mockRejectedValue('string error');
      registry.getInOrder.mockReturnValue([seeder]);

      const result = await runner.runAll();

      expect(result.results[0]).toMatchObject({
        name: 'seeder1',
        success: false,
        error: 'string error',
      });
    });

    it('handles non-Error throws (number)', async () => {
      const seeder = createMockSeeder('seeder1');
      vi.mocked(seeder.run).mockRejectedValue(42);
      registry.getInOrder.mockReturnValue([seeder]);

      const result = await runner.runAll();

      expect(result.results[0]).toMatchObject({
        name: 'seeder1',
        success: false,
        error: '42',
      });
    });

    it('dry run returns success without calling run()', async () => {
      const seeder = createMockSeeder('seeder1');
      registry.getInOrder.mockReturnValue([seeder]);

      const result = await runner.runAll({ dryRun: true });

      expect(seeder.run).not.toHaveBeenCalled();
      expect(result.results[0]).toMatchObject({
        name: 'seeder1',
        success: true,
      });
    });

    it('duration is 0 for dry run', async () => {
      const seeder = createMockSeeder('seeder1');
      registry.getInOrder.mockReturnValue([seeder]);

      const result = await runner.runAll({ dryRun: true });

      expect(result.results[0].duration).toBe(0);
    });
  });

  describe('truncateSeeders()', () => {
    it('calls truncate() on seeders that have it', async () => {
      const seeder1 = createMockSeederWithTruncate('seeder1');
      const seeder2 = createMockSeederWithTruncate('seeder2');
      registry.getInOrder.mockReturnValue([seeder1, seeder2]);

      await runner.fresh();

      expect(seeder1.truncate).toHaveBeenCalled();
      expect(seeder2.truncate).toHaveBeenCalled();
    });

    it('skips seeders without truncate()', async () => {
      const seeder1 = createMockSeederWithTruncate('seeder1');
      const seeder2 = createMockSeeder('seeder2');
      const seeder3 = createMockSeederWithTruncate('seeder3');
      registry.getInOrder.mockReturnValue([seeder1, seeder2, seeder3]);

      await runner.fresh();

      expect(seeder1.truncate).toHaveBeenCalled();
      expect(seeder3.truncate).toHaveBeenCalled();
    });

    it('throws SeederError on truncation failure', async () => {
      const seeder = createMockSeederWithTruncate('seeder1');
      seeder.truncate.mockRejectedValue(new Error('Truncation error'));
      registry.getInOrder.mockReturnValue([seeder]);

      await expect(runner.fresh()).rejects.toThrow(SeederError);
    });
  });

  describe('createContext()', () => {
    it('provides db (prisma client)', async () => {
      const seeder = createMockSeeder('seeder1');
      registry.getInOrder.mockReturnValue([seeder]);

      await runner.runAll();

      const context = vi.mocked(seeder.run).mock.calls[0][0];
      expect(context.db).toBe(prisma);
    });

    it('provides factory registry', async () => {
      const seeder = createMockSeeder('seeder1');
      registry.getInOrder.mockReturnValue([seeder]);

      await runner.runAll();

      const context = vi.mocked(seeder.run).mock.calls[0][0];
      expect(context.factory).toBeDefined();
    });

    it('provides environment', async () => {
      const seeder = createMockSeeder('seeder1');
      registry.getInOrder.mockReturnValue([seeder]);

      await runner.runAll({ environment: 'test' });

      const context = vi.mocked(seeder.run).mock.calls[0][0];
      expect(context.environment).toBe('test');
    });

    it('provides logger', async () => {
      const seeder = createMockSeeder('seeder1');
      registry.getInOrder.mockReturnValue([seeder]);

      await runner.runAll();

      const context = vi.mocked(seeder.run).mock.calls[0][0];
      expect(context.log).toBeDefined();
      expect(context.log).toHaveProperty('info');
      expect(context.log).toHaveProperty('success');
      expect(context.log).toHaveProperty('warning');
      expect(context.log).toHaveProperty('error');
      expect(context.log).toHaveProperty('debug');
    });

    it('runSeeder() executes nested seeder', async () => {
      const nestedSeeder = createMockSeeder('nested');
      const seeder = createMockSeeder('parent');

      vi.mocked(seeder.run).mockImplementation(async (ctx: SeederContext) => {
        await ctx.runSeeder(nestedSeeder);
      });

      registry.getInOrder.mockReturnValue([seeder]);

      await runner.runAll();

      expect(seeder.run).toHaveBeenCalled();
      expect(nestedSeeder.run).toHaveBeenCalled();
    });

    it('runSeeder() throws executionFailed on error', async () => {
      const nestedSeeder = createMockSeeder('nested');
      vi.mocked(nestedSeeder.run).mockRejectedValue(new Error('Nested error'));

      const seeder = createMockSeeder('parent');
      vi.mocked(seeder.run).mockImplementation(async (ctx: SeederContext) => {
        await ctx.runSeeder(nestedSeeder);
      });

      registry.getInOrder.mockReturnValue([seeder]);

      const result = await runner.runAll();

      expect(result.failed).toBe(1);
      expect(result.results[0].error).toContain('nested');
    });
  });

  describe('createLogger()', () => {
    it('logger methods include seeder name prefix', async () => {
      const seeder = createMockSeeder('testSeeder');
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      vi.mocked(seeder.run).mockImplementation(async (ctx: SeederContext) => {
        ctx.log.info('test message');
      });

      registry.getInOrder.mockReturnValue([seeder]);

      await runner.runAll();

      expect(consoleSpy).toHaveBeenCalledWith('[testSeeder] test message');
      consoleSpy.mockRestore();
    });

    it('debug() only logs in verbose mode', async () => {
      const seeder = createMockSeeder('testSeeder');
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      vi.mocked(seeder.run).mockImplementation(async (ctx: SeederContext) => {
        ctx.log.debug('debug message');
      });

      registry.getInOrder.mockReturnValue([seeder]);

      await runner.runAll({ verbose: true });

      expect(consoleSpy).toHaveBeenCalledWith('[testSeeder] [debug] debug message');
      consoleSpy.mockRestore();
    });

    it('debug() is silent when not verbose', async () => {
      const seeder = createMockSeeder('testSeeder');
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      vi.mocked(seeder.run).mockImplementation(async (ctx: SeederContext) => {
        ctx.log.debug('debug message');
      });

      registry.getInOrder.mockReturnValue([seeder]);

      await runner.runAll({ verbose: false });

      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('debug message'));
      consoleSpy.mockRestore();
    });
  });

  describe('detectEnvironment()', () => {
    it('returns "production" for NODE_ENV=production', async () => {
      process.env.NODE_ENV = 'production';
      const seeder = createMockSeeder('seeder1');
      registry.getInOrder.mockReturnValue([seeder]);

      await runner.runAll();

      expect(registry.getInOrder).toHaveBeenCalledWith('production');
    });

    it('returns "test" for NODE_ENV=test', async () => {
      process.env.NODE_ENV = 'test';
      const seeder = createMockSeeder('seeder1');
      registry.getInOrder.mockReturnValue([seeder]);

      await runner.runAll();

      expect(registry.getInOrder).toHaveBeenCalledWith('test');
    });

    it('returns "development" for other values', async () => {
      process.env.NODE_ENV = 'staging';
      const seeder = createMockSeeder('seeder1');
      registry.getInOrder.mockReturnValue([seeder]);

      await runner.runAll();

      expect(registry.getInOrder).toHaveBeenCalledWith('development');
    });

    it('returns "development" for undefined NODE_ENV', async () => {
      delete process.env.NODE_ENV;
      const seeder = createMockSeeder('seeder1');
      registry.getInOrder.mockReturnValue([seeder]);

      await runner.runAll();

      expect(registry.getInOrder).toHaveBeenCalledWith('development');
    });
  });

  describe('testConnection()', () => {
    it('succeeds when $queryRaw works', async () => {
      await expect(runner.testConnection()).resolves.toBeUndefined();
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('throws SeederError on failure', async () => {
      vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('Connection failed'));

      await expect(runner.testConnection()).rejects.toThrow(SeederError);
    });
  });

  describe('edge cases', () => {
    it('empty seeder list', async () => {
      registry.getInOrder.mockReturnValue([]);

      const result = await runner.runAll();

      expect(result).toMatchObject({
        total: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
      });
      expect(result.results).toHaveLength(0);
    });

    it('seeder throws non-Error value (object)', async () => {
      const seeder = createMockSeeder('seeder1');
      vi.mocked(seeder.run).mockRejectedValue({ custom: 'object' });
      registry.getInOrder.mockReturnValue([seeder]);

      const result = await runner.runAll();

      expect(result.results[0]).toMatchObject({
        name: 'seeder1',
        success: false,
        error: '[object Object]',
      });
    });

    it('multiple seeders with first failing', async () => {
      const seeder1 = createMockSeeder('seeder1');
      const seeder2 = createMockSeeder('seeder2');
      const seeder3 = createMockSeeder('seeder3');

      vi.mocked(seeder1.run).mockRejectedValue(new Error('Failed'));
      registry.getInOrder.mockReturnValue([seeder1, seeder2, seeder3]);

      const result = await runner.runAll();

      expect(result.successful).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.skipped).toBe(2);
      expect(seeder1.run).toHaveBeenCalled();
      expect(seeder2.run).not.toHaveBeenCalled();
      expect(seeder3.run).not.toHaveBeenCalled();
    });
  });
});
