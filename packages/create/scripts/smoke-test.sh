#!/bin/bash
# Smoke test for create-velox-app scaffolder
# Tests the full flow: scaffold -> install -> generate -> build -> run
#
# This test creates a project without running install internally,
# then manually installs dependencies (mocking @veloxts/* packages).

set -e

TEST_DIR="/tmp/velox-smoke-test-$$"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MONOREPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== Smoke Test for create-velox-app ==="
echo "Test directory: $TEST_DIR"
echo "Monorepo root: $MONOREPO_ROOT"
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

# Step 3: Create test project (scaffolder will fail on install, but files are created)
echo "=== Step 3: Creating test project files ==="
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Create project files only (let install fail, we'll do it manually)
node "$SCRIPT_DIR/dist/cli.js" smoke-test-app 2>&1 || true

# Check if files were created
if [ ! -f "$TEST_DIR/smoke-test-app/package.json" ]; then
  echo "✗ Project files not created"
  exit 1
fi
echo "✓ Project files created"
echo ""

# Step 4: Manually modify package.json to use workspace packages
echo "=== Step 4: Linking workspace packages ==="
cd "$TEST_DIR/smoke-test-app"

# Remove @veloxts/* dependencies from package.json and add them as file: references
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Point @veloxts/* packages to local built packages
pkg.dependencies['@veloxts/core'] = 'file:$MONOREPO_ROOT/packages/core';
pkg.dependencies['@veloxts/orm'] = 'file:$MONOREPO_ROOT/packages/orm';
pkg.dependencies['@veloxts/router'] = 'file:$MONOREPO_ROOT/packages/router';
pkg.dependencies['@veloxts/validation'] = 'file:$MONOREPO_ROOT/packages/validation';

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
console.log('Updated package.json with local package references');
"
echo "✓ Workspace packages linked"
echo ""

# Step 5: Install dependencies
echo "=== Step 5: Installing dependencies ==="
npm install --legacy-peer-deps
echo "✓ Dependencies installed"
echo ""

# Step 6: Generate Prisma client
echo "=== Step 6: Generating Prisma client ==="
npm run db:generate
echo "✓ Prisma client generated"
echo ""

# Step 7: Push database schema
echo "=== Step 7: Pushing database schema ==="
npm run db:push
echo "✓ Database schema pushed"
echo ""

# Step 8: Build the app
echo "=== Step 8: Building the app ==="
npm run build
echo "✓ App built"
echo ""

# Step 9: Start the server and test endpoints
echo "=== Step 9: Testing the app ==="

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

# Test users endpoint
USERS_RESPONSE=$(curl -s http://localhost:$TEST_PORT/api/users)
if echo "$USERS_RESPONSE" | grep -q "\["; then
  echo "✓ Users endpoint working"
else
  echo "✗ Users endpoint failed: $USERS_RESPONSE"
  exit 1
fi

# Kill the server
kill $SERVER_PID 2>/dev/null || true

echo ""
echo "=== All smoke tests passed! ==="
