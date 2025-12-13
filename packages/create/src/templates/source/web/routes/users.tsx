/**
 * Users Page - Demonstrates React 19 patterns with VeloxTS
 *
 * Uses useSuspenseQuery with Suspense boundaries for cleaner component code.
 * Data is guaranteed to be available when the component renders.
 */

import { createFileRoute } from '@tanstack/react-router';
import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

import styles from '@/App.module.css';
import { api } from '@/api';

export const Route = createFileRoute('/users')({
  component: UsersPage,
});

function UsersPage() {
  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <h1 className={styles.title}>Users</h1>
        <p className={styles.subtitle}>Type-safe data fetching with React 19 Suspense</p>
      </div>

      <ErrorBoundary fallback={<UsersError />}>
        <Suspense fallback={<UsersLoading />}>
          <UsersTable />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}

/**
 * Users table component - wrapped in Suspense
 *
 * With useSuspenseQuery, data is guaranteed to be available.
 * No need for isLoading/error checks - handled by boundaries.
 */
function UsersTable() {
  const { data } = api.users.listUsers.useSuspenseQuery({});

  return (
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
          {data.data.map((user) => (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>{new Date(user.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
          {data.data.length === 0 && (
            <tr>
              <td colSpan={3} className={styles.emptyState}>
                No users found. Create one via the API!
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <p className={styles.meta}>
        Page {data.meta.page} - {data.meta.total} total users
      </p>
    </div>
  );
}

function UsersLoading() {
  return <p className={styles.loading}>Loading users...</p>;
}

function UsersError() {
  return <p className={styles.error}>Failed to load users. Please try again.</p>;
}
