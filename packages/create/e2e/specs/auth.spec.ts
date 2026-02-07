import { expect, test } from '../fixtures/scaffold';

// Type definitions for API responses
interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

/**
 * Helper to make API requests with retry on rate limiting (429).
 */
async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  maxRetries = 2
): Promise<Response> {
  let lastResponse: Response | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    lastResponse = await fetch(url, options);
    if (lastResponse.status !== 429) {
      return lastResponse;
    }
    // Wait before retry
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  // lastResponse is guaranteed to be set since maxRetries >= 1
  return lastResponse as Response;
}

/**
 * E2E tests for the Auth template.
 *
 * Note: The Auth template is API-only. The frontend is a separate app
 * that would be started independently. These tests validate the API server.
 *
 * Tests:
 * - Authentication endpoints (register, login, me)
 * - Protected routes require authentication
 * - Token validation
 * - Error handling for invalid credentials
 */
test.describe('Auth Template', () => {
  test('registration creates user and returns tokens', async ({ scaffold }) => {
    const response = await fetchWithRetry(`${scaffold.baseURL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'E2E Auth User',
        email: 'e2eauth@test.com',
        password: 'SecurePass123!',
      }),
    });

    expect([200, 201]).toContain(response.status);
    const data = (await response.json()) as AuthResponse;
    expect(data.accessToken).toBeDefined();
  });

  test('login returns tokens for valid credentials', async ({ scaffold }) => {
    // First register
    await fetchWithRetry(`${scaffold.baseURL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Login Test User',
        email: 'logintest@test.com',
        password: 'SecurePass123!',
      }),
    });

    // Then login
    const response = await fetch(`${scaffold.baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'logintest@test.com',
        password: 'SecurePass123!',
      }),
    });

    expect([200, 201]).toContain(response.status);
    const data = (await response.json()) as AuthResponse;
    expect(data.accessToken).toBeDefined();
  });

  test('protected endpoint rejects unauthenticated requests', async ({ scaffold }) => {
    const response = await fetch(`${scaffold.baseURL}/api/auth/me`);
    expect(response.status).toBe(401);
  });

  test('protected endpoint accepts valid token', async ({ scaffold }) => {
    // Register and get token
    const registerRes = await fetchWithRetry(`${scaffold.baseURL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Protected Test',
        email: 'protected@test.com',
        password: 'SecurePass123!',
      }),
    });
    const authData = (await registerRes.json()) as AuthResponse;

    // Access protected endpoint
    const meRes = await fetch(`${scaffold.baseURL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${authData.accessToken}` },
    });
    expect(meRes.status).toBe(200);

    const userData = (await meRes.json()) as User;
    expect(userData.email).toBe('protected@test.com');
    expect(userData.name).toBe('Protected Test');
  });

  test('protected endpoint rejects invalid token', async ({ scaffold }) => {
    const response = await fetch(`${scaffold.baseURL}/api/auth/me`, {
      headers: { Authorization: 'Bearer invalid.token.here' },
    });
    expect(response.status).toBe(401);
  });

  test('invalid credentials return 401', async ({ scaffold }) => {
    const response = await fetch(`${scaffold.baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nonexistent@test.com',
        password: 'wrongpassword',
      }),
    });
    expect(response.status).toBe(401);
  });

  test('users endpoint is accessible', async ({ scaffold }) => {
    // The /api/users endpoint is public in the auth template
    const response = await fetch(`${scaffold.baseURL}/api/users`);
    expect(response.status).toBe(200);
  });

  test('validation error returns 400 with error details', async ({ scaffold }) => {
    const response = await fetchWithRetry(`${scaffold.baseURL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '',
        email: 'invalid-email',
        password: '123', // Too short
      }),
    });
    expect(response.status).toBe(400);
  });

  test.describe('Frontend', () => {
    test('shows login form by default', async ({ page, scaffold }) => {
      await page.goto(scaffold.webURL);
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(/welcome to veloxts/i).first()).toBeVisible({ timeout: 15000 });
      await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible();
      await expect(page.locator('input[type="password"]').first()).toBeVisible();
    });

    test('can switch between login and register tabs', async ({ page, scaffold }) => {
      await page.goto(scaffold.webURL);
      await page.waitForLoadState('networkidle');
      // Click Register tab
      await page.getByRole('button', { name: /register/i }).click();
      // Name field should appear (register has Name, login doesn't)
      await expect(
        page.locator('input[placeholder="Name"], input[name="name"]').first()
      ).toBeVisible({ timeout: 5000 });
    });

    test('full auth flow: login, see welcome, logout', async ({ page, scaffold }) => {
      // Uses 'e2eauth@test.com' registered by the API test above.
      // We log in instead of registering to avoid the registration rate limit
      // (maxAttempts: 3/hour, already consumed by API tests).
      await page.goto(scaffold.webURL);
      await page.waitForLoadState('networkidle');

      // Login tab is shown by default — fill credentials
      await page.locator('input[type="email"], input[name="email"]').first().fill('e2eauth@test.com');
      await page.locator('input[type="password"]').first().fill('SecurePass123!');

      // Submit login
      await page.getByRole('button', { name: /sign in/i }).click();

      // Should transition to the logged-in view showing the user's email and profile
      await expect(page.getByText('e2eauth@test.com').first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(/your profile/i).first()).toBeVisible();

      // Logout
      await page.getByRole('button', { name: /logout/i }).click();

      // Should return to login form
      await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible({
        timeout: 15000,
      });
    });

    test('about page renders', async ({ page, scaffold }) => {
      await page.goto(`${scaffold.webURL}/about`);
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(/about veloxts/i).first()).toBeVisible({ timeout: 15000 });
    });
  });
});
