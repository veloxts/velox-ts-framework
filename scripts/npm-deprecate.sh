#!/usr/bin/env bash
#
# Bulk deprecate VeloxTS packages on npm
#
# Usage:
#   ./scripts/npm-deprecate.sh <version> "<message>"
#   ./scripts/npm-deprecate.sh <version> "<message>" --dry-run
#
# Examples:
#   ./scripts/npm-deprecate.sh 0.4.11 "Unstable release, use 0.4.12 instead"
#   ./scripts/npm-deprecate.sh 0.4.11 "Unstable release" --dry-run
#
# To un-deprecate (remove deprecation message):
#   ./scripts/npm-deprecate.sh 0.4.11 ""

set -e

VERSION="$1"
MESSAGE="$2"
DRY_RUN="$3"

if [ -z "$VERSION" ]; then
  echo "Error: Version argument required"
  echo ""
  echo "Usage: ./scripts/npm-deprecate.sh <version> \"<message>\" [--dry-run]"
  echo ""
  echo "Examples:"
  echo "  ./scripts/npm-deprecate.sh 0.4.11 \"Unstable release, use 0.4.12 instead\""
  echo "  ./scripts/npm-deprecate.sh 0.4.11 \"Unstable\" --dry-run"
  echo ""
  echo "To un-deprecate (remove warning):"
  echo "  ./scripts/npm-deprecate.sh 0.4.11 \"\""
  exit 1
fi

# All VeloxTS packages (9 total)
PACKAGES=(
  "@veloxts/core"
  "@veloxts/validation"
  "@veloxts/orm"
  "@veloxts/router"
  "@veloxts/auth"
  "@veloxts/client"
  "@veloxts/cli"
  "@veloxts/velox"
  "create-velox-app"
)

echo ""
echo "VeloxTS Bulk Deprecate"
echo "======================"
echo "Version: $VERSION"
if [ -z "$MESSAGE" ]; then
  echo "Message: (removing deprecation)"
else
  echo "Message: $MESSAGE"
fi
echo "Packages: ${#PACKAGES[@]}"
if [ "$DRY_RUN" = "--dry-run" ]; then
  echo "Mode: DRY RUN (no changes will be made)"
fi
echo ""

# Confirm before proceeding (unless dry-run)
if [ "$DRY_RUN" != "--dry-run" ]; then
  if [ -z "$MESSAGE" ]; then
    echo "This will REMOVE deprecation from the following packages:"
  else
    echo "This will deprecate the following packages:"
  fi
  for pkg in "${PACKAGES[@]}"; do
    echo "  - ${pkg}@${VERSION}"
  done
  echo ""
  read -p "Are you sure you want to continue? (yes/no): " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted."
    exit 0
  fi
  echo ""
fi

# Track results
SUCCESS=0
FAILED=0
FAILED_PACKAGES=()

for pkg in "${PACKAGES[@]}"; do
  echo "----------------------------------------"
  echo "Processing ${pkg}@${VERSION}"

  if [ "$DRY_RUN" = "--dry-run" ]; then
    # Check if version exists
    if npm view "${pkg}@${VERSION}" version 2>/dev/null; then
      echo "  [DRY RUN] Would deprecate"
      ((SUCCESS++))
    else
      echo "  [DRY RUN] Version not found on npm"
      ((FAILED++))
      FAILED_PACKAGES+=("$pkg")
    fi
  else
    # Actually deprecate (show all output)
    if npm deprecate "${pkg}@${VERSION}" "$MESSAGE"; then
      echo "  SUCCESS"
      ((SUCCESS++))
    else
      echo "  FAILED: npm deprecate returned error"
      ((FAILED++))
      FAILED_PACKAGES+=("$pkg")
    fi
  fi
done

echo ""
echo "========================================"
echo "Results"
echo "========================================"
echo "Success: $SUCCESS"
echo "Failed: $FAILED"

if [ $FAILED -gt 0 ]; then
  echo ""
  echo "Failed packages:"
  for pkg in "${FAILED_PACKAGES[@]}"; do
    echo "  - ${pkg}@${VERSION}"
  done
  exit 1
fi

echo ""
echo "Done!"
if [ -n "$MESSAGE" ]; then
  echo ""
  echo "Users installing these versions will now see:"
  echo "  npm warn deprecated ${PACKAGES[0]}@${VERSION}: ${MESSAGE}"
fi
