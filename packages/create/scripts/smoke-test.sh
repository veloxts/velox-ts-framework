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

# Run the scaffolder to create project files
# In CI: Will install from npm (may fail if packages not yet published)
# Locally: Will fail on install (packages don't exist on npm)
# We use || true to continue regardless, as we verify the install in Step 4
node "$SCRIPT_DIR/dist/cli.js" smoke-test-app 2>&1 || true

# Verify that essential files were created
if [ ! -f "$TEST_DIR/smoke-test-app/package.json" ]; then
  echo "✗ Scaffolder failed to create project files"
  exit 1
fi
echo "✓ Project files created by scaffolder"
echo ""

cd "$TEST_DIR/smoke-test-app"

# Step 4: Setup dependencies
# In CI: Packages are already installed from npm by the scaffolder
# Locally: We need to link to monorepo packages via file: references
if [ "$IS_CI" = "true" ]; then
  echo "=== Step 4: Verifying published npm packages (CI mode) ==="

  # Verify that node_modules exists and contains @veloxts packages
  if [ ! -d "node_modules/@veloxts" ]; then
    echo "✗ Expected node_modules/@veloxts to exist (scaffolder should have installed)"
    echo "  The scaffolder may have failed during npm install"
    exit 1
  fi

  echo "✓ Dependencies installed from npm registry"
  echo ""

  # Rebuild native modules (better-sqlite3 requires this in CI)
  echo "=== Step 5: Rebuilding native modules ==="
  npm rebuild better-sqlite3 2>/dev/null || pnpm rebuild better-sqlite3 2>/dev/null || true
  echo "✓ Native modules rebuilt"
  echo ""
else
  echo "=== Step 4: Linking local monorepo packages ==="

  # Replace @veloxts/* dependencies with file: references to local packages
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
  echo "✓ Local packages linked in package.json"
  echo ""

  echo "=== Step 5: Installing dependencies with local packages ==="
  npm install --legacy-peer-deps
  echo "✓ Dependencies installed"
  echo ""
fi

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
