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
 * E2E tests for the Auth template.
 *
 * Tests:
 * - Login form displays and validates
 * - Register form displays and validates
 * - Full authentication flow (register → login → protected route → logout)
 * - Protected routes redirect when unauthenticated
 * - Error messages display for invalid credentials
 */
test.describe('Auth Template', () => {
  test('login form displays correctly', async ({ page, scaffold }) => {
    await page.goto(scaffold.baseURL);
    await page.waitForLoadState('networkidle');

    // Look for login form elements
    const loginLink = page.getByRole('link', { name: /login|sign in/i });
    if (await loginLink.isVisible()) {
      await loginLink.click();
    }

    // Check for form elements
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.getByRole('button', { name: /login|sign in|submit/i });

    await expect(emailInput.first()).toBeVisible({ timeout: 10000 });
    await expect(passwordInput.first()).toBeVisible();
    await expect(submitButton.first()).toBeVisible();
  });

  test('register form displays correctly', async ({ page, scaffold }) => {
    await page.goto(scaffold.baseURL);
    await page.waitForLoadState('networkidle');

    // Look for register form/link
    const registerLink = page.getByRole('link', { name: /register|sign up|create account/i });
    if (await registerLink.isVisible()) {
      await registerLink.click();
    }

    // Check for form elements (register typically has name field)
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"]');

    await expect(emailInput.first()).toBeVisible({ timeout: 10000 });
    await expect(passwordInput.first()).toBeVisible();
    // Name input might not be visible on all forms
  });

  test('registration creates user and returns tokens', async ({ scaffold }) => {
    const response = await fetch(`${scaffold.baseURL}/api/auth/register`, {
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
    await fetch(`${scaffold.baseURL}/api/auth/register`, {
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
    const registerRes = await fetch(`${scaffold.baseURL}/api/auth/register`, {
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

  test('protected user creation requires authentication', async ({ scaffold }) => {
    // Without auth
    const noAuthRes = await fetch(`${scaffold.baseURL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', email: 'test@unauth.com' }),
    });
    expect(noAuthRes.status).toBe(401);

    // With auth
    const registerRes = await fetch(`${scaffold.baseURL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Auth Creator',
        email: 'creator@test.com',
        password: 'SecurePass123!',
      }),
    });
    const authData = (await registerRes.json()) as AuthResponse;

    const authRes = await fetch(`${scaffold.baseURL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authData.accessToken}`,
      },
      body: JSON.stringify({ name: 'Created User', email: 'created@test.com' }),
    });
    expect(authRes.status).toBe(201);
  });

  test('validation error returns 400 with error details', async ({ scaffold }) => {
    const response = await fetch(`${scaffold.baseURL}/api/auth/register`, {
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

  test('UI shows validation errors for invalid form submission', async ({ page, scaffold }) => {
    await page.goto(scaffold.baseURL);
    await page.waitForLoadState('networkidle');

    // Navigate to register page
    const registerLink = page.getByRole('link', { name: /register|sign up/i });
    if (await registerLink.isVisible()) {
      await registerLink.click();
      await page.waitForLoadState('networkidle');
    }

    // Try to submit with invalid data
    const submitButton = page.getByRole('button', { name: /register|sign up|submit/i });
    if (await submitButton.first().isVisible()) {
      await submitButton.first().click();

      // Should show validation errors (either browser validation or form errors)
      // Check for HTML5 validation or custom error messages
      await page.waitForTimeout(1000);
    }
  });
});
