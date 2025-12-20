/**
 * Server Entry Point
 *
 * Handles server-side rendering of React Server Components.
 * Uses h3 event handler for Vinxi compatibility.
 */

import type { ComponentType } from 'react';

import { renderToPipeableStream } from 'react-dom/server';
import { PassThrough } from 'node:stream';

// Static imports for page components (using .tsx extension for Vite)
import HomePage from '../app/pages/index.tsx';
import UsersPage from '../app/pages/users.tsx';

// Page registry
const pages: Record<string, ComponentType<PageProps>> = {
  '/': HomePage,
  '/index': HomePage,
  '/users': UsersPage,
};

console.log('[SSR] Available pages:', Object.keys(pages));

// Page props type
interface PageProps {
  params: Record<string, string>;
  searchParams: Record<string, string | string[]>;
}

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

// Resolve page component from path
function getPageComponent(pathname: string): ComponentType<PageProps> | null {
  console.log('[SSR] Looking for:', pathname);
  return pages[pathname] || null;
}

/**
 * H3-compatible SSR handler for Vinxi
 */
export default async function ssrHandler(event: H3Event): Promise<void> {
  const res = event.node.res;
  const pathname = new URL(event.node.req.url || '/', 'http://localhost').pathname;

  console.log('[SSR] Handling:', pathname);

  // Get page component
  const PageComponent = getPageComponent(pathname);

  if (!PageComponent) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html');
    res.end(`<!DOCTYPE html><html><body><h1>404 - Page Not Found</h1><p>Path: ${pathname}</p></body></html>`);
    return;
  }

  // Prepare page props
  const pageProps: PageProps = {
    params: {},
    searchParams: {},
  };

  try {
    // Create the page element
    const pageElement = <PageComponent {...pageProps} />;

    // Wrap in HTML document
    const html = (
      <html lang="en">
        <head>
          <meta charSet="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>VeloxTS RSC</title>
        </head>
        <body>
          <div id="root">{pageElement}</div>
          <script src="/_build/entry.client.js" type="module" />
        </body>
      </html>
    );

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
    res.end(`<h1>Server Error</h1><pre>${error instanceof Error ? error.stack : String(error)}</pre>`);
  }
}
