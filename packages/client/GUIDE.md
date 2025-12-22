# @veloxts/client

Type-safe frontend API client with zero code generation.

## Quick Start

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
