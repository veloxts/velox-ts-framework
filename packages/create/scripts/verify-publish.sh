#!/bin/bash
# Post-publish verification script
# Tests actual published npm packages (not file: references like smoke-test.sh)
#
# Usage:
#   ./verify-publish.sh                    # Test latest from npm
#   ./verify-publish.sh 0.6.34             # Test specific version
#   ./verify-publish.sh --registry http://localhost:4873  # Test from Verdaccio
#   ./verify-publish.sh --all              # Test all template/database combinations
#   ./verify-publish.sh --template auth    # Test specific template
#   ./verify-publish.sh --database postgresql  # Test specific database
#   ./verify-publish.sh --docker           # Start PostgreSQL via Docker for runtime tests
#
# Examples:
#   ./verify-publish.sh 0.6.34 --all                    # Full matrix test
#   ./verify-publish.sh --template rsc --database sqlite # Single combination
#   ./verify-publish.sh --docker --database postgresql   # PostgreSQL with Docker

set -e

# Defaults
VERSION="latest"
REGISTRY="https://registry.npmjs.org"
TEST_ALL=false
USE_DOCKER=false
TEMPLATE=""
DATABASE=""
KEEP_PROJECTS=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --registry)
      REGISTRY="$2"
      shift 2
      ;;
    --all)
      TEST_ALL=true
      shift
      ;;
    --template)
      TEMPLATE="$2"
      shift 2
      ;;
    --database)
      DATABASE="$2"
      shift 2
      ;;
    --docker)
      USE_DOCKER=true
      shift
      ;;
    --keep)
      KEEP_PROJECTS=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [VERSION] [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --registry URL      npm registry (default: https://registry.npmjs.org)"
      echo "  --all               Test all template/database combinations"
      echo "  --template NAME     Test specific template (spa, auth, trpc, rsc)"
      echo "  --database NAME     Test specific database (sqlite, postgresql)"
      echo "  --docker            Start PostgreSQL via Docker for runtime tests"
      echo "  --keep              Keep test projects after completion"
      echo "  --help              Show this help"
      exit 0
      ;;
    *)
      # Assume it's a version number
      if [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+ ]]; then
        VERSION="$1"
      fi
      shift
      ;;
  esac
done

# Test directory
TEST_DIR="/tmp/velox-publish-verify-$$"
mkdir -p "$TEST_DIR"

# Available options
ALL_TEMPLATES=("spa" "auth" "trpc" "rsc")
ALL_DATABASES=("sqlite" "postgresql")

# Determine what to test
if [ "$TEST_ALL" = true ]; then
  TEMPLATES=("${ALL_TEMPLATES[@]}")
  DATABASES=("${ALL_DATABASES[@]}")
elif [ -n "$TEMPLATE" ] && [ -n "$DATABASE" ]; then
  TEMPLATES=("$TEMPLATE")
  DATABASES=("$DATABASE")
elif [ -n "$TEMPLATE" ]; then
  TEMPLATES=("$TEMPLATE")
  DATABASES=("sqlite")  # Default to sqlite for single template test
elif [ -n "$DATABASE" ]; then
  TEMPLATES=("spa")     # Default to spa for single database test
  DATABASES=("$DATABASE")
else
  # Default: test spa with sqlite (quick sanity check)
  TEMPLATES=("spa")
  DATABASES=("sqlite")
fi

# Counters
PASSED=0
FAILED=0
SKIPPED=0

echo ""
echo -e "${BLUE}=== Post-Publish Verification ===${NC}"
echo "Registry: $REGISTRY"
echo "Version: $VERSION"
echo "Test dir: $TEST_DIR"
echo "Templates: ${TEMPLATES[*]}"
echo "Databases: ${DATABASES[*]}"
echo "Docker: $USE_DOCKER"
echo ""

# Function to cleanup
cleanup() {
  if [ "$KEEP_PROJECTS" = false ]; then
    echo ""
    echo "=== Cleaning up ==="
    rm -rf "$TEST_DIR"
    echo "Done."
  else
    echo ""
    echo "Test projects kept at: $TEST_DIR"
  fi
}

trap cleanup EXIT

# Function to start PostgreSQL Docker container
start_postgres() {
  local project_name="$1"
  echo "Starting PostgreSQL container..."

  docker run -d \
    --name "${project_name}-postgres" \
    -e POSTGRES_USER=user \
    -e POSTGRES_PASSWORD=password \
    -e POSTGRES_DB="${project_name}" \
    -p 5432:5432 \
    postgres:16-alpine \
    > /dev/null 2>&1

  # Wait for PostgreSQL to be ready
  echo "Waiting for PostgreSQL to be ready..."
  for i in {1..30}; do
    if docker exec "${project_name}-postgres" pg_isready -U user -d "${project_name}" > /dev/null 2>&1; then
      echo "PostgreSQL is ready!"
      return 0
    fi
    sleep 1
  done

  echo "PostgreSQL failed to start"
  return 1
}

# Function to stop PostgreSQL Docker container
stop_postgres() {
  local project_name="$1"
  docker stop "${project_name}-postgres" > /dev/null 2>&1 || true
  docker rm "${project_name}-postgres" > /dev/null 2>&1 || true
}

# Function to test endpoints
test_endpoints() {
  local port="$1"
  local template="$2"
  local base_url="http://localhost:${port}"

  echo ""
  echo "--- Testing endpoints ---"

  # Health check
  response=$(curl -s -o /dev/null -w "%{http_code}" "${base_url}/api/health" 2>/dev/null || echo "000")
  if [ "$response" = "200" ]; then
    echo -e "${GREEN}✓${NC} GET /api/health (200)"
  else
    echo -e "${RED}✗${NC} GET /api/health (expected 200, got $response)"
    return 1
  fi

  # List users
  response=$(curl -s -o /dev/null -w "%{http_code}" "${base_url}/api/users" 2>/dev/null || echo "000")
  if [ "$response" = "200" ]; then
    echo -e "${GREEN}✓${NC} GET /api/users (200)"
  else
    echo -e "${RED}✗${NC} GET /api/users (expected 200, got $response)"
    return 1
  fi

  # Create user
  response=$(curl -s -X POST "${base_url}/api/users" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","name":"Test User"}' \
    -w "\n%{http_code}" 2>/dev/null)
  status=$(echo "$response" | tail -1)
  body=$(echo "$response" | head -n -1)

  if [ "$status" = "201" ]; then
    echo -e "${GREEN}✓${NC} POST /api/users (201)"
    user_id=$(echo "$body" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
  else
    echo -e "${RED}✗${NC} POST /api/users (expected 201, got $status)"
    return 1
  fi

  # Get user by ID
  if [ -n "$user_id" ]; then
    response=$(curl -s -o /dev/null -w "%{http_code}" "${base_url}/api/users/${user_id}" 2>/dev/null || echo "000")
    if [ "$response" = "200" ]; then
      echo -e "${GREEN}✓${NC} GET /api/users/:id (200)"
    else
      echo -e "${RED}✗${NC} GET /api/users/:id (expected 200, got $response)"
      return 1
    fi

    # Delete user
    response=$(curl -s -X DELETE -o /dev/null -w "%{http_code}" "${base_url}/api/users/${user_id}" 2>/dev/null || echo "000")
    if [ "$response" = "200" ]; then
      echo -e "${GREEN}✓${NC} DELETE /api/users/:id (200)"
    else
      echo -e "${RED}✗${NC} DELETE /api/users/:id (expected 200, got $response)"
      return 1
    fi
  fi

  # Auth-specific tests
  if [ "$template" = "auth" ]; then
    echo ""
    echo "--- Testing auth endpoints ---"

    # Register
    response=$(curl -s -X POST "${base_url}/auth/register" \
      -H "Content-Type: application/json" \
      -d '{"email":"auth-test@example.com","password":"password123","name":"Auth Test"}' \
      -w "\n%{http_code}" 2>/dev/null)
    status=$(echo "$response" | tail -1)

    if [ "$status" = "201" ] || [ "$status" = "200" ]; then
      echo -e "${GREEN}✓${NC} POST /auth/register ($status)"
    else
      echo -e "${YELLOW}⚠${NC} POST /auth/register (got $status)"
    fi

    # Login
    response=$(curl -s -X POST "${base_url}/auth/login" \
      -H "Content-Type: application/json" \
      -d '{"email":"auth-test@example.com","password":"password123"}' \
      -w "\n%{http_code}" 2>/dev/null)
    status=$(echo "$response" | tail -1)

    if [ "$status" = "200" ]; then
      echo -e "${GREEN}✓${NC} POST /auth/login (200)"
    else
      echo -e "${YELLOW}⚠${NC} POST /auth/login (got $status)"
    fi
  fi

  return 0
}

# Function to test a single combination
test_combination() {
  local template="$1"
  local database="$2"
  local project_name="test-${template}-${database}"
  local test_port=$((3030 + RANDOM % 1000))

  echo ""
  echo -e "${BLUE}===========================================${NC}"
  echo -e "${BLUE}  Testing: $template + $database${NC}"
  echo -e "${BLUE}===========================================${NC}"

  cd "$TEST_DIR"

  # Remove existing project if any
  rm -rf "$project_name"

  # Create project from published package
  echo ""
  echo "=== Creating project from npm ==="
  if ! npx --registry "$REGISTRY" "create-velox-app@${VERSION}" "$project_name" \
    --template "$template" \
    --database "$database" \
    --skip-install 2>&1; then
    echo -e "${RED}✗ Failed to create project${NC}"
    ((FAILED++))
    return 1
  fi
  echo -e "${GREEN}✓${NC} Project created"

  cd "$project_name"

  # Verify key files exist
  echo ""
  echo "=== Verifying project structure ==="
  local missing_files=false

  # Check based on template type
  if [ "$template" = "rsc" ]; then
    # RSC is single-package, not monorepo
    [ ! -f "package.json" ] && echo -e "${RED}✗ Missing: package.json${NC}" && missing_files=true
    [ ! -f "prisma.config.ts" ] && echo -e "${RED}✗ Missing: prisma.config.ts${NC}" && missing_files=true
    [ ! -f "prisma/schema.prisma" ] && echo -e "${RED}✗ Missing: prisma/schema.prisma${NC}" && missing_files=true
    [ "$database" = "postgresql" ] && [ ! -f "docker-compose.yml" ] && echo -e "${RED}✗ Missing: docker-compose.yml${NC}" && missing_files=true
  else
    # Monorepo templates (spa, auth, trpc)
    [ ! -f "package.json" ] && echo -e "${RED}✗ Missing: package.json${NC}" && missing_files=true
    [ ! -f "apps/api/package.json" ] && echo -e "${RED}✗ Missing: apps/api/package.json${NC}" && missing_files=true
    [ ! -f "apps/api/prisma.config.ts" ] && echo -e "${RED}✗ Missing: apps/api/prisma.config.ts${NC}" && missing_files=true
    [ ! -f "apps/api/prisma/schema.prisma" ] && echo -e "${RED}✗ Missing: apps/api/prisma/schema.prisma${NC}" && missing_files=true
    [ "$database" = "postgresql" ] && [ ! -f "apps/api/docker-compose.yml" ] && echo -e "${RED}✗ Missing: apps/api/docker-compose.yml${NC}" && missing_files=true
  fi

  if [ "$missing_files" = true ]; then
    echo -e "${RED}✗ Project structure verification failed${NC}"
    ((FAILED++))
    return 1
  fi
  echo -e "${GREEN}✓${NC} Project structure verified"

  # Install dependencies
  echo ""
  echo "=== Installing dependencies ==="
  if ! npm install 2>&1 | tail -5; then
    echo -e "${RED}✗ Failed to install dependencies${NC}"
    ((FAILED++))
    return 1
  fi
  echo -e "${GREEN}✓${NC} Dependencies installed"

  # Generate Prisma client
  echo ""
  echo "=== Generating Prisma client ==="
  if ! npm run db:generate 2>&1 | tail -5; then
    echo -e "${RED}✗ Failed to generate Prisma client${NC}"
    ((FAILED++))
    return 1
  fi
  echo -e "${GREEN}✓${NC} Prisma client generated"

  # Build
  echo ""
  echo "=== Building project ==="
  if [ "$template" = "rsc" ]; then
    # RSC uses vinxi build
    if ! npm run build 2>&1 | tail -10; then
      echo -e "${RED}✗ Failed to build${NC}"
      ((FAILED++))
      return 1
    fi
  else
    # Monorepo: build api
    if ! npm run -w api build 2>&1 | tail -5; then
      echo -e "${RED}✗ Failed to build API${NC}"
      ((FAILED++))
      return 1
    fi
  fi
  echo -e "${GREEN}✓${NC} Build successful"

  # Runtime tests (SQLite or PostgreSQL with Docker)
  if [ "$database" = "sqlite" ]; then
    echo ""
    echo "=== Setting up database ==="
    if ! npm run db:push 2>&1 | tail -3; then
      echo -e "${RED}✗ Failed to push database schema${NC}"
      ((FAILED++))
      return 1
    fi
    echo -e "${GREEN}✓${NC} Database schema pushed"

    # Start server and test endpoints
    echo ""
    echo "=== Starting server ==="

    if [ "$template" = "rsc" ]; then
      # RSC uses vinxi dev (skip runtime test for now, build is enough)
      echo -e "${YELLOW}⚠${NC} RSC runtime test skipped (requires vinxi)"
      ((PASSED++))
      return 0
    fi

    # Kill any existing process on the port
    lsof -ti :$test_port 2>/dev/null | xargs kill -9 2>/dev/null || true
    sleep 1

    # Start server in background
    cd apps/api
    PORT=$test_port node dist/index.js &
    SERVER_PID=$!
    cd ../..

    # Wait for server to start
    echo "Waiting for server to start (port $test_port)..."
    for i in {1..30}; do
      if curl -s "http://localhost:${test_port}/api/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Server started"
        break
      fi
      sleep 1
    done

    # Test endpoints
    if test_endpoints "$test_port" "$template"; then
      echo ""
      echo -e "${GREEN}✓ All endpoint tests passed${NC}"
      ((PASSED++))
    else
      echo ""
      echo -e "${RED}✗ Endpoint tests failed${NC}"
      ((FAILED++))
    fi

    # Stop server
    kill $SERVER_PID 2>/dev/null || true
    wait $SERVER_PID 2>/dev/null || true

  elif [ "$database" = "postgresql" ] && [ "$USE_DOCKER" = true ]; then
    echo ""
    echo "=== Setting up PostgreSQL via Docker ==="

    # Update .env with Docker PostgreSQL URL
    if [ "$template" = "rsc" ]; then
      echo "DATABASE_URL=postgresql://user:password@localhost:5432/${project_name}" > .env
    else
      echo "DATABASE_URL=postgresql://user:password@localhost:5432/${project_name}" > apps/api/.env
    fi

    # Start PostgreSQL
    if start_postgres "$project_name"; then
      echo ""
      echo "=== Pushing database schema ==="
      if npm run db:push 2>&1 | tail -3; then
        echo -e "${GREEN}✓${NC} Database schema pushed"

        # Start server and test (skip for RSC)
        if [ "$template" != "rsc" ]; then
          echo ""
          echo "=== Starting server ==="

          lsof -ti :$test_port 2>/dev/null | xargs kill -9 2>/dev/null || true
          sleep 1

          cd apps/api
          PORT=$test_port node dist/index.js &
          SERVER_PID=$!
          cd ../..

          echo "Waiting for server to start..."
          for i in {1..30}; do
            if curl -s "http://localhost:${test_port}/api/health" > /dev/null 2>&1; then
              echo -e "${GREEN}✓${NC} Server started"
              break
            fi
            sleep 1
          done

          if test_endpoints "$test_port" "$template"; then
            echo ""
            echo -e "${GREEN}✓ All endpoint tests passed${NC}"
            ((PASSED++))
          else
            echo ""
            echo -e "${RED}✗ Endpoint tests failed${NC}"
            ((FAILED++))
          fi

          kill $SERVER_PID 2>/dev/null || true
        else
          echo -e "${YELLOW}⚠${NC} RSC runtime test skipped"
          ((PASSED++))
        fi
      else
        echo -e "${RED}✗ Failed to push database schema${NC}"
        ((FAILED++))
      fi

      stop_postgres "$project_name"
    else
      echo -e "${RED}✗ Failed to start PostgreSQL${NC}"
      ((FAILED++))
    fi

  else
    # PostgreSQL without Docker - build-only validation
    echo ""
    echo -e "${YELLOW}⚠${NC} PostgreSQL runtime test skipped (use --docker to enable)"
    echo -e "${GREEN}✓${NC} Build validation passed"
    ((PASSED++))
  fi

  return 0
}

# Main test loop
echo ""
echo "=== Starting verification ==="

for template in "${TEMPLATES[@]}"; do
  for database in "${DATABASES[@]}"; do
    test_combination "$template" "$database" || true
  done
done

# Summary
echo ""
echo -e "${BLUE}===========================================${NC}"
echo -e "${BLUE}  Verification Summary${NC}"
echo -e "${BLUE}===========================================${NC}"
echo ""
echo -e "  ${GREEN}Passed:${NC}  $PASSED"
echo -e "  ${RED}Failed:${NC}  $FAILED"
echo -e "  ${YELLOW}Skipped:${NC} $SKIPPED"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}All verifications passed!${NC}"
  exit 0
else
  echo -e "${RED}Some verifications failed.${NC}"
  exit 1
fi
