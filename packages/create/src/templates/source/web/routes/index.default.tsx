import { createFileRoute } from '@tanstack/react-router';

import styles from '@/App.module.css';
import { api } from '@/api';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  const { data: health, isLoading, error } = api.health.check.useQuery({});

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <h1 className={styles.title}>Welcome to VeloxTS</h1>
        <p className={styles.subtitle}>Full-stack TypeScript, beautifully simple.</p>
      </div>

      <div className={styles.cards}>
        <div className={styles.card}>
          <h2>API Status</h2>
          {isLoading ? (
            <p className={styles.loading}>Checking...</p>
          ) : error ? (
            <p className={styles.error}>Disconnected</p>
          ) : (
            <p className={styles.success}>{health?.status === 'ok' ? 'Connected' : 'Unknown'}</p>
          )}
          {health && <p className={styles.meta}>v{health.version}</p>}
        </div>

        <div className={styles.card}>
          <h2>Get Started</h2>
          <p>
            Edit <code>apps/api/src/procedures</code> to add API endpoints.
          </p>
          <p>
            Edit <code>apps/web/src/routes</code> to add pages.
          </p>
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
