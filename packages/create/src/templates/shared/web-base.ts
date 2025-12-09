/**
 * Web Package Base Templates
 *
 * Shared templates for React frontend (Vite config, tsconfig, main.tsx, routes)
 */

import type { TemplateConfig, TemplateFile } from '../types.js';

// ============================================================================
// Web package.json
// ============================================================================

export function generateWebPackageJson(): string {
  return JSON.stringify(
    {
      name: 'web',
      version: '0.0.1',
      private: true,
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'tsc -b && vite build',
        preview: 'vite preview',
        'type-check': 'tsc --noEmit',
      },
      dependencies: {
        react: '19.1.0',
        'react-dom': '19.1.0',
        '@tanstack/react-router': '1.140.0',
        '@tanstack/react-query': '5.90.12',
      },
      devDependencies: {
        '@types/react': '19.1.6',
        '@types/react-dom': '19.1.5',
        '@vitejs/plugin-react': '5.1.2',
        '@tanstack/router-plugin': '1.140.0',
        vite: '6.4.1',
        typescript: '5.8.3',
      },
    },
    null,
    2
  );
}

// ============================================================================
// Web tsconfig.json
// ============================================================================

export function generateWebTsConfig(): string {
  return JSON.stringify(
    {
      $schema: 'https://json.schemastore.org/tsconfig',
      compilerOptions: {
        target: 'ES2022',
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        moduleResolution: 'bundler',
        jsx: 'react-jsx',
        strict: true,
        noEmit: true,
        isolatedModules: true,
        skipLibCheck: true,
        esModuleInterop: true,
        resolveJsonModule: true,
        allowSyntheticDefaultImports: true,
        forceConsistentCasingInFileNames: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        paths: {
          '@/*': ['./src/*'],
        },
      },
      include: ['src'],
    },
    null,
    2
  );
}

// ============================================================================
// Vite config
// ============================================================================

export function generateViteConfig(): string {
  return `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [TanStackRouterVite(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 8080,
    proxy: {
      '/api': {
        target: 'http://localhost:3210',
        changeOrigin: true,
      },
    },
  },
});
`;
}

// ============================================================================
// index.html
// ============================================================================

export function generateWebIndexHtml(config: TemplateConfig): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${config.projectName}</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
}

// ============================================================================
// Favicon
// ============================================================================

export function generateFavicon(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="20" fill="#0a0a0a"/>
  <text x="50" y="65" font-size="50" text-anchor="middle" fill="#00d9ff" font-family="system-ui, sans-serif" font-weight="bold">V</text>
</svg>
`;
}

// ============================================================================
// main.tsx
// ============================================================================

export function generateMainTsx(): string {
  return `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routeTree } from './routeTree.gen';
import './styles/global.css';

// Create query client for data fetching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
    },
  },
});

// Create router with route tree
const router = createRouter({ routeTree });

// Type-safe router registration
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

// Render application
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
);
`;
}

// ============================================================================
// Routes - __root.tsx
// ============================================================================

export function generateRootRoute(): string {
  return `import { createRootRoute, Outlet, Link } from '@tanstack/react-router';
import styles from '@/App.module.css';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className={styles.app}>
      <nav className={styles.nav}>
        <div className={styles.navBrand}>
          <Link to="/" className={styles.logo}>
            VeloxTS
          </Link>
        </div>
        <div className={styles.navLinks}>
          <Link to="/" className={styles.navLink} activeProps={{ className: styles.navLinkActive }}>
            Home
          </Link>
          <Link to="/about" className={styles.navLink} activeProps={{ className: styles.navLinkActive }}>
            About
          </Link>
        </div>
      </nav>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
`;
}

// ============================================================================
// Routes - index.tsx (Home page - Default template)
// ============================================================================

export function generateDefaultIndexRoute(): string {
  return `import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import styles from '@/App.module.css';

// API helper
const api = {
  get: async <T,>(path: string): Promise<T> => {
    const res = await fetch(\`/api\${path}\`);
    if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
    return res.json();
  },
};

export const Route = createFileRoute('/')({
  component: HomePage,
});

interface HealthResponse {
  status: string;
  version: string;
  timestamp: string;
  uptime: number;
}

function HomePage() {
  const { data: health, isLoading, error } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.get<HealthResponse>('/health'),
  });

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <h1 className={styles.title}>Welcome to VeloxTS</h1>
        <p className={styles.subtitle}>
          Full-stack TypeScript, beautifully simple.
        </p>
      </div>

      <div className={styles.cards}>
        <div className={styles.card}>
          <h2>API Status</h2>
          {isLoading ? (
            <p className={styles.loading}>Checking...</p>
          ) : error ? (
            <p className={styles.error}>Disconnected</p>
          ) : (
            <p className={styles.success}>
              {health?.status === 'ok' ? 'Connected' : 'Unknown'}
            </p>
          )}
          {health && (
            <p className={styles.meta}>v{health.version}</p>
          )}
        </div>

        <div className={styles.card}>
          <h2>Get Started</h2>
          <p>Edit <code>apps/api/src/procedures</code> to add API endpoints.</p>
          <p>Edit <code>apps/web/src/routes</code> to add pages.</p>
        </div>

        <div className={styles.card}>
          <h2>Documentation</h2>
          <p>
            <a href="https://veloxts.dev" target="_blank" rel="noopener noreferrer">
              VeloxTS Docs
            </a>
          </p>
          <p>
            <a href="https://tanstack.com/router" target="_blank" rel="noopener noreferrer">
              TanStack Router
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
`;
}

// ============================================================================
// Routes - index.tsx (Home page - Auth template)
// ============================================================================

export function generateAuthIndexRoute(): string {
  return `import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import styles from '@/App.module.css';

// API helpers
const api = {
  get: async <T,>(path: string): Promise<T> => {
    const token = localStorage.getItem('accessToken');
    const res = await fetch(\`/api\${path}\`, {
      headers: token ? { Authorization: \`Bearer \${token}\` } : {},
    });
    if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
    return res.json();
  },
  post: async <T,>(path: string, data: unknown): Promise<T> => {
    const token = localStorage.getItem('accessToken');
    const res = await fetch(\`/api\${path}\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: \`Bearer \${token}\` } : {}),
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || \`HTTP \${res.status}\`);
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
            className={\`\${styles.authTab} \${isLogin ? styles.authTabActive : ''}\`}
            onClick={() => setIsLogin(true)}
          >
            Login
          </button>
          <button
            className={\`\${styles.authTab} \${!isLogin ? styles.authTabActive : ''}\`}
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
`;
}

// ============================================================================
// Routes - about.tsx
// ============================================================================

export function generateAboutRoute(): string {
  return `import { createFileRoute } from '@tanstack/react-router';
import styles from '@/App.module.css';

export const Route = createFileRoute('/about')({
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <h1 className={styles.title}>About VeloxTS</h1>
        <p className={styles.subtitle}>
          A Laravel-inspired TypeScript framework for full-stack development.
        </p>
      </div>

      <div className={styles.cards}>
        <div className={styles.card}>
          <h2>Type Safety</h2>
          <p>End-to-end type safety without code generation. Types flow from backend to frontend automatically.</p>
        </div>

        <div className={styles.card}>
          <h2>Developer Experience</h2>
          <p>Convention over configuration. Sensible defaults with escape hatches when you need them.</p>
        </div>

        <div className={styles.card}>
          <h2>Modern Stack</h2>
          <p>Built on Fastify, tRPC, Prisma, React, and TanStack Router.</p>
        </div>
      </div>
    </div>
  );
}
`;
}

// ============================================================================
// Generate All Web Base Files
// ============================================================================

export function generateWebBaseFiles(
  config: TemplateConfig,
  isAuthTemplate: boolean
): TemplateFile[] {
  return [
    // Config files
    { path: 'apps/web/package.json', content: generateWebPackageJson() },
    { path: 'apps/web/tsconfig.json', content: generateWebTsConfig() },
    { path: 'apps/web/vite.config.ts', content: generateViteConfig() },
    { path: 'apps/web/index.html', content: generateWebIndexHtml(config) },
    { path: 'apps/web/public/favicon.svg', content: generateFavicon() },

    // Entry point
    { path: 'apps/web/src/main.tsx', content: generateMainTsx() },

    // Routes
    { path: 'apps/web/src/routes/__root.tsx', content: generateRootRoute() },
    {
      path: 'apps/web/src/routes/index.tsx',
      content: isAuthTemplate ? generateAuthIndexRoute() : generateDefaultIndexRoute(),
    },
    { path: 'apps/web/src/routes/about.tsx', content: generateAboutRoute() },
  ];
}
