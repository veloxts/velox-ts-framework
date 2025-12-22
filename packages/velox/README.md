# VeloxTS Framework

> **Early Preview (v0.6.x)** - APIs are stabilizing but may still change. Use with caution in production.

## Type-safe full-stack without the build step

Full-stack TypeScript framework with end-to-end type safety—no code generation required. Convention-driven APIs that generate both tRPC and REST from a single source.

## Quick Start (Recommended)

```bash
npx create-velox-app my-app
cd my-app
npm run db:push
npm run dev
```

Your API is running at `http://localhost:3030`.

## Manual Installation

For adding to an existing project:

```bash
npm install @veloxts/velox zod
npm install -D @veloxts/cli tsx typescript prisma @prisma/client
```

Note: Manual setup requires Prisma 7 configuration with driver adapters. See [@veloxts/orm](https://www.npmjs.com/package/@veloxts/orm) for details.

## What's Included

This umbrella package re-exports:
- `@veloxts/core` - App bootstrap, plugins, DI
- `@veloxts/validation` - Zod integration
- `@veloxts/orm` - Prisma database plugin
- `@veloxts/router` - Procedures, REST adapter, tRPC
- `@veloxts/auth` - Authentication & authorization

Separate packages: `@veloxts/cli`, `@veloxts/client`, `create-velox-app`

## License

MIT
