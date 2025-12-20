/**
 * Post Detail Page
 *
 * A React Server Component that displays a single post.
 * Demonstrates multi-level nested dynamic routes: /users/:id/posts/:postId
 */

import { db } from '../../../../../src/api/database.js';

interface PageProps {
  params: Record<string, string>;
  searchParams: Record<string, string | string[]>;
}

export default async function PostDetailPage({ params }: PageProps) {
  const { id: userId, postId } = params;

  // Fetch post with user
  const post = await db.post.findFirst({
    where: {
      id: postId,
      userId: userId,
    },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!post) {
    return (
      <div className="post-detail-page">
        <h1>Post Not Found</h1>
        <p>
          No post exists with ID: <code>{postId}</code>
        </p>
        <p>
          <a href={`/users/${userId}/posts`}>Back to Posts</a>
        </p>
      </div>
    );
  }

  return (
    <div className="post-detail-page">
      <article className="post">
        <header className="post-header">
          <h1>{post.title}</h1>
          <p className="post-meta">
            By <a href={`/users/${post.user.id}`}>{post.user.name}</a>
            {' | '}
            {post.published ? 'Published' : 'Draft'}
            {' | '}
            {post.createdAt.toLocaleDateString()}
          </p>
        </header>

        <section className="post-content">
          {post.content ? (
            <p>{post.content}</p>
          ) : (
            <p className="empty-content">No content</p>
          )}
        </section>

        <footer className="post-footer">
          <dl>
            <dt>Post ID</dt>
            <dd><code>{post.id}</code></dd>

            <dt>Author Email</dt>
            <dd>{post.user.email}</dd>

            <dt>Created</dt>
            <dd>{post.createdAt.toISOString()}</dd>

            <dt>Updated</dt>
            <dd>{post.updatedAt.toISOString()}</dd>
          </dl>
        </footer>
      </article>

      <nav className="actions">
        <a href={`/users/${userId}/posts`}>Back to Posts</a>
        {' | '}
        <a href={`/users/${userId}`}>User Profile</a>
      </nav>
    </div>
  );
}
