#!/bin/bash
# check-client-imports.sh
# Checks for server-only imports in client bundle files
#
# Usage: ./scripts/check-client-imports.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Patterns that should NOT appear in client files
FORBIDDEN_IMPORTS=(
  "@veloxts/web/server"
  "@veloxts/web/actions"
  "@veloxts/core"
  "@veloxts/orm"
  "@veloxts/auth"
  "@/api/database"
  "@/api/procedures"
)

# Client file patterns to check
CLIENT_FILES=(
  "src/entry.client.tsx"
  "src/entry.client.ts"
)

# Find files with 'use client' directive
USE_CLIENT_FILES=$(grep -rl "^'use client'" app/ 2>/dev/null || true)

errors=0

echo "Checking for server imports in client files..."
echo ""

# Check explicit client entry files
for file in "${CLIENT_FILES[@]}"; do
  if [ -f "$file" ]; then
    for pattern in "${FORBIDDEN_IMPORTS[@]}"; do
      if grep -q "from ['\"]${pattern}" "$file" 2>/dev/null; then
        echo -e "${RED}ERROR:${NC} $file imports '$pattern'"
        echo "       Server-only imports cannot be used in client bundles."
        ((errors++))
      fi
    done
  fi
done

# Check files with 'use client' directive
for file in $USE_CLIENT_FILES; do
  for pattern in "${FORBIDDEN_IMPORTS[@]}"; do
    if grep -q "from ['\"]${pattern}" "$file" 2>/dev/null; then
      echo -e "${RED}ERROR:${NC} $file imports '$pattern'"
      echo "       This file has 'use client' but imports server-only code."
      ((errors++))
    fi
  done
done

echo ""

if [ $errors -gt 0 ]; then
  echo -e "${RED}Found $errors server import(s) in client files.${NC}"
  echo ""
  echo "Solutions:"
  echo "1. Use @veloxts/web/client for browser-safe exports"
  echo "2. Move server logic to files with 'use server' directive"
  echo "3. Import server actions (not server modules) in client components"
  exit 1
else
  echo -e "${GREEN}No forbidden imports found in client files.${NC}"
  exit 0
fi
