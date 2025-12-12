/**
 * Users Page - Demonstrates type-safe data fetching with VeloxTS hooks
 */

import { createFileRoute } from '@tanstack/react-router';
import { api } from '@/api';
import styles from '@/App.module.css';

export const Route = createFileRoute('/users')({
  component: UsersPage,
});

function UsersPage() {
  const { data, isLoading, error } = api.users.listUsers.useQuery({});

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <h1 className={styles.title}>Users</h1>
        <p className={styles.subtitle}>
          Type-safe data fetching with VeloxTS hooks
        </p>
      </div>

      {isLoading ? (
        <p className={styles.loading}>Loading users...</p>
      ) : error ? (
        <p className={styles.error}>Error: {error.message}</p>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {data?.data.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {data?.data.length === 0 && (
                <tr>
                  <td colSpan={3} className={styles.emptyState}>
                    No users found. Create one via the API!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {data && (
            <p className={styles.meta}>
              Page {data.meta.page} - {data.meta.total} total users
            </p>
          )}
        </div>
      )}
    </div>
  );
}
