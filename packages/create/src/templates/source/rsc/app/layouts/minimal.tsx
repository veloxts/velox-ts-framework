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
        <link rel="stylesheet" href="/_build/styles.css" />
      </head>
      <body className="minimal-layout">
        {children}
        <script src="/_build/entry.client.js" type="module" />
      </body>
    </html>
  );
}
