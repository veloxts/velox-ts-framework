# Building the VeloxTS Framework

> **Deprecated:** This document is no longer maintained. Please refer to the official documentation at [veloxts.dev/docs](https://www.veloxts.dev/docs/).

This guide explains the different build commands available in the VeloxTS monorepo and when to use each one.

## Available Build Commands

| Command | Tool | Best For |
|---------|------|----------|
| `pnpm build` | Turborepo | CI/CD, fresh clones, after pulling changes |
| `pnpm build:tsc` | TypeScript | Local development, quick rebuilds |
| `pnpm build:watch` | TypeScript | Active coding sessions |

## Command Details

### `pnpm build` (Turborepo)

```bash
pnpm build
```

**What it does:**
- Runs `turbo build` which orchestrates builds across all packages
- Uses remote caching (if configured) to skip unchanged packages
- Respects `dependsOn: ["^build"]` to build dependencies first
- Generates `.turbo` cache artifacts

**When to use:**
- In CI/CD pipelines (use `pnpm ci:build` for CI-specific flags)
- After cloning the repository for the first time
- After pulling significant changes from remote
- When you want guaranteed correct build order across packages
- When working with remote caching in team environments

**Example CI usage:**
```bash
pnpm ci:build  # Runs: turbo run build --color --no-daemon
```

### `pnpm build:tsc` (TypeScript Build Mode)

```bash
pnpm build:tsc
```

**What it does:**
- Runs `tsc --build` using TypeScript's native project references
- Uses `.tsbuildinfo` files for incremental compilation
- Only recompiles files that have changed since last build
- Faster than Turborepo for incremental local builds

**When to use:**
- During local development after making code changes
- When you need fast incremental rebuilds
- When Turborepo cache is cold but TypeScript cache is warm
- When you only changed a few files and want instant feedback

**Performance comparison:**
```
# Cold build (no cache):
pnpm build      ~15s  (Turborepo orchestration overhead)
pnpm build:tsc  ~12s  (Direct TypeScript)

# Warm incremental build (few files changed):
pnpm build      ~3-5s (Cache lookup + validation)
pnpm build:tsc  ~1-2s (Direct .tsbuildinfo check)
```

### `pnpm build:watch` (Watch Mode)

```bash
pnpm build:watch
```

**What it does:**
- Runs `tsc --build --watch`
- Watches all source files for changes
- Automatically recompiles when files change
- Uses incremental compilation for fast rebuilds

**When to use:**
- During active coding sessions
- When you're making frequent changes across packages
- When running alongside the playground app
- When you want instant feedback on TypeScript errors

**Typical workflow:**
```bash
# Terminal 1: Watch for changes
pnpm build:watch

# Terminal 2: Run playground or tests
pnpm --filter playground dev
```

## Build Architecture

### Project References

The monorepo uses TypeScript project references for proper build ordering:

```
tsconfig.json (root)
├── packages/core         # Foundation - no framework deps
├── packages/validation   # Zod integration
├── packages/orm          # Prisma wrapper
├── packages/router       # tRPC + REST routing
├── packages/auth         # Authentication & authorization
├── packages/client       # Type-safe frontend client
├── packages/cli          # Developer tooling
├── packages/create       # Project scaffolder
├── packages/web          # RSC + Vinxi integration
├── packages/velox        # Meta-package (re-exports)
├── packages/mcp          # Model Context Protocol server
├── packages/cache        # Multi-driver caching
├── packages/queue        # Background job processing
├── packages/mail         # Email sending
├── packages/storage      # File storage abstraction
├── packages/scheduler    # Cron task scheduling
├── packages/events       # Real-time broadcasting
└── apps/playground       # Development testing
```

### Turborepo Task Configuration

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["src/**/*.ts", "tsconfig.json", "package.json", "$TURBO_DEFAULT$"],
      "outputs": ["dist/**", ".tsbuildinfo"]
    }
  }
}
```

Key settings:
- `dependsOn: ["^build"]` - Build dependencies before dependents
- `$TURBO_DEFAULT$` - Includes turbo.json and root config in cache key
- `.tsbuildinfo` in outputs - Preserves incremental build state

## Decision Flowchart

```
Need to build?
    │
    ├─> Is this CI? ─────────────────> pnpm ci:build
    │
    ├─> Fresh clone / major update? ─> pnpm build
    │
    ├─> Active coding session? ──────> pnpm build:watch
    │
    └─> Quick rebuild after edits? ──> pnpm build:tsc
```

## Other Scripts

### Type Checking

```bash
pnpm type-check  # Run type checking without emitting files
```

Runs `tsc --noEmit` across all packages. Faster than a full build when you only need to verify types.

### Cleaning

```bash
pnpm clean  # Remove all build artifacts
```

Use this to reset build state when troubleshooting cache issues.

### CI-Specific Scripts

```bash
pnpm ci:build       # Build with CI flags
pnpm ci:test        # Test with CI flags
pnpm ci:lint        # Lint with CI flags
pnpm ci:type-check  # Type check with CI flags
```

These scripts add `--color --no-daemon` flags for better CI output and to avoid daemon-related issues in ephemeral CI environments.

## Troubleshooting

### Build seems stuck or incorrect

```bash
pnpm clean && pnpm build
```

### TypeScript not picking up changes

```bash
# Remove tsbuildinfo files
find . -name "*.tsbuildinfo" -delete
pnpm build:tsc
```

### Turborepo cache issues

```bash
# Clear Turborepo cache
rm -rf .turbo
pnpm build
```
