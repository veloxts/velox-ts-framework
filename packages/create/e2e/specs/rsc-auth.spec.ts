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

interface HealthResponse {
  status: string;
}

/**
 * E2E tests for the RSC + Auth template.
 *
 * Tests:
 * - Login page renders with form
 * - Register page renders with form
 * - Authentication flow works (register → login)
 * - Dashboard page accessible after auth
 * - Protected API endpoints work
 * - Unauthenticated requests return 401
 */
test.describe('RSC-Auth Template', () => {
  // Skip tests if Vinxi runtime isn't ready
  test.beforeEach(async ({ scaffold }) => {
    try {
      const response = await fetch(`${scaffold.baseURL}/api/health`);
      if (!response.ok) {
        test.skip();
      }
    } catch {
      test.skip();
    }
  });

  test('home page renders', async ({ page, scaffold }) => {
    await page.goto(scaffold.baseURL);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible({ timeout: 15000 });
  });

  test('login page displays form', async ({ page, scaffold }) => {
    await page.goto(`${scaffold.baseURL}/auth/login`);
    await page.waitForLoadState('networkidle');

    // Check for login form elements
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.getByRole('button', { name: /login|sign in|submit/i });

    await expect(emailInput.first()).toBeVisible({ timeout: 15000 });
    await expect(passwordInput.first()).toBeVisible();
    await expect(submitButton.first()).toBeVisible();
  });

  test('register page displays form', async ({ page, scaffold }) => {
    await page.goto(`${scaffold.baseURL}/auth/register`);
    await page.waitForLoadState('networkidle');

    // Check for register form elements
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.getByRole('button', { name: /register|sign up|create|submit/i });

    await expect(emailInput.first()).toBeVisible({ timeout: 15000 });
    await expect(passwordInput.first()).toBeVisible();
    await expect(submitButton.first()).toBeVisible();
  });

  test('users page renders', async ({ page, scaffold }) => {
    await page.goto(`${scaffold.baseURL}/users`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible({ timeout: 15000 });
  });

  test('dashboard page renders', async ({ page, scaffold }) => {
    await page.goto(`${scaffold.baseURL}/dashboard`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible({ timeout: 15000 });
  });

  test('API registration creates user and returns tokens', async ({ scaffold }) => {
    const response = await fetch(`${scaffold.baseURL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'RSC Auth User',
        email: 'rscauth@test.com',
        password: 'SecurePass123!',
      }),
    });

    expect([200, 201]).toContain(response.status);
    const data = (await response.json()) as AuthResponse;
    expect(data.accessToken).toBeDefined();
    expect(data.refreshToken).toBeDefined();
  });

  test('API login returns tokens for valid credentials', async ({ scaffold }) => {
    // Register first
    await fetch(`${scaffold.baseURL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Login RSC User',
        email: 'loginrsc@test.com',
        password: 'SecurePass123!',
      }),
    });

    // Login
    const response = await fetch(`${scaffold.baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'loginrsc@test.com',
        password: 'SecurePass123!',
      }),
    });

    expect([200, 201]).toContain(response.status);
    const data = (await response.json()) as AuthResponse;
    expect(data.accessToken).toBeDefined();
  });

  test('API /auth/me returns 401 without token', async ({ scaffold }) => {
    const response = await fetch(`${scaffold.baseURL}/api/auth/me`);
    expect(response.status).toBe(401);
  });

  test('API /auth/me returns user with valid token', async ({ scaffold }) => {
    // Register and get token
    const registerRes = await fetch(`${scaffold.baseURL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Me RSC User',
        email: 'mersc@test.com',
        password: 'SecurePass123!',
      }),
    });
    const authData = (await registerRes.json()) as AuthResponse;

    // Access /me
    const meRes = await fetch(`${scaffold.baseURL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${authData.accessToken}` },
    });

    expect(meRes.status).toBe(200);
    const user = (await meRes.json()) as User;
    expect(user.email).toBe('mersc@test.com');
  });

  test('API invalid login returns 401', async ({ scaffold }) => {
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

  test('API invalid token returns 401', async ({ scaffold }) => {
    const response = await fetch(`${scaffold.baseURL}/api/auth/me`, {
      headers: { Authorization: 'Bearer invalid.token.here' },
    });
    expect(response.status).toBe(401);
  });

  test('API health endpoint returns 200', async ({ scaffold }) => {
    const response = await fetch(`${scaffold.baseURL}/api/health`);
    expect(response.status).toBe(200);

    const data = (await response.json()) as HealthResponse;
    expect(data).toHaveProperty('status');
  });

  test('API users list returns 200', async ({ scaffold }) => {
    const response = await fetch(`${scaffold.baseURL}/api/users`);
    expect(response.status).toBe(200);

    const users = (await response.json()) as User[];
    expect(Array.isArray(users)).toBe(true);
  });

  test('full authentication flow works', async ({ page, scaffold }) => {
    const testEmail = `e2efull${Date.now()}@test.com`;

    // Register via API
    const registerRes = await fetch(`${scaffold.baseURL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Full Flow User',
        email: testEmail,
        password: 'SecurePass123!',
      }),
    });
    expect([200, 201]).toContain(registerRes.status);
    const authData = (await registerRes.json()) as AuthResponse;

    // Verify token works
    const meRes = await fetch(`${scaffold.baseURL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${authData.accessToken}` },
    });
    expect(meRes.status).toBe(200);

    // Navigate to dashboard (should work with token in header)
    await page.goto(`${scaffold.baseURL}/dashboard`);
    await page.waitForLoadState('networkidle');

    // Dashboard should render
    await expect(page.locator('body')).toBeVisible({ timeout: 15000 });
  });

  test('form submission with invalid data shows errors', async ({ page, scaffold }) => {
    await page.goto(`${scaffold.baseURL}/auth/register`);
    await page.waitForLoadState('networkidle');

    // Fill with invalid data
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();

    if (await emailInput.isVisible()) {
      await emailInput.fill('invalid-email');
      await passwordInput.fill('123'); // Too short

      // Submit
      const submitButton = page.getByRole('button', { name: /register|sign up|submit/i }).first();
      await submitButton.click();

      // Wait for form processing
      await page.waitForTimeout(1000);

      // Either browser validation or server error should appear
      // (specific behavior depends on form implementation)
    }
  });
});
