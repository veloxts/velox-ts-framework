/**
 * Minimal Layout (Document Shell)
 *
 * A stripped-down layout for pages that need minimal chrome,
 * such as print-friendly pages, embedded widgets, or auth pages.
 *
 * This component provides the HTML document shell (server-only).
 * The actual content wrapper is in MinimalContent (shared with client).
 *
 * Architecture for proper hydration:
 * - Server renders: <MinimalLayout><Page /></MinimalLayout>
 *   Which produces: <html>...<div id="root"><MinimalContent><Page /></></div>...</html>
 * - Client hydrates #root with: <MinimalContent><Page /></MinimalContent>
 *   This ensures the React tree matches exactly.
 */

import type { ReactNode } from 'react';

import MinimalContent from './minimal-content.tsx';

interface MinimalLayoutProps {
  children: ReactNode;
  params?: Record<string, string>;
}

export default function MinimalLayout({ children }: MinimalLayoutProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>VeloxTS</title>
        <style>{`
          /* Global Reset & Dark Mode Base */
          *,
          *::before,
          *::after {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font: inherit;
          }

          html {
            font-size: 16px;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }

          body {
            background: #0a0a0a;
            color: #ededed;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
            line-height: 1.6;
            min-height: 100svh;
          }

          h1, h2, h3, h4, h5, h6 {
            text-wrap: balance;
          }

          p, li, figcaption {
            text-wrap: pretty;
          }

          a {
            color: #00d9ff;
            text-decoration: none;
            transition: opacity 0.2s;
          }

          a:hover {
            opacity: 0.8;
          }

          code {
            font-family: "SF Mono", "Fira Code", "Fira Mono", Menlo, Monaco, "Courier New", monospace;
            background: #1a1a1a;
            padding: 0.2em 0.4em;
            border-radius: 4px;
            font-size: 0.9em;
          }

          ::selection {
            background: #00d9ff;
            color: #000;
          }

          .minimal-body {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem;
          }

          .minimal-content {
            width: 100%;
            max-width: 450px;
          }
        `}</style>
      </head>
      <body className="minimal-body">
        <div id="root">
          <MinimalContent>{children}</MinimalContent>
        </div>
        <script src="/_build/src/entry.client.tsx" type="module" />
      </body>
    </html>
  );
}
