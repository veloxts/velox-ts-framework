/**
 * Document Component
 *
 * Provides the HTML wrapper for server-rendered React applications.
 * This is an async Server Component that can fetch metadata.
 *
 * @module @veloxts/web/rendering/document
 */

import type { ReactElement } from 'react';

import type { DocumentProps } from '../types.js';

/**
 * Default Document component for VeloxTS applications.
 *
 * Renders the HTML structure with:
 * - DOCTYPE and html/head/body tags
 * - Meta tags for charset, viewport
 * - Bootstrap scripts for client hydration
 * - Initial data serialization for hydration
 *
 * This is an async Server Component, enabling metadata fetching
 * before rendering the document.
 *
 * @param props - Document properties
 * @returns JSX element for the HTML document
 *
 * @example
 * ```tsx
 * import { Document } from '@veloxts/web/rendering';
 *
 * <Document scripts={['/build/client.js']}>
 *   <App />
 * </Document>
 * ```
 *
 * @example
 * ```tsx
 * // With custom head content and initial data
 * <Document
 *   head={<title>My App</title>}
 *   scripts={['/_build/client.js']}
 *   initialData={{ user: { id: '1', name: 'John' } }}
 * >
 *   <App />
 * </Document>
 * ```
 */
export async function Document({
  head,
  children,
  scripts = [],
  initialData,
  lang = 'en',
}: DocumentProps): Promise<ReactElement> {
  return (
    <html lang={lang}>
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {head}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              /* Prevent flash of unstyled content */
              body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
              #root { min-height: 100vh; }
            `,
          }}
        />
      </head>
      <body>
        <div id="root">{children}</div>

        {/* Serialize initial data for client-side hydration - data escaped via serializeInitialData() */}
        {initialData !== undefined && (
          <script
            id="__velox_data__"
            type="application/json"
            dangerouslySetInnerHTML={{
              __html: serializeInitialData(initialData),
            }}
          />
        )}

        {/* Bootstrap scripts for client hydration */}
        {scripts.map((src) => (
          <script key={src} src={src} type="module" async />
        ))}
      </body>
    </html>
  );
}

/**
 * Serializes initial data for safe JSON embedding in HTML.
 * Escapes script-terminating sequences to prevent XSS.
 *
 * @param data - Data to serialize
 * @returns Safe JSON string
 */
function serializeInitialData(data: unknown): string {
  const json = JSON.stringify(data);
  // Escape script-terminating sequences for safe embedding in script tags
  return json.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

/**
 * Default export for convenience
 */
export default Document;
