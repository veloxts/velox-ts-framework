/**
 * Users Page
 *
 * Demonstrates data fetching and displaying a list of users.
 */

import { db } from '@/api/database';

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
              <span className="user-name">{user.name}</span>
              <span className="user-email">{user.email}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
