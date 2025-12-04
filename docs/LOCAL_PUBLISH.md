# Setup Verdaccio

## Install & Start

```bash
# Terminal 1 (keep running)
npx verdaccio
# Runs at http://localhost:4873
```

### Configure npm for @veloxts scope

```bash
npm config set @veloxts:registry http://localhost:4873
```

## Publish to Local Registry

```bash
# Build all packages
pnpm build

# Publish using Changesets (converts workspace:* to ^0.1.0)
pnpm release
```

## Test End-to-End

```bash
 # Outside monorepo
cd /tmp
rm -rf velox-test-app

# Run scaffolder
node /Users/alainduchesneau/Projets/@veloxts/packages/create/dist/cli.js velox-test-app

# Test generated project
cd velox-test-app
pnpm install     # Should work with Verdaccio
pnpm build
pnpm db:push
pnpm dev
```

## Cleanup (After Testing)

```bash
 # Remove local registry config
npm config delete @veloxts:registry

# Stop Verdaccio (Ctrl+C in Terminal 1)
```
