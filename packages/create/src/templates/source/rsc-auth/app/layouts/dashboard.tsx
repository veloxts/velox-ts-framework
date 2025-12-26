/**
 * Dashboard Layout
 *
 * A nested layout for pages in the (dashboard) route group.
 * Adds a sidebar navigation for dashboard-related pages.
 * This is NOT a full HTML document - it wraps within RootLayout.
 */

import type { ReactNode } from 'react';

interface DashboardLayoutProps {
  children: ReactNode;
  params?: Record<string, string>;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="dashboard-layout">
      <style>{`
        .dashboard-layout {
          display: flex;
          gap: 2rem;
          min-height: 60vh;
        }

        .dashboard-sidebar {
          width: 200px;
          flex-shrink: 0;
          background: white;
          border-radius: 8px;
          padding: 1rem;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          height: fit-content;
        }

        .dashboard-sidebar h3 {
          font-size: 0.75rem;
          text-transform: uppercase;
          color: #888;
          margin-bottom: 0.5rem;
          padding: 0 0.5rem;
        }

        .sidebar-nav {
          list-style: none;
        }

        .sidebar-nav a {
          display: block;
          padding: 0.5rem;
          color: #1a1a2e;
          text-decoration: none;
          border-radius: 4px;
          transition: background 0.2s;
        }

        .sidebar-nav a:hover {
          background: #f0f0f0;
        }

        .sidebar-nav a.active {
          background: #6366f1;
          color: white;
        }

        .dashboard-content {
          flex: 1;
          background: white;
          border-radius: 8px;
          padding: 1.5rem;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .dashboard-badge {
          display: inline-block;
          background: #6366f1;
          color: white;
          font-size: 0.625rem;
          text-transform: uppercase;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          margin-bottom: 1rem;
        }
      `}</style>

      <aside className="dashboard-sidebar">
        <h3>Dashboard</h3>
        <nav>
          <ul className="sidebar-nav">
            <li>
              <a href="/profile">Profile</a>
            </li>
            <li>
              <a href="/settings">Settings</a>
            </li>
            <li>
              <a href="/settings?tab=notifications">Notifications</a>
            </li>
            <li>
              <a href="/settings?tab=security">Security</a>
            </li>
          </ul>
        </nav>

        <h3 style={{ marginTop: '1rem' }}>Navigation</h3>
        <nav>
          <ul className="sidebar-nav">
            <li>
              <a href="/">Home</a>
            </li>
            <li>
              <a href="/users">Users</a>
            </li>
            <li>
              <a href="/docs/getting-started">Docs</a>
            </li>
          </ul>
        </nav>
      </aside>

      <div className="dashboard-content">
        <span className="dashboard-badge">Dashboard</span>
        {children}
      </div>
    </div>
  );
}
