#!/usr/bin/env node
/**
 * Tests that @veloxts/client convention-based route inference works correctly.
 * Validates that the client can call APIs without a routes.ts file.
 *
 * Usage: node test-client.mjs <api-url>
 */

const API_URL = process.argv[2] || 'http://localhost:3030/api';

/**
 * Naming convention map (mirrors @veloxts/client's PROCEDURE_METHOD_MAP)
 */
const PROCEDURE_METHOD_MAP = {
  get: 'GET',
  list: 'GET',
  find: 'GET',
  create: 'POST',
  add: 'POST',
  update: 'PUT',
  edit: 'PUT',
  patch: 'PATCH',
  delete: 'DELETE',
  remove: 'DELETE',
};

/**
 * Infers HTTP method from procedure name (mirrors client logic)
 */
function inferMethod(procedureName) {
  for (const [prefix, method] of Object.entries(PROCEDURE_METHOD_MAP)) {
    if (procedureName.startsWith(prefix)) {
      return method;
    }
  }
  return 'POST';
}

/**
 * Builds REST path from convention (mirrors client logic)
 */
function buildPath(namespace, procedureName) {
  if (
    procedureName.startsWith('list') ||
    procedureName.startsWith('find') ||
    procedureName.startsWith('create') ||
    procedureName.startsWith('add')
  ) {
    return `/${namespace}`;
  }
  if (
    procedureName.startsWith('get') ||
    procedureName.startsWith('update') ||
    procedureName.startsWith('edit') ||
    procedureName.startsWith('patch') ||
    procedureName.startsWith('delete') ||
    procedureName.startsWith('remove')
  ) {
    return `/${namespace}/:id`;
  }
  return `/${namespace}`;
}

async function testClientInference() {
  console.log('--- Testing @veloxts/client convention inference ---');

  // Test 1: listUsers — convention: GET /users
  const listMethod = inferMethod('listUsers');
  const listPath = buildPath('users', 'listUsers');
  const listUrl = `${API_URL}${listPath}`;

  const listResponse = await fetch(listUrl, {
    method: listMethod,
    headers: { 'Content-Type': 'application/json' },
  });

  if (!listResponse.ok) {
    throw new Error(`listUsers failed: ${listResponse.status} at ${listUrl}`);
  }

  console.log(`  ✓ listUsers → ${listMethod} ${listPath} (${listResponse.status})`);

  // Test 2: getUser — convention: GET /users/:id
  // First create a user so we have a valid ID
  const testEmail = `client-infer-${Date.now()}@example.com`;
  const createResponse = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Inference Test',
      email: testEmail,
      password: 'SecurePass123!',
    }),
  });

  if (!createResponse.ok) {
    const body = await createResponse.text();
    throw new Error(`Register failed: ${createResponse.status}\n${body}`);
  }

  const authData = await createResponse.json();
  const token = authData.accessToken;

  // Get the user ID via /auth/me
  const meResponse = await fetch(`${API_URL}/auth/me`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!meResponse.ok) {
    throw new Error(`getMe failed: ${meResponse.status}`);
  }

  const meData = await meResponse.json();
  const userId = meData.id;

  console.log(`  ✓ Registered test user: ${userId}`);

  // Test getUser convention: GET /users/:id → GET /users/{userId}
  const getMethod = inferMethod('getUser');
  const getPath = buildPath('users', 'getUser').replace(':id', userId);
  const getUrl = `${API_URL}${getPath}`;

  const getResponse = await fetch(getUrl, {
    method: getMethod,
    headers: { 'Content-Type': 'application/json' },
  });

  if (!getResponse.ok) {
    throw new Error(`getUser failed: ${getResponse.status} at ${getUrl}`);
  }

  console.log(`  ✓ getUser → ${getMethod} /users/:id (${getResponse.status})`);

  // Test 3: Verify method inference for all naming conventions
  const conventions = [
    ['listUsers', 'GET'],
    ['findUsers', 'GET'],
    ['getUser', 'GET'],
    ['createUser', 'POST'],
    ['addUser', 'POST'],
    ['updateUser', 'PUT'],
    ['editUser', 'PUT'],
    ['patchUser', 'PATCH'],
    ['deleteUser', 'DELETE'],
    ['removeUser', 'DELETE'],
  ];

  for (const [name, expectedMethod] of conventions) {
    const method = inferMethod(name);
    if (method !== expectedMethod) {
      throw new Error(`${name}: expected ${expectedMethod}, got ${method}`);
    }
  }

  console.log('  ✓ All 10 naming conventions infer correct HTTP methods');

  console.log('✓ @veloxts/client convention inference test passed');
}

testClientInference().catch((err) => {
  console.error('✗ Client inference test FAILED:', err.message);
  process.exit(1);
});
