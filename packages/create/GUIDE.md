# create-velox-app

Interactive project scaffolder for VeloxTS Framework.

## Usage

```bash
npx create-velox-app my-app
cd my-app
npm run db:push
npm run dev
```

Your app will be running at `http://localhost:3030`

## Templates

```bash
npx create-velox-app my-app              # Default REST API
npx create-velox-app my-app --auth       # With JWT authentication
npx create-velox-app my-app --trpc       # tRPC-only setup (no REST)
npx create-velox-app my-app --rsc        # Full-stack RSC with Vinxi
npx create-velox-app my-app --rsc-auth   # Full-stack RSC + JWT authentication
```

## Project Structure

```
my-app/
├── src/
│   ├── procedures/      # API endpoints
│   ├── schemas/         # Zod validation
│   └── index.ts         # Entry point
├── prisma/
│   └── schema.prisma    # Database schema
└── package.json
```

## Available Scripts

```bash
npm run dev          # Development server with HMR
npm run build        # Build for production
npm run db:push      # Push database schema
```

## Test Endpoints

```bash
curl http://localhost:3030/api/health
curl http://localhost:3030/api/users
curl -X POST http://localhost:3030/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "email": "alice@example.com"}'
```

## Post-Publish Verification

The `verify-publish.sh` script tests actual published npm packages to ensure they work correctly after publishing. Unlike the smoke test (which uses local `file:` references), this script downloads packages from npm and validates the complete user experience.

### When to Use

- **After publishing** to npm to verify packages work correctly
- **Before major releases** to test all template/database combinations
- **With Verdaccio** to test packages locally before publishing to npm
- **In CI/CD** as a post-publish validation step

### Prerequisites

- Node.js 20+
- npm
- curl
- Docker (optional, for PostgreSQL runtime tests)

### Basic Usage

```bash
cd packages/create

# Test latest published version (spa + sqlite)
pnpm verify-publish

# Test specific version
pnpm verify-publish 0.6.34

# Test from local Verdaccio registry
pnpm verify-publish --registry http://localhost:4873

# Test specific template
pnpm verify-publish --template auth

# Test specific database (Docker auto-enabled for postgresql)
pnpm verify-publish --database postgresql

# Test specific combination
pnpm verify-publish --template auth --database sqlite

# Test all combinations (full matrix)
pnpm verify-publish --all

# Keep test projects for inspection
pnpm verify-publish --keep
```

### Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `VERSION` | Package version to test | `latest` |
| `--registry URL` | npm registry URL | `https://registry.npmjs.org` |
| `--template NAME` | Template to test (`spa`, `auth`, `trpc`, `rsc`) | `spa` |
| `--database NAME` | Database to test (`sqlite`, `postgresql`) | `sqlite` |
| `--all` | Test all template/database combinations | `false` |
| `--docker` | Force Docker (auto-enabled for postgresql) | `false` |
| `--keep` | Keep test projects after completion | `false` |
| `--help` | Show help message | - |

### What Gets Tested

For each template/database combination, the script validates:

1. **Project Creation** - `npx create-velox-app` succeeds
2. **Project Structure** - Required files exist (package.json, prisma.config.ts, schema.prisma, docker-compose.yml for PostgreSQL)
3. **Dependency Installation** - `npm install` succeeds
4. **Prisma Generation** - `npm run db:generate` succeeds
5. **Build** - `npm run build` (or `npm run -w api build` for monorepo) succeeds
6. **Database Setup** - `npm run db:push` succeeds (SQLite direct, PostgreSQL via Docker)
7. **Runtime Endpoints** (all databases - Docker auto-enabled for PostgreSQL):
   - `GET /api/health` → 200
   - `GET /api/users` → 200
   - `POST /api/users` → 201
   - `GET /api/users/:id` → 200
   - `DELETE /api/users/:id` → 200
   - Auth template also tests `/auth/register` and `/auth/login`

### Examples

#### Quick Sanity Check
```bash
# Test default template with SQLite (fastest)
pnpm verify-publish
```

#### Test Specific Version from npm
```bash
pnpm verify-publish 0.6.31
```

#### Test with Local Verdaccio Before Publishing
```bash
# 1. Start Verdaccio
npx verdaccio

# 2. Publish packages to Verdaccio
pnpm publish --registry http://localhost:4873 --no-git-checks

# 3. Verify the published packages
pnpm verify-publish --registry http://localhost:4873
```

#### Full Matrix Test
```bash
# Test all 8 combinations (4 templates × 2 databases)
# Docker auto-enabled for PostgreSQL runtime tests
pnpm verify-publish --all
```

#### PostgreSQL (Docker Auto-Enabled)
```bash
# Docker automatically starts for PostgreSQL runtime tests
pnpm verify-publish --template spa --database postgresql
```

#### Debug Failed Tests
```bash
# Keep projects for manual inspection
pnpm verify-publish --template auth --keep

# Projects saved to /tmp/velox-publish-verify-XXXX/
```

### Understanding Output

```
=== Post-Publish Verification ===
Registry: https://registry.npmjs.org
Version: 0.6.34
Templates: spa auth trpc rsc
Databases: sqlite postgresql

=== Testing: spa + sqlite ===
✓ Project created
✓ Project structure verified
✓ Dependencies installed
✓ Prisma client generated
✓ Build successful
✓ Database schema pushed
✓ Server started
✓ GET /api/health (200)
✓ GET /api/users (200)
✓ POST /api/users (201)
✓ GET /api/users/:id (200)
✓ DELETE /api/users/:id (200)
✓ All endpoint tests passed

=== Verification Summary ===
  Passed:  1
  Failed:  0
  Skipped: 0

All verifications passed!
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All tests passed |
| 1 | One or more tests failed |

### Troubleshooting

#### "No matching version found"
The specified version doesn't exist on the registry:
```bash
# Check available versions
npm view create-velox-app versions --registry http://localhost:4873
```

#### Docker Not Running
PostgreSQL tests require Docker to be running:
```bash
# Start Docker Desktop or daemon first, then run:
pnpm verify-publish --database postgresql
```

#### Port Already in Use
The script uses random ports (3030-4030), but conflicts can occur:
```bash
# Kill processes on common ports
lsof -ti :3030 | xargs kill -9
```

#### Inspect Failed Project
```bash
# Keep the test project
pnpm verify-publish --template auth --keep

# Navigate to it
cd /tmp/velox-publish-verify-XXXXX/test-auth-sqlite

# Manually debug
npm run dev
```

### CI/CD Integration

```yaml
# GitHub Actions example
verify-publish:
  runs-on: ubuntu-latest
  needs: publish
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v2
    - uses: actions/setup-node@v4
      with:
        node-version: '20'

    - name: Verify published packages
      run: |
        cd packages/create
        ./scripts/verify-publish.sh ${{ needs.publish.outputs.version }}
```

### Comparison: smoke-test vs verify-publish

| Aspect | smoke-test | verify-publish |
|--------|------------|----------------|
| **Purpose** | Pre-publish validation | Post-publish validation |
| **Package Source** | Local `file:` references | npm registry |
| **Speed** | Faster (no npm download) | Slower (full npm install) |
| **When to Run** | Before publishing | After publishing |
| **Matrix Testing** | Single template | All combinations |
| **Docker Support** | No | Auto (PostgreSQL) |

## Learn More

See [@veloxts/velox](https://www.npmjs.com/package/@veloxts/velox) for complete documentation.
