#!/bin/bash
# Smoke test for create-velox-app scaffolder
# Tests the full flow: scaffold -> install -> generate -> build -> run
#
# Now supports testing both templates:
#   ./smoke-test.sh           # Test default template
#   ./smoke-test.sh --auth    # Test auth template
#   ./smoke-test.sh --all     # Test all templates
#
# In CI: Uses published npm packages directly
# Locally: Links to monorepo packages via file: references

set -e

TEMPLATE="default"
TEST_ALL=false

# Parse arguments
for arg in "$@"; do
  case $arg in
    --auth)
      TEMPLATE="auth"
      shift
      ;;
    --all)
      TEST_ALL=true
      shift
      ;;
    *)
      ;;
  esac
done

TEST_DIR="/tmp/velox-smoke-test-$$"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MONOREPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Detect if running in CI
if [ "$CI" = "true" ] || [ "$CI" = "1" ]; then
  IS_CI="true"
else
  IS_CI="false"
fi

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

# Build function (only run once)
build_all() {
  echo "=== Building scaffolder ==="
  cd "$SCRIPT_DIR"
  pnpm build
  echo "✓ Scaffolder built"
  echo ""

  echo "=== Building monorepo packages ==="
  cd "$MONOREPO_ROOT"
  pnpm build
  echo "✓ Monorepo packages built"
  echo ""
}

# Test a specific template
test_template() {
  local template=$1
  local project_name="smoke-test-$template"
  local test_port=3210

  echo ""
  echo "=========================================="
  echo "  Testing template: $template"
  echo "=========================================="
  echo ""

  # Create test project
  echo "=== Creating test project ==="
  mkdir -p "$TEST_DIR"
  cd "$TEST_DIR"

  # Run scaffolder with template flag (always pass explicitly to avoid interactive prompt)
  SKIP_INSTALL=true node "$SCRIPT_DIR/dist/cli.js" "$project_name" --template="$template"

  # Verify project was created
  if [ ! -f "$TEST_DIR/$project_name/package.json" ]; then
    echo "✗ Scaffolder failed to create project files"
    exit 1
  fi
  echo "✓ Project files created"
  echo ""

  cd "$TEST_DIR/$project_name"

  # Link local packages (in apps/api for workspace structure)
  # We need to link ALL @veloxts packages because they have workspace:* dependencies
  echo "=== Linking local packages ==="
  node -e "
const fs = require('fs');
const apiPkgPath = 'apps/api/package.json';
const webPkgPath = 'apps/web/package.json';
const monorepo = '$MONOREPO_ROOT';

// Link API dependencies
const apiPkg = JSON.parse(fs.readFileSync(apiPkgPath, 'utf8'));
apiPkg.dependencies['@veloxts/velox'] = 'file:' + monorepo + '/packages/velox';
apiPkg.dependencies['@veloxts/core'] = 'file:' + monorepo + '/packages/core';
apiPkg.dependencies['@veloxts/router'] = 'file:' + monorepo + '/packages/router';
apiPkg.dependencies['@veloxts/validation'] = 'file:' + monorepo + '/packages/validation';
apiPkg.dependencies['@veloxts/orm'] = 'file:' + monorepo + '/packages/orm';
apiPkg.dependencies['@veloxts/auth'] = 'file:' + monorepo + '/packages/auth';
apiPkg.devDependencies['@veloxts/cli'] = 'file:' + monorepo + '/packages/cli';
fs.writeFileSync(apiPkgPath, JSON.stringify(apiPkg, null, 2));

// Link Web dependencies
const webPkg = JSON.parse(fs.readFileSync(webPkgPath, 'utf8'));
webPkg.dependencies['@veloxts/client'] = 'file:' + monorepo + '/packages/client';
fs.writeFileSync(webPkgPath, JSON.stringify(webPkg, null, 2));
"
  echo "✓ Local packages linked"
  echo ""

  # Install API dependencies (where the @veloxts packages are)
  echo "=== Installing API dependencies ==="
  cd apps/api
  npm install --legacy-peer-deps
  echo "✓ API dependencies installed"
  echo ""

  # Run Prisma generate
  echo "=== Generating Prisma client ==="
  npx prisma generate
  echo "✓ Prisma client generated"

  # Push database schema
  echo "=== Pushing database schema ==="
  npx prisma db push
  echo "✓ Database schema pushed"
  echo ""

  # Build the API
  echo "=== Building the API ==="
  npm run build
  echo "✓ API built"
  echo ""

  # Start server from apps/api (where .env is located)
  echo "=== Testing endpoints ==="
  lsof -ti :$test_port 2>/dev/null | xargs kill -9 2>/dev/null || true
  sleep 1

  PORT=$test_port node dist/index.js &
  SERVER_PID=$!
  sleep 3

  # Test health endpoint
  HEALTH_RESPONSE=$(curl -s http://localhost:$test_port/api/health)
  if echo "$HEALTH_RESPONSE" | grep -q "status"; then
    echo "✓ Health endpoint working"
  else
    echo "✗ Health endpoint failed: $HEALTH_RESPONSE"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
  fi

  # Test users list endpoint (GET)
  USERS_RESPONSE=$(curl -s http://localhost:$test_port/api/users)
  if echo "$USERS_RESPONSE" | grep -q "\["; then
    echo "✓ GET /api/users working"
  else
    echo "✗ GET /api/users failed: $USERS_RESPONSE"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
  fi

  # Template-specific tests
  if [ "$template" = "auth" ]; then
    echo ""
    echo "--- Testing auth endpoints ---"

    # Test register (should work - returns 200 with tokens)
    REGISTER_STATUS=$(curl -s -o /tmp/register_body.json -w "%{http_code}" -X POST http://localhost:$test_port/api/auth/register \
      -H "Content-Type: application/json" \
      -d '{"name": "Test User", "email": "test@smoke.com", "password": "SecurePass123!"}')
    REGISTER_BODY=$(cat /tmp/register_body.json)
    if [ "$REGISTER_STATUS" = "200" ] && echo "$REGISTER_BODY" | grep -q '"accessToken"'; then
      echo "✓ POST /auth/register returned 200"
      ACCESS_TOKEN=$(echo "$REGISTER_BODY" | grep -o '"accessToken":"[^"]*"' | sed 's/"accessToken":"//;s/"//')
    else
      echo "✗ POST /auth/register failed: status=$REGISTER_STATUS, body=$REGISTER_BODY"
      kill $SERVER_PID 2>/dev/null || true
      exit 1
    fi

    # Test login
    LOGIN_STATUS=$(curl -s -o /tmp/login_body.json -w "%{http_code}" -X POST http://localhost:$test_port/api/auth/login \
      -H "Content-Type: application/json" \
      -d '{"email": "test@smoke.com", "password": "SecurePass123!"}')
    LOGIN_BODY=$(cat /tmp/login_body.json)
    if [ "$LOGIN_STATUS" = "200" ] && echo "$LOGIN_BODY" | grep -q '"accessToken"'; then
      echo "✓ POST /auth/login returned 200"
      ACCESS_TOKEN=$(echo "$LOGIN_BODY" | grep -o '"accessToken":"[^"]*"' | sed 's/"accessToken":"//;s/"//')
    else
      echo "✗ POST /auth/login failed: status=$LOGIN_STATUS, body=$LOGIN_BODY"
      kill $SERVER_PID 2>/dev/null || true
      exit 1
    fi

    # Test /auth/me (protected endpoint)
    ME_STATUS=$(curl -s -o /tmp/me_body.json -w "%{http_code}" http://localhost:$test_port/api/auth/me \
      -H "Authorization: Bearer $ACCESS_TOKEN")
    ME_BODY=$(cat /tmp/me_body.json)
    if [ "$ME_STATUS" = "200" ] && echo "$ME_BODY" | grep -q '"email"'; then
      echo "✓ GET /auth/me returned 200 (protected)"
    else
      echo "✗ GET /auth/me failed: status=$ME_STATUS, body=$ME_BODY"
      kill $SERVER_PID 2>/dev/null || true
      exit 1
    fi

    # Test protected createUser requires auth
    CREATE_NOAUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:$test_port/api/users \
      -H "Content-Type: application/json" \
      -d '{"name": "Test", "email": "test2@smoke.com"}')
    if [ "$CREATE_NOAUTH_STATUS" = "401" ]; then
      echo "✓ POST /api/users requires auth (401)"
    else
      echo "✗ POST /api/users should require auth: got $CREATE_NOAUTH_STATUS"
      kill $SERVER_PID 2>/dev/null || true
      exit 1
    fi

    # Test createUser with auth
    CREATE_STATUS=$(curl -s -o /tmp/create_body.json -w "%{http_code}" -X POST http://localhost:$test_port/api/users \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -d '{"name": "Test User 2", "email": "test2@smoke.com"}')
    if [ "$CREATE_STATUS" = "201" ]; then
      echo "✓ POST /api/users with auth returned 201"
    else
      echo "✗ POST /api/users with auth failed: $CREATE_STATUS"
      kill $SERVER_PID 2>/dev/null || true
      exit 1
    fi

  else
    # Default template - test REST verbs (no auth)
    echo ""
    echo "--- Testing REST verbs ---"

    # Test create user (POST)
    CREATE_STATUS=$(curl -s -o /tmp/create_body.json -w "%{http_code}" -X POST http://localhost:$test_port/api/users \
      -H "Content-Type: application/json" \
      -d '{"name": "Test User", "email": "test@smoke.com"}')
    CREATE_BODY=$(cat /tmp/create_body.json)
    if [ "$CREATE_STATUS" = "201" ] && echo "$CREATE_BODY" | grep -q '"id"'; then
      USER_ID=$(echo "$CREATE_BODY" | grep -o '"id":"[^"]*"' | sed 's/"id":"//;s/"//')
      echo "✓ POST /api/users returned 201"
    else
      echo "✗ POST /api/users failed: status=$CREATE_STATUS"
      kill $SERVER_PID 2>/dev/null || true
      exit 1
    fi

    # Test update (PUT)
    UPDATE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "http://localhost:$test_port/api/users/$USER_ID" \
      -H "Content-Type: application/json" \
      -d '{"name": "Updated User", "email": "test@smoke.com"}')
    if [ "$UPDATE_STATUS" = "200" ]; then
      echo "✓ PUT /api/users/:id returned 200"
    else
      echo "✗ PUT /api/users/:id failed: $UPDATE_STATUS"
      kill $SERVER_PID 2>/dev/null || true
      exit 1
    fi

    # Test patch (PATCH)
    PATCH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "http://localhost:$test_port/api/users/$USER_ID" \
      -H "Content-Type: application/json" \
      -d '{"name": "Patched User"}')
    if [ "$PATCH_STATUS" = "200" ]; then
      echo "✓ PATCH /api/users/:id returned 200"
    else
      echo "✗ PATCH /api/users/:id failed: $PATCH_STATUS"
      kill $SERVER_PID 2>/dev/null || true
      exit 1
    fi

    # Test delete (DELETE)
    DELETE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "http://localhost:$test_port/api/users/$USER_ID")
    if [ "$DELETE_STATUS" = "200" ]; then
      echo "✓ DELETE /api/users/:id returned 200"
    else
      echo "✗ DELETE /api/users/:id failed: $DELETE_STATUS"
      kill $SERVER_PID 2>/dev/null || true
      exit 1
    fi
  fi

  # Kill the server
  kill $SERVER_PID 2>/dev/null || true

  # Return to project root (we were in apps/api)
  cd ../..

  echo ""
  echo "✓ Template '$template' passed all tests!"
  echo ""

  # Cleanup test project for next template
  rm -rf "$TEST_DIR/$project_name"
}

# Main execution
echo "=== Smoke Test for create-velox-app ==="
echo "Test directory: $TEST_DIR"
echo "Monorepo root: $MONOREPO_ROOT"
echo "Running in CI: $IS_CI"

if [ "$TEST_ALL" = true ]; then
  echo "Testing ALL templates"
else
  echo "Testing template: $TEMPLATE"
fi
echo ""

# Build once
build_all

# Test templates
if [ "$TEST_ALL" = true ]; then
  test_template "default"
  test_template "auth"
else
  test_template "$TEMPLATE"
fi

echo ""
echo "=========================================="
echo "  All smoke tests passed!"
echo "=========================================="
