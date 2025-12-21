/**
 * User Detail Page
 *
 * A React Server Component that displays a single user.
 * Demonstrates dynamic route parameters with [id] segment.
 */

import { db } from '../../../src/api/database.js';

interface PageProps {
  params: Record<string, string>;
  searchParams: Record<string, string | string[]>;
}

export default async function UserDetailPage({ params }: PageProps) {
  const { id } = params;

  // Fetch user from database
  const user = await db.user.findUnique({
    where: { id },
  });

  if (!user) {
    return (
      <div className="user-detail-page">
        <h1>User Not Found</h1>
        <p>
          No user exists with ID: <code>{id}</code>
        </p>
        <p>
          <a href="/users">Back to Users</a>
        </p>
      </div>
    );
  }

  return (
    <div className="user-detail-page">
      <h1>{user.name}</h1>

      <section className="user-info">
        <dl>
          <dt>Email</dt>
          <dd>{user.email}</dd>

          <dt>ID</dt>
          <dd>
            <code>{user.id}</code>
          </dd>

          <dt>Created</dt>
          <dd>{user.createdAt.toISOString()}</dd>

          <dt>Updated</dt>
          <dd>{user.updatedAt.toISOString()}</dd>
        </dl>
      </section>

      <footer className="actions">
        <a href="/users">Back to Users</a>
      </footer>
    </div>
  );
}
