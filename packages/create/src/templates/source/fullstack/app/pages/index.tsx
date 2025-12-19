/**
 * Home Page
 *
 * A React Server Component that runs on the server at request time.
 * Data fetching happens directly in the component - no useEffect needed.
 */

import { db } from '@/api/database';

export default async function HomePage() {
  // Server-side data fetching
  const userCount = await db.user.count();

  return (
    <div className="home-page">
      <header className="hero">
        <h1>Welcome to VeloxTS</h1>
        <p className="tagline">Type-safe full-stack development with React Server Components</p>
      </header>

      <section className="stats">
        <div className="stat-card">
          <span className="stat-value">{userCount}</span>
          <span className="stat-label">Users in Database</span>
        </div>
      </section>

      <section className="features">
        <h2>Features</h2>
        <ul>
          <li>
            <strong>React Server Components</strong> - Server-first rendering with streaming
          </li>
          <li>
            <strong>File-Based Routing</strong> - Laravel-inspired route conventions
          </li>
          <li>
            <strong>Type-Safe Actions</strong> - Server actions with Zod validation
          </li>
          <li>
            <strong>Embedded API</strong> - Fastify API routes at /api/*
          </li>
        </ul>
      </section>

      <footer className="cta">
        <p>
          Edit <code>app/pages/index.tsx</code> to customize this page.
        </p>
      </footer>
    </div>
  );
}
