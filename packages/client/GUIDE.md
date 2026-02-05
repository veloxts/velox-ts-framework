# @veloxts/client

Type-safe frontend API client with zero code generation.

## Quick Start

### tRPC Mode (Recommended for tRPC template)

```typescript
import { createClient } from '@veloxts/client';
import type { AppRouter } from '../../api/src/router.js';

// AppRouter is typeof router from rpc()
const api = createClient<AppRouter>({
  baseUrl: 'http://localhost:3030/trpc',
  // mode: 'trpc' - auto-detected when baseUrl ends with /trpc
});

const health = await api.health.getHealth();
const users = await api.users.listUsers();
```

### REST Mode (ProcedureCollection)

```typescript
import { createClient } from '@veloxts/client';
import type { userProcedures } from '../server/procedures';

const api = createClient<{ users: typeof userProcedures }>({
  baseUrl: '/api',
});

const user = await api.users.getUser({ id: '123' });
// user is fully typed from backend schema
```

## Configuration

```typescript
const api = createClient<Router>({
  baseUrl: '/api',
  headers: { 'Authorization': 'Bearer token' },
  onRequest: async (url, options) => console.log(`${options.method} ${url}`),
  onError: async (error) => console.error('API Error:', error.message),
});
```

## Error Handling

```typescript
import { isClientNotFoundError, isClientValidationError } from '@veloxts/client';

try {
  const user = await api.users.getUser({ id: 'invalid' });
} catch (error) {
  if (isClientNotFoundError(error)) console.log('Not found:', error.resource);
  if (isClientValidationError(error)) console.log('Validation:', error.fields);
}
```

## React Query Integration

### Recommended: createVeloxHooks (tRPC-style API)

```typescript
import { createVeloxHooks, VeloxProvider } from '@veloxts/client/react';
import type { AppRouter } from '../../api/src/router.js';

// Create typed hooks - works with both ProcedureCollection and tRPC router types
export const api = createVeloxHooks<AppRouter>();

// In component
function UserList() {
  const { data, isLoading } = api.users.listUsers.useQuery();
  const { mutate } = api.users.createUser.useMutation();

  // Suspense variant
  const { data: users } = api.users.listUsers.useSuspenseQuery();
}
```

### Basic: Manual React Query

```typescript
import { useQuery, useMutation } from '@tanstack/react-query';

function useUser(userId: string) {
  return useQuery({
    queryKey: ['users', userId],
    queryFn: () => api.users.getUser({ id: userId }),
  });
}

function useCreateUser() {
  return useMutation({
    mutationFn: (data) => api.users.createUser(data),
  });
}
```

## REST Mapping

| Procedure | Method | Path |
|-----------|--------|------|
| `getUser` | GET | `/users/:id` |
| `listUsers` | GET | `/users` |
| `createUser` | POST | `/users` |
| `updateUser` | PUT | `/users/:id` |
| `patchUser` | PATCH | `/users/:id` |
| `deleteUser` | DELETE | `/users/:id` |

## Learn More

See [@veloxts/velox](https://www.npmjs.com/package/@veloxts/velox) for complete documentation.
