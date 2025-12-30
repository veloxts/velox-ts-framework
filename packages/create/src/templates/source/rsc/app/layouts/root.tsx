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

          img, picture, svg, video, canvas {
            max-width: 100%;
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

          ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }

          ::-webkit-scrollbar-track {
            background: #111;
          }

          ::-webkit-scrollbar-thumb {
            background: #333;
            border-radius: 4px;
          }

          ::-webkit-scrollbar-thumb:hover {
            background: #444;
          }

          /* Layout Structure */
          .layout {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
          }

          .nav {
            background: #111;
            padding: 1rem 2rem;
            border-bottom: 1px solid #222;
          }

          .nav-list {
            display: flex;
            gap: 2rem;
            list-style: none;
            max-width: 1200px;
            margin: 0 auto;
            align-items: center;
          }

          .nav-link {
            color: #ededed;
            text-decoration: none;
            font-weight: 500;
            transition: color 0.2s;
            padding: 0.5rem 0.75rem;
            border-radius: 4px;
          }

          .nav-link:hover {
            color: #00d9ff;
            background: #1a1a1a;
          }

          .main {
            flex: 1;
            padding: 2rem;
            max-width: 1200px;
            margin: 0 auto;
            width: 100%;
          }

          .footer {
            background: #111;
            color: #888;
            text-align: center;
            padding: 1rem;
            font-size: 0.875rem;
            border-top: 1px solid #222;
          }

          /* Home Page Hero */
          .home-page .hero {
            text-align: center;
            padding: 3rem 0;
          }

          .home-page h1 {
            font-size: 2.5rem;
            margin-bottom: 0.75rem;
            font-weight: 700;
          }

          .home-page .tagline {
            color: #888;
            font-size: 1.25rem;
          }

          /* Stats Cards */
          .stats {
            display: flex;
            gap: 1rem;
            justify-content: center;
            margin: 2rem 0;
            flex-wrap: wrap;
          }

          .stat-card {
            background: #111;
            padding: 1.5rem 2rem;
            border-radius: 8px;
            border: 1px solid #222;
            text-align: center;
            min-width: 150px;
            transition: border-color 0.2s;
          }

          .stat-card:hover {
            border-color: #00d9ff;
          }

          .stat-value {
            display: block;
            font-size: 2rem;
            font-weight: 700;
            color: #00d9ff;
          }

          .stat-label {
            color: #888;
            font-size: 0.875rem;
            margin-top: 0.5rem;
          }

          /* Features Section */
          .features {
            background: #111;
            padding: 2rem;
            border-radius: 8px;
            border: 1px solid #222;
            margin-top: 2rem;
          }

          .features h2 {
            margin-bottom: 1.5rem;
            font-size: 1.5rem;
            font-weight: 600;
          }

          .features ul {
            list-style: none;
          }

          .features li {
            padding: 0.75rem 0;
            border-bottom: 1px solid #222;
            color: #ededed;
          }

          .features li:last-child {
            border-bottom: none;
          }

          .cta {
            text-align: center;
            margin-top: 2rem;
            color: #888;
          }

          /* Users Page */
          .users-page h1 {
            margin-bottom: 1.5rem;
            font-size: 2rem;
            font-weight: 700;
          }

          .empty-state {
            color: #888;
            padding: 2rem;
            text-align: center;
            background: #111;
            border-radius: 8px;
            border: 1px solid #222;
          }

          .user-list {
            list-style: none;
            display: grid;
            gap: 1rem;
          }

          .user-card {
            background: #111;
            padding: 1rem;
            border-radius: 8px;
            border: 1px solid #222;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: border-color 0.2s;
          }

          .user-card:hover {
            border-color: #00d9ff;
          }

          .user-name {
            font-weight: 600;
            color: #ededed;
          }

          .user-email {
            color: #888;
            font-size: 0.875rem;
          }

          /* About Page */
          .about-page h1 {
            font-size: 2rem;
            margin-bottom: 1.5rem;
            font-weight: 700;
          }

          .about-page h2 {
            font-size: 1.5rem;
            margin-top: 2rem;
            margin-bottom: 1rem;
            font-weight: 600;
          }

          .about-page p {
            color: #888;
            margin-bottom: 1rem;
            line-height: 1.8;
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
                <a href="/about" className="nav-link">
                  About
                </a>
              </li>
              <li>
                <a href="/docs/getting-started" className="nav-link">
                  Docs
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
