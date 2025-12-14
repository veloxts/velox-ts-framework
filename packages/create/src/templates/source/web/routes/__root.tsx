import { createRootRoute, Link, Outlet } from '@tanstack/react-router';
import styles from '@/App.module.css';
/* @if auth */
import { useQuery } from '@veloxts/client/react';

import type { AppRouter } from '../../../api/src/index.js';
/* @endif auth */

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  /* @if auth */
  const { data: user } = useQuery<AppRouter, 'auth', 'getMe'>(
    'auth',
    'getMe',
    {},
    { retry: false }
  );
  const isAuthenticated = !!user;
  /* @endif auth */

  return (
    <div className={styles.app}>
      <nav className={styles.nav}>
        <div className={styles.navBrand}>
          <Link to="/" className={styles.logo}>
            Velox TS
          </Link>
        </div>
        <div className={styles.navLinks}>
          <Link to="/" className={styles.navLink} activeProps={{ className: styles.navLinkActive }}>
            Home
          </Link>
          {/* @if default */}
          <Link
            to="/users"
            className={styles.navLink}
            activeProps={{ className: styles.navLinkActive }}
          >
            Users
          </Link>
          {/* @endif default */}
          {/* @if auth */}
          {isAuthenticated && (
            <Link
              to="/users"
              className={styles.navLink}
              activeProps={{ className: styles.navLinkActive }}
            >
              Users
            </Link>
          )}
          {/* @endif auth */}
          <Link
            to="/about"
            className={styles.navLink}
            activeProps={{ className: styles.navLinkActive }}
          >
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
