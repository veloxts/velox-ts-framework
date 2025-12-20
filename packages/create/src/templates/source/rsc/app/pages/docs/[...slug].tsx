/**
 * Docs Catch-All Page
 *
 * A React Server Component that handles all /docs/* routes.
 * Demonstrates catch-all routing with [...slug] pattern.
 *
 * Examples:
 *   /docs/getting-started         -> slug = "getting-started"
 *   /docs/api/reference           -> slug = "api/reference"
 *   /docs/api/reference/types     -> slug = "api/reference/types"
 */

interface PageProps {
  params: Record<string, string>;
  searchParams: Record<string, string | string[]>;
}

// Mock documentation structure
const docsTree: Record<string, { title: string; content: string }> = {
  'getting-started': {
    title: 'Getting Started',
    content: 'Welcome to VeloxTS! This guide will help you get up and running quickly.',
  },
  'installation': {
    title: 'Installation',
    content: 'Install VeloxTS using your preferred package manager: pnpm, npm, or yarn.',
  },
  'api/reference': {
    title: 'API Reference',
    content: 'Complete reference for all VeloxTS APIs and utilities.',
  },
  'api/reference/types': {
    title: 'Type Definitions',
    content: 'TypeScript type definitions exported by VeloxTS packages.',
  },
  'guides/routing': {
    title: 'Routing Guide',
    content: 'Learn about file-based routing, dynamic routes, and catch-all patterns.',
  },
  'guides/layouts': {
    title: 'Layouts Guide',
    content: 'Understand how layouts work with route groups and segment inheritance.',
  },
};

export default async function DocsPage({ params }: PageProps) {
  const slug = params.slug || 'getting-started';
  const segments = slug.split('/');

  // Look up documentation
  const doc = docsTree[slug];

  return (
    <div className="docs-page">
      <style>{`
        .docs-page {
          display: flex;
          gap: 2rem;
          min-height: 60vh;
        }

        .docs-sidebar {
          width: 200px;
          flex-shrink: 0;
        }

        .docs-sidebar h3 {
          font-size: 0.75rem;
          text-transform: uppercase;
          color: #888;
          margin-bottom: 0.5rem;
        }

        .docs-sidebar ul {
          list-style: none;
          margin-bottom: 1rem;
        }

        .docs-sidebar a {
          display: block;
          padding: 0.25rem 0;
          color: #1a1a2e;
          text-decoration: none;
        }

        .docs-sidebar a:hover {
          color: #6366f1;
        }

        .docs-main {
          flex: 1;
          background: white;
          border-radius: 8px;
          padding: 2rem;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .docs-breadcrumb {
          font-size: 0.875rem;
          color: #888;
          margin-bottom: 1rem;
        }

        .docs-breadcrumb a {
          color: #6366f1;
          text-decoration: none;
        }

        .docs-content {
          line-height: 1.8;
        }

        .docs-meta {
          margin-top: 2rem;
          padding-top: 1rem;
          border-top: 1px solid #eee;
          font-size: 0.875rem;
          color: #888;
        }

        .not-found {
          text-align: center;
          padding: 2rem;
        }

        .not-found h1 {
          color: #e11d48;
        }
      `}</style>

      <aside className="docs-sidebar">
        <h3>Getting Started</h3>
        <ul>
          <li><a href="/docs/getting-started">Getting Started</a></li>
          <li><a href="/docs/installation">Installation</a></li>
        </ul>

        <h3>API Reference</h3>
        <ul>
          <li><a href="/docs/api/reference">Overview</a></li>
          <li><a href="/docs/api/reference/types">Types</a></li>
        </ul>

        <h3>Guides</h3>
        <ul>
          <li><a href="/docs/guides/routing">Routing</a></li>
          <li><a href="/docs/guides/layouts">Layouts</a></li>
        </ul>
      </aside>

      <main className="docs-main">
        <nav className="docs-breadcrumb">
          <a href="/">Home</a>
          {' / '}
          <a href="/docs/getting-started">Docs</a>
          {segments.map((segment, i) => (
            <span key={segment}>
              {' / '}
              {i === segments.length - 1 ? (
                segment
              ) : (
                <a href={`/docs/${segments.slice(0, i + 1).join('/')}`}>{segment}</a>
              )}
            </span>
          ))}
        </nav>

        {doc ? (
          <article className="docs-content">
            <h1>{doc.title}</h1>
            <p>{doc.content}</p>

            <div className="docs-meta">
              <p>
                <strong>Path:</strong> /docs/{slug}
              </p>
              <p>
                <strong>Segments:</strong> {segments.length} ({segments.join(' -> ')})
              </p>
              <p>
                <strong>Route Pattern:</strong> [...slug] (catch-all)
              </p>
            </div>
          </article>
        ) : (
          <div className="not-found">
            <h1>Documentation Not Found</h1>
            <p>
              No documentation exists for: <code>/docs/{slug}</code>
            </p>
            <p>
              <a href="/docs/getting-started">Go to Getting Started</a>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
