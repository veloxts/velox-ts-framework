/**
 * Server Entry Point
 *
 * Handles server-side rendering of React Server Components.
 * Uses h3 event handler for Vinxi compatibility.
 */

import { PassThrough } from 'node:stream';

import type { ComponentType, ReactElement, ReactNode } from 'react';
import { renderToPipeableStream } from 'react-dom/server';

// Static imports for layout components
import DashboardLayout from '../app/layouts/dashboard.tsx';
import MarketingLayout from '../app/layouts/marketing.tsx';
import MinimalLayout from '../app/layouts/minimal.tsx';
import RootLayout from '../app/layouts/root.tsx';
// Static imports for page components
import NotFoundPage from '../app/pages/_not-found.tsx';
import LoginPage from '../app/pages/auth/login.tsx';
import RegisterPage from '../app/pages/auth/register.tsx';
import DashboardPage from '../app/pages/dashboard/index.tsx';
import HomePage from '../app/pages/index.tsx';
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
  regex: RegExp;
  paramNames: string[];
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
 */
function compileRoute(pattern: string): { regex: RegExp; paramNames: string[] } {
  const paramNames: string[] = [];

  const regexStr = pattern
    .replace(/\[\.\.\.(\w+)\]/g, (_, name) => {
      paramNames.push(name);
      return '___CATCH_ALL___';
    })
    .replace(/\[(\w+)\]/g, (_, name) => {
      paramNames.push(name);
      return '___DYNAMIC___';
    })
    .replace(/[.+?^${}()|\\]/g, '\\$&')
    .replace(/___CATCH_ALL___/g, '(.+)')
    .replace(/___DYNAMIC___/g, '([^/]+)');

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
 * Wraps a page element with its layout chain
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

// Route registry (order matters - more specific first)
const routes: RouteDefinition[] = [
  // Home
  defineRoute('/', HomePage, [RootLayout, MarketingLayout]),
  defineRoute('/index', HomePage, [RootLayout, MarketingLayout]),

  // Auth pages (minimal layout)
  defineRoute('/auth/login', LoginPage, [RootLayout, MinimalLayout]),
  defineRoute('/auth/register', RegisterPage, [RootLayout, MinimalLayout]),

  // Protected pages (dashboard layout)
  defineRoute('/dashboard', DashboardPage, [RootLayout, DashboardLayout]),

  // Public pages
  defineRoute('/users', UsersPage, [RootLayout, MarketingLayout]),
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
 */
function matchRoute(pathname: string): RouteMatch | null {
  console.log('[SSR] Matching:', pathname);

  for (const route of routes) {
    const match = pathname.match(route.regex);
    if (match) {
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

  const match = matchRoute(pathname);

  if (!match) {
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

  const pageProps: PageProps = {
    params,
    searchParams: parseSearchParams(url),
  };

  try {
    const pageElement = <PageComponent {...pageProps} />;
    const html = wrapWithLayouts(pageElement, layouts, params);

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
