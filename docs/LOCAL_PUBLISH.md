# Local Publishing with Verdaccio

Test VeloxTS packages locally before publishing to npm.

## Setup Verdaccio

```bash
# Terminal 1 (keep running)
npx verdaccio
# Runs at http://localhost:4873
```

## Configure npm for @veloxts scope

```bash
npm config set @veloxts:registry http://localhost:4873
```

## Publish to Local Registry

**IMPORTANT:** Always use `pnpm publish`, not `npm publish`. This ensures `workspace:*` references are converted to actual version numbers.

```bash
# Build all packages
pnpm build

# Publish each package in dependency order
for pkg in core validation orm router auth client cli create web mcp velox cache queue mail storage scheduler events; do
  cd packages/$pkg
  pnpm publish --registry http://localhost:4873 --no-git-checks
  cd ../..
done
```

## Test End-to-End

```bash
# Outside monorepo
cd /tmp
rm -rf velox-test-app

# Create new project from local registry
npx create-velox-app@latest velox-test-app --registry http://localhost:4873

# Test generated project
cd velox-test-app
npm install
npm run db:push
npm run dev

# Test with auth template
cd /tmp
npx create-velox-app@latest velox-auth-app --auth --registry http://localhost:4873
```

## Smoke Test (Recommended)

The monorepo includes an automated smoke test:

```bash
cd packages/create
pnpm smoke-test           # Test default template
pnpm smoke-test --auth    # Test auth template
pnpm smoke-test --rsc     # Test RSC template
```

## Cleanup

```bash
# Remove local registry config
npm config delete @veloxts:registry

# Stop Verdaccio (Ctrl+C in Terminal 1)

# Clear Verdaccio storage (optional)
rm -rf ~/.config/verdaccio/storage/@veloxts
```
