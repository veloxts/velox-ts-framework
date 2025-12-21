/**
 * New Post Page
 *
 * A React Server Component with a form to create a new post.
 * Demonstrates static route precedence: /users/:id/posts/new
 * (static 'new' matches before dynamic :postId)
 */

import { db } from '../../../../../src/api/database.js';

interface PageProps {
  params: Record<string, string>;
  searchParams: Record<string, string | string[]>;
}

export default async function NewPostPage({ params }: PageProps) {
  const { id: userId } = params;

  // Verify user exists
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true },
  });

  if (!user) {
    return (
      <div className="new-post-page">
        <h1>User Not Found</h1>
        <p>
          Cannot create post - no user exists with ID: <code>{userId}</code>
        </p>
        <p>
          <a href="/users">Back to Users</a>
        </p>
      </div>
    );
  }

  return (
    <div className="new-post-page">
      <header className="page-header">
        <h1>New Post</h1>
        <p>Create a new post for {user.name}</p>
      </header>

      <form className="post-form" action={`/api/users/${userId}/posts`} method="POST">
        <div className="form-group">
          <label htmlFor="title">Title</label>
          <input type="text" id="title" name="title" required placeholder="Enter post title" />
        </div>

        <div className="form-group">
          <label htmlFor="content">Content</label>
          <textarea id="content" name="content" rows={6} placeholder="Write your post content..." />
        </div>

        <div className="form-group">
          <label>
            <input type="checkbox" name="published" value="true" /> Publish immediately
          </label>
        </div>

        <div className="form-actions">
          <button type="submit">Create Post</button>
          <a href={`/users/${userId}/posts`}>Cancel</a>
        </div>
      </form>

      <footer className="page-footer">
        <p>
          <small>
            Note: This page demonstrates static route precedence. The path /users/:id/posts/new
            matches before /users/:id/posts/:postId
          </small>
        </p>
      </footer>
    </div>
  );
}
