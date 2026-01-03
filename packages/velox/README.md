# Velox TS Framework

> **Early Preview (v0.6.x)** - APIs are stabilizing but may still change. Do not use in production yet.

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

Your web app is running at `http://localhost:8080`.

## Manual Installation

For adding to an existing project:

```bash
# Runtime dependencies
npm install @veloxts/velox @veloxts/cli @prisma/client zod

# Development dependencies
npm install -D tsx typescript prisma
```

Note: Manual setup requires Prisma 7 configuration with driver adapters. See [@veloxts/orm](https://www.npmjs.com/package/@veloxts/orm) for details.

## What's Included

This umbrella package re-exports:

- `@veloxts/core` - App bootstrap, plugins, DI container
- `@veloxts/router` - Procedures, REST adapter, tRPC integration
- `@veloxts/orm` - Prisma database plugin with driver adapters
- `@veloxts/auth` - JWT/session authentication, guards, rate limiting
- `@veloxts/validation` - Zod schema utilities and integration

## Separate Packages

Install these separately based on your needs:

| Package | Description |
|---------|-------------|
| `@veloxts/cli` | Developer CLI (`velox dev`, `velox make`, `velox migrate`) |
| `@veloxts/client` | Type-safe frontend API client |
| `@veloxts/web` | React Server Components with Vinxi |
| `@veloxts/mcp` | Model Context Protocol server for AI assistants |
| `create-velox-app` | Project scaffolder |

## Ecosystem Add-ons (Experimental)

| Package | Description |
|---------|-------------|
| `@veloxts/cache` | Multi-driver caching (memory, Redis) |
| `@veloxts/queue` | Background job processing (sync, BullMQ) |
| `@veloxts/mail` | Email sending (SMTP, Resend, React Email) |
| `@veloxts/storage` | File storage abstraction (local, S3/R2) |
| `@veloxts/scheduler` | Cron task scheduling |
| `@veloxts/events` | Real-time broadcasting (WebSocket, SSE) |

## License

MIT
