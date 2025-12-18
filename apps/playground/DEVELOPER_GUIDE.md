# VeloxTS CLI Developer Guide

This guide explains how to use the playground for rapid CLI development and testing.

## Overview

The playground is a pre-configured VeloxTS application that serves as a sandbox for testing CLI commands during development. Combined with the `dev:link` watch mode, it provides a fast feedback loop for CLI development.

**Time savings:** 30-60 seconds per iteration → 3-5 seconds (10x faster)

## Quick Start

### 1. Start Watch Mode (Terminal 1)

```bash
cd packages/cli
pnpm dev:link
```

You'll see:
```
┌  VeloxTS CLI Dev Mode
│
◆  Initial build complete

Ready for testing!

Open a new terminal and run:

  cd /path/to/apps/playground

  pnpm velox --help              # CLI help
  pnpm velox make r Post --crud  # Generate resource
  pnpm velox procedures list     # List procedures
  pnpm velox dev                 # Start dev server
```

### 2. Test Commands (Terminal 2)

```bash
cd apps/playground
pnpm velox --help
```

### 3. Iterate

1. Edit CLI code (e.g., `packages/cli/src/commands/make.ts`)
2. Watch terminal shows "Rebuild complete" (2 seconds)
3. Re-run command immediately
4. See changes instantly

## Available Commands

### CLI Shortcuts

The playground has convenience scripts for common operations:

```bash
# Run any velox command
pnpm velox <command>

# Shortcuts
pnpm velox:make           # Same as: pnpm velox make
pnpm velox:procedures     # Same as: pnpm velox procedures list
```

### Generator Commands

```bash
# Generate a resource (model + schema + procedure)
pnpm velox make resource Post --crud
pnpm velox make r Post --crud        # Short form

# Generate individual components
pnpm velox make procedure User
pnpm velox make schema User
pnpm velox make migration AddUserRole

# Interactive mode (prompts for fields)
pnpm velox make resource Post
```

### Procedure Discovery

```bash
# List all discovered procedures
pnpm velox procedures list

# With verbose output
pnpm velox procedures list --verbose
```

### Database Commands

```bash
# Run migrations
pnpm velox migrate run

# Check migration status
pnpm velox migrate status

# Seed database
pnpm velox db seed

# Run specific seeder
pnpm velox db seed --seeder UserSeeder
```

### Development Server

```bash
# Start with HMR (default)
pnpm velox dev

# Without HMR
pnpm velox dev --no-hmr

# Custom port
pnpm velox dev --port 4000

# Verbose mode
pnpm velox dev --verbose
```

## Development Workflows

### Testing Generator Changes

**Scenario:** You're modifying the resource generator template.

```bash
# Terminal 1: Watch mode
cd packages/cli && pnpm dev:link

# Terminal 2: Test generation
cd apps/playground

# Clean up previous test files
rm -f src/procedures/test-*.ts src/schemas/test-*.ts src/models/test-*.prisma

# Generate new resource
pnpm velox make r TestPost --crud

# Check generated files
cat src/procedures/test-post.ts
cat src/schemas/test-post.schema.ts
cat src/models/test-post.prisma
```

### Testing Procedure Discovery

**Scenario:** You're debugging procedure discovery issues.

```bash
# Terminal 1: Watch mode
cd packages/cli && pnpm dev:link

# Terminal 2: Test discovery
cd apps/playground

# List procedures with verbose output
pnpm velox procedures list --verbose

# Check specific file
cat src/procedures/health.ts
```

### Testing Dev Server

**Scenario:** You're working on HMR improvements.

```bash
# Terminal 1: Watch CLI
cd packages/cli && pnpm dev:link

# Terminal 2: Run dev server
cd apps/playground && pnpm velox dev --verbose

# Terminal 3: Make changes and observe reload timing
# Edit apps/playground/src/procedures/health.ts
# Watch Terminal 2 for reload metrics
```

### Testing Interactive Prompts

**Scenario:** You're improving the field collection UX.

```bash
# Terminal 1: Watch mode
cd packages/cli && pnpm dev:link

# Terminal 2: Run interactive generator
cd apps/playground
pnpm velox make resource

# Follow prompts, test various inputs:
# - Valid field names: title, firstName, userId
# - Invalid field names: Title, 1field, field-name
# - Reserved names: id, createdAt, updatedAt
# - All field types: string, text, int, float, boolean, datetime, json, enum
```

## File Locations

### CLI Source Files

```
packages/cli/src/
├── cli.ts                 # Main entry point
├── commands/              # Command implementations
│   ├── dev.ts             # Dev server
│   ├── make.ts            # Generators
│   ├── migrate.ts         # Migrations
│   └── procedures.ts      # Procedure discovery
├── generators/            # Code generators
│   ├── fields/            # Field prompts
│   │   ├── prompts.ts     # Interactive collection
│   │   └── types.ts       # Field type definitions
│   └── templates/         # Code templates
│       └── resource.ts    # Resource generator
└── dev/                   # Dev server internals
    ├── hmr.ts             # HMR implementation
    └── reload-reporter.ts # Timing display
```

### Playground Files

```
apps/playground/
├── src/
│   ├── index.ts           # App entry point
│   ├── procedures/        # API procedures
│   │   ├── health.ts      # Health check
│   │   └── users.ts       # User CRUD
│   ├── schemas/           # Zod schemas
│   └── config/            # App configuration
├── prisma/
│   └── schema.prisma      # Database schema
└── DEVELOPER_GUIDE.md     # This file
```

## Troubleshooting

### Watch mode not detecting changes

**Symptom:** You edit CLI code but don't see "Rebuild complete".

**Solution:**
1. Check the watch terminal for TypeScript errors
2. Ensure you're editing files in `packages/cli/src/`
3. Try restarting watch mode: Ctrl+C, then `pnpm dev:link`

### Command not found after rebuild

**Symptom:** Command fails even after successful rebuild.

**Solution:**
1. Ensure CLI build completed without errors
2. Check that `packages/cli/dist/` exists
3. The playground uses `node ../../packages/cli/dist/cli.js` directly

### Procedure discovery warnings

**Symptom:** `velox procedures list` shows warnings about missing modules.

**Solution:**
This often means the playground hasn't been built:
```bash
cd apps/playground
pnpm build
pnpm velox procedures list
```

### TypeScript errors in watch mode

**Symptom:** Watch terminal shows red TypeScript errors.

**Solution:**
1. Read the error message carefully
2. Fix the issue in your code
3. Save the file - watch mode will automatically rebuild
4. Verify "Rebuild complete" appears

### Generated files have issues

**Symptom:** Generated code has syntax errors or wrong output.

**Solution:**
1. Check the template in `packages/cli/src/generators/templates/`
2. Run tests: `cd packages/cli && pnpm test`
3. Look at test expectations in `__tests__/` directories

## Tips & Tricks

### Quick iteration on templates

```bash
# Generate, inspect, delete, repeat
pnpm velox make r Test --crud && \
  cat src/procedures/test.ts && \
  rm -f src/procedures/test.ts src/schemas/test.schema.ts src/models/test.prisma
```

### Test all field types at once

```bash
# Use the "all fields" template when available
pnpm velox make resource Test

# Or manually specify diverse fields:
# title:string, content:text, count:int, price:float,
# isActive:boolean, publishedAt:datetime, metadata:json, status:enum
```

### Check generated Prisma schema validity

```bash
# After generating a resource with a model
pnpm velox make r Post --crud

# Validate Prisma schema
npx prisma validate
```

### Debug CLI code

Add console.log statements to CLI code:
```typescript
// In packages/cli/src/commands/make.ts
console.log('[DEBUG]', { options, args });
```

Save → watch rebuilds → re-run command → see output.

## Related Documentation

- [VeloxTS Framework CLAUDE.md](/CLAUDE.md) - Framework architecture and conventions
- [CLI Package README](/packages/cli/README.md) - CLI documentation
- [Smoke Test](/packages/create/scripts/smoke-test.sh) - End-to-end testing
