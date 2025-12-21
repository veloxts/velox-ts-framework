/**
 * Tests for Layout Resolution System
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { ParsedRoute } from '../types.js';
import { createLayoutResolver, wrapWithLayouts } from './layouts.js';

// Test fixture directory
const TEST_DIR = join(process.cwd(), '.test-layouts');
const LAYOUTS_DIR = join(TEST_DIR, 'app/layouts');
const PAGES_DIR = join(TEST_DIR, 'app/pages');

describe('createLayoutResolver', () => {
  beforeAll(() => {
    // Create test directory structure
    mkdirSync(LAYOUTS_DIR, { recursive: true });
    mkdirSync(PAGES_DIR, { recursive: true });
  });

  afterAll(() => {
    // Cleanup test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('initialization', () => {
    it('should create a resolver with default options', () => {
      const resolver = createLayoutResolver();

      expect(resolver).toBeDefined();
      expect(typeof resolver.resolve).toBe('function');
      expect(typeof resolver.getLayouts).toBe('function');
      expect(typeof resolver.hasLayout).toBe('function');
    });

    it('should accept custom options', () => {
      const resolver = createLayoutResolver({
        layoutsDir: 'src/layouts',
        pagesDir: 'src/pages',
        extensions: ['.tsx'],
      });

      expect(resolver).toBeDefined();
    });
  });

  describe('root layout resolution', () => {
    beforeAll(() => {
      // Create root layout
      writeFileSync(join(LAYOUTS_DIR, 'root.tsx'), 'export default function RootLayout() {}');
    });

    afterAll(() => {
      rmSync(join(LAYOUTS_DIR, 'root.tsx'), { force: true });
    });

    it('should resolve root layout when it exists', () => {
      const resolver = createLayoutResolver({
        layoutsDir: join(TEST_DIR, 'app/layouts'),
        pagesDir: join(TEST_DIR, 'app/pages'),
      });

      const route: ParsedRoute = {
        filePath: 'index.tsx',
        pattern: '/',
        params: [],
        catchAll: false,
      };

      const chain = resolver.resolve(route);

      expect(chain.rootLayout).toBe('root.tsx');
      expect(chain.layouts).toContain('root.tsx');
    });

    it('should include root layout in getLayouts()', () => {
      const resolver = createLayoutResolver({
        layoutsDir: join(TEST_DIR, 'app/layouts'),
        pagesDir: join(TEST_DIR, 'app/pages'),
      });

      const layouts = resolver.getLayouts();
      expect(layouts).toContain('root.tsx');
    });

    it('should return true for hasLayout("root")', () => {
      const resolver = createLayoutResolver({
        layoutsDir: join(TEST_DIR, 'app/layouts'),
        pagesDir: join(TEST_DIR, 'app/pages'),
      });

      expect(resolver.hasLayout('root')).toBe(true);
    });
  });

  describe('group layout resolution', () => {
    beforeAll(() => {
      // Create group layouts
      writeFileSync(join(LAYOUTS_DIR, 'auth.tsx'), 'export default function AuthLayout() {}');
      writeFileSync(
        join(LAYOUTS_DIR, 'dashboard.tsx'),
        'export default function DashboardLayout() {}'
      );
    });

    afterAll(() => {
      rmSync(join(LAYOUTS_DIR, 'auth.tsx'), { force: true });
      rmSync(join(LAYOUTS_DIR, 'dashboard.tsx'), { force: true });
    });

    it('should resolve group layout for grouped routes', () => {
      const resolver = createLayoutResolver({
        layoutsDir: join(TEST_DIR, 'app/layouts'),
        pagesDir: join(TEST_DIR, 'app/pages'),
      });

      const route: ParsedRoute = {
        filePath: '(auth)/login.tsx',
        pattern: '/login',
        params: [],
        catchAll: false,
        groups: ['auth'],
      };

      const chain = resolver.resolve(route);

      expect(chain.groupLayouts).toEqual(['auth.tsx']);
      expect(chain.layouts).toContain('auth.tsx');
    });

    it('should not include group layouts for non-grouped routes', () => {
      const resolver = createLayoutResolver({
        layoutsDir: join(TEST_DIR, 'app/layouts'),
        pagesDir: join(TEST_DIR, 'app/pages'),
      });

      const route: ParsedRoute = {
        filePath: 'about.tsx',
        pattern: '/about',
        params: [],
        catchAll: false,
      };

      const chain = resolver.resolve(route);

      expect(chain.groupLayouts).toBeUndefined();
    });

    it('should return true for hasLayout with group name', () => {
      const resolver = createLayoutResolver({
        layoutsDir: join(TEST_DIR, 'app/layouts'),
        pagesDir: join(TEST_DIR, 'app/pages'),
      });

      expect(resolver.hasLayout('auth')).toBe(true);
      expect(resolver.hasLayout('dashboard')).toBe(true);
      expect(resolver.hasLayout('nonexistent')).toBe(false);
    });
  });

  describe('segment layout resolution', () => {
    beforeAll(() => {
      // Create segment layouts
      mkdirSync(join(PAGES_DIR, 'users'), { recursive: true });
      mkdirSync(join(PAGES_DIR, 'users/profile'), { recursive: true });
      writeFileSync(
        join(PAGES_DIR, '_layout.tsx'),
        'export default function RootSegmentLayout() {}'
      );
      writeFileSync(
        join(PAGES_DIR, 'users/_layout.tsx'),
        'export default function UsersLayout() {}'
      );
    });

    afterAll(() => {
      rmSync(join(PAGES_DIR, '_layout.tsx'), { force: true });
      rmSync(join(PAGES_DIR, 'users'), { recursive: true, force: true });
    });

    it('should resolve segment layouts from page directory hierarchy', () => {
      const resolver = createLayoutResolver({
        layoutsDir: join(TEST_DIR, 'app/layouts'),
        pagesDir: join(TEST_DIR, 'app/pages'),
      });

      const route: ParsedRoute = {
        filePath: 'users/profile/index.tsx',
        pattern: '/users/profile',
        params: [],
        catchAll: false,
      };

      const chain = resolver.resolve(route);

      expect(chain.segmentLayouts).toContain('_layout.tsx');
      expect(chain.segmentLayouts).toContain('users/_layout.tsx');
    });

    it('should order segment layouts from root to leaf', () => {
      const resolver = createLayoutResolver({
        layoutsDir: join(TEST_DIR, 'app/layouts'),
        pagesDir: join(TEST_DIR, 'app/pages'),
      });

      const route: ParsedRoute = {
        filePath: 'users/profile/index.tsx',
        pattern: '/users/profile',
        params: [],
        catchAll: false,
      };

      const chain = resolver.resolve(route);

      const rootIndex = chain.segmentLayouts.indexOf('_layout.tsx');
      const usersIndex = chain.segmentLayouts.indexOf('users/_layout.tsx');

      expect(rootIndex).toBeLessThan(usersIndex);
    });
  });

  describe('combined layout chain', () => {
    beforeAll(() => {
      // Create all layout types
      writeFileSync(join(LAYOUTS_DIR, 'root.tsx'), 'export default function RootLayout() {}');
      writeFileSync(join(LAYOUTS_DIR, 'admin.tsx'), 'export default function AdminLayout() {}');
      writeFileSync(join(LAYOUTS_DIR, 'auth.tsx'), 'export default function AuthLayout() {}');
      writeFileSync(
        join(LAYOUTS_DIR, 'dashboard.tsx'),
        'export default function DashboardLayout() {}'
      );
      mkdirSync(join(PAGES_DIR, '(admin)/settings'), { recursive: true });
      writeFileSync(
        join(PAGES_DIR, '(admin)/_layout.tsx'),
        'export default function AdminSegmentLayout() {}'
      );
    });

    afterAll(() => {
      rmSync(join(LAYOUTS_DIR, 'root.tsx'), { force: true });
      rmSync(join(LAYOUTS_DIR, 'admin.tsx'), { force: true });
      rmSync(join(LAYOUTS_DIR, 'auth.tsx'), { force: true });
      rmSync(join(LAYOUTS_DIR, 'dashboard.tsx'), { force: true });
      rmSync(join(PAGES_DIR, '(admin)'), { recursive: true, force: true });
    });

    it('should resolve complete layout chain in correct order', () => {
      const resolver = createLayoutResolver({
        layoutsDir: join(TEST_DIR, 'app/layouts'),
        pagesDir: join(TEST_DIR, 'app/pages'),
      });

      const route: ParsedRoute = {
        filePath: '(admin)/settings/index.tsx',
        pattern: '/settings',
        params: [],
        catchAll: false,
        groups: ['admin'],
      };

      const chain = resolver.resolve(route);

      // Root layout should come first
      expect(chain.layouts[0]).toBe('root.tsx');

      // Group layout should come second
      expect(chain.layouts[1]).toBe('admin.tsx');

      // All layouts should be present
      expect(chain.rootLayout).toBe('root.tsx');
      expect(chain.groupLayouts).toEqual(['admin.tsx']);
    });

    it('should resolve multiple group layouts in order', () => {
      const resolver = createLayoutResolver({
        layoutsDir: join(TEST_DIR, 'app/layouts'),
        pagesDir: join(TEST_DIR, 'app/pages'),
      });

      const route: ParsedRoute = {
        filePath: '(auth)/(dashboard)/settings.tsx',
        pattern: '/settings',
        params: [],
        catchAll: false,
        groups: ['auth', 'dashboard'],
      };

      const chain = resolver.resolve(route);

      // Root layout first, then both group layouts in order
      expect(chain.layouts[0]).toBe('root.tsx');
      expect(chain.layouts[1]).toBe('auth.tsx');
      expect(chain.layouts[2]).toBe('dashboard.tsx');
      expect(chain.groupLayouts).toEqual(['auth.tsx', 'dashboard.tsx']);
    });
  });

  describe('no layouts scenario', () => {
    it('should return empty chain when no layouts exist', () => {
      const resolver = createLayoutResolver({
        layoutsDir: join(TEST_DIR, 'nonexistent/layouts'),
        pagesDir: join(TEST_DIR, 'nonexistent/pages'),
      });

      const route: ParsedRoute = {
        filePath: 'index.tsx',
        pattern: '/',
        params: [],
        catchAll: false,
      };

      const chain = resolver.resolve(route);

      expect(chain.layouts).toEqual([]);
      expect(chain.rootLayout).toBeUndefined();
      expect(chain.groupLayouts).toBeUndefined();
      expect(chain.segmentLayouts).toEqual([]);
    });

    it('should return empty array from getLayouts()', () => {
      const resolver = createLayoutResolver({
        layoutsDir: join(TEST_DIR, 'nonexistent/layouts'),
        pagesDir: join(TEST_DIR, 'nonexistent/pages'),
      });

      expect(resolver.getLayouts()).toEqual([]);
    });

    it('should return false for hasLayout()', () => {
      const resolver = createLayoutResolver({
        layoutsDir: join(TEST_DIR, 'nonexistent/layouts'),
        pagesDir: join(TEST_DIR, 'nonexistent/pages'),
      });

      expect(resolver.hasLayout('root')).toBe(false);
      expect(resolver.hasLayout('anything')).toBe(false);
    });
  });

  describe('extension handling', () => {
    beforeAll(() => {
      writeFileSync(join(LAYOUTS_DIR, 'jsx-layout.jsx'), 'export default function JsxLayout() {}');
      writeFileSync(join(LAYOUTS_DIR, 'ts-layout.ts'), 'export default function TsLayout() {}');
    });

    afterAll(() => {
      rmSync(join(LAYOUTS_DIR, 'jsx-layout.jsx'), { force: true });
      rmSync(join(LAYOUTS_DIR, 'ts-layout.ts'), { force: true });
    });

    it('should recognize .jsx files', () => {
      const resolver = createLayoutResolver({
        layoutsDir: join(TEST_DIR, 'app/layouts'),
        pagesDir: join(TEST_DIR, 'app/pages'),
      });

      expect(resolver.hasLayout('jsx-layout')).toBe(true);
    });

    it('should recognize .ts files', () => {
      const resolver = createLayoutResolver({
        layoutsDir: join(TEST_DIR, 'app/layouts'),
        pagesDir: join(TEST_DIR, 'app/pages'),
      });

      expect(resolver.hasLayout('ts-layout')).toBe(true);
    });

    it('should respect custom extensions option', () => {
      const resolver = createLayoutResolver({
        layoutsDir: join(TEST_DIR, 'app/layouts'),
        pagesDir: join(TEST_DIR, 'app/pages'),
        extensions: ['.tsx'], // Only .tsx
      });

      // .jsx should not be found with .tsx only extension
      expect(resolver.hasLayout('jsx-layout')).toBe(false);
    });
  });
});

describe('wrapWithLayouts', () => {
  it('should return original element when no layouts provided', () => {
    const pageElement = {
      type: 'div',
      props: { children: 'Page' },
      key: null,
    } as React.ReactElement;

    const result = wrapWithLayouts(pageElement, []);

    expect(result).toBe(pageElement);
  });

  it('should wrap with single layout', () => {
    const pageElement = {
      type: 'div',
      props: { children: 'Page' },
      key: null,
    } as React.ReactElement;
    const Layout = ({ children }: { children: React.ReactNode }) => children;

    const result = wrapWithLayouts(pageElement, [Layout]);

    expect(result.type).toBe(Layout);
    expect(result.props.children).toBe(pageElement);
  });

  it('should wrap with multiple layouts in correct order', () => {
    const pageElement = {
      type: 'div',
      props: { children: 'Page' },
      key: null,
    } as React.ReactElement;
    const OuterLayout = ({ children }: { children: React.ReactNode }) => children;
    const InnerLayout = ({ children }: { children: React.ReactNode }) => children;

    const result = wrapWithLayouts(pageElement, [OuterLayout, InnerLayout]);

    // Outer should be the outermost wrapper
    expect(result.type).toBe(OuterLayout);
    // Inner should wrap the page
    expect(result.props.children.type).toBe(InnerLayout);
    // Page should be innermost
    expect(result.props.children.props.children).toBe(pageElement);
  });

  it('should pass params to layouts', () => {
    const pageElement = {
      type: 'div',
      props: { children: 'Page' },
      key: null,
    } as React.ReactElement;
    const Layout = ({
      children,
      params: _params,
    }: {
      children: React.ReactNode;
      params?: Record<string, string>;
    }) => children;
    const testParams = { id: '123' };

    const result = wrapWithLayouts(pageElement, [Layout], testParams);

    expect(result.props.params).toEqual(testParams);
  });

  it('should handle undefined params', () => {
    const pageElement = {
      type: 'div',
      props: { children: 'Page' },
      key: null,
    } as React.ReactElement;
    const Layout = ({ children }: { children: React.ReactNode; params?: Record<string, string> }) =>
      children;

    const result = wrapWithLayouts(pageElement, [Layout], undefined);

    expect(result.props.params).toBeUndefined();
  });

  it('should handle empty params object', () => {
    const pageElement = {
      type: 'div',
      props: { children: 'Page' },
      key: null,
    } as React.ReactElement;
    const Layout = ({ children }: { children: React.ReactNode; params?: Record<string, string> }) =>
      children;

    const result = wrapWithLayouts(pageElement, [Layout], {});

    expect(result.props.params).toEqual({});
  });

  it('should create unique keys for each layout', () => {
    const pageElement = {
      type: 'div',
      props: { children: 'Page' },
      key: null,
    } as React.ReactElement;
    const Layout1 = ({ children }: { children: React.ReactNode }) => children;
    const Layout2 = ({ children }: { children: React.ReactNode }) => children;
    const Layout3 = ({ children }: { children: React.ReactNode }) => children;

    const result = wrapWithLayouts(pageElement, [Layout1, Layout2, Layout3]);

    // Check that keys are present and unique
    expect(result.key).toBe('layout-0');
    expect(result.props.children.key).toBe('layout-1');
    expect(result.props.children.props.children.key).toBe('layout-2');
  });

  it('should handle large layout chains (10+ layouts)', () => {
    const pageElement = {
      type: 'div',
      props: { children: 'Page' },
      key: null,
    } as React.ReactElement;

    // Create 15 layouts
    const layouts = Array.from({ length: 15 }, () => {
      return ({ children }: { children: React.ReactNode }) => children;
    });

    const result = wrapWithLayouts(pageElement, layouts);

    // Outer should be the first layout
    expect(result.type).toBe(layouts[0]);

    // Walk down to verify nesting
    let current = result;
    for (let i = 1; i < layouts.length; i++) {
      current = current.props.children;
      expect(current.type).toBe(layouts[i]);
    }

    // Innermost should be the page
    expect(current.props.children).toBe(pageElement);
  });

  it('should preserve all params through nested layouts', () => {
    const pageElement = {
      type: 'div',
      props: { children: 'Page' },
      key: null,
    } as React.ReactElement;

    const Layout1 = ({
      children,
    }: {
      children: React.ReactNode;
      params?: Record<string, string>;
    }) => children;
    const Layout2 = ({
      children,
    }: {
      children: React.ReactNode;
      params?: Record<string, string>;
    }) => children;
    const Layout3 = ({
      children,
    }: {
      children: React.ReactNode;
      params?: Record<string, string>;
    }) => children;

    const testParams = { id: '123', slug: 'test-post', category: 'tech' };

    const result = wrapWithLayouts(pageElement, [Layout1, Layout2, Layout3], testParams);

    // All layouts should receive the same params
    expect(result.props.params).toEqual(testParams);
    expect(result.props.children.props.params).toEqual(testParams);
    expect(result.props.children.props.children.props.params).toEqual(testParams);
  });
});

describe('per-route layout configuration', () => {
  beforeAll(() => {
    // Create layouts for testing
    mkdirSync(LAYOUTS_DIR, { recursive: true });
    writeFileSync(join(LAYOUTS_DIR, 'root.tsx'), 'export default function RootLayout() {}');
    writeFileSync(join(LAYOUTS_DIR, 'admin.tsx'), 'export default function AdminLayout() {}');
    writeFileSync(join(LAYOUTS_DIR, 'minimal.tsx'), 'export default function MinimalLayout() {}');
    writeFileSync(join(LAYOUTS_DIR, 'sidebar.tsx'), 'export default function SidebarLayout() {}');
  });

  afterAll(() => {
    rmSync(join(LAYOUTS_DIR, 'root.tsx'), { force: true });
    rmSync(join(LAYOUTS_DIR, 'admin.tsx'), { force: true });
    rmSync(join(LAYOUTS_DIR, 'minimal.tsx'), { force: true });
    rmSync(join(LAYOUTS_DIR, 'sidebar.tsx'), { force: true });
  });

  describe('replace mode', () => {
    it('should replace all inherited layouts with page-specified layouts', () => {
      const resolver = createLayoutResolver({
        layoutsDir: join(TEST_DIR, 'app/layouts'),
        pagesDir: join(TEST_DIR, 'app/pages'),
      });

      const route: ParsedRoute = {
        filePath: 'admin/dashboard.tsx',
        pattern: '/admin/dashboard',
        params: [],
        catchAll: false,
        layoutConfig: {
          layouts: ['minimal.tsx'],
          mode: 'replace',
        },
      };

      const chain = resolver.resolve(route);

      // Should only have the page-specified layout
      expect(chain.layouts).toEqual(['minimal.tsx']);
      expect(chain.pageLayouts).toEqual(['minimal.tsx']);
      expect(chain.layoutMode).toBe('replace');
    });

    it('should return empty layouts when replace mode with empty array', () => {
      const resolver = createLayoutResolver({
        layoutsDir: join(TEST_DIR, 'app/layouts'),
        pagesDir: join(TEST_DIR, 'app/pages'),
      });

      const route: ParsedRoute = {
        filePath: 'print/invoice.tsx',
        pattern: '/print/invoice',
        params: [],
        catchAll: false,
        layoutConfig: {
          layouts: [],
          mode: 'replace',
        },
      };

      const chain = resolver.resolve(route);

      // No layouts at all (for print-friendly pages)
      expect(chain.layouts).toEqual([]);
      expect(chain.layoutMode).toBe('replace');
    });
  });

  describe('prepend mode', () => {
    it('should add page layouts before inherited layouts', () => {
      const resolver = createLayoutResolver({
        layoutsDir: join(TEST_DIR, 'app/layouts'),
        pagesDir: join(TEST_DIR, 'app/pages'),
      });

      const route: ParsedRoute = {
        filePath: 'dashboard.tsx',
        pattern: '/dashboard',
        params: [],
        catchAll: false,
        layoutConfig: {
          layouts: ['admin.tsx'],
          mode: 'prepend',
        },
      };

      const chain = resolver.resolve(route);

      // Admin layout first, then root layout
      expect(chain.layouts[0]).toBe('admin.tsx');
      expect(chain.layouts[1]).toBe('root.tsx');
      expect(chain.pageLayouts).toEqual(['admin.tsx']);
      expect(chain.layoutMode).toBe('prepend');
    });
  });

  describe('append mode', () => {
    it('should add page layouts after inherited layouts', () => {
      const resolver = createLayoutResolver({
        layoutsDir: join(TEST_DIR, 'app/layouts'),
        pagesDir: join(TEST_DIR, 'app/pages'),
      });

      const route: ParsedRoute = {
        filePath: 'dashboard.tsx',
        pattern: '/dashboard',
        params: [],
        catchAll: false,
        layoutConfig: {
          layouts: ['sidebar.tsx'],
          mode: 'append',
        },
      };

      const chain = resolver.resolve(route);

      // Root layout first, then sidebar layout
      expect(chain.layouts[0]).toBe('root.tsx');
      expect(chain.layouts[1]).toBe('sidebar.tsx');
      expect(chain.pageLayouts).toEqual(['sidebar.tsx']);
      expect(chain.layoutMode).toBe('append');
    });

    it('should add multiple page layouts after inherited layouts', () => {
      const resolver = createLayoutResolver({
        layoutsDir: join(TEST_DIR, 'app/layouts'),
        pagesDir: join(TEST_DIR, 'app/pages'),
      });

      const route: ParsedRoute = {
        filePath: 'dashboard.tsx',
        pattern: '/dashboard',
        params: [],
        catchAll: false,
        layoutConfig: {
          layouts: ['admin.tsx', 'sidebar.tsx'],
          mode: 'append',
        },
      };

      const chain = resolver.resolve(route);

      // Root layout first, then admin, then sidebar
      expect(chain.layouts).toEqual(['root.tsx', 'admin.tsx', 'sidebar.tsx']);
      expect(chain.pageLayouts).toEqual(['admin.tsx', 'sidebar.tsx']);
    });
  });

  describe('inherit mode (default)', () => {
    it('should use inherited layouts when mode is inherit', () => {
      const resolver = createLayoutResolver({
        layoutsDir: join(TEST_DIR, 'app/layouts'),
        pagesDir: join(TEST_DIR, 'app/pages'),
      });

      const route: ParsedRoute = {
        filePath: 'page.tsx',
        pattern: '/page',
        params: [],
        catchAll: false,
        layoutConfig: {
          layouts: ['sidebar.tsx'],
          mode: 'inherit',
        },
      };

      const chain = resolver.resolve(route);

      // Should use inherited layouts, ignoring page layouts
      expect(chain.layouts).toEqual(['root.tsx']);
      expect(chain.layoutMode).toBe('inherit');
    });

    it('should default to inherit mode when mode is not specified', () => {
      const resolver = createLayoutResolver({
        layoutsDir: join(TEST_DIR, 'app/layouts'),
        pagesDir: join(TEST_DIR, 'app/pages'),
      });

      const route: ParsedRoute = {
        filePath: 'page.tsx',
        pattern: '/page',
        params: [],
        catchAll: false,
        // No layoutConfig means inherit mode
      };

      const chain = resolver.resolve(route);

      expect(chain.layouts).toEqual(['root.tsx']);
      expect(chain.layoutMode).toBeUndefined();
    });
  });

  describe('combination with route groups', () => {
    beforeAll(() => {
      writeFileSync(join(LAYOUTS_DIR, 'auth.tsx'), 'export default function AuthLayout() {}');
    });

    afterAll(() => {
      rmSync(join(LAYOUTS_DIR, 'auth.tsx'), { force: true });
    });

    it('should replace group layouts when using replace mode', () => {
      const resolver = createLayoutResolver({
        layoutsDir: join(TEST_DIR, 'app/layouts'),
        pagesDir: join(TEST_DIR, 'app/pages'),
      });

      const route: ParsedRoute = {
        filePath: '(auth)/login.tsx',
        pattern: '/login',
        params: [],
        catchAll: false,
        groups: ['auth'],
        layoutConfig: {
          layouts: ['minimal.tsx'],
          mode: 'replace',
        },
      };

      const chain = resolver.resolve(route);

      // Should replace root+auth with just minimal
      expect(chain.layouts).toEqual(['minimal.tsx']);
      expect(chain.rootLayout).toBe('root.tsx'); // Still tracked for reference
      expect(chain.groupLayouts).toEqual(['auth.tsx']); // Still tracked for reference
    });

    it('should append to group layouts when using append mode', () => {
      const resolver = createLayoutResolver({
        layoutsDir: join(TEST_DIR, 'app/layouts'),
        pagesDir: join(TEST_DIR, 'app/pages'),
      });

      const route: ParsedRoute = {
        filePath: '(auth)/settings.tsx',
        pattern: '/settings',
        params: [],
        catchAll: false,
        groups: ['auth'],
        layoutConfig: {
          layouts: ['sidebar.tsx'],
          mode: 'append',
        },
      };

      const chain = resolver.resolve(route);

      // Root, then auth (from group), then sidebar (appended)
      expect(chain.layouts).toEqual(['root.tsx', 'auth.tsx', 'sidebar.tsx']);
    });
  });
});
