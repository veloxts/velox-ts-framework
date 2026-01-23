#!/bin/bash
# VeloxTS Framework Contract Audit Script
# Run automated checks for release readiness

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
CRITICAL=0
ERRORS=0
WARNINGS=0
PASSED=0

print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"
}

print_check() {
    echo -e "  ${BLUE}→${NC} $1"
}

print_pass() {
    echo -e "  ${GREEN}✓${NC} $1"
    ((PASSED++))
}

print_warn() {
    echo -e "  ${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

print_error() {
    echo -e "  ${RED}✗${NC} $1"
    ((ERRORS++))
}

print_critical() {
    echo -e "  ${RED}⛔${NC} $1"
    ((CRITICAL++))
}

cd "$ROOT_DIR"

echo -e "\n${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         VeloxTS Framework Contract Audit                      ║${NC}"
echo -e "${BLUE}║         $(date '+%Y-%m-%d %H:%M:%S')                                  ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"

# ============================================================================
# Phase 1: Build Verification
# ============================================================================
print_header "Phase 1: Build Verification"

print_check "Running pnpm build..."
if pnpm build > /dev/null 2>&1; then
    print_pass "Build successful"
else
    print_critical "Build failed"
    echo "  Run 'pnpm build' manually to see errors"
fi

print_check "Running pnpm type-check..."
if pnpm type-check > /dev/null 2>&1; then
    print_pass "Type check passed"
else
    print_error "Type check failed"
    echo "  Run 'pnpm type-check' manually to see errors"
fi

print_check "Running pnpm lint..."
if pnpm lint > /dev/null 2>&1; then
    print_pass "Lint passed"
else
    print_warn "Lint has warnings/errors"
    echo "  Run 'pnpm lint' manually to see details"
fi

# ============================================================================
# Phase 2: Type Contract Checks
# ============================================================================
print_header "Phase 2: Type Contract Checks"

# TC-001: No 'any' in public exports
print_check "Checking for 'any' in public exports..."
ANY_COUNT=$(grep -r "export.*: any\|export.*<.*any.*>" packages/*/src/index.ts packages/*/src/types.ts 2>/dev/null | wc -l | tr -d ' ')
if [ "$ANY_COUNT" -eq 0 ]; then
    print_pass "No 'any' found in public exports"
else
    print_critical "Found $ANY_COUNT instances of 'any' in public exports"
    grep -rn "export.*: any\|export.*<.*any.*>" packages/*/src/index.ts packages/*/src/types.ts 2>/dev/null || true
fi

# TC-002: No escape hatches
print_check "Checking for @ts-ignore/@ts-expect-error..."
ESCAPE_COUNT=$(grep -r "@ts-ignore\|@ts-expect-error" packages/*/src/*.ts 2>/dev/null | grep -v "node_modules" | grep -v ".test.ts" | wc -l | tr -d ' ')
if [ "$ESCAPE_COUNT" -eq 0 ]; then
    print_pass "No escape hatches found"
else
    print_critical "Found $ESCAPE_COUNT escape hatches"
    grep -rn "@ts-ignore\|@ts-expect-error" packages/*/src/*.ts 2>/dev/null | grep -v "node_modules" | grep -v ".test.ts" || true
fi

# TC-002b: No 'as any' assertions
print_check "Checking for 'as any' assertions..."
AS_ANY_COUNT=$(grep -r "as any" packages/*/src/*.ts 2>/dev/null | grep -v "node_modules" | grep -v ".test.ts" | wc -l | tr -d ' ')
if [ "$AS_ANY_COUNT" -eq 0 ]; then
    print_pass "No 'as any' assertions found"
else
    print_critical "Found $AS_ANY_COUNT 'as any' assertions"
    grep -rn "as any" packages/*/src/*.ts 2>/dev/null | grep -v "node_modules" | grep -v ".test.ts" | head -10 || true
    if [ "$AS_ANY_COUNT" -gt 10 ]; then
        echo "  ... and $((AS_ANY_COUNT - 10)) more"
    fi
fi

# ============================================================================
# Phase 3: Public API Surface
# ============================================================================
print_header "Phase 3: Public API Surface"

# API-005: Check package.json exports exist
print_check "Verifying package.json exports..."
EXPORT_ERRORS=0
for pkg in core validation orm router auth client cli web velox; do
    PKG_JSON="packages/$pkg/package.json"
    if [ -f "$PKG_JSON" ]; then
        # Check if main export exists
        MAIN_EXPORT=$(node -e "const p=require('./$PKG_JSON'); console.log(p.exports?.['.']?.import || p.main || '')" 2>/dev/null)
        if [ -n "$MAIN_EXPORT" ]; then
            EXPORT_PATH="packages/$pkg/${MAIN_EXPORT#./}"
            if [ ! -f "$EXPORT_PATH" ] && [ ! -f "${EXPORT_PATH%.js}.ts" ]; then
                # Check dist folder
                if [ ! -f "packages/$pkg/dist/index.js" ]; then
                    print_error "@veloxts/$pkg: Main export not found: $MAIN_EXPORT"
                    ((EXPORT_ERRORS++))
                fi
            fi
        fi
    fi
done
if [ "$EXPORT_ERRORS" -eq 0 ]; then
    print_pass "All package exports valid"
fi

# Count total exports from velox meta-package
print_check "Counting @veloxts/velox re-exports..."
if [ -f "packages/velox/dist/index.js" ]; then
    VELOX_EXPORTS=$(node -e "const v=require('./packages/velox/dist/index.js'); console.log(Object.keys(v).length)" 2>/dev/null || echo "0")
    print_pass "@veloxts/velox exports $VELOX_EXPORTS symbols"
else
    print_warn "Cannot count exports - build packages/velox first"
fi

# ============================================================================
# Phase 4: Security Checks
# ============================================================================
print_header "Phase 4: Security Checks"

# SEC-003: No eval() or Function()
print_check "Checking for eval() usage..."
EVAL_COUNT=$(grep -r "eval(" packages/*/src/*.ts 2>/dev/null | grep -v "node_modules" | wc -l | tr -d ' ')
if [ "$EVAL_COUNT" -eq 0 ]; then
    print_pass "No eval() found"
else
    print_critical "Found $EVAL_COUNT eval() usages"
    grep -rn "eval(" packages/*/src/*.ts 2>/dev/null | grep -v "node_modules" || true
fi

print_check "Checking for new Function() usage..."
FUNC_COUNT=$(grep -r "new Function(" packages/*/src/*.ts 2>/dev/null | grep -v "node_modules" | wc -l | tr -d ' ')
if [ "$FUNC_COUNT" -eq 0 ]; then
    print_pass "No new Function() found"
else
    print_critical "Found $FUNC_COUNT new Function() usages"
    grep -rn "new Function(" packages/*/src/*.ts 2>/dev/null | grep -v "node_modules" || true
fi

# ============================================================================
# Summary
# ============================================================================
print_header "Audit Summary"

TOTAL=$((PASSED + WARNINGS + ERRORS + CRITICAL))

echo -e "  ${GREEN}Passed:${NC}   $PASSED"
echo -e "  ${YELLOW}Warnings:${NC} $WARNINGS"
echo -e "  ${RED}Errors:${NC}   $ERRORS"
echo -e "  ${RED}Critical:${NC} $CRITICAL"
echo ""

if [ "$CRITICAL" -gt 0 ]; then
    echo -e "  ${RED}⛔ NOT READY FOR RELEASE${NC}"
    echo -e "  Fix all critical issues before releasing."
    exit 3
elif [ "$ERRORS" -gt 0 ]; then
    echo -e "  ${RED}✗ NOT READY FOR RELEASE${NC}"
    echo -e "  Fix all errors before releasing."
    exit 2
elif [ "$WARNINGS" -gt 0 ]; then
    echo -e "  ${YELLOW}⚠ READY WITH WARNINGS${NC}"
    echo -e "  Consider addressing warnings before releasing."
    exit 1
else
    echo -e "  ${GREEN}✓ READY FOR RELEASE${NC}"
    exit 0
fi
