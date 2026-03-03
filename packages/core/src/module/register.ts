/**
 * createModulePlugin() — creates a Fastify plugin from a VeloxModule definition.
 *
 * The plugin creates an encapsulated scope that:
 * 1. Creates service instances via factories (sync or async)
 * 2. Injects services into every request via decorateRequest + onRequest hook
 * 3. Applies module middleware as onRequest hooks
 * 4. Registers routes with the module prefix (auto from name, custom, or disabled)
 * 5. Adds onClose hooks for service cleanup
 *
 * @module module/register
 */

import type { FastifyInstance } from 'fastify';

import { createLogger } from '../utils/logger.js';
import type { InferServices, ServiceDefinitions, VeloxModule } from './types.js';

const log = createLogger('module');

/**
 * Creates a Fastify plugin from a VeloxModule definition.
 *
 * @param mod - The module definition
 * @param onServicesResolved - Optional callback invoked after all services are created,
 *   during plugin registration (before server.ready()). Used by app.module() to capture
 *   resolved service references for boot/shutdown hooks.
 * @returns A Fastify plugin function
 *
 * @internal Used by app.module() — not typically called directly.
 */
export function createModulePlugin<TName extends string, TServices extends ServiceDefinitions>(
  mod: VeloxModule<TName, TServices>,
  onServicesResolved?: (services: InferServices<TServices>) => void
): (server: FastifyInstance) => Promise<void> {
  const { config } = mod;

  return async (server: FastifyInstance) => {
    const services: Record<string, unknown> = {};

    if (config.services) {
      for (const [key, def] of Object.entries(config.services)) {
        const service = await def.factory();
        services[key] = service;

        // TODO(phase-2): decorateRequest on scoped server — service names may
        // collide between modules at the Fastify decorator level.
        if (!server.hasRequestDecorator(key)) {
          server.decorateRequest(key, undefined);
        }

        server.addHook('onRequest', async (request) => {
          (request as unknown as Record<string, unknown>)[key] = service;
        });

        // Cleanup on close
        if (def.close) {
          addCloseHook(server, service, def.close);
        }
      }
    }

    // Notify caller of resolved services (for boot/shutdown)
    if (onServicesResolved) {
      onServicesResolved(services as InferServices<TServices>);
    }

    // Apply module middleware
    if (config.middleware) {
      for (const mw of config.middleware) {
        server.addHook('onRequest', mw);
      }
    }

    // Register routes with prefix
    if (config.routes) {
      const prefix = resolvePrefix(mod.name, config.prefix);
      if (prefix) {
        await server.register(config.routes, { prefix });
      } else {
        await server.register(config.routes);
      }
    }

    log.debug(`Module "${mod.name}" registered`);
  };
}

/**
 * Registers an onClose hook with properly correlated types.
 * Object.entries() erases per-key generics, so we use a helper
 * to preserve the relationship between the service and its close function.
 */
function addCloseHook<T>(
  server: FastifyInstance,
  service: T,
  closeFn: (service: T) => void | Promise<void>
): void {
  server.addHook('onClose', async () => {
    await closeFn(service);
  });
}

/**
 * Resolve the effective route prefix for a module.
 *
 * - undefined -> /${name} (auto from module name)
 * - false -> no prefix
 * - string -> custom prefix (ensures leading slash)
 */
function resolvePrefix(name: string, prefix: string | false | undefined): string | undefined {
  if (prefix === false) {
    return undefined;
  }
  if (typeof prefix === 'string') {
    return prefix.startsWith('/') ? prefix : `/${prefix}`;
  }
  return `/${name}`;
}
