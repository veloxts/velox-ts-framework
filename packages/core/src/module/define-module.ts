/**
 * defineModule() factory and isVeloxModule() type guard
 *
 * Creates self-contained vertical domain slices with services,
 * middleware, routes, and lifecycle hooks.
 *
 * @module module/define-module
 */

import { VeloxError } from '../errors.js';
import type { ModuleConfig, ServiceDefinitions, VeloxModule } from './types.js';
import { MODULE_BRAND } from './types.js';

/**
 * Defines a VeloxTS module — a self-contained vertical domain slice.
 *
 * Modules encapsulate services, middleware, routes, and lifecycle hooks
 * for a specific domain (e.g., billing, analytics, notifications).
 *
 * @template TName - Literal string name of the module
 * @template TServices - The service definitions provided by this module
 * @param name - Unique module name (used as route prefix default)
 * @param config - Module configuration
 * @returns A frozen VeloxModule ready for registration
 *
 * @throws {VeloxError} If name is empty or whitespace-only
 *
 * @example
 * ```typescript
 * export const billingModule = defineModule('billing', {
 *   services: {
 *     stripe: {
 *       factory: () => new Stripe(process.env.STRIPE_KEY!),
 *       close: (s) => s.close(),
 *     },
 *   },
 *   routes: rest([billingProcedures]),
 *   boot: async ({ stripe }) => {
 *     await stripe.verifyConnection();
 *   },
 * });
 * ```
 */
export function defineModule<
  const TName extends string,
  TServices extends ServiceDefinitions = ServiceDefinitions,
>(name: TName, config: ModuleConfig<TServices>): VeloxModule<TName, TServices> {
  if (name.trim() === '') {
    throw new VeloxError('Module must have a non-empty name', 500, 'INVALID_MODULE_NAME');
  }

  return {
    [MODULE_BRAND]: true as const,
    name,
    config: Object.freeze({ ...config }),
  };
}

/**
 * Type guard to check if a value is a VeloxModule.
 *
 * Uses the MODULE_BRAND symbol for reliable runtime identification,
 * avoiding false positives from duck-typing.
 *
 * @param value - Value to check
 * @returns true if value is a VeloxModule created by defineModule()
 *
 * @example
 * ```typescript
 * if (isVeloxModule(someValue)) {
 *   console.log('Module name:', someValue.name);
 *   await app.module(someValue);
 * }
 * ```
 */
export function isVeloxModule(value: unknown): value is VeloxModule {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return MODULE_BRAND in value && (value as Record<symbol, unknown>)[MODULE_BRAND] === true;
}
