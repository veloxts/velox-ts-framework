/**
 * Users Page
 *
 * A React Server Component that runs on the server at request time.
 * Demonstrates direct database access from RSC.
 */

import { db } from '../../src/api/database.js';

export default async function UsersPage() {
  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return (
    <div className="users-page">
      <h1>Users</h1>

      {users.length === 0 ? (
        <p className="empty-state">
          No users yet. Create one via the API at <code>POST /api/users</code>
        </p>
      ) : (
        <ul className="user-list">
          {users.map((user) => (
            <li key={user.id} className="user-card">
              <a href={`/users/${user.id}`} className="user-link">
                <span className="user-name">{user.name}</span>
                <span className="user-email">{user.email}</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      <footer className="cta">
        <p>
          Edit <code>app/pages/users.tsx</code> to customize this page.
        </p>
      </footer>
    </div>
  );
}
