# @veloxts/web Guide

React Server Components integration for VeloxTS Framework using Vinxi.

## Quick Start

Scaffold a new RSC project:

```bash
npx create-velox-app my-app --rsc
cd my-app
pnpm install
pnpm dev
```

## Key Features

- **React Server Components** - Full RSC support with streaming
- **File-Based Routing** - Laravel-inspired routing from `app/pages/`
- **Server Actions** - Type-safe mutations with Zod validation
- **tRPC Bridge** - Connect server actions to existing procedures
- **Route Groups** - Organize routes with `(group)` folders

## Server Actions

Create type-safe server actions with Zod validation:

```typescript
// src/actions/users.ts
import { action } from '@veloxts/web';
import { z } from 'zod';

export const createUser = action()
  .input(z.object({
    name: z.string().min(1),
    email: z.string().email(),
  }))
  .output(z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
  }))
  .handler(async (input) => {
    return await db.user.create({ data: input });
  });

// Protected action (requires authentication)
export const updateProfile = action()
  .input(z.object({ name: z.string() }))
  .protected()
  .handler(async (input, ctx) => {
    // ctx.user is guaranteed to exist
    return await db.user.update({
      where: { id: ctx.user.id },
      data: input,
    });
  });
```

Use in React components:

```tsx
'use client';

import { createUser } from '@/actions/users';

export default function NewUserPage() {
  async function handleSubmit(formData: FormData) {
    const result = await createUser({
      name: formData.get('name') as string,
      email: formData.get('email') as string,
    });

    if (result.success) {
      console.log('Created:', result.data);
    } else {
      console.error('Error:', result.error.message);
    }
  }

  return (
    <form action={handleSubmit}>
      <input name="name" required />
      <input name="email" type="email" required />
      <button type="submit">Create</button>
    </form>
  );
}
```

## File-Based Routing

Routes are derived from file structure in `app/pages/`:

| File Path | Route Pattern | Description |
|-----------|--------------|-------------|
| `index.tsx` | `/` | Home page |
| `about.tsx` | `/about` | Static page |
| `users/[id].tsx` | `/users/:id` | Dynamic segment |
| `docs/[...slug].tsx` | `/docs/*` | Catch-all route |
| `(auth)/login.tsx` | `/login` | Route group (no prefix) |

### Dynamic Routes

```tsx
// app/pages/users/[id].tsx
interface PageProps {
  params: { id: string };
  searchParams: Record<string, string | string[]>;
}

export default async function UserPage({ params }: PageProps) {
  const user = await db.user.findUniqueOrThrow({ where: { id: params.id } });
  return <h1>{user.name}</h1>;
}
```

### Layouts

Create `_layout.tsx` for shared layouts:

```tsx
// app/pages/_layout.tsx (root layout)
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav>{/* Navigation */}</nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
```

## tRPC Bridge

Connect server actions to existing tRPC procedures:

```typescript
// src/actions/bridge.ts
import { createTrpcBridge } from '@veloxts/web';
import type { AppRouter } from '@/trpc/router';

export const bridge = createTrpcBridge<AppRouter>({
  trpcBase: '/trpc',
});

// Create type-safe actions from procedures
export const getUser = bridge.createAction('users.get');
export const updateUser = bridge.createProtectedAction('users.update');
```

## Requirements

- Node.js 20+
- React 19+
- TypeScript 5.5+

## Documentation

Complete documentation at [@veloxts/velox](https://www.npmjs.com/package/@veloxts/velox).

## Status

**v0.6.x** - Early preview. APIs stabilizing with 615+ tests and 94.4% coverage.

## License

MIT
