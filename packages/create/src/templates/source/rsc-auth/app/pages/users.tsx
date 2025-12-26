/**
 * Users Page (RSC)
 *
 * A React Server Component listing users.
 * For database access, use the API endpoint at /api/users.
 */

export default function UsersPage() {
  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Users</h1>
      <p style={{ color: '#666' }}>
        Fetch user data from the API at <code>/api/users</code>
      </p>

      <div
        style={{ marginTop: '2rem', padding: '1rem', background: '#f5f5f5', borderRadius: '8px' }}
      >
        <h3>API Usage</h3>
        <pre
          style={{
            background: '#1e1e1e',
            color: '#d4d4d4',
            padding: '1rem',
            borderRadius: '4px',
            overflow: 'auto',
          }}
        >
          {`// Fetch users from the API
const response = await fetch('/api/users');
const users = await response.json();

// Or use the typed client
import { createClient } from '@veloxts/client';
const client = createClient('/api');
const users = await client.users.list();`}
        </pre>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <a href="/" style={{ color: '#007bff' }}>
          &larr; Back to Home
        </a>
      </div>
    </div>
  );
}
