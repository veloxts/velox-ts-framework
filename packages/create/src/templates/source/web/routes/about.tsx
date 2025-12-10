import { createFileRoute } from '@tanstack/react-router';
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
          An elegant TypeScript framework for full-stack development.
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
