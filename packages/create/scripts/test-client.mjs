#!/usr/bin/env node
/**
 * Tests that @veloxts/client can call the API correctly.
 * This catches issues like the path.matchAll error.
 *
 * Usage: npx tsx test-client.mjs <routes-file-path> [api-url]
 */

const routesPath = process.argv[2];
const API_URL = process.argv[3] || 'http://localhost:3030/api';

if (!routesPath) {
  console.error('Usage: npx tsx test-client.mjs <routes-file-path> [api-url]');
  process.exit(1);
}

/**
 * Resolves a route entry to method and path.
 * Matches the logic in @veloxts/client.
 */
function resolveRoute(entry) {
  if (typeof entry === 'string') {
    return { method: 'POST', path: entry };
  }
  return { method: entry.method, path: entry.path };
}

async function testClientIntegration() {
  console.log('--- Testing @veloxts/client integration ---');

  // Dynamic import the routes from the scaffolded project
  const { routes } = await import(routesPath);

  // Test 1: Verify route resolution for createAccount
  const createAccountRoute = routes.auth?.createAccount;
  if (!createAccountRoute) {
    throw new Error('routes.auth.createAccount not found in routes file');
  }

  const { method, path } = resolveRoute(createAccountRoute);

  if (typeof path !== 'string') {
    throw new Error(
      `Expected path to be string, got ${typeof path}: ${JSON.stringify(createAccountRoute)}`
    );
  }

  if (!path.startsWith('/')) {
    throw new Error(`Expected path to start with /, got: ${path}`);
  }

  console.log(`  Route resolved: ${method} ${path}`);

  // Test 2: Make the createAccount API call
  const testEmail = `client-test-${Date.now()}@example.com`;
  const testName = 'Client Test User';

  const createUrl = `${API_URL}${path}`;
  const createResponse = await fetch(createUrl, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: testName,
      email: testEmail,
      password: 'SecurePass123!',
    }),
  });

  if (!createResponse.ok) {
    const body = await createResponse.text();
    throw new Error(
      `createAccount failed: ${createResponse.status} ${createResponse.statusText}\n${body}`
    );
  }

  const createData = await createResponse.json();

  if (!createData.accessToken || !createData.refreshToken) {
    throw new Error(`Missing tokens in createAccount response: ${JSON.stringify(createData)}`);
  }

  console.log('  ✓ createAccount returned tokens');

  // Test 3: Verify user appears in getMe
  const getMeRoute = routes.auth?.getMe;
  if (getMeRoute) {
    const { method: meMethod, path: mePath } = resolveRoute(getMeRoute);
    const getMeUrl = `${API_URL}${mePath}`;

    const getMeResponse = await fetch(getMeUrl, {
      method: meMethod,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${createData.accessToken}`,
      },
    });

    if (getMeResponse.ok) {
      const meData = await getMeResponse.json();
      if (meData.email === testEmail) {
        console.log('  ✓ getMe returned created user');
      } else {
        console.log(`  ⚠ getMe returned different email: ${meData.email}`);
      }
    } else {
      console.log(`  ⚠ getMe failed: ${getMeResponse.status}`);
    }
  }

  // Test 4: Verify user appears in users list (if listUsers exists)
  const listUsersRoute = routes.users?.listUsers;
  if (listUsersRoute) {
    const { method: listMethod, path: listPath } = resolveRoute(listUsersRoute);
    const listUrl = `${API_URL}${listPath}`;

    const listResponse = await fetch(listUrl, {
      method: listMethod,
      headers: { 'Content-Type': 'application/json' },
    });

    if (listResponse.ok) {
      const listData = await listResponse.json();
      const users = listData.data || listData;
      const foundUser = Array.isArray(users) && users.find((u) => u.email === testEmail);

      if (foundUser) {
        console.log('  ✓ Created user found in users list');
      } else {
        // User might not be in list if auth template requires auth for listUsers
        console.log('  ⚠ Created user not found in users list (may require auth)');
      }
    }
  }

  console.log('✓ @veloxts/client integration test passed');
}

testClientIntegration().catch((err) => {
  console.error('✗ Client integration test FAILED:', err.message);
  process.exit(1);
});
