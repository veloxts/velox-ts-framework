# @veloxts/web

React Server Components integration for the VeloxTS framework using [Vinxi](https://vinxi.vercel.app/).

## Overview

`@veloxts/web` enables full-stack React applications with VeloxTS by:

- Embedding Fastify API routes inside Vinxi's HTTP infrastructure
- Providing React Server Components with streaming support
- Implementing Laravel-inspired file-based routing
- Bridging server actions to tRPC procedures
- Type-safe server actions with Zod validation

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

## Server Actions

### Basic Action with Validation

```typescript
// src/actions/users.ts
import { action } from '@veloxts/web';
import { z } from 'zod';

// Define a server action with input/output validation
export const createUser = action()
  .input(z.object({
    name: z.string().min(1),
    email: z.string().email(),
  }))
  .output(z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    createdAt: z.string(),
  }))
  .handler(async (input) => {
    // Create user in database
    const user = await db.user.create({
      data: { name: input.name, email: input.email },
    });
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    };
  });
```

### Protected Actions (Require Authentication)

```typescript
// src/actions/profile.ts
import { action } from '@veloxts/web';
import { z } from 'zod';

export const updateProfile = action()
  .input(z.object({
    name: z.string().min(1),
    bio: z.string().optional(),
  }))
  .protected() // Requires authentication
  .handler(async (input, ctx) => {
    // ctx.user is guaranteed to exist
    return await db.user.update({
      where: { id: ctx.user.id },
      data: input,
    });
  });
```

### Using Actions in React Components

```tsx
// app/pages/users/new.tsx
'use client';

import { createUser } from '@/actions/users';

export default function NewUserPage() {
  async function handleSubmit(formData: FormData) {
    const result = await createUser({
      name: formData.get('name') as string,
      email: formData.get('email') as string,
    });

    if (result.success) {
      console.log('Created user:', result.data);
    } else {
      console.error('Error:', result.error.message);
    }
  }

  return (
    <form action={handleSubmit}>
      <input name="name" placeholder="Name" required />
      <input name="email" type="email" placeholder="Email" required />
      <button type="submit">Create User</button>
    </form>
  );
}
```

## tRPC Bridge

Connect server actions to existing tRPC procedures with full type safety.

### Setup

```typescript
// src/actions/bridge.ts
import { createTrpcBridge } from '@veloxts/web';
import type { AppRouter } from '@/trpc/router';

// Create a type-safe bridge to your tRPC router
export const bridge = createTrpcBridge<AppRouter>({
  trpcBase: '/trpc',
});
```

### Create Actions from Procedures

```typescript
// src/actions/users.ts
import { bridge } from './bridge';

// Type-safe: 'users.get' is validated against AppRouter
export const getUser = bridge.createAction('users.get');

// With options
export const updateUser = bridge.createAction('users.update', {
  requireAuth: true,
});

// Protected shorthand
export const deleteUser = bridge.createProtectedAction('users.delete');
```

### Custom Action with Multiple Procedure Calls

```typescript
// src/actions/checkout.ts
import { bridge } from './bridge';
import { z } from 'zod';

export const checkout = bridge.handler(
  async (input, ctx, call) => {
    // Call multiple procedures in sequence
    const cart = await call('cart.get', { userId: ctx.user.id });

    if (!cart.success) {
      throw new Error('Cart not found');
    }

    const order = await call('orders.create', {
      items: cart.data.items,
      total: cart.data.total,
    });

    await call('cart.clear', { userId: ctx.user.id });

    return order.data;
  },
  {
    input: z.object({ paymentMethod: z.string() }),
    requireAuth: true,
  }
);
```

## File-Based Routing

Routes are derived from the file structure in `app/pages/`:

| File Path | Route Pattern | Description |
|-----------|--------------|-------------|
| `index.tsx` | `/` | Home page |
| `about.tsx` | `/about` | Static page |
| `users/index.tsx` | `/users` | List page |
| `users/[id].tsx` | `/users/:id` | Dynamic segment |
| `users/[id]/edit.tsx` | `/users/:id/edit` | Nested dynamic |
| `docs/[...slug].tsx` | `/docs/*` | Catch-all route |
| `(auth)/login.tsx` | `/login` | Route group (no /auth prefix) |
| `(marketing)/pricing.tsx` | `/pricing` | Another route group |

### Dynamic Routes

```tsx
// app/pages/users/[id].tsx
interface PageProps {
  params: { id: string };
  searchParams: Record<string, string | string[]>;
}

export default async function UserPage({ params }: PageProps) {
  const user = await db.user.findUnique({
    where: { id: params.id },
  });

  if (!user) {
    return <div>User not found</div>;
  }

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}
```

### Catch-All Routes

```tsx
// app/pages/docs/[...slug].tsx
interface PageProps {
  params: { '*': string }; // e.g., "getting-started/installation"
}

export default async function DocsPage({ params }: PageProps) {
  const slugParts = params['*'].split('/');
  const doc = await loadDoc(slugParts);

  return <article dangerouslySetInnerHTML={{ __html: doc.html }} />;
}
```

### Layouts

Create `_layout.tsx` files for shared layouts:

```tsx
// app/pages/_layout.tsx (root layout)
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <title>My App</title>
      </head>
      <body>
        <nav>{/* Navigation */}</nav>
        <main>{children}</main>
        <footer>{/* Footer */}</footer>
      </body>
    </html>
  );
}

// app/pages/(dashboard)/_layout.tsx (group layout)
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dashboard">
      <aside>{/* Sidebar */}</aside>
      <div className="content">{children}</div>
    </div>
  );
}
```

## SSR Rendering

### Basic SSR Setup

```typescript
// src/entry.server.tsx
import { createSsrRouter, createFileRouter, renderToStream } from '@veloxts/web';

const fileRouter = createFileRouter({
  pagesDir: 'app/pages',
});

export default createSsrRouter({
  resolveRoute: (path) => fileRouter.match(path),
  render: (match, request) => renderToStream(match, request, {
    bootstrapScripts: ['/_build/client.js'],
  }),
});
```

### With Initial Data

```typescript
// src/entry.server.tsx
export default createSsrRouter({
  resolveRoute: (path) => fileRouter.match(path),
  render: async (match, request) => {
    // Fetch data for the page
    const user = await getCurrentUser(request);

    return renderToStream(match, request, {
      bootstrapScripts: ['/_build/client.js'],
      initialData: { user },
    });
  },
});
```

## Client Hydration

### Basic Hydration

```typescript
// src/entry.client.tsx
import { hydrate } from '@veloxts/web';
import App from './App';

hydrate(<App />);
```

### With Initial Data

```typescript
// src/entry.client.tsx
import { hydrate, getInitialData } from '@veloxts/web';
import App from './App';

const result = hydrate(<App />);

// Access initial data from server
const initialData = result.initialData;
// Or use the helper
const data = getInitialData<{ user: User }>();
```

### Custom Error Handling

```typescript
// src/entry.client.tsx
import { hydrate } from '@veloxts/web';
import App from './App';

hydrate(<App />, {
  onRecoverableError: (error) => {
    // Custom error reporting
    console.error('Hydration error:', error);
    reportToSentry(error);
  },
});
```

## Error Handling

### Action Error Codes

Server actions return typed results with error codes:

```typescript
type ActionErrorCode =
  | 'VALIDATION_ERROR'    // Input validation failed
  | 'UNAUTHORIZED'        // Not authenticated
  | 'FORBIDDEN'           // Not authorized
  | 'NOT_FOUND'           // Resource not found
  | 'CONFLICT'            // Duplicate/conflict error
  | 'RATE_LIMITED'        // Too many requests
  | 'BAD_REQUEST'         // Invalid request
  | 'INTERNAL_ERROR';     // Server error
```

### Handling Errors in Components

```tsx
import { createUser } from '@/actions/users';

async function handleCreate(data: FormData) {
  const result = await createUser({
    name: data.get('name') as string,
    email: data.get('email') as string,
  });

  if (!result.success) {
    switch (result.error.code) {
      case 'VALIDATION_ERROR':
        setErrors(result.error.message);
        break;
      case 'CONFLICT':
        setErrors('Email already exists');
        break;
      case 'RATE_LIMITED':
        setErrors('Too many attempts. Please wait.');
        break;
      default:
        setErrors('Something went wrong');
    }
    return;
  }

  // Success
  router.push(`/users/${result.data.id}`);
}
```

### Custom Error Handler

```typescript
import { action } from '@veloxts/web';

export const riskyAction = action()
  .input(z.object({ id: z.string() }))
  .onError((error, ctx) => {
    // Custom error handling
    logError(error, { userId: ctx.user?.id });

    // Return custom error response
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Operation failed. Please try again.',
      },
    };
  })
  .handler(async (input) => {
    // Handler logic
  });
```

## API Reference

### Actions

| Export | Description |
|--------|-------------|
| `action()` | Create a server action with fluent builder API |
| `createAction()` | Low-level action creator |
| `createTrpcBridge()` | Create a tRPC bridge for calling procedures |

### Routing

| Export | Description |
|--------|-------------|
| `createFileRouter()` | Create file-based router |
| `createSsrRouter()` | Create SSR request handler |
| `createApiRouter()` | Create API route handler |
| `createClientRouter()` | Create client-side router |

### Rendering

| Export | Description |
|--------|-------------|
| `renderToStream()` | Render React to streaming response |
| `hydrate()` | Hydrate server-rendered React |
| `getInitialData()` | Get initial data passed from server |
| `Document` | Default HTML document component |

### Utilities

| Export | Description |
|--------|-------------|
| `escapeHtml()` | Escape HTML special characters (XSS prevention) |
| `isSuccess()` | Type guard for successful action results |
| `isError()` | Type guard for error action results |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 Vinxi (HTTP Entry Point)                │
├─────────────────────────────────────────────────────────┤
│  /api/*      → Fastify (Embedded via createApiRouter)   │
│  /trpc/*     → tRPC (via Fastify adapter)               │
│  /_build/*   → Static Assets (Vite client bundle)       │
│  /*          → RSC Renderer (React Flight streaming)    │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│              Server Actions (via tRPC Bridge)           │
├─────────────────────────────────────────────────────────┤
│  action()     → Validated handlers with Zod schemas    │
│  bridge.call  → Type-safe procedure invocation         │
│  ctx.user     → Authenticated user from session        │
└─────────────────────────────────────────────────────────┘
```

## Requirements

- Node.js 20+
- React 19+
- TypeScript 5.5+

## Status

**v0.5.0** - Production ready for MVP applications.

- 615 tests passing
- 94.4% code coverage
- Full TypeScript support with zero `any` types

## License

MIT
