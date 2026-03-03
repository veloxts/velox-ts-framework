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
 * @param onServicesResolved - Optional callback receiving resolved service instances
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
    // --- 1. Create services ---
    const services: Record<string, unknown> = {};

    if (config.services) {
      for (const [key, def] of Object.entries(config.services)) {
        const service = await def.factory();
        services[key] = service;

        // Decorate request so Fastify knows about the property
        if (!server.hasRequestDecorator(key)) {
          server.decorateRequest(key, undefined);
        }

        // --- 2. Inject service into every request ---
        server.addHook('onRequest', async (request) => {
          (request as unknown as Record<string, unknown>)[key] = service;
        });

        // --- 5. Cleanup on close ---
        if (def.close) {
          const closeFn = def.close;
          const svc = service;
          server.addHook('onClose', async () => {
            await closeFn(svc as never);
          });
        }
      }
    }

    // Notify caller of resolved services (for boot/shutdown)
    if (onServicesResolved) {
      onServicesResolved(services as InferServices<TServices>);
    }

    // --- 3. Apply module middleware ---
    if (config.middleware) {
      for (const mw of config.middleware) {
        server.addHook('onRequest', mw);
      }
    }

    // --- 4. Register routes with prefix ---
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
