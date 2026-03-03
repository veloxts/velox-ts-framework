/**
 * Module system type definitions for VeloxTS framework
 *
 * Defines the shape of a VeloxTS module — a self-contained vertical domain slice
 * with services, middleware, routes, and lifecycle hooks.
 *
 * @module module/types
 */

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

/**
 * Service definition within a module.
 * Each service has a factory and optional cleanup.
 */
export interface ServiceDefinition<T = unknown> {
  /** Factory function to create the service instance */
  factory: () => T | Promise<T>;
  /** Optional cleanup called on server close */
  close?: (service: T) => void | Promise<void>;
}

/**
 * Record of named service definitions
 */
export type ServiceDefinitions = Record<string, ServiceDefinition>;

/**
 * Infer resolved service instances from their definitions.
 *
 * @example
 * ```typescript
 * const services = {
 *   db: { factory: () => new Database() },
 *   cache: { factory: () => new Cache() },
 * } satisfies ServiceDefinitions;
 *
 * type Resolved = InferServices<typeof services>;
 * // { db: Database; cache: Cache }
 * ```
 */
export type InferServices<T extends ServiceDefinitions> = {
  [K in keyof T]: T[K] extends ServiceDefinition<infer S> ? S : never;
};

/**
 * Module middleware — a Fastify onRequest hook applied to all routes in the module scope.
 */
export type ModuleMiddleware = (
  request: FastifyRequest,
  reply: FastifyReply
) => void | Promise<void>;

/**
 * Configuration for defineModule().
 *
 * @template TServices - The service definitions provided by this module
 */
export interface ModuleConfig<TServices extends ServiceDefinitions = ServiceDefinitions> {
  /** Services this module provides (created once, injected per-request) */
  services?: TServices;

  /** Module-wide middleware applied to all routes in the module scope */
  middleware?: ModuleMiddleware[];

  /**
   * Fastify plugin for route registration.
   * Typically the result of rest([...]) from @veloxts/router.
   */
  routes?: FastifyPluginAsync;

  /**
   * REST route prefix. Defaults to /${moduleName}.
   * Set false to disable auto-prefix.
   * Set a string for a custom prefix.
   */
  prefix?: string | false;

  /** Called after all modules registered, before server starts listening */
  boot?: (services: InferServices<TServices>) => void | Promise<void>;

  /** Called during graceful shutdown */
  shutdown?: (services: InferServices<TServices>) => void | Promise<void>;
}

/** Brand symbol for VeloxModule type guard */
export const MODULE_BRAND: unique symbol = Symbol.for('velox:module');

/**
 * A VeloxTS module — the return type of defineModule().
 *
 * Branded with a unique symbol for reliable runtime type checking
 * via isVeloxModule().
 *
 * @template TName - Literal string name of the module
 * @template TServices - The service definitions provided by this module
 */
export interface VeloxModule<
  TName extends string = string,
  TServices extends ServiceDefinitions = ServiceDefinitions,
> {
  readonly [MODULE_BRAND]: true;
  readonly name: TName;
  readonly config: Readonly<ModuleConfig<TServices>>;
}

/**
 * Infer the services type from a VeloxModule instance.
 * Useful for extending BaseContext via declaration merging.
 *
 * @example
 * ```typescript
 * const billing = defineModule('billing', {
 *   services: {
 *     stripe: { factory: () => new Stripe(process.env.STRIPE_KEY!) },
 *   },
 * });
 *
 * type BillingServices = InferModuleServices<typeof billing>;
 * // { stripe: Stripe }
 * ```
 */
export type InferModuleServices<M> =
  M extends VeloxModule<string, infer S> ? InferServices<S> : never;
