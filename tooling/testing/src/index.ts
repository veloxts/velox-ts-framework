/**
 * @veloxts/testing - Testing utilities for VeloxTS framework
 *
 * This package provides common test utilities used across VeloxTS packages:
 * - Model factories for type-safe test data (Laravel-style)
 * - Mock database with Prisma-compatible interface
 * - Test server factory with VeloxApp-like context setup
 * - HTTP helpers for authorization headers
 * - Test secrets for JWT/session/CSRF testing
 *
 * @example
 * ```typescript
 * import {
 *   defineFactory,
 *   createMockDatabase,
 *   createTestServer,
 *   authHeader,
 * } from '@veloxts/testing';
 *
 * // Define a factory
 * const User = defineFactory<User>(() => ({
 *   id: ({ sequence }) => `user-${sequence}`,
 *   name: ({ sequence }) => `User ${sequence}`,
 *   email: ({ sequence }) => `user${sequence}@test.com`,
 * }));
 *
 * // Create mock database with seed data
 * const db = createMockDatabase({
 *   user: User.count(3).make(),
 * });
 *
 * // Use in tests
 * const users = await db.user.findMany();
 * ```
 *
 * @module testing
 */

// Re-export setupTestContext from core for convenience
export { setupTestContext } from '@veloxts/core';

// ============================================================================
// Model Factories (Laravel-style)
// ============================================================================

export type { Factory, FactoryBuilder, FactoryContext, FactoryDefinition } from './factory.js';
export { defineFactory, email, sequence, timestamp, uuid } from './factory.js';

// ============================================================================
// Mock Database
// ============================================================================

export type { MockDatabase, MockModel, SeedData, WhereClause } from './database.js';
export { createMockDatabase, mockDatabaseConfig } from './database.js';

// ============================================================================
// Test Helpers
// ============================================================================

export type { TestUser } from './helpers.js';
export {
  authHeader,
  createTestUser,
  createUserLoader,
  jsonHeaders,
  TEST_SECRETS,
  wait,
} from './helpers.js';

// ============================================================================
// Test Server
// ============================================================================

export type { TestServerOptions } from './server.js';
export { createTestServer, wrapVeloxPlugin } from './server.js';

// ============================================================================
// Testcontainers (Docker-based integration testing)
// ============================================================================

export type {
  DescribeFn,
  MailhogContainerResult,
  MinioContainerResult,
  RedisContainerResult,
} from './containers.js';
export {
  describeWithDocker,
  isDockerAvailable,
  startMailhogContainer,
  startMinioContainer,
  startRedisContainer,
} from './containers.js';
