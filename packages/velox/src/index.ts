/**
 * @veloxts/velox - Complete VeloxTS Framework
 *
 * Umbrella package that re-exports all VeloxTS framework packages.
 * Install this single package to get started with VeloxTS.
 *
 * @example
 * ```typescript
 * import { createVeloxApp, procedure, z } from '@veloxts/velox';
 * ```
 *
 * For better tree-shaking, use subpath imports:
 * @example
 * ```typescript
 * import { createVeloxApp } from '@veloxts/velox/core';
 * import { procedure } from '@veloxts/velox/router';
 * ```
 */

// Core - Application bootstrap, plugins, context
export * from '@veloxts/core';

// Validation - Zod integration and schema utilities
export * from '@veloxts/validation';

// ORM - Database plugin and Prisma integration
export * from '@veloxts/orm';

// Router - Procedure definitions, REST adapter, tRPC
export * from '@veloxts/router';

// Auth - Authentication and authorization (v1.1+)
export * from '@veloxts/auth';
