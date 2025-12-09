import { createRootRoute, Outlet, Link } from '@tanstack/react-router';
import styles from '@/App.module.css';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className={styles.app}>
      <nav className={styles.nav}>
        <div className={styles.navBrand}>
          <Link to="/" className={styles.logo}>
            VeloxTS
          </Link>
        </div>
        <div className={styles.navLinks}>
          <Link to="/" className={styles.navLink} activeProps={{ className: styles.navLinkActive }}>
            Home
          </Link>
          <Link to="/about" className={styles.navLink} activeProps={{ className: styles.navLinkActive }}>
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
