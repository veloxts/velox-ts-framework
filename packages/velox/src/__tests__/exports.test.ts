/**
 * Meta-package Export Tests
 *
 * Verifies that all expected exports from @veloxts/velox are accessible
 * and that the re-export mechanism works correctly.
 */

import { describe, expect, expectTypeOf, it } from 'vitest';

import type { GuardFunction, JwtConfig, TokenPayload, User } from '../auth.js';
// Import from subpath exports
import * as auth from '../auth.js';
// Type imports for expectTypeOf tests
import type { BaseContext, Container, InjectionToken, VeloxApp } from '../core.js';
import * as core from '../core.js';
// Import everything from main entry point
import * as velox from '../index.js';
import * as orm from '../orm.js';
import type { CompiledProcedure, ProcedureCollection } from '../router.js';
import * as router from '../router.js';
import type { InferOutput, SafeParseResult } from '../validation.js';
import * as validation from '../validation.js';

// ============================================================================
// Main Entry Point Exports
// ============================================================================

describe('Main entry point (@veloxts/velox)', () => {
  describe('Core exports', () => {
    it('should export veloxApp factory', () => {
      expect(velox.veloxApp).toBeDefined();
      expect(typeof velox.veloxApp).toBe('function');
    });

    it('should export Container class', () => {
      expect(velox.Container).toBeDefined();
    });

    it('should export container singleton', () => {
      expect(velox.container).toBeDefined();
    });

    it('should export definePlugin', () => {
      expect(velox.definePlugin).toBeDefined();
      expect(typeof velox.definePlugin).toBe('function');
    });

    it('should export DI decorators', () => {
      expect(velox.Injectable).toBeDefined();
      expect(velox.Inject).toBeDefined();
      expect(velox.Optional).toBeDefined();
      expect(velox.Scope).toBeDefined();
    });

    it('should export token utilities', () => {
      expect(velox.token).toBeDefined();
      expect(velox.singleton).toBeDefined();
      expect(velox.transient).toBeDefined();
    });

    it('should export error classes', () => {
      expect(velox.VeloxError).toBeDefined();
      expect(velox.ValidationError).toBeDefined();
      expect(velox.NotFoundError).toBeDefined();
    });
  });

  describe('Router exports', () => {
    it('should export procedure builder', () => {
      expect(velox.procedure).toBeDefined();
      expect(typeof velox.procedure).toBe('function');
    });

    it('should export defineProcedures', () => {
      expect(velox.defineProcedures).toBeDefined();
      expect(typeof velox.defineProcedures).toBe('function');
    });

    it('should export tRPC utilities', () => {
      expect(velox.trpc).toBeDefined();
    });

    it('should export REST adapter utilities', () => {
      expect(velox.rest).toBeDefined();
    });
  });

  describe('Validation exports', () => {
    it('should export Zod (z)', () => {
      expect(velox.z).toBeDefined();
      expect(velox.z.string).toBeDefined();
      expect(velox.z.object).toBeDefined();
    });

    it('should export parse utilities', () => {
      expect(velox.parse).toBeDefined();
      expect(velox.safeParse).toBeDefined();
      expect(velox.parseAll).toBeDefined();
    });

    it('should export common schemas', () => {
      expect(velox.emailSchema).toBeDefined();
      expect(velox.uuidSchema).toBeDefined();
      expect(velox.nonEmptyStringSchema).toBeDefined();
    });

    it('should export pagination utilities', () => {
      expect(velox.paginationInputSchema).toBeDefined();
      expect(velox.createPaginatedResponseSchema).toBeDefined();
    });
  });

  describe('ORM exports', () => {
    it('should export databasePlugin', () => {
      expect(velox.databasePlugin).toBeDefined();
    });

    it('should export database utilities', () => {
      expect(velox.createDatabase).toBeDefined();
    });

    it('should export DI tokens', () => {
      expect(velox.DATABASE_CLIENT).toBeDefined();
    });
  });

  describe('Auth exports', () => {
    it('should export authPlugin', () => {
      expect(velox.authPlugin).toBeDefined();
    });

    it('should export jwtManager', () => {
      expect(velox.jwtManager).toBeDefined();
      expect(typeof velox.jwtManager).toBe('function');
    });

    it('should export guards', () => {
      expect(velox.authenticated).toBeDefined();
      expect(velox.hasRole).toBeDefined();
      expect(velox.hasPermission).toBeDefined();
    });

    it('should export session utilities', () => {
      expect(velox.sessionMiddleware).toBeDefined();
      expect(velox.sessionManager).toBeDefined();
      expect(velox.inMemorySessionStore).toBeDefined();
    });

    it('should export CSRF protection', () => {
      expect(velox.csrfManager).toBeDefined();
      expect(velox.csrfMiddleware).toBeDefined();
    });

    it('should export rate limiting', () => {
      expect(velox.authRateLimiter).toBeDefined();
      expect(velox.rateLimitMiddleware).toBeDefined();
    });

    it('should export password utilities', () => {
      expect(velox.passwordHasher).toBeDefined();
      expect(velox.hashPassword).toBeDefined();
      expect(velox.verifyPassword).toBeDefined();
    });
  });
});

// ============================================================================
// Subpath Exports
// ============================================================================

describe('Subpath exports', () => {
  describe('@veloxts/velox/core', () => {
    it('should export core functionality', () => {
      expect(core.veloxApp).toBeDefined();
      expect(core.Container).toBeDefined();
      expect(core.definePlugin).toBeDefined();
      expect(core.VeloxError).toBeDefined();
    });

    it('should match main entry exports for core', () => {
      expect(core.veloxApp).toBe(velox.veloxApp);
      expect(core.Container).toBe(velox.Container);
      expect(core.definePlugin).toBe(velox.definePlugin);
    });
  });

  describe('@veloxts/velox/validation', () => {
    it('should export validation functionality', () => {
      expect(validation.z).toBeDefined();
      expect(validation.parse).toBeDefined();
      expect(validation.safeParse).toBeDefined();
      expect(validation.emailSchema).toBeDefined();
    });

    it('should match main entry exports for validation', () => {
      expect(validation.z).toBe(velox.z);
      expect(validation.parse).toBe(velox.parse);
      expect(validation.emailSchema).toBe(velox.emailSchema);
    });
  });

  describe('@veloxts/velox/orm', () => {
    it('should export ORM functionality', () => {
      expect(orm.databasePlugin).toBeDefined();
      expect(orm.createDatabase).toBeDefined();
      expect(orm.DATABASE_CLIENT).toBeDefined();
    });

    it('should match main entry exports for orm', () => {
      expect(orm.databasePlugin).toBe(velox.databasePlugin);
      expect(orm.DATABASE_CLIENT).toBe(velox.DATABASE_CLIENT);
    });
  });

  describe('@veloxts/velox/router', () => {
    it('should export router functionality', () => {
      expect(router.procedure).toBeDefined();
      expect(router.defineProcedures).toBeDefined();
      expect(router.trpc).toBeDefined();
      expect(router.rest).toBeDefined();
    });

    it('should match main entry exports for router', () => {
      expect(router.procedure).toBe(velox.procedure);
      expect(router.defineProcedures).toBe(velox.defineProcedures);
      expect(router.trpc).toBe(velox.trpc);
    });
  });

  describe('@veloxts/velox/auth', () => {
    it('should export auth functionality', () => {
      expect(auth.authPlugin).toBeDefined();
      expect(auth.jwtManager).toBeDefined();
      expect(auth.authenticated).toBeDefined();
      expect(auth.sessionMiddleware).toBeDefined();
    });

    it('should match main entry exports for auth', () => {
      expect(auth.authPlugin).toBe(velox.authPlugin);
      expect(auth.jwtManager).toBe(velox.jwtManager);
      expect(auth.authenticated).toBe(velox.authenticated);
    });
  });
});

// ============================================================================
// Integration Verification
// ============================================================================

describe('Integration verification', () => {
  it('should allow creating a basic schema with z', () => {
    const schema = velox.z.object({
      id: velox.z.string().uuid(),
      email: velox.z.string().email(),
      name: velox.z.string().min(1),
    });

    const result = schema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      name: 'Test User',
    });

    expect(result.success).toBe(true);
  });

  it('should allow creating a Container instance', () => {
    const container = new velox.Container();
    expect(container).toBeInstanceOf(velox.Container);
  });

  it('should allow creating tokens', () => {
    const testToken = velox.token<string>('test-token');
    expect(testToken).toBeDefined();
    // Token is a StringToken which is just a branded string
    expect(typeof testToken).toBe('string');
  });

  it('should allow using parse utilities', () => {
    const schema = velox.z.number().positive();

    expect(() => velox.parse(schema, 42)).not.toThrow();
    expect(() => velox.parse(schema, -1)).toThrow();

    const safeResult = velox.safeParse(schema, 42);
    expect(safeResult.success).toBe(true);
    if (safeResult.success) {
      expect(safeResult.data).toBe(42);
    }
  });

  it('should allow creating error instances', () => {
    const error = new velox.VeloxError('Test error message', 500, 'TEST_ERROR');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(velox.VeloxError);
    expect(error.code).toBe('TEST_ERROR');
    expect(error.message).toBe('Test error message');
    expect(error.statusCode).toBe(500);
  });
});

// ============================================================================
// Export Count Verification
// ============================================================================

describe('Export completeness', () => {
  it('should have a substantial number of exports', () => {
    const exportCount = Object.keys(velox).length;
    // Meta-package should re-export many items from 5 packages
    expect(exportCount).toBeGreaterThan(50);
  });

  it('should have exports from all subpackages', () => {
    // Verify at least one unique export from each package
    expect(velox.veloxApp).toBeDefined(); // core
    expect(velox.z).toBeDefined(); // validation
    expect(velox.databasePlugin).toBeDefined(); // orm
    expect(velox.procedure).toBeDefined(); // router
    expect(velox.jwtManager).toBeDefined(); // auth
  });
});

// ============================================================================
// Type Export Tests (compile-time verification with expectTypeOf)
// ============================================================================

describe('Type exports', () => {
  describe('Core types', () => {
    it('should export VeloxApp type', () => {
      expectTypeOf<VeloxApp>().toBeObject();
    });

    it('should export Container type', () => {
      expectTypeOf<Container>().toBeObject();
    });

    it('should export BaseContext type', () => {
      expectTypeOf<BaseContext>().toBeObject();
    });

    it('should export InjectionToken type', () => {
      // InjectionToken is a union type
      expectTypeOf<InjectionToken<string>>().not.toBeNever();
    });
  });

  describe('Auth types', () => {
    it('should export User type', () => {
      expectTypeOf<User>().toBeObject();
    });

    it('should export TokenPayload type', () => {
      expectTypeOf<TokenPayload>().toBeObject();
    });

    it('should export JwtConfig type', () => {
      expectTypeOf<JwtConfig>().toBeObject();
    });

    it('should export GuardFunction type', () => {
      // GuardFunction is a function type
      expectTypeOf<GuardFunction>().toBeFunction();
    });
  });

  describe('Router types', () => {
    it('should export CompiledProcedure type', () => {
      expectTypeOf<CompiledProcedure>().toBeObject();
    });

    it('should export ProcedureCollection type', () => {
      expectTypeOf<ProcedureCollection>().toBeObject();
    });
  });

  describe('Validation types', () => {
    it('should export InferOutput type utility', () => {
      // InferOutput extracts the output type from a schema
      const schema = velox.z.object({ id: velox.z.string() });
      type Output = InferOutput<typeof schema>;
      expectTypeOf<Output>().toEqualTypeOf<{ id: string }>();
    });

    it('should export SafeParseResult type', () => {
      expectTypeOf<SafeParseResult<string>>().not.toBeNever();
    });
  });
});

// ============================================================================
// Export Count Per Submodule (Regression Protection)
// ============================================================================

describe('Export count per submodule', () => {
  // These counts serve as regression protection - if exports are accidentally
  // removed, these tests will fail and alert developers.

  it('should have expected number of core exports', () => {
    const coreExportCount = Object.keys(core).length;
    // Core has ~50+ exports (classes, functions, types, decorators)
    expect(coreExportCount).toBeGreaterThanOrEqual(45);
  });

  it('should have expected number of validation exports', () => {
    const validationExportCount = Object.keys(validation).length;
    // Validation has ~35+ exports (z, schemas, utilities)
    expect(validationExportCount).toBeGreaterThanOrEqual(30);
  });

  it('should have expected number of orm exports', () => {
    const ormExportCount = Object.keys(orm).length;
    // ORM has ~25+ exports (plugin, utilities, types)
    expect(ormExportCount).toBeGreaterThanOrEqual(20);
  });

  it('should have expected number of router exports', () => {
    const routerExportCount = Object.keys(router).length;
    // Router has ~70+ exports (procedures, REST, tRPC, OpenAPI)
    expect(routerExportCount).toBeGreaterThanOrEqual(65);
  });

  it('should have expected number of auth exports', () => {
    const authExportCount = Object.keys(auth).length;
    // Auth has ~70+ exports (JWT, sessions, guards, CSRF, rate limiting)
    expect(authExportCount).toBeGreaterThanOrEqual(65);
  });

  it('should log export counts for debugging', () => {
    // This test always passes but logs counts for visibility
    const counts = {
      core: Object.keys(core).length,
      validation: Object.keys(validation).length,
      orm: Object.keys(orm).length,
      router: Object.keys(router).length,
      auth: Object.keys(auth).length,
      total: Object.keys(velox).length,
    };
    // Log to help debug if thresholds need adjustment
    console.log('Export counts:', counts);
    expect(true).toBe(true);
  });
});

// ============================================================================
// Negative Tests (Verify Internals NOT Exported)
// ============================================================================

describe('Internal implementation details should NOT be exported', () => {
  describe('Core internals', () => {
    it('should not expose internal container implementation details', () => {
      // These are implementation details that should not be public API
      expect((velox as Record<string, unknown>).ContainerImpl).toBeUndefined();
      expect((velox as Record<string, unknown>)._internalContainer).toBeUndefined();
      expect((velox as Record<string, unknown>).__private).toBeUndefined();
    });

    it('should not expose internal metadata keys', () => {
      expect((velox as Record<string, unknown>).INJECTABLE_METADATA).toBeUndefined();
      expect((velox as Record<string, unknown>).INJECT_METADATA).toBeUndefined();
    });
  });

  describe('Router internals', () => {
    it('should not expose internal procedure building utilities', () => {
      expect((velox as Record<string, unknown>)._buildProcedure).toBeUndefined();
      expect((velox as Record<string, unknown>).InternalBuilder).toBeUndefined();
    });

    it('should not expose internal REST adapter internals', () => {
      expect((velox as Record<string, unknown>)._restAdapterInternal).toBeUndefined();
    });
  });

  describe('Auth internals', () => {
    it('should not expose internal token handling', () => {
      expect((velox as Record<string, unknown>)._signToken).toBeUndefined();
      expect((velox as Record<string, unknown>)._verifyToken).toBeUndefined();
    });

    it('should not expose internal session store implementation', () => {
      expect((velox as Record<string, unknown>).SessionStoreImpl).toBeUndefined();
      expect((velox as Record<string, unknown>)._sessionStorage).toBeUndefined();
    });
  });

  describe('ORM internals', () => {
    it('should not expose internal database connection handling', () => {
      expect((velox as Record<string, unknown>)._dbConnection).toBeUndefined();
      expect((velox as Record<string, unknown>).InternalPrismaClient).toBeUndefined();
    });
  });

  describe('Validation internals', () => {
    it('should not expose internal schema utilities', () => {
      expect((velox as Record<string, unknown>)._schemaRegistry).toBeUndefined();
      expect((velox as Record<string, unknown>).InternalValidator).toBeUndefined();
    });
  });

  describe('General naming conventions', () => {
    it('should not have any exports starting with underscore', () => {
      const underscoreExports = Object.keys(velox).filter((key) => key.startsWith('_'));
      expect(underscoreExports).toEqual([]);
    });

    it('should not have any exports containing "Internal" (case-insensitive)', () => {
      const internalExports = Object.keys(velox).filter((key) =>
        key.toLowerCase().includes('internal')
      );
      expect(internalExports).toEqual([]);
    });

    it('should not have any exports containing "Private" (case-insensitive)', () => {
      const privateExports = Object.keys(velox).filter((key) =>
        key.toLowerCase().includes('private')
      );
      expect(privateExports).toEqual([]);
    });

    it('should not have any exports containing "Impl" suffix', () => {
      const implExports = Object.keys(velox).filter((key) => key.endsWith('Impl'));
      expect(implExports).toEqual([]);
    });
  });
});
