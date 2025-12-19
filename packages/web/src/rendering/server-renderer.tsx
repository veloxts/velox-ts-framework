/**
 * Server-Side Renderer for React Server Components
 *
 * Implements streaming RSC using React's renderToPipeableStream.
 * This module handles the server-side rendering of pages and
 * streams HTML responses to the browser.
 *
 * @module @veloxts/web/rendering/server-renderer
 */

import { PassThrough, type Readable } from 'node:stream';

import { renderToPipeableStream } from 'react-dom/server';

import type { PageProps, RouteMatch } from '../types.js';
import { Document } from './document.js';

/**
 * Page component type with props
 */
type PageComponent = React.ComponentType<PageProps>;

/**
 * Options for server rendering
 */
export interface RenderToStreamOptions {
  /**
   * Bootstrap scripts to include for client hydration
   * @default ['/_build/client.js']
   */
  bootstrapScripts?: string[];

  /**
   * Custom Document component
   */
  DocumentComponent?: typeof Document;

  /**
   * Initial data to pass to client for hydration
   */
  initialData?: unknown;

  /**
   * Custom head content (title, meta tags, etc.)
   */
  head?: React.ReactNode;

  /**
   * Error handler for render errors
   */
  onError?: (error: Error) => void;

  /**
   * Timeout for shell rendering in milliseconds
   * @default 10000
   */
  shellTimeout?: number;

  /**
   * Function to resolve page component from file path
   * If not provided, uses dynamic import
   */
  resolveComponent?: (filePath: string) => Promise<PageComponent>;
}

/**
 * Renders a matched route to a streaming HTML response.
 *
 * This function:
 * 1. Dynamically imports the page component
 * 2. Wraps it in the Document component
 * 3. Renders using React's renderToPipeableStream
 * 4. Returns a streaming Response with HTML
 *
 * Supports async Server Components that can access backend resources.
 *
 * @param match - The matched route with params
 * @param request - The incoming HTTP request
 * @param options - Rendering options
 * @returns Streaming HTML response
 *
 * @example
 * ```typescript
 * // In your SSR router handler
 * export default createSsrRouter({
 *   resolveRoute: (path) => fileRouter.match(path),
 *   render: async (match, request) => {
 *     return renderToStream(match, request, {
 *       bootstrapScripts: ['/_build/client.js'],
 *     });
 *   },
 * });
 * ```
 */
export async function renderToStream(
  match: RouteMatch,
  request: Request,
  options: RenderToStreamOptions = {}
): Promise<Response> {
  const {
    bootstrapScripts = ['/_build/client.js'],
    DocumentComponent = Document,
    initialData,
    head,
    onError = defaultErrorHandler,
    shellTimeout = 10000,
    resolveComponent,
  } = options;

  try {
    // Extract search params from request URL
    const url = new URL(request.url);
    const searchParams = Object.fromEntries(url.searchParams.entries());

    // Dynamically import the page component
    const PageComponent = resolveComponent
      ? await resolveComponent(match.route.filePath)
      : await importPageComponent(match.route.filePath);

    if (!PageComponent) {
      throw new Error(`Page component not found: ${match.route.filePath}`);
    }

    // Prepare props for the page component
    const pageProps = {
      params: match.params,
      searchParams,
    };

    // Create the React element tree
    const app = (
      <DocumentComponent head={head} scripts={bootstrapScripts} initialData={initialData}>
        <PageComponent {...pageProps} />
      </DocumentComponent>
    );

    // Create a streaming response
    return await createStreamingResponse(app, {
      bootstrapScripts,
      shellTimeout,
      onError,
    });
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
    return createErrorResponse(error);
  }
}

/**
 * Creates a streaming HTTP response from a React element.
 *
 * @param element - React element to render
 * @param options - Streaming options
 * @returns Streaming Response
 */
async function createStreamingResponse(
  element: React.ReactElement,
  options: {
    bootstrapScripts: string[];
    shellTimeout: number;
    onError: (error: Error) => void;
  }
): Promise<Response> {
  const { bootstrapScripts, shellTimeout, onError } = options;

  return new Promise((resolve, reject) => {
    let didError = false;
    let shellReady = false;
    let timeoutId: NodeJS.Timeout | undefined;

    // Create the pipeable stream
    const { pipe, abort } = renderToPipeableStream(element, {
      bootstrapScripts,
      onShellReady() {
        shellReady = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        // Create a PassThrough stream to pipe React's output
        const passThrough = new PassThrough();

        // Start piping React's output
        pipe(passThrough);

        // Convert Node.js stream to Web ReadableStream
        const webStream = nodeStreamToWebStream(passThrough);

        resolve(
          new Response(webStream, {
            status: didError ? 500 : 200,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Transfer-Encoding': 'chunked',
              'X-Content-Type-Options': 'nosniff',
            },
          })
        );
      },
      onShellError(error) {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        didError = true;
        onError(error instanceof Error ? error : new Error(String(error)));
        reject(error);
      },
      onError(error) {
        didError = true;
        onError(error instanceof Error ? error : new Error(String(error)));
      },
    });

    // Set shell timeout
    timeoutId = setTimeout(() => {
      if (!shellReady) {
        abort();
        const timeoutError = new Error(`Shell render timeout after ${shellTimeout}ms`);
        onError(timeoutError);
        reject(timeoutError);
      }
    }, shellTimeout);
  });
}

/**
 * Converts a Node.js readable stream to a Web ReadableStream.
 *
 * @param nodeStream - Node.js readable stream
 * @returns Web ReadableStream
 */
function nodeStreamToWebStream(nodeStream: Readable): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk: Buffer | string) => {
        const data = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
        controller.enqueue(new Uint8Array(data));
      });

      nodeStream.on('end', () => {
        controller.close();
      });

      nodeStream.on('error', (error) => {
        controller.error(error);
      });
    },
    cancel() {
      nodeStream.destroy();
    },
  });
}

/**
 * Dynamically imports a page component by file path.
 *
 * @param filePath - Path to the page component
 * @returns Page component
 */
async function importPageComponent(filePath: string): Promise<PageComponent> {
  // Convert file path to import path
  // Example: "users/[id].tsx" -> "./app/pages/users/[id]"
  const importPath = `./app/pages/${filePath.replace(/\.(tsx?|jsx?)$/, '')}`;

  try {
    const module = await import(importPath);
    const Component = module.default;

    if (!Component) {
      throw new Error(`No default export found in ${importPath}`);
    }

    return Component;
  } catch (error) {
    throw new Error(`Failed to import page component: ${importPath}`, {
      cause: error,
    });
  }
}

/**
 * Default error handler.
 */
function defaultErrorHandler(error: Error): void {
  console.error('[VeloxTS RSC Error]', error);
}

/**
 * Creates an error response for fatal render errors.
 *
 * @param error - The error that occurred
 * @returns Error Response
 */
function createErrorResponse(error: unknown): Response {
  const isDev = process.env.NODE_ENV !== 'production';
  const message = error instanceof Error ? error.message : String(error);
  const stack = isDev && error instanceof Error ? error.stack : undefined;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Server Error</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto; background: #fef2f2; }
    .container { background: white; border-radius: 8px; padding: 2rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    h1 { color: #dc2626; margin-top: 0; }
    pre { background: #f5f5f5; padding: 1rem; overflow-x: auto; border-radius: 4px; font-size: 0.875rem; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Server Render Error</h1>
    <p><strong>Message:</strong> ${escapeHtml(message)}</p>
    ${stack ? `<pre>${escapeHtml(stack)}</pre>` : ''}
    <p><a href="/">Back to home</a></p>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 500,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}

/**
 * Escapes HTML entities to prevent XSS.
 *
 * @param str - String to escape
 * @returns Escaped string
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
