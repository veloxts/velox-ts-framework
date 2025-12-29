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
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: system-ui, -apple-system, sans-serif;
            line-height: 1.6;
            color: #1a1a2e;
            background: #f8f9fa;
          }
          .minimal-body {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .minimal-content {
            width: 100%;
            max-width: 400px;
            padding: 2rem;
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
