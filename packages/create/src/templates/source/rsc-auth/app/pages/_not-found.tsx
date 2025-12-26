/**
 * 404 Not Found Page
 */

export default function NotFoundPage() {
  return (
    <div style={{ padding: '4rem', textAlign: 'center' }}>
      <h1 style={{ fontSize: '4rem', margin: 0 }}>404</h1>
      <p style={{ fontSize: '1.5rem', color: '#666' }}>Page not found</p>
      <a href="/" style={{ color: '#007bff' }}>Go home</a>
    </div>
  );
}
