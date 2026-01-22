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

// Auth - Re-export from subpath module (excludes internal testing utilities)
export * from './auth.js';
// Core - Application bootstrap, plugins, context
export * from '@veloxts/core';
// ORM - Database plugin and Prisma integration
export * from '@veloxts/orm';
// Router - Procedure definitions, REST adapter, tRPC
export * from '@veloxts/router';
// Validation - Zod integration and schema utilities
export * from '@veloxts/validation';
