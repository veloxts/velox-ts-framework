/**
 * Server Entry Point
 *
 * Handles server-side rendering of React Server Components.
 * Uses h3 event handler for Vinxi compatibility.
 * Supports dynamic routes with [param] and [...catchAll] patterns.
 */

import { PassThrough } from 'node:stream';

import type { ComponentType, ReactElement, ReactNode } from 'react';
import { renderToPipeableStream } from 'react-dom/server';

import DashboardLayout from '../app/layouts/dashboard.tsx';
import MarketingLayout from '../app/layouts/marketing.tsx';
import MinimalLayout from '../app/layouts/minimal.tsx';
// Static imports for layout components
import RootLayout from '../app/layouts/root.tsx';
import NotFoundPage from '../app/pages/_not-found.tsx';
import ProfilePage from '../app/pages/(dashboard)/profile.tsx';
import SettingsPage from '../app/pages/(dashboard)/settings.tsx';
import AboutPage from '../app/pages/(marketing)/about.tsx';
import DocsPage from '../app/pages/docs/[...slug].tsx';
// Static imports for page components (using .tsx extension for Vite)
import HomePage from '../app/pages/index.tsx';
import PrintPage from '../app/pages/print.tsx';
import UsersLayout from '../app/pages/users/_layout.tsx';
import PostDetailPage from '../app/pages/users/[id]/posts/[postId].tsx';
import UserPostsPage from '../app/pages/users/[id]/posts/index.tsx';
import NewPostPage from '../app/pages/users/[id]/posts/new.tsx';
import UserDetailPage from '../app/pages/users/[id].tsx';
import UsersPage from '../app/pages/users.tsx';

// Page props type
interface PageProps {
  params: Record<string, string>;
  searchParams: Record<string, string | string[]>;
}

// Layout props type
interface LayoutProps {
  children: ReactNode;
  params: Record<string, string>;
}

type LayoutComponent = ComponentType<LayoutProps>;

// Route definition with pattern matching
interface RouteDefinition {
  pattern: string;
  component: ComponentType<PageProps>;
  // Compiled regex and param names for matching
  regex: RegExp;
  paramNames: string[];
  // Layout chain for this route (outermost first)
  layouts: LayoutComponent[];
}

// Route match result
interface RouteMatch {
  component: ComponentType<PageProps>;
  params: Record<string, string>;
  layouts: LayoutComponent[];
}

/**
 * Compiles a file-based route pattern into a regex
 * Supports:
 *   - Static segments: /users -> matches exactly /users
 *   - Dynamic segments: /users/[id] -> matches /users/123, extracts id=123
 *   - Catch-all: /posts/[...slug] -> matches /posts/a/b/c, extracts slug=a/b/c
 */
function compileRoute(pattern: string): { regex: RegExp; paramNames: string[] } {
  const paramNames: string[] = [];

  // Process pattern replacements BEFORE escaping to preserve [...] and [] syntax
  const regexStr = pattern
    // Handle catch-all [...param] first (before escaping dots)
    .replace(/\[\.\.\.(\w+)\]/g, (_, name) => {
      paramNames.push(name);
      return '___CATCH_ALL___';
    })
    // Handle dynamic [param]
    .replace(/\[(\w+)\]/g, (_, name) => {
      paramNames.push(name);
      return '___DYNAMIC___';
    })
    // Now escape special regex chars
    .replace(/[.+?^${}()|\\]/g, '\\$&')
    // Restore placeholders with actual regex patterns
    .replace(/___CATCH_ALL___/g, '(.+)')
    .replace(/___DYNAMIC___/g, '([^/]+)');

  // Exact match
  const regex = new RegExp(`^${regexStr}$`);
  return { regex, paramNames };
}

/**
 * Creates a route definition from pattern and component
 */
function defineRoute(
  pattern: string,
  component: ComponentType<PageProps>,
  layouts: LayoutComponent[] = [RootLayout]
): RouteDefinition {
  const { regex, paramNames } = compileRoute(pattern);
  return { pattern, component, regex, paramNames, layouts };
}

/**
 * Wraps a page element with its layout chain.
 * Layouts are applied from outermost (root) to innermost.
 * Uses reduceRight to build the nested component tree.
 */
function wrapWithLayouts(
  pageElement: ReactElement,
  layouts: LayoutComponent[],
  params: Record<string, string>
): ReactElement {
  return layouts.reduceRight(
    (children, Layout) => (
      <Layout key={Layout.name || Layout.displayName || 'layout'} params={params}>
        {children}
      </Layout>
    ),
    pageElement
  );
}

// Route registry with patterns (order matters - more specific first)
const routes: RouteDefinition[] = [
  // Home
  defineRoute('/', HomePage),
  defineRoute('/index', HomePage),

  // Users section (with segment layout)
  defineRoute('/users', UsersPage, [RootLayout, UsersLayout]),
  // Static 'new' before dynamic [postId] for proper precedence
  defineRoute('/users/[id]/posts/new', NewPostPage, [RootLayout, UsersLayout]),
  defineRoute('/users/[id]/posts/[postId]', PostDetailPage, [RootLayout, UsersLayout]),
  defineRoute('/users/[id]/posts', UserPostsPage, [RootLayout, UsersLayout]),
  defineRoute('/users/[id]', UserDetailPage, [RootLayout, UsersLayout]),

  // Dashboard group pages (with dashboard layout)
  defineRoute('/settings', SettingsPage, [RootLayout, DashboardLayout]),
  defineRoute('/profile', ProfilePage, [RootLayout, DashboardLayout]),

  // Marketing group pages
  defineRoute('/about', AboutPage, [RootLayout, MarketingLayout]),

  // Documentation catch-all
  defineRoute('/docs/[...slug]', DocsPage),

  // Per-route layout override - uses MinimalLayout instead of RootLayout
  defineRoute('/print', PrintPage, [MinimalLayout]),
];

console.log(
  '[SSR] Available routes:',
  routes.map((r) => r.pattern)
);

// H3 event type for Vinxi
interface H3Event {
  node: {
    req: { url?: string };
    res: {
      statusCode?: number;
      setHeader: (name: string, value: string) => void;
      end: (data?: unknown) => void;
      write: (chunk: unknown) => boolean;
    };
  };
}

/**
 * Match a pathname against registered routes
 * Returns the matched component and extracted params
 */
function matchRoute(pathname: string): RouteMatch | null {
  console.log('[SSR] Matching:', pathname);

  for (const route of routes) {
    const match = pathname.match(route.regex);
    if (match) {
      // Extract params from capture groups
      const params: Record<string, string> = {};
      route.paramNames.forEach((name, index) => {
        params[name] = match[index + 1];
      });

      console.log('[SSR] Matched:', route.pattern, 'params:', params);
      return { component: route.component, params, layouts: route.layouts };
    }
  }

  return null;
}

/**
 * Parse search params from URL
 */
function parseSearchParams(url: URL): Record<string, string | string[]> {
  const searchParams: Record<string, string | string[]> = {};
  url.searchParams.forEach((value, key) => {
    const existing = searchParams[key];
    if (existing) {
      searchParams[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
    } else {
      searchParams[key] = value;
    }
  });
  return searchParams;
}

/**
 * H3-compatible SSR handler for Vinxi
 */
export default async function ssrHandler(event: H3Event): Promise<void> {
  const res = event.node.res;
  const url = new URL(event.node.req.url || '/', 'http://localhost');
  const pathname = url.pathname;

  console.log('[SSR] Handling:', pathname);

  // Match route and extract params
  const match = matchRoute(pathname);

  if (!match) {
    // Use the NotFoundPage component with RootLayout
    const pageProps: PageProps = {
      params: {},
      searchParams: parseSearchParams(url),
    };

    const notFoundElement = <NotFoundPage {...pageProps} />;
    const html = wrapWithLayouts(notFoundElement, [RootLayout], {});

    const passThrough = new PassThrough();
    const { pipe } = renderToPipeableStream(html, {
      onShellReady() {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        passThrough.on('data', (chunk) => res.write(chunk));
        passThrough.on('end', () => res.end());
        pipe(passThrough);
      },
      onShellError(error) {
        console.error('[SSR] 404 Shell error:', error);
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/html');
        res.end(
          `<!DOCTYPE html><html><body><h1>404 - Page Not Found</h1><p>Path: ${pathname}</p></body></html>`
        );
      },
    });
    return;
  }

  const { component: PageComponent, params, layouts } = match;

  // Prepare page props with extracted params and search params
  const pageProps: PageProps = {
    params,
    searchParams: parseSearchParams(url),
  };

  try {
    // Create the page element
    const pageElement = <PageComponent {...pageProps} />;

    // Wrap page with layout chain (layouts provide the HTML shell)
    const html = wrapWithLayouts(pageElement, layouts, params);

    // Stream the response
    const passThrough = new PassThrough();
    const { pipe } = renderToPipeableStream(html, {
      onShellReady() {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        passThrough.on('data', (chunk) => res.write(chunk));
        passThrough.on('end', () => res.end());
        pipe(passThrough);
      },
      onShellError(error) {
        console.error('[SSR] Shell error:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/html');
        res.end(`<h1>Render Error</h1><pre>${error}</pre>`);
      },
      onError(error) {
        console.error('[SSR] Render error:', error);
      },
    });
  } catch (error) {
    console.error('[SSR] Handler error:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/html');
    res.end(
      `<h1>Server Error</h1><pre>${error instanceof Error ? error.stack : String(error)}</pre>`
    );
  }
}
