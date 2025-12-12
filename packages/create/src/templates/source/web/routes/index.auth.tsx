import { createFileRoute } from '@tanstack/react-router';
import { useQueryClient } from '@veloxts/client/react';
import { useState } from 'react';
import { api } from '@/api';
import styles from '@/App.module.css';

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
  const { data: user, isLoading } = api.auth.getMe.useQuery({}, { retry: false });

  const login = api.auth.createSession.useMutation({
    onSuccess: (data) => {
      localStorage.setItem('token', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      api.auth.getMe.invalidate(undefined, queryClient);
      setError('');
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Login failed');
    },
  });

  const register = api.auth.createAccount.useMutation({
    onSuccess: (data) => {
      localStorage.setItem('token', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      api.auth.getMe.invalidate(undefined, queryClient);
      setError('');
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Registration failed');
    },
  });

  const logout = api.auth.deleteSession.useMutation({
    onSuccess: () => {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      api.auth.getMe.setData({}, null, queryClient);
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
              onClick={() => logout.mutate({})}
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
