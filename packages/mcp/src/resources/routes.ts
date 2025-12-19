/**
 * Routes Resource
 *
 * Exposes REST route mappings to AI tools.
 */

import type { ProcedureCollection } from '@veloxts/router';
import { discoverProceduresVerbose, getRouteSummary } from '@veloxts/router';

import { getProceduresPath } from '../utils/project.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Route information for MCP response
 */
export interface RouteInfo {
  /** HTTP method (GET, POST, PUT, PATCH, DELETE) */
  method: string;
  /** Route path (e.g., '/api/users/:id') */
  path: string;
  /** Procedure namespace */
  namespace: string;
  /** Procedure name */
  procedure: string;
}

/**
 * Routes resource response
 */
export interface RoutesResourceResponse {
  routes: RouteInfo[];
  totalCount: number;
  byMethod: Record<string, number>;
  byNamespace: Record<string, number>;
}

// ============================================================================
// Resource Handler
// ============================================================================

/**
 * Discover and return route information for a project
 */
export async function getRoutes(projectRoot: string): Promise<RoutesResourceResponse> {
  const proceduresPath = getProceduresPath(projectRoot);

  if (!proceduresPath) {
    return {
      routes: [],
      totalCount: 0,
      byMethod: {},
      byNamespace: {},
    };
  }

  let collections: ProcedureCollection[];
  try {
    const result = await discoverProceduresVerbose(proceduresPath, {
      recursive: true,
      onInvalidExport: 'warn',
    });
    collections = result.collections;
  } catch {
    return {
      routes: [],
      totalCount: 0,
      byMethod: {},
      byNamespace: {},
    };
  }

  // Get route summary which provides what we need
  const routeSummary = getRouteSummary(collections, '/api');

  const routes: RouteInfo[] = routeSummary.map((r) => ({
    method: r.method,
    path: r.path,
    namespace: r.namespace,
    procedure: r.procedure,
  }));

  // Count by method
  const byMethod: Record<string, number> = {};
  for (const route of routes) {
    byMethod[route.method] = (byMethod[route.method] ?? 0) + 1;
  }

  // Count by namespace
  const byNamespace: Record<string, number> = {};
  for (const route of routes) {
    byNamespace[route.namespace] = (byNamespace[route.namespace] ?? 0) + 1;
  }

  return {
    routes,
    totalCount: routes.length,
    byMethod,
    byNamespace,
  };
}

/**
 * Get routes filtered by HTTP method
 */
export async function getRoutesByMethod(projectRoot: string, method: string): Promise<RouteInfo[]> {
  const response = await getRoutes(projectRoot);
  return response.routes.filter((r) => r.method === method.toUpperCase());
}

/**
 * Get routes filtered by namespace
 */
export async function getRoutesByNamespace(
  projectRoot: string,
  namespace: string
): Promise<RouteInfo[]> {
  const response = await getRoutes(projectRoot);
  return response.routes.filter((r) => r.namespace === namespace);
}

/**
 * Format routes response as text
 */
export function formatRoutesAsText(response: RoutesResourceResponse): string {
  const lines: string[] = [
    '# VeloxTS REST Routes',
    '',
    `Total routes: ${response.totalCount}`,
    '',
    '## By HTTP Method',
    '',
  ];

  for (const [method, count] of Object.entries(response.byMethod)) {
    lines.push(`- ${method}: ${count}`);
  }

  lines.push('', '## By Namespace', '');

  for (const [namespace, count] of Object.entries(response.byNamespace)) {
    lines.push(`- ${namespace}: ${count}`);
  }

  lines.push('', '## All Routes', '');

  // Group by method for better readability
  const byMethod = new Map<string, RouteInfo[]>();
  for (const route of response.routes) {
    const list = byMethod.get(route.method) ?? [];
    list.push(route);
    byMethod.set(route.method, list);
  }

  for (const [method, routes] of byMethod) {
    lines.push(`### ${method}`);
    for (const route of routes) {
      lines.push(`- ${route.path} -> ${route.namespace}.${route.procedure}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
