/**
 * User Posts List Page
 *
 * A React Server Component that displays all posts for a specific user.
 * Demonstrates multi-level nested dynamic routes: /users/:id/posts
 */

import type { Post } from '@prisma/client';

import { db } from '../../../../../src/api/database.js';

interface PageProps {
  params: Record<string, string>;
  searchParams: Record<string, string | string[]>;
}

export default async function UserPostsPage({ params }: PageProps) {
  const { id: userId } = params;

  // Fetch user with posts
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      posts: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!user) {
    return (
      <div className="posts-page">
        <h1>User Not Found</h1>
        <p>
          No user exists with ID: <code>{userId}</code>
        </p>
        <p>
          <a href="/users">Back to Users</a>
        </p>
      </div>
    );
  }

  return (
    <div className="posts-page">
      <header className="page-header">
        <h1>Posts by {user.name}</h1>
        <p>
          <a href={`/users/${userId}`}>Back to User Profile</a>
          {' | '}
          <a href={`/users/${userId}/posts/new`}>New Post</a>
        </p>
      </header>

      {user.posts.length === 0 ? (
        <p className="empty-state">No posts yet. Create the first one!</p>
      ) : (
        <ul className="posts-list">
          {user.posts.map((post: Post) => (
            <li key={post.id} className="post-item">
              <a href={`/users/${userId}/posts/${post.id}`}>
                <h2>{post.title}</h2>
                {post.content && <p>{post.content.substring(0, 100)}...</p>}
                <small>
                  {post.published ? 'Published' : 'Draft'} - {post.createdAt.toLocaleDateString()}
                </small>
              </a>
            </li>
          ))}
        </ul>
      )}

      <footer className="page-footer">
        <p>Total: {user.posts.length} posts</p>
      </footer>
    </div>
  );
}
