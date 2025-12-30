/**
 * Login Page
 *
 * Client component for authentication using server actions.
 * Tokens are stored in httpOnly cookies automatically by the server action.
 */
'use client';

import { useState } from 'react';

import { login } from '@/actions/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Call server action - tokens are stored in httpOnly cookies automatically
      const result = await login({ email, password });

      if (!result.success) {
        throw new Error(result.error.message);
      }

      // Redirect to dashboard (cookies are already set by server action)
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <style>{`
        .auth-container {
          max-width: 450px;
          margin: 0 auto;
        }

        .auth-card {
          background: #111;
          padding: 2rem;
          border-radius: 8px;
          border: 1px solid #222;
        }

        .auth-card h1 {
          font-size: 1.5rem;
          font-weight: 700;
          margin-bottom: 1.5rem;
          text-align: center;
          color: #ededed;
        }

        .auth-form {
          margin-top: 1.5rem;
        }

        .form-group {
          margin-bottom: 1.25rem;
        }

        .form-label {
          display: block;
          margin-bottom: 0.5rem;
          color: #ededed;
          font-weight: 500;
          font-size: 0.875rem;
        }

        .form-input {
          width: 100%;
          padding: 0.75rem 1rem;
          border-radius: 4px;
          border: 1px solid #222;
          background: #0a0a0a;
          color: #ededed;
          font-size: 0.875rem;
          transition: border-color 0.2s, background 0.2s;
        }

        .form-input:focus {
          outline: none;
          border-color: #00d9ff;
          background: #111;
        }

        .form-input:hover {
          border-color: #333;
        }

        .btn {
          width: 100%;
          padding: 0.75rem 1.25rem;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
          font-size: 0.875rem;
          transition: background 0.2s, opacity 0.2s;
        }

        .btn-primary {
          background: #00d9ff;
          color: #000;
        }

        .btn-primary:hover:not(:disabled) {
          background: rgba(0, 217, 255, 0.8);
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .error-message {
          padding: 0.75rem;
          background: #2a1111;
          color: #ff6666;
          border-radius: 4px;
          margin-bottom: 1rem;
          border: 1px solid #ff4444;
          font-size: 0.875rem;
        }

        .auth-footer {
          margin-top: 1.5rem;
          text-align: center;
          color: #888;
          font-size: 0.875rem;
        }

        .auth-footer a {
          color: #00d9ff;
          font-weight: 500;
        }

        .auth-footer a:hover {
          opacity: 0.8;
        }
      `}</style>

      <div className="auth-card">
        <h1>Login</h1>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="form-input"
            />
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="auth-footer">
          Don't have an account? <a href="/auth/register">Register</a>
        </p>
      </div>
    </div>
  );
}
