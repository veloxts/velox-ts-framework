/**
 * About Page
 *
 * This page is in the (marketing) route group.
 * The URL is /about (not /marketing/about).
 *
 * Route groups let you organize pages without affecting the URL structure.
 * They're useful for:
 * - Applying shared layouts to a subset of pages
 * - Organizing pages by team or feature
 * - Grouping related pages without nesting URLs
 */

import type { PageProps } from '@veloxts/web';

export default function AboutPage({ params }: PageProps) {
  return (
    <div className="page about-page">
      <h1>About VeloxTS</h1>

      <section className="about-section">
        <h2>What is VeloxTS?</h2>
        <p>
          VeloxTS is a Laravel-inspired TypeScript full-stack web framework designed for
          exceptional developer experience and type safety.
        </p>
      </section>

      <section className="about-section">
        <h2>Key Features</h2>
        <ul>
          <li>Type safety without code generation</li>
          <li>React Server Components with streaming</li>
          <li>File-based routing with route groups</li>
          <li>Built on Fastify, tRPC, and Prisma</li>
        </ul>
      </section>

      <section className="about-section route-group-demo">
        <h2>Route Groups Demo</h2>
        <p>
          This page lives at <code>app/pages/(marketing)/about.tsx</code> but is served at{' '}
          <code>/about</code>.
        </p>
        <p>
          The <code>(marketing)</code> directory is a route group - it organizes files without
          affecting the URL structure.
        </p>
      </section>
    </div>
  );
}
