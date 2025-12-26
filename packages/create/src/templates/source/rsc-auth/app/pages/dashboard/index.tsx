/**
 * Dashboard Page
 *
 * Protected page that requires authentication.
 * Uses client-side token validation.
 */
'use client';

import { useEffect, useState } from 'react';

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
      const token = localStorage.getItem('accessToken');

      if (!token) {
        window.location.href = '/auth/login';
        return;
      }

      try {
        const response = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          // Token invalid or expired
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
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

  const handleLogout = () => {
    const token = localStorage.getItem('accessToken');

    // Call logout endpoint (fire and forget)
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }

    // Clear tokens
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');

    // Redirect to home
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#c00' }}>
        {error}
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Dashboard</h1>
        <button
          onClick={handleLogout}
          style={{
            padding: '0.5rem 1rem',
            background: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Logout
        </button>
      </div>

      <div style={{ marginTop: '2rem', padding: '1rem', background: '#f5f5f5', borderRadius: '8px' }}>
        <h2>Welcome, {user.name || 'User'}!</h2>
        <p>Email: {user.email}</p>
        <p>Roles: {user.roles.join(', ')}</p>
      </div>

      <div style={{ marginTop: '2rem', padding: '1rem', background: '#e3f2fd', borderRadius: '8px' }}>
        <h3>Your Actions</h3>
        <p>As an authenticated user, you can:</p>
        <ul style={{ lineHeight: '2' }}>
          <li>View your profile</li>
          <li>Update your settings</li>
          {user.roles.includes('admin') && (
            <>
              <li><strong>Admin:</strong> Manage users</li>
              <li><strong>Admin:</strong> View all data</li>
            </>
          )}
        </ul>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <a href="/" style={{ color: '#007bff' }}>← Back to Home</a>
      </div>
    </div>
  );
}
