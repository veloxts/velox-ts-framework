#!/bin/bash
# E2E tests for create-velox-app using Playwright
#
# Usage:
#   ./scripts/e2e-test.sh           # Run all E2E tests
#   ./scripts/e2e-test.sh spa       # Run only SPA template tests
#   ./scripts/e2e-test.sh auth      # Run only auth template tests
#   ./scripts/e2e-test.sh trpc      # Run only tRPC template tests
#   ./scripts/e2e-test.sh rsc       # Run only RSC template tests
#   ./scripts/e2e-test.sh rsc-auth  # Run only RSC-auth template tests
#
# Options:
#   --headed                        # Run tests in headed mode (visible browser)
#   --debug                         # Run in debug mode with step-through
#   --ui                            # Open Playwright UI mode
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

# Parse arguments
FILTER=""
EXTRA_ARGS=""

for arg in "$@"; do
  case $arg in
    spa|auth|trpc|rsc|rsc-auth)
      FILTER="--grep $arg"
      shift
      ;;
    --headed)
      EXTRA_ARGS="$EXTRA_ARGS --headed"
      shift
      ;;
    --debug)
      EXTRA_ARGS="$EXTRA_ARGS --debug"
      shift
      ;;
    --ui)
      EXTRA_ARGS="$EXTRA_ARGS --ui"
      shift
      ;;
    *)
      EXTRA_ARGS="$EXTRA_ARGS $arg"
      shift
      ;;
  esac
done

echo "=== VeloxTS E2E Tests ==="
echo "Working directory: $SCRIPT_DIR"
echo ""

# Check if Playwright is installed
if ! npx playwright --version > /dev/null 2>&1; then
  echo "Playwright not found. Installing browsers..."
  npx playwright install chromium
  echo ""
fi

# Run Playwright tests
echo "Running E2E tests..."
echo ""

# Use --config to point to the e2e directory
npx playwright test --config=e2e/playwright.config.ts $FILTER $EXTRA_ARGS

echo ""
echo "=== E2E Tests Complete ==="
