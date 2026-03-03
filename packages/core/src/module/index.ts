/**
 * Module system for VeloxTS framework
 *
 * Provides defineModule() for creating self-contained vertical domain slices
 * with services, middleware, routes, and lifecycle hooks.
 *
 * @module module
 */

export { defineModule, isVeloxModule } from './define-module.js';
export type {
  InferModuleServices,
  InferServices,
  ModuleConfig,
  ModuleMiddleware,
  ServiceDefinition,
  ServiceDefinitions,
  VeloxModule,
} from './types.js';
export { MODULE_BRAND } from './types.js';
