/**
 * Minimal Layout
 *
 * A stripped-down layout for pages that need minimal chrome,
 * such as print-friendly pages, embedded widgets, or auth pages.
 */

import type { ReactNode } from 'react';

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
          .minimal-layout {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
        `}</style>
      </head>
      <body className="minimal-layout">
        <div id="root">{children}</div>
        <script src="/_build/src/entry.client.tsx" type="module" />
      </body>
    </html>
  );
}
