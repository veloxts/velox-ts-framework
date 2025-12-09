/**
 * Seeding Errors Tests
 */

import { describe, expect, it } from 'vitest';

import {
  circularDependency,
  dependencyNotFound,
  executionFailed,
  FactoryError,
  factoryCreateFailed,
  factoryNotFound,
  filesystemError,
  invalidExport,
  noSeedersFound,
  SeederError,
  SeederErrorCode,
  seederDatabaseError,
  seederNotFound,
  stateNotFound,
  truncationFailed,
} from '../errors.js';

// ============================================================================
// Tests
// ============================================================================

describe('SeederError', () => {
  it('should set code, message, and fix', () => {
    const error = new SeederError(SeederErrorCode.SEEDER_NOT_FOUND, 'Test message', 'Test fix');

    expect(error.code).toBe(SeederErrorCode.SEEDER_NOT_FOUND);
    expect(error.message).toBe('Test message');
    expect(error.fix).toBe('Test fix');
  });

  it('should have name property set to SeederError', () => {
    const error = new SeederError(SeederErrorCode.SEEDER_NOT_FOUND, 'Test message');

    expect(error.name).toBe('SeederError');
  });

  it('should format error with code and message', () => {
    const error = new SeederError(SeederErrorCode.SEEDER_NOT_FOUND, 'Test message');

    const formatted = error.format();

    expect(formatted).toBe('SeederError[E3001]: Test message');
  });

  it('should include fix in formatted output when provided', () => {
    const error = new SeederError(SeederErrorCode.SEEDER_NOT_FOUND, 'Test message', 'Test fix');

    const formatted = error.format();

    expect(formatted).toBe('SeederError[E3001]: Test message\n\n  Fix: Test fix');
  });

  it('should omit fix from formatted output when undefined', () => {
    const error = new SeederError(SeederErrorCode.SEEDER_NOT_FOUND, 'Test message');

    const formatted = error.format();

    expect(formatted).toBe('SeederError[E3001]: Test message');
  });

  it('should return correct JSON shape with all fields', () => {
    const error = new SeederError(SeederErrorCode.SEEDER_NOT_FOUND, 'Test message', 'Test fix');

    const json = error.toJSON();

    expect(json).toEqual({
      code: 'E3001',
      message: 'Test message',
      fix: 'Test fix',
    });
  });

  it('should return undefined for fix in JSON when not provided', () => {
    const error = new SeederError(SeederErrorCode.SEEDER_NOT_FOUND, 'Test message');

    const json = error.toJSON();

    expect(json).toEqual({
      code: 'E3001',
      message: 'Test message',
      fix: undefined,
    });
  });
});

describe('FactoryError', () => {
  it('should set code, message, and fix', () => {
    const error = new FactoryError(SeederErrorCode.FACTORY_NOT_FOUND, 'Test message', 'Test fix');

    expect(error.code).toBe(SeederErrorCode.FACTORY_NOT_FOUND);
    expect(error.message).toBe('Test message');
    expect(error.fix).toBe('Test fix');
  });

  it('should have name property set to FactoryError', () => {
    const error = new FactoryError(SeederErrorCode.FACTORY_NOT_FOUND, 'Test message');

    expect(error.name).toBe('FactoryError');
  });

  it('should format error with code and message', () => {
    const error = new FactoryError(SeederErrorCode.FACTORY_NOT_FOUND, 'Test message');

    const formatted = error.format();

    expect(formatted).toBe('FactoryError[E3010]: Test message');
  });

  it('should include fix in formatted output when provided', () => {
    const error = new FactoryError(SeederErrorCode.FACTORY_NOT_FOUND, 'Test message', 'Test fix');

    const formatted = error.format();

    expect(formatted).toBe('FactoryError[E3010]: Test message\n\n  Fix: Test fix');
  });

  it('should omit fix from formatted output when undefined', () => {
    const error = new FactoryError(SeederErrorCode.FACTORY_NOT_FOUND, 'Test message');

    const formatted = error.format();

    expect(formatted).toBe('FactoryError[E3010]: Test message');
  });

  it('should return correct JSON shape with all fields', () => {
    const error = new FactoryError(SeederErrorCode.FACTORY_NOT_FOUND, 'Test message', 'Test fix');

    const json = error.toJSON();

    expect(json).toEqual({
      code: 'E3010',
      message: 'Test message',
      fix: 'Test fix',
    });
  });
});

describe('Error Factory Functions', () => {
  describe('seederNotFound', () => {
    it('should create error with E3001 code', () => {
      const error = seederNotFound('UserSeeder');

      expect(error.code).toBe(SeederErrorCode.SEEDER_NOT_FOUND);
    });

    it('should include seeder name in message', () => {
      const error = seederNotFound('UserSeeder');

      expect(error.message).toContain('UserSeeder');
    });

    it('should have fix suggestion', () => {
      const error = seederNotFound('UserSeeder');

      expect(error.fix).toBeDefined();
      expect(error.fix).toBeTruthy();
    });
  });

  describe('circularDependency', () => {
    it('should create error with E3002 code', () => {
      const error = circularDependency(['A', 'B', 'C', 'A']);

      expect(error.code).toBe(SeederErrorCode.CIRCULAR_DEPENDENCY);
    });

    it('should format cycle path correctly', () => {
      const error = circularDependency(['A', 'B', 'C', 'A']);

      expect(error.message).toContain('A -> B -> C -> A');
    });

    it('should handle single-node cycle', () => {
      const error = circularDependency(['A', 'A']);

      expect(error.message).toContain('A -> A');
    });

    it('should handle long cycles', () => {
      const error = circularDependency(['A', 'B', 'C', 'D', 'E', 'A']);

      expect(error.message).toContain('A -> B -> C -> D -> E -> A');
    });
  });

  describe('executionFailed', () => {
    it('should create error with E3003 code', () => {
      const cause = new Error('Database connection failed');
      const error = executionFailed('UserSeeder', cause);

      expect(error.code).toBe(SeederErrorCode.EXECUTION_FAILED);
    });

    it('should include seeder name in message', () => {
      const cause = new Error('Database connection failed');
      const error = executionFailed('UserSeeder', cause);

      expect(error.message).toContain('UserSeeder');
    });

    it('should include cause message', () => {
      const cause = new Error('Database connection failed');
      const error = executionFailed('UserSeeder', cause);

      expect(error.message).toContain('Database connection failed');
    });
  });

  describe('truncationFailed', () => {
    it('should create error with E3004 code', () => {
      const cause = new Error('Foreign key constraint');
      const error = truncationFailed('UserSeeder', cause);

      expect(error.code).toBe(SeederErrorCode.TRUNCATION_FAILED);
    });

    it('should include seeder name in message', () => {
      const cause = new Error('Foreign key constraint');
      const error = truncationFailed('UserSeeder', cause);

      expect(error.message).toContain('UserSeeder');
    });

    it('should include cause message', () => {
      const cause = new Error('Foreign key constraint');
      const error = truncationFailed('UserSeeder', cause);

      expect(error.message).toContain('Foreign key constraint');
    });
  });

  describe('dependencyNotFound', () => {
    it('should create error with E3006 code', () => {
      const error = dependencyNotFound('PostSeeder', 'UserSeeder');

      expect(error.code).toBe(SeederErrorCode.DEPENDENCY_NOT_FOUND);
    });

    it('should mention both seeder and dependency names', () => {
      const error = dependencyNotFound('PostSeeder', 'UserSeeder');

      expect(error.message).toContain('PostSeeder');
      expect(error.message).toContain('UserSeeder');
    });
  });

  describe('noSeedersFound', () => {
    it('should create error with E3007 code', () => {
      const error = noSeedersFound('/app/seeders');

      expect(error.code).toBe(SeederErrorCode.NO_SEEDERS_FOUND);
    });

    it('should include path in message', () => {
      const error = noSeedersFound('/app/seeders');

      expect(error.message).toContain('/app/seeders');
    });

    it('should have fix suggestion with generate command', () => {
      const error = noSeedersFound('/app/seeders');

      expect(error.fix).toBeDefined();
      expect(error.fix).toContain('velox');
    });
  });

  describe('seederDatabaseError', () => {
    it('should create error with E3008 code', () => {
      const cause = new Error('Connection timeout');
      const error = seederDatabaseError('insert', cause);

      expect(error.code).toBe(SeederErrorCode.DATABASE_ERROR);
    });

    it('should include operation in message', () => {
      const cause = new Error('Connection timeout');
      const error = seederDatabaseError('insert', cause);

      expect(error.message).toContain('insert');
    });

    it('should include cause message', () => {
      const cause = new Error('Connection timeout');
      const error = seederDatabaseError('insert', cause);

      expect(error.message).toContain('Connection timeout');
    });
  });

  describe('factoryNotFound', () => {
    it('should create FactoryError with E3010 code', () => {
      const error = factoryNotFound('UserFactory');

      expect(error).toBeInstanceOf(FactoryError);
      expect(error.code).toBe(SeederErrorCode.FACTORY_NOT_FOUND);
    });

    it('should include factory name', () => {
      const error = factoryNotFound('UserFactory');

      expect(error.message).toContain('UserFactory');
    });
  });

  describe('stateNotFound', () => {
    it('should create FactoryError with E3011 code', () => {
      const error = stateNotFound('UserFactory', 'admin', ['active', 'inactive']);

      expect(error).toBeInstanceOf(FactoryError);
      expect(error.code).toBe(SeederErrorCode.STATE_NOT_FOUND);
    });

    it('should include factory and state names', () => {
      const error = stateNotFound('UserFactory', 'admin', ['active', 'inactive']);

      expect(error.message).toContain('UserFactory');
      expect(error.message).toContain('admin');
    });

    it('should list available states', () => {
      const error = stateNotFound('UserFactory', 'admin', ['active', 'inactive']);

      expect(error.fix).toContain('active');
      expect(error.fix).toContain('inactive');
    });

    it('should show none when no states available', () => {
      const error = stateNotFound('UserFactory', 'admin', []);

      expect(error.fix).toContain('none');
    });
  });

  describe('factoryCreateFailed', () => {
    it('should create FactoryError with E3012 code', () => {
      const cause = new Error('Validation failed');
      const error = factoryCreateFailed('User', cause);

      expect(error).toBeInstanceOf(FactoryError);
      expect(error.code).toBe(SeederErrorCode.FACTORY_CREATE_FAILED);
    });

    it('should include model name', () => {
      const cause = new Error('Validation failed');
      const error = factoryCreateFailed('User', cause);

      expect(error.message).toContain('User');
    });

    it('should include cause message', () => {
      const cause = new Error('Validation failed');
      const error = factoryCreateFailed('User', cause);

      expect(error.message).toContain('Validation failed');
    });
  });

  describe('invalidExport', () => {
    it('should create error with E3021 code', () => {
      const error = invalidExport('/app/seeders/user.ts', 'Missing default export');

      expect(error.code).toBe(SeederErrorCode.INVALID_EXPORT);
    });

    it('should include file path', () => {
      const error = invalidExport('/app/seeders/user.ts', 'Missing default export');

      expect(error.message).toContain('/app/seeders/user.ts');
    });

    it('should include reason', () => {
      const error = invalidExport('/app/seeders/user.ts', 'Missing default export');

      expect(error.message).toContain('Missing default export');
    });
  });

  describe('filesystemError', () => {
    it('should create error with E3020 code', () => {
      const cause = new Error('ENOENT: no such file');
      const error = filesystemError('read', '/app/seeders', cause);

      expect(error.code).toBe(SeederErrorCode.FILESYSTEM_ERROR);
    });

    it('should include operation and path', () => {
      const cause = new Error('ENOENT: no such file');
      const error = filesystemError('read', '/app/seeders', cause);

      expect(error.message).toContain('read');
      expect(error.message).toContain('/app/seeders');
    });

    it('should include cause message', () => {
      const cause = new Error('ENOENT: no such file');
      const error = filesystemError('read', '/app/seeders', cause);

      expect(error.message).toContain('ENOENT: no such file');
    });
  });
});

describe('SeederErrorCode enum', () => {
  it('should have all error codes with unique values', () => {
    const codes = Object.values(SeederErrorCode);
    const uniqueCodes = new Set(codes);

    expect(codes.length).toBe(uniqueCodes.size);
  });

  it('should follow E30xx pattern', () => {
    const codes = Object.values(SeederErrorCode);

    for (const code of codes) {
      expect(code).toMatch(/^E30\d{2}$/);
    }
  });
});
