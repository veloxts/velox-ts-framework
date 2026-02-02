import { expect, test } from '../fixtures/scaffold';

// Type definitions for API responses
interface User {
  id: string;
  name: string;
  email: string;
}

interface HealthResponse {
  status: string;
}

/**
 * E2E tests for the SPA (default) template.
 *
 * Tests:
 * - Home page renders with navigation
 * - API status card displays health info
 * - Users table displays data from API
 * - Page links navigate correctly
 */
test.describe('SPA Template (Default)', () => {
  test('home page renders with navigation', async ({ page, scaffold }) => {
    await page.goto(scaffold.baseURL);

    // Check page title or main heading
    await expect(page.locator('h1, h2').first()).toBeVisible();

    // Check navigation links exist
    const nav = page.locator('nav, header');
    await expect(nav).toBeVisible();
  });

  test('API status card shows health info', async ({ page, scaffold }) => {
    await page.goto(scaffold.baseURL);

    // Wait for API data to load
    await page.waitForLoadState('networkidle');

    // Look for status indicator (healthy/connected text or status card)
    const statusIndicator = page.getByText(/healthy|connected|online|status|ok/i);
    await expect(statusIndicator.first()).toBeVisible({ timeout: 10000 });
  });

  test('users table displays data from API', async ({ page, scaffold }) => {
    // First, create a test user via API
    const createResponse = await fetch(`${scaffold.baseURL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'E2E Test User', email: 'e2e@test.com' }),
    });
    expect(createResponse.status).toBe(201);

    // Navigate to page
    await page.goto(scaffold.baseURL);
    await page.waitForLoadState('networkidle');

    // Check for user data in the page
    const userText = page.getByText('E2E Test User');
    await expect(userText).toBeVisible({ timeout: 10000 });
  });

  test('navigation links work correctly', async ({ page, scaffold }) => {
    await page.goto(scaffold.baseURL);

    // Find and click a navigation link (if exists)
    const navLinks = page.locator('nav a, header a');
    const linkCount = await navLinks.count();

    if (linkCount > 0) {
      // Click the first link
      await navLinks.first().click();
      await page.waitForLoadState('networkidle');

      // Should navigate without errors (no 404)
      expect(page.url()).not.toContain('404');
    }
  });

  test('API health endpoint returns correct data', async ({ scaffold }) => {
    const response = await fetch(`${scaffold.baseURL}/api/health`);
    expect(response.status).toBe(200);

    const data = (await response.json()) as HealthResponse;
    expect(data).toHaveProperty('status');
  });

  test('API users endpoint supports CRUD operations', async ({ scaffold }) => {
    // Create
    const createRes = await fetch(`${scaffold.baseURL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'CRUD Test', email: 'crud@test.com' }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as User;
    expect(created.id).toBeDefined();

    // Read
    const getRes = await fetch(`${scaffold.baseURL}/api/users/${created.id}`);
    expect(getRes.status).toBe(200);
    const fetched = (await getRes.json()) as User;
    expect(fetched.name).toBe('CRUD Test');

    // Update
    const updateRes = await fetch(`${scaffold.baseURL}/api/users/${created.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'CRUD Updated', email: 'crud@test.com' }),
    });
    expect(updateRes.status).toBe(200);

    // Delete
    const deleteRes = await fetch(`${scaffold.baseURL}/api/users/${created.id}`, {
      method: 'DELETE',
    });
    expect(deleteRes.status).toBe(200);
  });

  test('API returns 400 for invalid input', async ({ scaffold }) => {
    const response = await fetch(`${scaffold.baseURL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', email: 'invalid-email' }),
    });
    expect(response.status).toBe(400);
  });

  test('API returns 404 for non-existent user', async ({ scaffold }) => {
    const response = await fetch(
      `${scaffold.baseURL}/api/users/00000000-0000-0000-0000-000000000000`
    );
    expect(response.status).toBe(404);
  });
});
