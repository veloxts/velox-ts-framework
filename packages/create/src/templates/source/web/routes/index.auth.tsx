import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import styles from '@/App.module.css';

// API helpers
const api = {
  get: async <T,>(path: string): Promise<T> => {
    const token = localStorage.getItem('accessToken');
    const res = await fetch(`/api${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  post: async <T,>(path: string, data: unknown): Promise<T> => {
    const token = localStorage.getItem('accessToken');
    const res = await fetch(`/api${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || `HTTP ${res.status}`);
    }
    return res.json();
  },
};

interface User {
  id: string;
  name: string;
  email: string;
  roles?: string[];
}

interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  const queryClient = useQueryClient();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  // Check if user is logged in
  const { data: user, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<User>('/auth/me'),
    retry: false,
  });

  const login = useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      api.post<AuthResponse>('/auth/login', data),
    onSuccess: (data) => {
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      queryClient.invalidateQueries({ queryKey: ['me'] });
      setError('');
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Login failed');
    },
  });

  const register = useMutation({
    mutationFn: (data: { name: string; email: string; password: string }) =>
      api.post<AuthResponse>('/auth/register', data),
    onSuccess: (data) => {
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      queryClient.invalidateQueries({ queryKey: ['me'] });
      setError('');
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Registration failed');
    },
  });

  const logout = useMutation({
    mutationFn: () => api.post('/auth/logout', {}),
    onSuccess: () => {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isLogin) {
      login.mutate({ email, password });
    } else {
      register.mutate({ name, email, password });
    }
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <p className={styles.loading}>Loading...</p>
      </div>
    );
  }

  // Logged in view
  if (user) {
    return (
      <div className={styles.container}>
        <div className={styles.hero}>
          <h1 className={styles.title}>Welcome, {user.name}!</h1>
          <p className={styles.subtitle}>{user.email}</p>
        </div>

        <div className={styles.cards}>
          <div className={styles.card}>
            <h2>Your Profile</h2>
            <p><strong>ID:</strong> {user.id}</p>
            <p><strong>Roles:</strong> {user.roles?.join(', ') || 'user'}</p>
          </div>

          <div className={styles.card}>
            <h2>Actions</h2>
            <button
              onClick={() => logout.mutate()}
              className={styles.button}
              disabled={logout.isPending}
            >
              {logout.isPending ? 'Logging out...' : 'Logout'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Login/Register form
  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <h1 className={styles.title}>Welcome to VeloxTS</h1>
        <p className={styles.subtitle}>
          Full-stack TypeScript with authentication.
        </p>
      </div>

      <div className={styles.authCard}>
        <div className={styles.authTabs}>
          <button
            className={`${styles.authTab} ${isLogin ? styles.authTabActive : ''}`}
            onClick={() => setIsLogin(true)}
          >
            Login
          </button>
          <button
            className={`${styles.authTab} ${!isLogin ? styles.authTabActive : ''}`}
            onClick={() => setIsLogin(false)}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {!isLogin && (
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={styles.input}
              required
              minLength={2}
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={styles.input}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={styles.input}
            required
            minLength={isLogin ? 1 : 12}
          />

          {error && <p className={styles.formError}>{error}</p>}

          <button
            type="submit"
            className={styles.button}
            disabled={login.isPending || register.isPending}
          >
            {login.isPending || register.isPending
              ? 'Please wait...'
              : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {!isLogin && (
          <p className={styles.formHint}>
            Password: 12+ chars, uppercase, lowercase, number
          </p>
        )}
      </div>
    </div>
  );
}
