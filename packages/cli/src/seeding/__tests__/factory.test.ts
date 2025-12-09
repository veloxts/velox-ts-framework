/**
 * Factory System Tests
 */

import { describe, expect, it, vi } from 'vitest';

import { FactoryError } from '../errors.js';
import { BaseFactory, createFactoryRegistry } from '../factory.js';
import type { PrismaClientLike } from '../types.js';

// ============================================================================
// Test Helpers
// ============================================================================

interface TestUserInput {
  email: string;
  name: string;
  role: 'admin' | 'user';
}

class TestUserFactory extends BaseFactory<TestUserInput> {
  readonly modelName = 'user';

  constructor(prisma: PrismaClientLike) {
    super(prisma);

    this.registerState('admin', (attrs) => ({
      ...attrs,
      role: 'admin' as const,
    }));

    this.registerState('verified', (attrs) => ({
      ...attrs,
      email: `verified-${attrs.email}`,
    }));
  }

  definition(): TestUserInput {
    return {
      email: 'test@example.com',
      name: 'Test User',
      role: 'user',
    };
  }

  /**
   * Convenience method that applies admin state.
   * Used to test that subclass methods are preserved after state() calls.
   */
  admin(): this {
    return this.state('admin') as this;
  }

  /**
   * Convenience method that applies verified state.
   */
  verified(): this {
    return this.state('verified') as this;
  }
}

function createMockPrisma(): PrismaClientLike {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
    $executeRawUnsafe: vi.fn().mockResolvedValue(0),
    $disconnect: vi.fn().mockResolvedValue(undefined),
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('BaseFactory', () => {
  describe('definition', () => {
    it('should return default attributes', () => {
      const prisma = createMockPrisma();
      const factory = new TestUserFactory(prisma);

      const result = factory.definition();

      expect(result).toEqual({
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      });
    });
  });

  describe('make', () => {
    it('should create attributes without persisting', () => {
      const prisma = createMockPrisma();
      const factory = new TestUserFactory(prisma);

      const result = factory.make();

      expect(result).toEqual({
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      });
    });

    it('should allow overrides', () => {
      const prisma = createMockPrisma();
      const factory = new TestUserFactory(prisma);

      const result = factory.make({ name: 'Custom Name' });

      expect(result).toEqual({
        email: 'test@example.com',
        name: 'Custom Name',
        role: 'user',
      });
    });
  });

  describe('makeMany', () => {
    it('should create multiple instances', () => {
      const prisma = createMockPrisma();
      const factory = new TestUserFactory(prisma);

      const results = factory.makeMany(3);

      expect(results).toHaveLength(3);
      for (const result of results) {
        expect(result.email).toBe('test@example.com');
      }
    });

    it('should apply overrides to all instances', () => {
      const prisma = createMockPrisma();
      const factory = new TestUserFactory(prisma);

      const results = factory.makeMany(2, { role: 'admin' });

      expect(results).toHaveLength(2);
      for (const result of results) {
        expect(result.role).toBe('admin');
      }
    });
  });

  describe('state', () => {
    it('should apply registered state', () => {
      const prisma = createMockPrisma();
      const factory = new TestUserFactory(prisma);

      const result = factory.state('admin').make();

      expect(result.role).toBe('admin');
    });

    it('should chain multiple states', () => {
      const prisma = createMockPrisma();
      const factory = new TestUserFactory(prisma);

      const result = factory.state('admin').state('verified').make();

      expect(result.role).toBe('admin');
      expect(result.email).toBe('verified-test@example.com');
    });

    it('should throw for unknown state', () => {
      const prisma = createMockPrisma();
      const factory = new TestUserFactory(prisma);

      expect(() => factory.state('nonexistent')).toThrow(FactoryError);
    });

    it('should not mutate original factory', () => {
      const prisma = createMockPrisma();
      const factory = new TestUserFactory(prisma);

      const adminFactory = factory.state('admin');
      const originalResult = factory.make();
      const adminResult = adminFactory.make();

      expect(originalResult.role).toBe('user');
      expect(adminResult.role).toBe('admin');
    });

    it('should preserve subclass methods after state() call', () => {
      const prisma = createMockPrisma();
      const factory = new TestUserFactory(prisma);

      // Verify that state() returns this type, preserving subclass methods
      const statefulFactory = factory.state('verified');

      // The admin() method should still be accessible after state()
      // This is the critical test for the `state(): this` return type fix
      expect(typeof (statefulFactory as TestUserFactory).admin).toBe('function');
    });

    it('should allow chaining subclass methods after state()', () => {
      const prisma = createMockPrisma();
      const factory = new TestUserFactory(prisma);

      // Chain state() with subclass method admin()
      const result = factory.state('verified').admin().make();

      expect(result.role).toBe('admin');
      expect(result.email).toBe('verified-test@example.com');
    });

    it('should allow chaining state() after subclass methods', () => {
      const prisma = createMockPrisma();
      const factory = new TestUserFactory(prisma);

      // Chain subclass method with state()
      const result = factory.admin().state('verified').make();

      expect(result.role).toBe('admin');
      expect(result.email).toBe('verified-test@example.com');
    });

    it('should support convenience methods that wrap state()', () => {
      const prisma = createMockPrisma();
      const factory = new TestUserFactory(prisma);

      // Use convenience methods instead of direct state() calls
      const result = factory.admin().verified().make();

      expect(result.role).toBe('admin');
      expect(result.email).toBe('verified-test@example.com');
    });
  });

  describe('getAvailableStates', () => {
    it('should return registered state names', () => {
      const prisma = createMockPrisma();
      const factory = new TestUserFactory(prisma);

      const states = factory.getAvailableStates();

      expect(states).toContain('admin');
      expect(states).toContain('verified');
      expect(states).toHaveLength(2);
    });
  });
});

describe('createFactoryRegistry', () => {
  it('should create and cache factory instances', () => {
    const prisma = createMockPrisma();
    const registry = createFactoryRegistry(prisma);

    const factory1 = registry.get(TestUserFactory);
    const factory2 = registry.get(TestUserFactory);

    expect(factory1).toBe(factory2);
  });

  it('should clear cached instances', () => {
    const prisma = createMockPrisma();
    const registry = createFactoryRegistry(prisma);

    const factory1 = registry.get(TestUserFactory);
    registry.clear();
    const factory2 = registry.get(TestUserFactory);

    expect(factory1).not.toBe(factory2);
  });

  it('should provide working factory instances', () => {
    const prisma = createMockPrisma();
    const registry = createFactoryRegistry(prisma);

    const factory = registry.get(TestUserFactory);
    const result = factory.make();

    expect(result).toEqual({
      email: 'test@example.com',
      name: 'Test User',
      role: 'user',
    });
  });
});
