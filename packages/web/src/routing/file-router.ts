/**
 * File-based Router
 *
 * Scans the pages directory and creates routes based on file structure.
 * Follows VeloxTS/Laravel-inspired conventions.
 *
 * @module @veloxts/web/routing/file-router
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';

import { createRouter as createRadixRouter } from 'radix3';

import type { ParsedRoute, RouteMatch, SpecialPageType } from '../types.js';

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

  /**
   * Files/directories to ignore (in addition to _ prefix)
   * @default ['_components', '_utils', '_hooks', '_lib']
   */
  ignore?: string[];
}

/**
 * Special pages configuration
 */
export interface SpecialPages {
  /**
   * 404 Not Found page file path
   */
  notFound?: string;

  /**
   * Error page file path
   */
  error?: string;

  /**
   * Loading page file path
   */
  loading?: string;
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
   * Special pages (404, error, loading)
   */
  specialPages: SpecialPages;

  /**
   * Match a pathname to a route
   */
  match(pathname: string): RouteMatch | null;

  /**
   * Get a special page path
   */
  getSpecialPage(type: SpecialPageType): string | undefined;

  /**
   * Check if a special page exists
   */
  hasSpecialPage(type: SpecialPageType): boolean;

  /**
   * Reload routes from the file system
   */
  reload(): Promise<void>;
}

/**
 * Internal radix router entry
 */
interface RadixRouteEntry {
  route: ParsedRoute;
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
export async function createFileRouter(options: FileRouterOptions = {}): Promise<FileRouter> {
  const {
    pagesDir = 'app/pages',
    layoutsDir = 'app/layouts',
    extensions = ['.tsx', '.jsx', '.ts', '.js'],
    ignore = ['_components', '_utils', '_hooks', '_lib'],
  } = options;

  let routes: ParsedRoute[] = [];
  let radixRouter = createRadixRouter<RadixRouteEntry>();
  let specialPages: SpecialPages = {};

  /**
   * Special page file name patterns
   */
  const specialPagePatterns: Record<SpecialPageType, string[]> = {
    'not-found': ['_not-found', '_404', 'not-found', '404'],
    error: ['_error', 'error'],
    loading: ['_loading', 'loading'],
  };

  /**
   * Finds special pages in the pages directory
   */
  function findSpecialPages(pagesDir: string): SpecialPages {
    const found: SpecialPages = {};

    if (!existsSync(pagesDir)) {
      return found;
    }

    for (const [type, patterns] of Object.entries(specialPagePatterns) as [
      SpecialPageType,
      string[],
    ][]) {
      for (const pattern of patterns) {
        for (const ext of extensions) {
          const filePath = join(pagesDir, `${pattern}${ext}`);
          if (existsSync(filePath)) {
            const key = type === 'not-found' ? 'notFound' : type;
            found[key as keyof SpecialPages] = `${pattern}${ext}`;
            break;
          }
        }
        // If found, stop checking other patterns for this type
        const key = type === 'not-found' ? 'notFound' : type;
        if (found[key as keyof SpecialPages]) {
          break;
        }
      }
    }

    return found;
  }

  /**
   * Scans the pages directory and populates routes
   */
  async function scanAndBuildRoutes(): Promise<void> {
    routes = [];
    radixRouter = createRadixRouter<RadixRouteEntry>();

    // Handle both absolute and relative paths
    const absolutePagesDir = isAbsolute(pagesDir) ? pagesDir : join(process.cwd(), pagesDir);
    const absoluteLayoutsDir = isAbsolute(layoutsDir) ? layoutsDir : join(process.cwd(), layoutsDir);

    if (!existsSync(absolutePagesDir)) {
      specialPages = {};
      return;
    }

    // Find special pages
    specialPages = findSpecialPages(absolutePagesDir);

    // Get special page file names to exclude from routing
    const specialPageFiles = new Set(Object.values(specialPages).filter(Boolean));

    // Scan for page files
    const files = scanDirectory(absolutePagesDir, extensions, ignore);

    // Parse each file into a route
    for (const file of files) {
      const relativePath = relative(absolutePagesDir, file);
      // Normalize path separators for Windows compatibility
      const normalizedPath = relativePath.split(sep).join('/');

      // Skip special pages from normal routing
      if (specialPageFiles.has(normalizedPath)) {
        continue;
      }

      const parsedRoute = parseFilePath(normalizedPath);

      // Check for associated layout
      const layout = findLayout(parsedRoute, absoluteLayoutsDir, extensions);
      if (layout) {
        parsedRoute.layout = layout;
      }

      routes.push(parsedRoute);
    }

    // Sort routes by specificity (more specific first)
    routes.sort(compareRouteSpecificity);

    // Register routes in radix router
    for (const route of routes) {
      // Convert our pattern to radix3 format
      const radixPattern = convertToRadixPattern(route.pattern, route.catchAll);
      radixRouter.insert(radixPattern, { route });
    }
  }

  // Initial scan
  await scanAndBuildRoutes();

  return {
    get routes() {
      return routes;
    },

    get specialPages() {
      return specialPages;
    },

    match(pathname: string): RouteMatch | null {
      // Normalize pathname
      const normalizedPath = normalizePath(pathname);

      // Use radix router for matching
      const result = radixRouter.lookup(normalizedPath);

      if (!result) {
        return null;
      }

      // Extract parameters
      const params = extractParams(result.route.pattern, normalizedPath, result.route.catchAll);

      return {
        route: result.route,
        params,
      };
    },

    getSpecialPage(type: SpecialPageType): string | undefined {
      const key = type === 'not-found' ? 'notFound' : type;
      return specialPages[key as keyof SpecialPages];
    },

    hasSpecialPage(type: SpecialPageType): boolean {
      const key = type === 'not-found' ? 'notFound' : type;
      return specialPages[key as keyof SpecialPages] !== undefined;
    },

    async reload(): Promise<void> {
      await scanAndBuildRoutes();
    },
  };
}

/**
 * Recursively scans a directory for page files
 */
function scanDirectory(dir: string, extensions: string[], ignore: string[]): string[] {
  const files: string[] = [];

  if (!existsSync(dir)) {
    return files;
  }

  const entries = readdirSync(dir);

  for (const entry of entries) {
    // Skip hidden files and ignored patterns
    if (entry.startsWith('.') || entry.startsWith('_') || ignore.includes(entry)) {
      continue;
    }

    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      // Recurse into subdirectories (including route groups like (auth))
      files.push(...scanDirectory(fullPath, extensions, ignore));
    } else if (stat.isFile()) {
      // Check if file has valid extension
      const hasValidExtension = extensions.some((ext) => entry.endsWith(ext));
      if (hasValidExtension) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Finds the associated layout for a route
 */
function findLayout(
  route: ParsedRoute,
  layoutsDir: string,
  extensions: string[]
): string | undefined {
  if (!existsSync(layoutsDir)) {
    return undefined;
  }

  // Check for group-specific layout first
  if (route.group) {
    for (const ext of extensions) {
      const groupLayoutPath = join(layoutsDir, `${route.group}${ext}`);
      if (existsSync(groupLayoutPath)) {
        return `${route.group}${ext}`;
      }
    }
  }

  // Check for root layout
  for (const ext of extensions) {
    const rootLayoutPath = join(layoutsDir, `root${ext}`);
    if (existsSync(rootLayoutPath)) {
      return `root${ext}`;
    }
  }

  return undefined;
}

/**
 * Converts our route pattern to radix3 format
 *
 * Our format: /users/:id
 * Radix3 format: /users/:id
 *
 * Catch-all: /* → /** (radix3 uses ** for catch-all)
 */
function convertToRadixPattern(pattern: string, catchAll: boolean): string {
  if (catchAll) {
    // Replace trailing /* with /**
    return pattern.replace(/\/\*$/, '/**');
  }
  return pattern;
}

/**
 * Extracts parameters from a matched pathname
 */
function extractParams(
  pattern: string,
  pathname: string,
  catchAll: boolean
): Record<string, string> {
  const params: Record<string, string> = {};

  // Handle catch-all routes
  if (catchAll) {
    const prefix = pattern.replace(/\/\*$/, '');
    const catchAllValue = pathname.slice(prefix.length + 1); // +1 for the /
    // Extract parameter name from pattern (e.g., "slug" from the original file [..slug].tsx)
    // For now, use "slug" as default catch-all param name
    params['*'] = catchAllValue || '';
    return params;
  }

  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = pathname.split('/').filter(Boolean);

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    if (patternPart.startsWith(':')) {
      const paramName = patternPart.slice(1);
      params[paramName] = pathPart || '';
    }
  }

  return params;
}

/**
 * Normalizes a pathname
 */
function normalizePath(pathname: string): string {
  // Ensure leading slash
  let normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;

  // Remove trailing slash (except for root)
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

/**
 * Compares routes by specificity for sorting.
 * More specific routes should come first.
 */
function compareRouteSpecificity(a: ParsedRoute, b: ParsedRoute): number {
  // Catch-all routes are least specific
  if (a.catchAll && !b.catchAll) return 1;
  if (!a.catchAll && b.catchAll) return -1;

  // Count static segments (more static = more specific)
  const aStaticCount = a.pattern.split('/').filter((s) => s && !s.startsWith(':')).length;
  const bStaticCount = b.pattern.split('/').filter((s) => s && !s.startsWith(':')).length;

  if (aStaticCount !== bStaticCount) {
    return bStaticCount - aStaticCount;
  }

  // Count dynamic segments (fewer dynamic = more specific)
  const aDynamicCount = a.params.length;
  const bDynamicCount = b.params.length;

  if (aDynamicCount !== bDynamicCount) {
    return aDynamicCount - bDynamicCount;
  }

  // Longer patterns are more specific
  return b.pattern.length - a.pattern.length;
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
