/**
 * 404 Not Found Page
 *
 * This page is displayed when no route matches the requested URL.
 * The _not-found.tsx naming convention is recognized by the file router.
 */

interface PageProps {
  params: Record<string, string>;
  searchParams: Record<string, string | string[]>;
}

export default async function NotFoundPage(_props: PageProps) {
  return (
    <div className="not-found-page">
      <style>{`
        .not-found-page {
          text-align: center;
          padding: 4rem 2rem;
          min-height: 60vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }

        .error-code {
          font-size: 8rem;
          font-weight: 700;
          color: #e0e0e0;
          line-height: 1;
          margin-bottom: 1rem;
        }

        .not-found-page h1 {
          font-size: 2rem;
          color: #1a1a2e;
          margin-bottom: 0.5rem;
        }

        .not-found-page p {
          color: #666;
          max-width: 400px;
          margin-bottom: 2rem;
        }

        .action-links {
          display: flex;
          gap: 1rem;
        }

        .action-links a {
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 500;
          transition: all 0.2s;
        }

        .action-links .primary {
          background: #6366f1;
          color: white;
        }

        .action-links .primary:hover {
          background: #4f46e5;
        }

        .action-links .secondary {
          background: #f0f0f0;
          color: #1a1a2e;
        }

        .action-links .secondary:hover {
          background: #e0e0e0;
        }

        .suggestions {
          margin-top: 3rem;
          padding-top: 2rem;
          border-top: 1px solid #eee;
          color: #888;
        }

        .suggestions h3 {
          font-size: 0.875rem;
          text-transform: uppercase;
          margin-bottom: 1rem;
        }

        .suggestions ul {
          list-style: none;
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
          justify-content: center;
        }

        .suggestions a {
          color: #6366f1;
          text-decoration: none;
        }

        .suggestions a:hover {
          text-decoration: underline;
        }
      `}</style>

      <div className="error-code">404</div>

      <h1>Page Not Found</h1>

      <p>
        The page you're looking for doesn't exist or has been moved.
        Check the URL or navigate using the links below.
      </p>

      <div className="action-links">
        <a href="/" className="primary">Go Home</a>
        <a href="/users" className="secondary">View Users</a>
      </div>

      <div className="suggestions">
        <h3>Popular Pages</h3>
        <ul>
          <li><a href="/">Home</a></li>
          <li><a href="/users">Users</a></li>
          <li><a href="/settings">Settings</a></li>
          <li><a href="/profile">Profile</a></li>
          <li><a href="/docs/getting-started">Documentation</a></li>
        </ul>
      </div>
    </div>
  );
}
