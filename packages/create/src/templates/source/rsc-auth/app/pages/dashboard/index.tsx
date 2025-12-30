/**
 * Dashboard Page
 *
 * Protected page that requires authentication.
 * Uses httpOnly cookie-based authentication (tokens stored in cookies by server actions).
 */
'use client';

import { useEffect, useState } from 'react';

import { logout } from '@/app/actions/auth';

interface User {
  id: string;
  name: string;
  email: string;
  roles: string[];
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        // Cookies are sent automatically with credentials: 'include'
        const response = await fetch('/api/auth/me', {
          credentials: 'include',
        });

        if (!response.ok) {
          // Token invalid, expired, or not present - redirect to login
          window.location.href = '/auth/login';
          return;
        }

        const userData = await response.json();
        setUser(userData);
      } catch {
        setError('Failed to load user data');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const handleLogout = async () => {
    try {
      // Call server action to clear auth cookies
      await logout();
    } catch {
      // Ignore errors - we're redirecting anyway
    }

    // Redirect to home
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <style>{`
          .dashboard-loading {
            padding: 2rem;
            text-align: center;
            color: #888;
          }
        `}</style>
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <style>{`
          .dashboard-error {
            padding: 2rem;
            text-align: center;
            color: #ff6666;
          }
        `}</style>
        {error}
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="dashboard">
      <style>{`
        .dashboard {
          max-width: 800px;
          margin: 0 auto;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }

        .dashboard-header h1 {
          font-size: 1.75rem;
          font-weight: 700;
          color: #ededed;
          margin: 0;
        }

        .btn-logout {
          padding: 0.5rem 1rem;
          background: transparent;
          color: #ff6666;
          border: 1px solid #ff6666;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
          font-size: 0.875rem;
          transition: background 0.2s, color 0.2s;
        }

        .btn-logout:hover {
          background: #ff6666;
          color: #000;
        }

        .user-card {
          padding: 1.5rem;
          background: #111;
          border: 1px solid #222;
          border-radius: 8px;
          margin-bottom: 1.5rem;
        }

        .user-card h2 {
          font-size: 1.25rem;
          font-weight: 600;
          color: #ededed;
          margin: 0 0 1rem 0;
        }

        .user-info {
          color: #888;
          font-size: 0.875rem;
          line-height: 1.8;
        }

        .user-info strong {
          color: #ededed;
        }

        .actions-card {
          padding: 1.5rem;
          background: #0d1a26;
          border: 1px solid #1a3a5c;
          border-radius: 8px;
          margin-bottom: 1.5rem;
        }

        .actions-card h3 {
          font-size: 1rem;
          font-weight: 600;
          color: #00d9ff;
          margin: 0 0 0.75rem 0;
        }

        .actions-card p {
          color: #888;
          font-size: 0.875rem;
          margin: 0 0 1rem 0;
        }

        .actions-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .actions-list li {
          color: #888;
          font-size: 0.875rem;
          padding: 0.5rem 0;
          border-bottom: 1px solid #1a3a5c;
        }

        .actions-list li:last-child {
          border-bottom: none;
        }

        .admin-tag {
          display: inline-block;
          padding: 0.125rem 0.5rem;
          background: #00d9ff;
          color: #000;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 600;
          margin-right: 0.5rem;
        }

        .back-link {
          display: inline-block;
          color: #00d9ff;
          font-size: 0.875rem;
          text-decoration: none;
        }

        .back-link:hover {
          opacity: 0.8;
        }
      `}</style>

      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <button type="button" onClick={handleLogout} className="btn-logout">
          Logout
        </button>
      </div>

      <div className="user-card">
        <h2>Welcome, {user.name || 'User'}!</h2>
        <div className="user-info">
          <p>
            <strong>Email:</strong> {user.email}
          </p>
          <p>
            <strong>Roles:</strong> {user.roles.join(', ')}
          </p>
        </div>
      </div>

      <div className="actions-card">
        <h3>Your Actions</h3>
        <p>As an authenticated user, you can:</p>
        <ul className="actions-list">
          <li>View your profile</li>
          <li>Update your settings</li>
          {user.roles.includes('admin') && (
            <>
              <li>
                <span className="admin-tag">Admin</span>
                Manage users
              </li>
              <li>
                <span className="admin-tag">Admin</span>
                View all data
              </li>
            </>
          )}
        </ul>
      </div>

      <a href="/" className="back-link">
        ← Back to Home
      </a>
    </div>
  );
}
