/**
 * File-based Router
 *
 * Scans the pages directory and creates routes based on file structure.
 * Follows VeloxTS/Laravel-inspired conventions.
 *
 * @module
 */

import type { ParsedRoute, RouteMatch } from '../types.js';

/**
 * Options for the file router
 */
export interface FileRouterOptions {
  /**
   * Directory containing page components
   * @default 'app/pages'
   */
  pagesDir?: string;

  /**
   * Directory containing layout components
   * @default 'app/layouts'
   */
  layoutsDir?: string;

  /**
   * File extensions to consider as pages
   * @default ['.tsx', '.jsx', '.ts', '.js']
   */
  extensions?: string[];
}

/**
 * File router instance
 */
export interface FileRouter {
  /**
   * All parsed routes
   */
  routes: ParsedRoute[];

  /**
   * Match a pathname to a route
   */
  match(pathname: string): RouteMatch | null;

  /**
   * Reload routes from the file system
   */
  reload(): Promise<void>;
}

/**
 * Creates a file-based router.
 *
 * The router scans the pages directory and creates routes based on
 * the file structure:
 *
 * - `index.tsx` → `/`
 * - `about.tsx` → `/about`
 * - `users/index.tsx` → `/users`
 * - `users/[id].tsx` → `/users/:id`
 * - `users/[id]/edit.tsx` → `/users/:id/edit`
 * - `[...slug].tsx` → `/*` (catch-all)
 * - `(auth)/login.tsx` → `/login` (route group)
 *
 * Files starting with `_` are excluded from routing.
 *
 * @example
 * ```typescript
 * import { createFileRouter } from '@veloxts/web';
 *
 * const router = await createFileRouter({
 *   pagesDir: 'app/pages',
 * });
 *
 * const match = router.match('/users/123');
 * // { route: { pattern: '/users/:id', ... }, params: { id: '123' } }
 * ```
 */
export async function createFileRouter(_options: FileRouterOptions = {}): Promise<FileRouter> {
  // Placeholder implementation - will be expanded in Week 3
  const routes: ParsedRoute[] = [];

  return {
    routes,

    match(_pathname: string): RouteMatch | null {
      // TODO: Implement route matching with radix3
      return null;
    },

    async reload(): Promise<void> {
      // TODO: Implement file scanning
    },
  };
}

/**
 * Parses a file path into a route pattern.
 *
 * @example
 * parseFilePath('users/[id].tsx') // { pattern: '/users/:id', params: ['id'], ... }
 * parseFilePath('(auth)/login.tsx') // { pattern: '/login', group: 'auth', ... }
 */
export function parseFilePath(filePath: string): ParsedRoute {
  // Remove extension
  let path = filePath.replace(/\.(tsx?|jsx?)$/, '');

  // Track extracted info
  const params: string[] = [];
  let catchAll = false;
  let group: string | undefined;

  // Handle route groups: (group)/...
  const groupMatch = path.match(/^\(([^)]+)\)\//);
  if (groupMatch) {
    group = groupMatch[1];
    path = path.slice(groupMatch[0].length);
  }

  // Split into segments
  const segments = path.split('/').filter(Boolean);

  // Process each segment
  const processedSegments = segments.map((segment) => {
    // Catch-all: [...slug]
    if (segment.startsWith('[...') && segment.endsWith(']')) {
      catchAll = true;
      const param = segment.slice(4, -1);
      params.push(param);
      return '*';
    }

    // Dynamic: [param]
    if (segment.startsWith('[') && segment.endsWith(']')) {
      const param = segment.slice(1, -1);
      params.push(param);
      return `:${param}`;
    }

    // Index route
    if (segment === 'index') {
      return '';
    }

    return segment;
  });

  // Build the pattern
  const pattern = `/${processedSegments.filter(Boolean).join('/')}` || '/';

  return {
    filePath,
    pattern,
    params,
    catchAll,
    group,
  };
}
