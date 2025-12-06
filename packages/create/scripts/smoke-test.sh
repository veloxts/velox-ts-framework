#!/bin/bash
# Smoke test for create-velox-app scaffolder
# Tests the full flow: scaffold -> install -> generate -> build -> run
#
# In CI: Uses published npm packages directly
# Locally: Links to monorepo packages via file: references

set -e

TEST_DIR="/tmp/velox-smoke-test-$$"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MONOREPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Detect if running in CI
# GitHub Actions sets CI=true, some other CI systems use CI=1
if [ "$CI" = "true" ] || [ "$CI" = "1" ]; then
  IS_CI="true"
else
  IS_CI="false"
fi

echo "=== Smoke Test for create-velox-app ==="
echo "Test directory: $TEST_DIR"
echo "Monorepo root: $MONOREPO_ROOT"
echo "Running in CI: $IS_CI"
echo ""

# Cleanup function
cleanup() {
  echo ""
  echo "=== Cleaning up ==="
  # Kill any server running on test port
  lsof -ti :3210 2>/dev/null | xargs kill -9 2>/dev/null || true
  # Remove test directory
  rm -rf "$TEST_DIR"
  echo "Done."
}

# Set trap to cleanup on exit
trap cleanup EXIT

# Step 1: Build the scaffolder
echo "=== Step 1: Building scaffolder ==="
cd "$SCRIPT_DIR"
pnpm build
echo "✓ Scaffolder built"
echo ""

# Step 2: Build monorepo packages
echo "=== Step 2: Building monorepo packages ==="
cd "$MONOREPO_ROOT"
pnpm build
echo "✓ Monorepo packages built"
echo ""

# Step 3: Create test project using scaffolder
echo "=== Step 3: Running scaffolder ==="
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Run the scaffolder to create project files only (skip npm install)
# We skip installation because we'll link to local packages in Step 4
SKIP_INSTALL=true node "$SCRIPT_DIR/dist/cli.js" smoke-test-app

# Verify that essential files were created
if [ ! -f "$TEST_DIR/smoke-test-app/package.json" ]; then
  echo "✗ Scaffolder failed to create project files"
  exit 1
fi
echo "✓ Project files created by scaffolder"
echo ""

cd "$TEST_DIR/smoke-test-app"

# Step 4: Setup dependencies
# Always link to local monorepo packages for smoke tests
# This ensures we test against the code we just built, not published packages
echo "=== Step 4: Linking local monorepo packages ==="

# Replace @veloxts/velox dependency with file: reference to local umbrella package
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Point @veloxts/velox to local built umbrella package
pkg.dependencies['@veloxts/velox'] = 'file:$MONOREPO_ROOT/packages/velox';

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
console.log('Updated package.json with local package reference');
"
echo "✓ Local packages linked in package.json"
echo ""

echo "=== Step 5: Installing dependencies with local packages ==="
# postinstall script runs 'prisma generate' automatically
npm install --legacy-peer-deps
echo "✓ Dependencies installed (Prisma client generated via postinstall)"
echo ""

# Step 6: Push database schema
echo "=== Step 6: Pushing database schema ==="
npm run db:push
echo "✓ Database schema pushed"
echo ""

# Step 7: Build the app
echo "=== Step 7: Building the app ==="
npm run build
echo "✓ App built"
echo ""

# Step 8: Start the server and test endpoints
echo "=== Step 8: Testing the app ==="

# Use a unique port for testing (avoid conflicts with other processes)
TEST_PORT=3210

# Kill any process on test port
lsof -ti :$TEST_PORT 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1

PORT=$TEST_PORT node dist/index.js &
SERVER_PID=$!
sleep 3

# Test health endpoint
HEALTH_RESPONSE=$(curl -s http://localhost:$TEST_PORT/api/health)
if echo "$HEALTH_RESPONSE" | grep -q "status"; then
  echo "✓ Health endpoint working: $HEALTH_RESPONSE"
else
  echo "✗ Health endpoint failed: $HEALTH_RESPONSE"
  exit 1
fi

# Test users list endpoint (GET)
USERS_RESPONSE=$(curl -s http://localhost:$TEST_PORT/api/users)
if echo "$USERS_RESPONSE" | grep -q "\["; then
  echo "✓ GET /api/users working"
else
  echo "✗ GET /api/users failed: $USERS_RESPONSE"
  exit 1
fi

# Test create user (POST) - should return 201
echo ""
echo "--- Testing REST verbs ---"
CREATE_STATUS=$(curl -s -o /tmp/create_body.json -w "%{http_code}" -X POST http://localhost:$TEST_PORT/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Test User", "email": "test@smoke.com"}')
CREATE_BODY=$(cat /tmp/create_body.json)
if [ "$CREATE_STATUS" = "201" ] && echo "$CREATE_BODY" | grep -q '"id"'; then
  USER_ID=$(echo "$CREATE_BODY" | grep -o '"id":"[^"]*"' | sed 's/"id":"//;s/"//')
  echo "✓ POST /api/users returned 201 (created user: $USER_ID)"
else
  echo "✗ POST /api/users failed: status=$CREATE_STATUS, body=$CREATE_BODY"
  exit 1
fi

# Test update user (PUT) - should return 200
UPDATE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "http://localhost:$TEST_PORT/api/users/$USER_ID" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated User", "email": "test@smoke.com"}')
if [ "$UPDATE_STATUS" = "200" ]; then
  echo "✓ PUT /api/users/:id returned 200"
else
  echo "✗ PUT /api/users/:id failed: status=$UPDATE_STATUS"
  exit 1
fi

# Test patch user (PATCH) - should return 200
PATCH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "http://localhost:$TEST_PORT/api/users/$USER_ID" \
  -H "Content-Type: application/json" \
  -d '{"name": "Patched User"}')
if [ "$PATCH_STATUS" = "200" ]; then
  echo "✓ PATCH /api/users/:id returned 200"
else
  echo "✗ PATCH /api/users/:id failed: status=$PATCH_STATUS"
  exit 1
fi

# Test delete user (DELETE) - should return 200
DELETE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "http://localhost:$TEST_PORT/api/users/$USER_ID")
if [ "$DELETE_STATUS" = "200" ]; then
  echo "✓ DELETE /api/users/:id returned 200"
else
  echo "✗ DELETE /api/users/:id failed: status=$DELETE_STATUS"
  exit 1
fi

# Kill the server
kill $SERVER_PID 2>/dev/null || true

echo ""
echo "=== All smoke tests passed! ==="
