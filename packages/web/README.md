# @veloxts/web

React Server Components integration for the VeloxTS framework using [Vinxi](https://vinxi.vercel.app/).

## Overview

`@veloxts/web` enables full-stack React applications with VeloxTS by:

- Embedding Fastify API routes inside Vinxi's HTTP infrastructure
- Providing React Server Components with streaming support
- Implementing Laravel-inspired file-based routing
- Bridging server actions to tRPC procedures

## Installation

```bash
pnpm add @veloxts/web react@19 react-dom@19
```

## Quick Start

### 1. Create your Vinxi configuration

```typescript
// app.config.ts
import { defineVeloxApp } from '@veloxts/web';

export default defineVeloxApp({
  port: 3030,
  apiHandler: './src/api.handler',
  serverEntry: './src/entry.server',
  clientEntry: './src/entry.client',
});
```

### 2. Create the API handler

```typescript
// src/api.handler.ts
import { createApiRouter } from '@veloxts/web';
import { createApp } from '@veloxts/core';
import { userProcedures } from './procedures/users';

const app = await createApp();
// Register your procedures...

export default createApiRouter({
  app,
  basePath: '/api',
});
```

### 3. Create pages

```tsx
// app/pages/index.tsx
export default async function HomePage() {
  return (
    <div>
      <h1>Welcome to VeloxTS</h1>
      <p>Full-stack TypeScript with React Server Components</p>
    </div>
  );
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 Vinxi (HTTP Entry Point)                │
├─────────────────────────────────────────────────────────┤
│  /api/*      → Fastify (Embedded Handler)               │
│  /trpc/*     → Fastify (Embedded Handler)               │
│  /_build/*   → Static Assets (Client Bundle)            │
│  /*          → RSC Renderer (React Flight)              │
└─────────────────────────────────────────────────────────┘
```

## File-Based Routing

Routes are derived from the file structure in `app/pages/`:

| File Path | Route Pattern |
|-----------|--------------|
| `index.tsx` | `/` |
| `about.tsx` | `/about` |
| `users/index.tsx` | `/users` |
| `users/[id].tsx` | `/users/:id` |
| `users/[id]/edit.tsx` | `/users/:id/edit` |
| `[...slug].tsx` | `/*` (catch-all) |
| `(auth)/login.tsx` | `/login` (route group) |

## Requirements

- Node.js 20+
- React 19+
- TypeScript 5.5+

## Status

This package is under active development as part of VeloxTS Phase 4.

## License

MIT
