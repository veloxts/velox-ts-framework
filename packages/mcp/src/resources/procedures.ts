/**
 * Procedures Resource
 *
 * Exposes VeloxTS procedure information to AI tools.
 */

import type { ProcedureCollection } from '@veloxts/router';
import { type DiscoveryResult, discoverProceduresVerbose, getRouteSummary } from '@veloxts/router';

import { getProceduresPath } from '../utils/project.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Information about a single procedure
 */
export interface ProcedureInfo {
  /** Procedure name (e.g., 'getUser') */
  name: string;
  /** Namespace (e.g., 'users') */
  namespace: string;
  /** Procedure type: 'query' or 'mutation' */
  type: 'query' | 'mutation';
  /** Whether input schema is defined */
  hasInputSchema: boolean;
  /** Whether output schema is defined */
  hasOutputSchema: boolean;
  /** Number of guards applied */
  guardCount: number;
  /** Number of middlewares applied */
  middlewareCount: number;
  /** REST route info if applicable */
  route?: {
    method: string;
    path: string;
  };
}

/**
 * Procedures resource response
 */
export interface ProceduresResourceResponse {
  procedures: ProcedureInfo[];
  namespaces: string[];
  totalCount: number;
  queries: number;
  mutations: number;
  discoveryInfo?: {
    scannedFiles: number;
    loadedFiles: number;
    warnings: number;
  };
}

// ============================================================================
// Resource Handler
// ============================================================================

/**
 * Extract procedure information from collections
 */
function extractProcedureInfo(collections: ProcedureCollection[]): {
  procedures: ProcedureInfo[];
  namespaces: string[];
} {
  const procedures: ProcedureInfo[] = [];
  const namespaces: string[] = [];

  // Get route mappings using getRouteSummary
  const routeSummary = getRouteSummary(collections, '/api');
  const routeMap = new Map<string, { method: string; path: string }>();

  for (const route of routeSummary) {
    routeMap.set(`${route.namespace}.${route.procedure}`, {
      method: route.method,
      path: route.path,
    });
  }

  for (const collection of collections) {
    namespaces.push(collection.namespace);

    for (const [name, procedure] of Object.entries(collection.procedures)) {
      const info: ProcedureInfo = {
        name,
        namespace: collection.namespace,
        type: procedure.type,
        hasInputSchema: !!procedure.inputSchema,
        hasOutputSchema: !!procedure.outputSchema,
        guardCount: procedure.guards?.length ?? 0,
        middlewareCount: procedure.middlewares?.length ?? 0,
      };

      // Add route info if available
      const routeKey = `${collection.namespace}.${name}`;
      const route = routeMap.get(routeKey);
      if (route) {
        info.route = route;
      }

      procedures.push(info);
    }
  }

  return { procedures, namespaces };
}

/**
 * Discover and return procedure information for a project
 */
export async function getProcedures(projectRoot: string): Promise<ProceduresResourceResponse> {
  const proceduresPath = getProceduresPath(projectRoot);

  if (!proceduresPath) {
    return {
      procedures: [],
      namespaces: [],
      totalCount: 0,
      queries: 0,
      mutations: 0,
    };
  }

  let result: DiscoveryResult;
  try {
    result = await discoverProceduresVerbose(proceduresPath, {
      recursive: true,
      onInvalidExport: 'warn',
    });
  } catch {
    return {
      procedures: [],
      namespaces: [],
      totalCount: 0,
      queries: 0,
      mutations: 0,
    };
  }

  const { procedures, namespaces } = extractProcedureInfo(result.collections);

  const queries = procedures.filter((p) => p.type === 'query').length;
  const mutations = procedures.filter((p) => p.type === 'mutation').length;

  return {
    procedures,
    namespaces,
    totalCount: procedures.length,
    queries,
    mutations,
    discoveryInfo: {
      scannedFiles: result.scannedFiles.length,
      loadedFiles: result.loadedFiles.length,
      warnings: result.warnings.length,
    },
  };
}

/**
 * Get procedures filtered by namespace
 */
export async function getProceduresByNamespace(
  projectRoot: string,
  namespace: string
): Promise<ProcedureInfo[]> {
  const response = await getProcedures(projectRoot);
  return response.procedures.filter((p) => p.namespace === namespace);
}

/**
 * Get procedures filtered by type
 */
export async function getProceduresByType(
  projectRoot: string,
  type: 'query' | 'mutation'
): Promise<ProcedureInfo[]> {
  const response = await getProcedures(projectRoot);
  return response.procedures.filter((p) => p.type === type);
}

/**
 * Format procedures response as text
 */
export function formatProceduresAsText(response: ProceduresResourceResponse): string {
  const lines: string[] = [
    '# VeloxTS Procedures',
    '',
    `Total: ${response.totalCount} (${response.queries} queries, ${response.mutations} mutations)`,
    `Namespaces: ${response.namespaces.join(', ')}`,
    '',
  ];

  if (response.discoveryInfo) {
    lines.push('## Discovery Info');
    lines.push(`- Scanned files: ${response.discoveryInfo.scannedFiles}`);
    lines.push(`- Loaded files: ${response.discoveryInfo.loadedFiles}`);
    lines.push(`- Warnings: ${response.discoveryInfo.warnings}`);
    lines.push('');
  }

  // Group by namespace
  const byNamespace = new Map<string, ProcedureInfo[]>();
  for (const proc of response.procedures) {
    const list = byNamespace.get(proc.namespace) ?? [];
    list.push(proc);
    byNamespace.set(proc.namespace, list);
  }

  for (const [namespace, procs] of byNamespace) {
    lines.push(`## ${namespace}`);
    lines.push('');

    for (const proc of procs) {
      const type = proc.type === 'query' ? 'Q' : 'M';
      const route = proc.route ? ` -> ${proc.route.method} ${proc.route.path}` : '';
      const guards = proc.guardCount > 0 ? ` [${proc.guardCount} guards]` : '';
      lines.push(`- [${type}] ${proc.name}${route}${guards}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
