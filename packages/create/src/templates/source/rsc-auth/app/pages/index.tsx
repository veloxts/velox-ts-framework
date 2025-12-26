/**
 * Home Page
 *
 * A React Server Component that runs on the server at request time.
 * For database access, use the API endpoints at /api/*.
 */

export default function HomePage() {
  return (
    <div className="home-page">
      <header className="hero">
        <h1>Welcome to VeloxTS</h1>
        <p className="tagline">Full-stack React Server Components with Authentication</p>
      </header>

      <section className="quick-links">
        <h2>Quick Links</h2>
        <ul>
          <li>
            <a href="/auth/login">Login</a>
          </li>
          <li>
            <a href="/auth/register">Register</a>
          </li>
          <li>
            <a href="/dashboard">Dashboard</a> (requires login)
          </li>
          <li>
            <a href="/users">Users</a>
          </li>
        </ul>
      </section>

      <section className="api-endpoints">
        <h2>API Endpoints</h2>
        <ul>
          <li>
            <code>GET /api/health</code> - Health check
          </li>
          <li>
            <code>POST /api/auth/register</code> - Create account
          </li>
          <li>
            <code>POST /api/auth/login</code> - Get tokens
          </li>
          <li>
            <code>GET /api/auth/me</code> - Current user (protected)
          </li>
          <li>
            <code>GET /api/users</code> - List users
          </li>
        </ul>
      </section>

      <section className="features">
        <h2>Features</h2>
        <ul>
          <li>
            <strong>JWT Authentication</strong> - Access and refresh tokens
          </li>
          <li>
            <strong>Rate Limiting</strong> - Built-in protection for auth endpoints
          </li>
          <li>
            <strong>Password Validation</strong> - Strength requirements enforced
          </li>
          <li>
            <strong>Role-Based Access</strong> - Authorization via guards
          </li>
          <li>
            <strong>Server Actions</strong> - Type-safe with validated() helper
          </li>
        </ul>
      </section>

      <footer className="cta">
        <p>
          Edit <code>app/pages/index.tsx</code> to customize this page.
        </p>
      </footer>
    </div>
  );
}
