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
 * Note: The SPA template is API-only for E2E testing. The frontend is a separate app
 * that would be started independently. These tests validate the API server.
 *
 * Tests:
 * - Health endpoint works
 * - CRUD operations work
 * - Error handling works
 */
test.describe('SPA Template (Default)', () => {
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
