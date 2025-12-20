/**
 * Layout Resolution System
 *
 * Handles nested layout resolution for VeloxTS applications.
 * Supports both route group layouts and hierarchical directory layouts.
 *
 * @module @veloxts/web/routing/layouts
 */

import { existsSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';

import type { ParsedRoute } from '../types.js';

/**
 * Layout component type
 */
export type LayoutComponent = React.ComponentType<{
  children: React.ReactNode;
  params?: Record<string, string>;
}>;

/**
 * Resolved layout chain
 */
export interface LayoutChain {
  /**
   * Final ordered list of layout file paths, from outermost to innermost
   * This is the result after applying any per-route layout configuration
   */
  layouts: string[];

  /**
   * Root layout file path (if any)
   */
  rootLayout?: string;

  /**
   * Group layouts in order (outermost to innermost)
   */
  groupLayouts?: string[];

  /**
   * Segment layouts (directory-based)
   */
  segmentLayouts: string[];

  /**
   * Per-route layout files (from page's layoutConfig)
   */
  pageLayouts?: string[];

  /**
   * Layout mode applied (from page's layoutConfig)
   */
  layoutMode?: 'inherit' | 'replace' | 'prepend' | 'append';
}

/**
 * Options for layout resolution
 */
export interface LayoutResolverOptions {
  /**
   * Directory containing layout components
   * @default 'app/layouts'
   */
  layoutsDir?: string;

  /**
   * Directory containing page components
   * @default 'app/pages'
   */
  pagesDir?: string;

  /**
   * File extensions to check for layouts
   * @default ['.tsx', '.jsx', '.ts', '.js']
   */
  extensions?: string[];
}

/**
 * Layout resolver instance
 */
export interface LayoutResolver {
  /**
   * Resolve the layout chain for a route
   */
  resolve(route: ParsedRoute): LayoutChain;

  /**
   * Get all available layouts
   */
  getLayouts(): string[];

  /**
   * Check if a layout exists
   */
  hasLayout(name: string): boolean;
}

/**
 * Creates a layout resolver.
 *
 * Layout Resolution Order:
 * 1. Root layout (app/layouts/root.tsx)
 * 2. Group layout (app/layouts/{group}.tsx for routes in (group)/)
 * 3. Segment layouts (app/pages/users/_layout.tsx for /users routes)
 *
 * @example
 * ```typescript
 * const resolver = createLayoutResolver({
 *   layoutsDir: 'app/layouts',
 *   pagesDir: 'app/pages',
 * });
 *
 * const chain = resolver.resolve(route);
 * // { layouts: ['root.tsx', 'dashboard.tsx'], ... }
 * ```
 */
export function createLayoutResolver(options: LayoutResolverOptions = {}): LayoutResolver {
  const {
    layoutsDir = 'app/layouts',
    pagesDir = 'app/pages',
    extensions = ['.tsx', '.jsx', '.ts', '.js'],
  } = options;

  // Handle both absolute and relative paths
  const absoluteLayoutsDir = isAbsolute(layoutsDir) ? layoutsDir : join(process.cwd(), layoutsDir);
  const absolutePagesDir = isAbsolute(pagesDir) ? pagesDir : join(process.cwd(), pagesDir);

  /**
   * Cache of discovered layouts
   */
  const layoutCache = new Map<string, string>();

  /**
   * Scans the layouts directory for available layouts
   */
  function scanLayouts(): void {
    layoutCache.clear();

    if (!existsSync(absoluteLayoutsDir)) {
      return;
    }

    const entries = readdirSync(absoluteLayoutsDir);

    for (const entry of entries) {
      for (const ext of extensions) {
        if (entry.endsWith(ext)) {
          const name = entry.slice(0, -ext.length);
          layoutCache.set(name, entry);
          break;
        }
      }
    }
  }

  // Initial scan
  scanLayouts();

  return {
    resolve(route: ParsedRoute): LayoutChain {
      // Build inherited layouts (root, groups, segments)
      const inheritedLayouts: string[] = [];
      let rootLayout: string | undefined;
      const groupLayouts: string[] = [];
      const segmentLayouts: string[] = [];

      // 1. Check for root layout
      const rootLayoutFile = layoutCache.get('root');
      if (rootLayoutFile) {
        rootLayout = rootLayoutFile;
        inheritedLayouts.push(rootLayoutFile);
      }

      // 2. Check for group layouts (supports multiple groups)
      const routeGroups = route.groups ?? [];
      for (const groupName of routeGroups) {
        const groupLayoutFile = layoutCache.get(groupName);
        if (groupLayoutFile) {
          groupLayouts.push(groupLayoutFile);
          inheritedLayouts.push(groupLayoutFile);
        }
      }

      // 3. Check for segment layouts (directory-based _layout files)
      const segmentLayoutFiles = findSegmentLayouts(route.filePath, absolutePagesDir, extensions);
      for (const segmentLayout of segmentLayoutFiles) {
        segmentLayouts.push(segmentLayout);
        inheritedLayouts.push(segmentLayout);
      }

      // 4. Apply per-route layout configuration if present
      const pageLayouts = route.layoutConfig?.layouts;
      const layoutMode = route.layoutConfig?.mode ?? 'inherit';

      let finalLayouts: string[];

      if (pageLayouts && pageLayouts.length > 0) {
        switch (layoutMode) {
          case 'replace':
            // Replace all inherited layouts with page-specified layouts
            finalLayouts = [...pageLayouts];
            break;
          case 'prepend':
            // Add page layouts before inherited layouts
            finalLayouts = [...pageLayouts, ...inheritedLayouts];
            break;
          case 'append':
            // Add page layouts after inherited layouts
            finalLayouts = [...inheritedLayouts, ...pageLayouts];
            break;
          case 'inherit':
          default:
            // Use inherited layouts only
            finalLayouts = inheritedLayouts;
            break;
        }
      } else if (layoutMode === 'replace' && pageLayouts?.length === 0) {
        // Explicit empty array with replace mode = no layouts
        finalLayouts = [];
      } else {
        // No page config or inherit mode - use inherited layouts
        finalLayouts = inheritedLayouts;
      }

      return {
        layouts: finalLayouts,
        rootLayout,
        groupLayouts: groupLayouts.length > 0 ? groupLayouts : undefined,
        segmentLayouts,
        pageLayouts: pageLayouts && pageLayouts.length > 0 ? pageLayouts : undefined,
        layoutMode: route.layoutConfig ? layoutMode : undefined,
      };
    },

    getLayouts(): string[] {
      return Array.from(layoutCache.values());
    },

    hasLayout(name: string): boolean {
      return layoutCache.has(name);
    },
  };
}

/**
 * Finds segment layouts in the page directory hierarchy
 *
 * For a route like "users/[id]/posts/index.tsx", this checks:
 * - app/pages/_layout.tsx
 * - app/pages/users/_layout.tsx
 * - app/pages/users/[id]/_layout.tsx
 * - app/pages/users/[id]/posts/_layout.tsx
 */
function findSegmentLayouts(filePath: string, pagesDir: string, extensions: string[]): string[] {
  const layouts: string[] = [];

  // Get the directory path (without the file)
  let currentDir = dirname(filePath);

  // Build list of directories from root to leaf
  const directories: string[] = [];

  while (currentDir && currentDir !== '.') {
    directories.unshift(currentDir);
    currentDir = dirname(currentDir);
  }

  // Add root pages directory
  directories.unshift('');

  // Check each directory for a _layout file
  for (const dir of directories) {
    const dirPath = dir ? join(pagesDir, dir) : pagesDir;

    for (const ext of extensions) {
      const layoutPath = join(dirPath, `_layout${ext}`);
      if (existsSync(layoutPath)) {
        // Return relative path from pages dir
        const relativePath = dir ? `${dir}/_layout${ext}` : `_layout${ext}`;
        layouts.push(relativePath);
        break;
      }
    }
  }

  return layouts;
}

/**
 * Wraps a page component with its layout chain
 *
 * @example
 * ```tsx
 * const WrappedPage = wrapWithLayouts(
 *   PageComponent,
 *   [RootLayout, DashboardLayout],
 *   { id: '123' }
 * );
 * ```
 */
export function wrapWithLayouts(
  pageElement: React.ReactElement,
  layouts: LayoutComponent[],
  params?: Record<string, string>
): React.ReactElement {
  // Wrap from innermost to outermost
  let wrapped = pageElement;

  for (let i = layouts.length - 1; i >= 0; i--) {
    const Layout = layouts[i];
    // Create element with proper typing
    const layoutElement = {
      type: Layout,
      props: { children: wrapped, params },
      key: `layout-${i}`,
    } as React.ReactElement;
    wrapped = layoutElement;
  }

  return wrapped;
}

/**
 * Default export for convenience
 */
export default createLayoutResolver;
