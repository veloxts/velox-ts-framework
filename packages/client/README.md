# @veloxts/client

Type-safe frontend API client for the VeloxTS framework.

## Features

- **Zero code generation** - Types inferred directly from backend procedure definitions
- **Full type safety** - Autocomplete and compile-time type checking
- **Fetch-based** - Works in both browser and Node.js environments
- **Error handling** - Typed error classes with full response context
- **Interceptors** - Request, response, and error hooks
- **REST integration** - Maps to auto-generated REST endpoints

## Installation

```bash
npm install @veloxts/client
```

## Usage

### Basic Setup

```typescript
// Import your backend procedure types
import type { userProcedures, postProcedures } from '../server/procedures';
import { createClient } from '@veloxts/client';

// Create a typed client
const api = createClient<{
  users: typeof userProcedures;
  posts: typeof postProcedures;
}>({
  baseUrl: '/api',
});

// Make fully typed API calls
const user = await api.users.getUser({ id: '123' });
// user is typed as User (inferred from backend output schema)

const users = await api.users.listUsers({ page: 1, limit: 10 });
// users is typed as User[] (or whatever your output schema defines)

const newUser = await api.users.createUser({
  name: 'Alice',
  email: 'alice@example.com'
});
// newUser is typed as User
```

### Custom Configuration

```typescript
const api = createClient<Router>({
  baseUrl: 'https://api.example.com/api',

  // Add custom headers to all requests
  headers: {
    'Authorization': 'Bearer token123',
  },

  // Request interceptor
  onRequest: async (url, options) => {
    console.log(`${options.method} ${url}`);
  },

  // Response interceptor
  onResponse: async (response) => {
    console.log(`Response: ${response.status}`);
  },

  // Error interceptor
  onError: async (error) => {
    console.error('API Error:', error.message);
    // You can track errors, show notifications, etc.
  },
});
```

### Error Handling

The client provides typed error classes for different error scenarios:

```typescript
import {
  isVeloxClientError,
  isClientValidationError,
  isClientNotFoundError,
  isServerError,
  isNetworkError,
} from '@veloxts/client';

try {
  const user = await api.users.getUser({ id: 'invalid' });
} catch (error) {
  if (isClientValidationError(error)) {
    // Handle validation errors (400)
    console.log('Validation failed:', error.fields);
  } else if (isClientNotFoundError(error)) {
    // Handle not found errors (404)
    console.log('Resource not found:', error.resource);
  } else if (isServerError(error)) {
    // Handle server errors (5xx)
    console.log('Server error:', error.statusCode);
  } else if (isNetworkError(error)) {
    // Handle network errors (can't reach server)
    console.log('Network error:', error.message);
  } else if (isVeloxClientError(error)) {
    // Generic client error
    console.log('Error:', error.statusCode, error.message);
  }
}
```

### Using with React

```typescript
// hooks/useApi.ts
import { createClient } from '@veloxts/client';
import type { AppRouter } from '../server/procedures';

export const api = createClient<AppRouter>({
  baseUrl: import.meta.env.VITE_API_URL || '/api',
});

// In your component
import { api } from './hooks/useApi';
import { useState, useEffect } from 'react';

function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.users.getUser({ id: userId })
      .then(setUser)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>User: {user.name}</div>;
}
```

### Using with React Query (Recommended)

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './hooks/useApi';

// Query hook
function useUser(userId: string) {
  return useQuery({
    queryKey: ['users', userId],
    queryFn: () => api.users.getUser({ id: userId }),
  });
}

// Mutation hook
function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => api.users.createUser(data),
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

// In your component
function UserList() {
  const { data: users, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.users.listUsers({}),
  });

  const createUser = useCreateUser();

  const handleCreate = () => {
    createUser.mutate({
      name: 'New User',
      email: 'user@example.com'
    });
  };

  // ... rest of component
}
```

## Type Inference

The client uses TypeScript's type system to infer the complete API shape from your backend procedure definitions:

```typescript
// Backend (procedures.ts)
export const userProcedures = defineProcedures('users', {
  getUser: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(UserSchema)
    .query(async ({ input, ctx }) => {
      return ctx.db.user.findUnique({ where: { id: input.id } });
    }),
});

// Frontend - Types are automatically inferred!
const client = createClient<{ users: typeof userProcedures }>({ baseUrl: '/api' });

// TypeScript knows:
// - api.users.getUser expects { id: string }
// - api.users.getUser returns Promise<User>
// - Invalid inputs will show compile-time errors
```

## REST Endpoint Mapping

The client automatically maps procedure calls to REST endpoints using the same conventions as the server:

| Procedure Name | HTTP Method | Path |
|---------------|-------------|------|
| `getUser` | GET | `/users/:id` |
| `listUsers` | GET | `/users` |
| `createUser` | POST | `/users` |
| `updateUser` | PUT | `/users/:id` |
| `deleteUser` | DELETE | `/users/:id` |

## Browser and Node.js Support

The client uses the native `fetch` API, which is available in:
- All modern browsers
- Node.js v18+ (native fetch)
- Earlier Node.js versions with a polyfill

For older Node.js versions, provide a custom fetch implementation:

```typescript
import fetch from 'node-fetch';

const api = createClient<Router>({
  baseUrl: 'https://api.example.com',
  fetch: fetch as typeof globalThis.fetch,
});
```

## Related Packages

- [@veloxts/core](/packages/core) - Core framework with error classes
- [@veloxts/router](/packages/router) - Procedure definitions for backend
- [@veloxts/validation](/packages/validation) - Schema validation with Zod
- [create-velox-app](/packages/create) - Project scaffolder

## TypeScript Support

All exports are fully typed with comprehensive JSDoc documentation. The package includes type definitions and declaration maps for excellent IDE support.

## License

MIT
