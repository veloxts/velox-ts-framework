#!/bin/bash
# Deprecate all old versions of @veloxts packages on npm
#
# Usage:
#   ./scripts/deprecate-old-versions.sh           # Dry run (shows commands)
#   ./scripts/deprecate-old-versions.sh --execute # Actually run deprecation
#
# Prerequisites:
#   - Must be logged in to npm: npm login
#   - Must have publish access to @veloxts scope

set -e

# All published @veloxts packages
PACKAGES=(
  "@veloxts/core"
  "@veloxts/validation"
  "@veloxts/orm"
  "@veloxts/router"
  "@veloxts/auth"
  "@veloxts/client"
  "@veloxts/cli"
  "@veloxts/velox"
  "@veloxts/web"
  "@veloxts/mcp"
  "@veloxts/cache"
  "@veloxts/queue"
  "@veloxts/mail"
  "@veloxts/storage"
  "@veloxts/scheduler"
  "@veloxts/events"
  "create-velox-app"
)

DRY_RUN=true

# Parse arguments
for arg in "$@"; do
  case $arg in
    --execute)
      DRY_RUN=false
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [--execute]"
      echo ""
      echo "Options:"
      echo "  --execute  Actually run the deprecation commands (default is dry run)"
      echo ""
      echo "This script deprecates all versions except the latest for each @veloxts package."
      exit 0
      ;;
  esac
done

if [ "$DRY_RUN" = true ]; then
  echo "=== DRY RUN MODE ==="
  echo "Add --execute to actually deprecate packages"
  echo ""
fi

echo "Checking npm login status..."
NPM_USER=$(npm whoami 2>/dev/null) || {
  echo "Error: Not logged in to npm. Run 'npm login' first."
  exit 1
}
echo "Logged in as: $NPM_USER"
echo ""

PACKAGES_PROCESSED=0

for PACKAGE in "${PACKAGES[@]}"; do
  echo "================================================"
  echo "Processing: $PACKAGE"
  echo "================================================"

  # Get the latest version
  LATEST=$(npm view "$PACKAGE" version 2>/dev/null) || {
    echo "  ⚠ Package not found on npm, skipping"
    echo ""
    continue
  }

  echo "  Latest version: $LATEST"

  # Build deprecation message and range
  DEPRECATION_MSG="This version is deprecated. Please upgrade to the latest release, $LATEST."
  VERSION_RANGE="<$LATEST"

  if [ "$DRY_RUN" = true ]; then
    echo "  [DRY RUN] Would deprecate all versions < $LATEST"
    echo "    npm deprecate $PACKAGE@\"$VERSION_RANGE\" \"$DEPRECATION_MSG\""
  else
    echo "  Deprecating all versions < $LATEST"
    npm deprecate "$PACKAGE@$VERSION_RANGE" "$DEPRECATION_MSG" || {
      echo "    ⚠ Failed to deprecate $PACKAGE@$VERSION_RANGE"
    }
  fi

  PACKAGES_PROCESSED=$((PACKAGES_PROCESSED + 1))
  echo ""
done

echo "================================================"
echo "Summary"
echo "================================================"
echo "Packages processed: $PACKAGES_PROCESSED"

if [ "$DRY_RUN" = true ]; then
  echo ""
  echo "This was a DRY RUN. Run with --execute to actually deprecate."
fi
