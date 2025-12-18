/**
 * Startup Banner
 *
 * Prints an elegant startup banner when the server starts.
 * Development mode shows detailed route information.
 * Production mode shows a single, machine-parseable line.
 */

import type { FastifyInstance } from 'fastify';
import pc from 'picocolors';

import { VELOX_VERSION } from '../index.js';

export interface BannerOptions {
  /** Server address (e.g., "http://127.0.0.1:3030") */
  address: string;
  /** Environment name (e.g., "development", "production") */
  env: string;
  /** Start time from performance.now() for elapsed calculation */
  startTime: number;
}

/**
 * Print the startup banner to console.
 *
 * @param server - Fastify server instance (must be ready)
 * @param options - Banner configuration
 */
export function printBanner(server: FastifyInstance, options: BannerOptions): void {
  const { address, env, startTime } = options;
  const elapsed = Math.round(performance.now() - startTime);

  if (env === 'production') {
    // Production: single line, minimal, machine-parseable
    console.log(`  VeloxTS v${VELOX_VERSION} | ${env} | ${address}`);
    return;
  }

  // Development: detailed banner with route information
  const routes = collectRoutes(server);

  console.log('');
  console.log(`  ${pc.bold('VeloxTS')} v${VELOX_VERSION}`);
  console.log('');
  console.log(`  ${pc.dim('Environment')}   ${env}`);
  console.log(`  ${pc.dim('Listening')}     ${address}`);
  console.log('');

  if (routes.length > 0) {
    console.log(`  ${pc.dim('Routes')}        ${routes.length} registered`);
    for (const route of routes.slice(0, 10)) {
      const method = formatMethod(route.method);
      console.log(`                ${method} ${route.path}`);
    }
    if (routes.length > 10) {
      console.log(`                ${pc.dim(`... and ${routes.length - 10} more`)}`);
    }
    console.log('');
  }

  console.log(`  ${pc.green('Ready')} in ${elapsed}ms`);
  console.log('');
}

/**
 * Format HTTP method with color coding.
 */
function formatMethod(method: string): string {
  const colors: Record<string, (s: string) => string> = {
    GET: pc.green,
    POST: pc.yellow,
    PUT: pc.blue,
    PATCH: pc.cyan,
    DELETE: pc.red,
  };
  const color = colors[method] ?? pc.white;
  return color(method.padEnd(6));
}

interface RouteInfo {
  method: string;
  path: string;
}

/**
 * Collect all registered routes from Fastify.
 */
function collectRoutes(server: FastifyInstance): RouteInfo[] {
  const routes: RouteInfo[] = [];

  // Fastify exposes routes via printRoutes or we can iterate
  // Using the internal routes map after ready()
  const routesList = server.printRoutes({ commonPrefix: false });

  // Parse the route tree output
  // Format: "└── /api (GET, HEAD)\n    └── /users (GET, POST, HEAD)"
  const lines = routesList.split('\n');
  for (const line of lines) {
    const match = line.match(/([/][^\s(]*)\s*\(([^)]+)\)/);
    if (match) {
      const path = match[1];
      const methods = match[2].split(',').map((m) => m.trim());
      for (const method of methods) {
        if (method === 'HEAD' || method === 'OPTIONS') continue;
        routes.push({ method, path });
      }
    }
  }

  // Sort: by path, then GET first within same path
  return routes.sort((a, b) => {
    const pathCompare = a.path.localeCompare(b.path);
    if (pathCompare !== 0) return pathCompare;
    if (a.method === 'GET' && b.method !== 'GET') return -1;
    if (b.method === 'GET' && a.method !== 'GET') return 1;
    return a.method.localeCompare(b.method);
  });
}
