/**
 * Users Segment Layout
 *
 * A directory-based layout that wraps all pages under /users/*.
 * Demonstrates segment layouts (also called per-directory layouts).
 *
 * Layout inheritance chain for /users/[id]/posts:
 *   RootLayout -> UsersLayout -> Page
 */

import type { ReactNode } from 'react';

interface UsersLayoutProps {
  children: ReactNode;
  params?: Record<string, string>;
}

export default function UsersLayout({ children }: UsersLayoutProps) {
  return (
    <div className="users-layout">
      <style>{`
        .users-layout {
          min-height: 60vh;
        }

        .users-header {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white;
          padding: 1.5rem 2rem;
          border-radius: 8px 8px 0 0;
          margin: -2rem -2rem 2rem -2rem;
        }

        .users-header h2 {
          font-size: 0.875rem;
          text-transform: uppercase;
          opacity: 0.8;
          margin-bottom: 0.25rem;
        }

        .users-header nav {
          display: flex;
          gap: 1.5rem;
          margin-top: 1rem;
        }

        .users-header a {
          color: white;
          text-decoration: none;
          opacity: 0.8;
          font-size: 0.875rem;
          transition: opacity 0.2s;
        }

        .users-header a:hover {
          opacity: 1;
        }

        .users-breadcrumb {
          font-size: 0.875rem;
          color: rgba(255,255,255,0.7);
          margin-top: 0.5rem;
        }

        .users-breadcrumb a {
          color: rgba(255,255,255,0.7);
        }

        .users-content {
          background: white;
          border-radius: 0 0 8px 8px;
          padding: 2rem;
          margin: -2rem -2rem 0 -2rem;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .segment-badge {
          display: inline-block;
          background: #e0e7ff;
          color: #4338ca;
          font-size: 0.625rem;
          text-transform: uppercase;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          margin-bottom: 1rem;
        }
      `}</style>

      <header className="users-header">
        <h2>User Management</h2>
        <nav>
          <a href="/users">All Users</a>
          <a href="/">Home</a>
          <a href="/settings">Settings</a>
        </nav>
      </header>

      <div className="users-content">
        <span className="segment-badge">Users Section</span>
        {children}
      </div>
    </div>
  );
}
