/**
 * Root Layout
 *
 * The root layout wraps all pages with common UI elements.
 * This is a Server Component that provides the HTML structure.
 */

import type { ReactNode } from 'react';

interface RootLayoutProps {
  children: ReactNode;
  params?: Record<string, string>;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>VeloxTS App</title>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
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

          .layout {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
          }

          .nav {
            background: #1a1a2e;
            padding: 1rem 2rem;
          }

          .nav-list {
            display: flex;
            gap: 2rem;
            list-style: none;
            max-width: 1200px;
            margin: 0 auto;
          }

          .nav-link {
            color: #e8e8e8;
            text-decoration: none;
            font-weight: 500;
            transition: color 0.2s;
          }

          .nav-link:hover {
            color: #6366f1;
          }

          .main {
            flex: 1;
            padding: 2rem;
            max-width: 1200px;
            margin: 0 auto;
            width: 100%;
          }

          .footer {
            background: #1a1a2e;
            color: #a8a8b8;
            text-align: center;
            padding: 1rem;
            font-size: 0.875rem;
          }

          /* Page styles */
          .home-page .hero {
            text-align: center;
            padding: 3rem 0;
          }

          .home-page h1 {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
          }

          .home-page .tagline {
            color: #666;
            font-size: 1.25rem;
          }

          .stats {
            display: flex;
            gap: 1rem;
            justify-content: center;
            margin: 2rem 0;
          }

          .stat-card {
            background: white;
            padding: 1.5rem 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            text-align: center;
          }

          .stat-value {
            display: block;
            font-size: 2rem;
            font-weight: 700;
            color: #6366f1;
          }

          .stat-label {
            color: #666;
            font-size: 0.875rem;
          }

          .features {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }

          .features h2 {
            margin-bottom: 1rem;
          }

          .features ul {
            list-style: none;
          }

          .features li {
            padding: 0.5rem 0;
            border-bottom: 1px solid #eee;
          }

          .features li:last-child {
            border-bottom: none;
          }

          .cta {
            text-align: center;
            margin-top: 2rem;
            color: #666;
          }

          code {
            background: #f0f0f0;
            padding: 0.2rem 0.4rem;
            border-radius: 4px;
            font-family: monospace;
          }

          /* Users page */
          .users-page h1 {
            margin-bottom: 1rem;
          }

          .empty-state {
            color: #666;
            padding: 2rem;
            text-align: center;
            background: white;
            border-radius: 8px;
          }

          .user-list {
            list-style: none;
            display: grid;
            gap: 1rem;
          }

          .user-card {
            background: white;
            padding: 1rem;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .user-name {
            font-weight: 600;
          }

          .user-email {
            color: #666;
          }
        `}</style>
      </head>
      <body>
        <div className="layout">
          <nav className="nav">
            <ul className="nav-list">
              <li>
                <a href="/" className="nav-link">
                  Home
                </a>
              </li>
              <li>
                <a href="/users" className="nav-link">
                  Users
                </a>
              </li>
              <li>
                <a href="/settings" className="nav-link">
                  Settings
                </a>
              </li>
              <li>
                <a href="/docs/getting-started" className="nav-link">
                  Docs
                </a>
              </li>
              <li>
                <a href="/api/health" className="nav-link">
                  API
                </a>
              </li>
            </ul>
          </nav>

          <main className="main">{children}</main>

          <footer className="footer">Built with VeloxTS &bull; React Server Components</footer>
        </div>
        <script src="/_build/src/entry.client.tsx" type="module" />
      </body>
    </html>
  );
}
