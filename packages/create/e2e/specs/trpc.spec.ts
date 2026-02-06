import { expect, test } from '../fixtures/scaffold';

// Type definitions for tRPC responses
interface TRPCResponse<T> {
  result: {
    data: T;
  };
}

interface TRPCError {
  error: {
    message: string;
    code: string;
  };
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface HealthStatus {
  status: string;
}

/**
 * E2E tests for the tRPC-only template.
 *
 * Tests:
 * - tRPC endpoints work correctly
 * - REST endpoints return 404 (not registered)
 * - tRPC queries and mutations function properly
 */
test.describe('tRPC Template', () => {
  test('tRPC health endpoint works', async ({ scaffold }) => {
    const response = await fetch(`${scaffold.baseURL}/trpc/health.getHealth`);
    expect(response.status).toBe(200);

    const data = (await response.json()) as TRPCResponse<HealthStatus>;
    expect(data.result).toBeDefined();
    expect(data.result.data).toHaveProperty('status');
  });

  test('tRPC listUsers query returns success response', async ({ scaffold }) => {
    const response = await fetch(`${scaffold.baseURL}/trpc/users.listUsers`);
    expect(response.status).toBe(200);

    const data = await response.json();
    // tRPC response structure: { result: { data: [...] } }
    expect(data.result).toBeDefined();
  });

  test('tRPC createUser mutation creates user', async ({ scaffold }) => {
    const response = await fetch(`${scaffold.baseURL}/trpc/users.createUser`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'tRPC User', email: 'trpc@test.com' }),
    });
    expect(response.status).toBe(200);

    const data = (await response.json()) as TRPCResponse<User>;
    expect(data.result).toBeDefined();
    expect(data.result.data.id).toBeDefined();
    expect(data.result.data.name).toBe('tRPC User');
  });

  test('tRPC getUser query retrieves user', async ({ scaffold }) => {
    // Create a user first
    const createRes = await fetch(`${scaffold.baseURL}/trpc/users.createUser`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Get Test', email: 'gettest@test.com' }),
    });
    const createData = (await createRes.json()) as TRPCResponse<User>;
    const userId = createData.result.data.id;

    // Get the user
    const response = await fetch(
      `${scaffold.baseURL}/trpc/users.getUser?input=${encodeURIComponent(JSON.stringify({ id: userId }))}`
    );
    expect(response.status).toBe(200);

    const data = (await response.json()) as TRPCResponse<User>;
    expect(data.result.data.name).toBe('Get Test');
  });

  test('tRPC deleteUser mutation removes user', async ({ scaffold }) => {
    // Create a user first
    const createRes = await fetch(`${scaffold.baseURL}/trpc/users.createUser`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Delete Test', email: 'delete@test.com' }),
    });
    const createData = (await createRes.json()) as TRPCResponse<User>;
    const userId = createData.result.data.id;

    // Delete the user
    const response = await fetch(`${scaffold.baseURL}/trpc/users.deleteUser`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId }),
    });
    expect(response.status).toBe(200);

    // Verify deletion
    const getRes = await fetch(
      `${scaffold.baseURL}/trpc/users.getUser?input=${encodeURIComponent(JSON.stringify({ id: userId }))}`
    );
    expect(getRes.status).toBe(500); // tRPC returns 500 for not found errors
  });

  test('REST /api/users returns 404 (not registered)', async ({ scaffold }) => {
    const response = await fetch(`${scaffold.baseURL}/api/users`);
    expect(response.status).toBe(404);
  });

  test('REST /api/health returns 404 (not registered)', async ({ scaffold }) => {
    const response = await fetch(`${scaffold.baseURL}/api/health`);
    expect(response.status).toBe(404);
  });

  test('tRPC error handling returns proper error format', async ({ scaffold }) => {
    // Try to get non-existent user
    const response = await fetch(
      `${scaffold.baseURL}/trpc/users.getUser?input=${encodeURIComponent(JSON.stringify({ id: '00000000-0000-0000-0000-000000000000' }))}`
    );

    // tRPC returns 500 for internal errors (like Prisma not found)
    expect([404, 500]).toContain(response.status);

    const data = (await response.json()) as TRPCError;
    expect(data.error).toBeDefined();
  });

  test.describe('Frontend', () => {
    test('home page renders', async ({ page, scaffold }) => {
      await page.goto(scaffold.webURL);
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(/welcome to veloxts/i).first()).toBeVisible({ timeout: 15000 });
    });

    test('users page renders via tRPC', async ({ page, scaffold }) => {
      await page.goto(`${scaffold.webURL}/users`);
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(/users/i).first()).toBeVisible({ timeout: 15000 });
    });

    test('about page renders', async ({ page, scaffold }) => {
      await page.goto(`${scaffold.webURL}/about`);
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(/about veloxts/i).first()).toBeVisible({ timeout: 15000 });
    });

    test('navigation links work', async ({ page, scaffold }) => {
      await page.goto(scaffold.webURL);
      await page.waitForLoadState('networkidle');
      await page.getByRole('link', { name: /users/i }).click();
      await expect(page.getByText(/users/i).first()).toBeVisible({ timeout: 15000 });
    });
  });
});
