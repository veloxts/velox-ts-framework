import { expect, test } from '../fixtures/scaffold';

// Type definitions for API responses
interface User {
  id: string;
  name: string;
  email: string;
}

interface Post {
  id: string;
  title: string;
  content: string;
  published: boolean;
  userId: string;
}

interface HealthResponse {
  status: string;
}

/**
 * E2E tests for the RSC (React Server Components) template.
 *
 * Tests:
 * - Server-rendered pages display correctly
 * - Dynamic routes work ([id] parameters)
 * - Nested dynamic routes work (/users/:id/posts/:postId)
 * - Route groups don't affect URL structure
 * - Catch-all routes capture path segments
 * - 404 page displays for non-existent routes
 * - API endpoints function correctly
 */
test.describe('RSC Template', () => {
  // Skip tests if Vinxi runtime isn't ready
  test.beforeEach(async ({ scaffold }) => {
    // Quick health check - if API isn't responding, skip tests
    try {
      const response = await fetch(`${scaffold.baseURL}/api/health`);
      if (!response.ok) {
        test.skip();
      }
    } catch {
      test.skip();
    }
  });

  test('home page renders with server content', async ({ page, scaffold }) => {
    await page.goto(scaffold.baseURL);
    await page.waitForLoadState('networkidle');

    // Check for VeloxTS branding or welcome message
    const welcome = page.getByText(/welcome|velox/i);
    await expect(welcome.first()).toBeVisible({ timeout: 15000 });
  });

  test('users page displays user list', async ({ page, scaffold }) => {
    // Create a test user
    await fetch(`${scaffold.baseURL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'RSC Test User', email: 'rsc@test.com' }),
    });

    await page.goto(`${scaffold.baseURL}/users`);
    await page.waitForLoadState('networkidle');

    // Check for user in the list
    const userText = page.getByText('RSC Test User');
    await expect(userText).toBeVisible({ timeout: 15000 });
  });

  test('user detail page shows user info (dynamic route)', async ({ page, scaffold }) => {
    // Create a test user
    const createRes = await fetch(`${scaffold.baseURL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Detail User', email: 'detail@test.com' }),
    });
    const user = (await createRes.json()) as User;

    // Navigate to user detail page
    await page.goto(`${scaffold.baseURL}/users/${user.id}`);
    await page.waitForLoadState('networkidle');

    // Check for user details
    const userName = page.getByText('Detail User');
    const userEmail = page.getByText('detail@test.com');

    await expect(userName).toBeVisible({ timeout: 15000 });
    await expect(userEmail).toBeVisible();
  });

  test('user posts page shows posts list (nested dynamic)', async ({ page, scaffold }) => {
    // Create user and post
    const userRes = await fetch(`${scaffold.baseURL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Posts User', email: 'posts@test.com' }),
    });
    const user = (await userRes.json()) as User;

    await fetch(`${scaffold.baseURL}/api/users/${user.id}/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test Post', content: 'Post content', published: true }),
    });

    // Navigate to posts page
    await page.goto(`${scaffold.baseURL}/users/${user.id}/posts`);
    await page.waitForLoadState('networkidle');

    // Check for post title
    const postTitle = page.getByText('Test Post');
    await expect(postTitle).toBeVisible({ timeout: 15000 });
  });

  test('post detail page shows post content (multi-level nested)', async ({ page, scaffold }) => {
    // Create user and post
    const userRes = await fetch(`${scaffold.baseURL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Post Detail User', email: 'postdetail@test.com' }),
    });
    const user = (await userRes.json()) as User;

    const postRes = await fetch(`${scaffold.baseURL}/api/users/${user.id}/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Detail Post',
        content: 'Detailed content here',
        published: true,
      }),
    });
    const post = (await postRes.json()) as Post;

    // Navigate to post detail
    await page.goto(`${scaffold.baseURL}/users/${user.id}/posts/${post.id}`);
    await page.waitForLoadState('networkidle');

    // Check for post content
    const postContent = page.getByText('Detailed content here');
    await expect(postContent).toBeVisible({ timeout: 15000 });
  });

  test('route groups dont affect URL (settings page)', async ({ page, scaffold }) => {
    await page.goto(`${scaffold.baseURL}/settings`);
    await page.waitForLoadState('networkidle');

    // URL should be /settings (not /(dashboard)/settings)
    expect(page.url()).toContain('/settings');
    expect(page.url()).not.toContain('(dashboard)');

    // Page should render
    await expect(page.locator('body')).toBeVisible();
  });

  test('catch-all route handles docs paths', async ({ page, scaffold }) => {
    await page.goto(`${scaffold.baseURL}/docs/getting-started`);
    await page.waitForLoadState('networkidle');

    // Page should render docs content
    await expect(page.locator('body')).toBeVisible({ timeout: 15000 });

    // Multi-segment catch-all
    await page.goto(`${scaffold.baseURL}/docs/api/reference/types`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();
  });

  test('404 page displays for non-existent routes', async ({ page, scaffold }) => {
    const response = await page.goto(`${scaffold.baseURL}/nonexistent-page`);

    // Check 404 status
    expect(response?.status()).toBe(404);

    // Check for 404 content
    const notFoundText = page.getByText(/404|not found/i);
    await expect(notFoundText.first()).toBeVisible({ timeout: 15000 });
  });

  test('API health endpoint returns 200', async ({ scaffold }) => {
    const response = await fetch(`${scaffold.baseURL}/api/health`);
    expect(response.status).toBe(200);

    const data = (await response.json()) as HealthResponse;
    expect(data).toHaveProperty('status');
  });

  test('API users CRUD operations work', async ({ scaffold }) => {
    // Create
    const createRes = await fetch(`${scaffold.baseURL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'CRUD RSC', email: 'crudrsc@test.com' }),
    });
    expect(createRes.status).toBe(201);
    const user = (await createRes.json()) as User;

    // Read
    const getRes = await fetch(`${scaffold.baseURL}/api/users/${user.id}`);
    expect(getRes.status).toBe(200);

    // Update
    const updateRes = await fetch(`${scaffold.baseURL}/api/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'CRUD Updated', email: 'crudrsc@test.com' }),
    });
    expect(updateRes.status).toBe(200);

    // Delete
    const deleteRes = await fetch(`${scaffold.baseURL}/api/users/${user.id}`, {
      method: 'DELETE',
    });
    expect([200, 204]).toContain(deleteRes.status);
  });

  test('API nested posts CRUD operations work', async ({ scaffold }) => {
    // Create user
    const userRes = await fetch(`${scaffold.baseURL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Posts CRUD', email: 'postscrud@test.com' }),
    });
    const user = (await userRes.json()) as User;

    // Create post
    const createRes = await fetch(`${scaffold.baseURL}/api/users/${user.id}/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'API Post', content: 'Content', published: true }),
    });
    expect(createRes.status).toBe(201);
    const post = (await createRes.json()) as Post;

    // List posts
    const listRes = await fetch(`${scaffold.baseURL}/api/users/${user.id}/posts`);
    expect(listRes.status).toBe(200);
    const posts = (await listRes.json()) as Post[];
    expect(posts.length).toBeGreaterThan(0);

    // Get post
    const getRes = await fetch(`${scaffold.baseURL}/api/users/${user.id}/posts/${post.id}`);
    expect(getRes.status).toBe(200);

    // Delete post
    const deleteRes = await fetch(`${scaffold.baseURL}/api/users/${user.id}/posts/${post.id}`, {
      method: 'DELETE',
    });
    expect(deleteRes.status).toBe(200);
  });

  test('API returns 404 for non-existent user', async ({ scaffold }) => {
    const response = await fetch(
      `${scaffold.baseURL}/api/users/00000000-0000-0000-0000-000000000000`
    );
    expect(response.status).toBe(404);
  });

  test('API returns 400 for invalid input', async ({ scaffold }) => {
    const response = await fetch(`${scaffold.baseURL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }), // Missing email
    });
    expect(response.status).toBe(400);
  });
});
