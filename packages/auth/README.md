# @veloxts/auth

Authentication and authorization system for VeloxTS Framework.

> **Note:** This package is a placeholder in v0.1.0. Full implementation coming in v1.1.

## Status

This package is reserved for future functionality. The current release includes only type definitions and stub implementations to allow other packages to reference it.

## Planned Features (v1.1+)

- **Session Management** - Secure session handling with configurable stores
- **JWT Authentication** - Token-based authentication with refresh tokens
- **Guards and Policies** - Declarative authorization for procedures
- **Role-Based Access Control** - Define roles and permissions
- **User Model Integration** - Seamless integration with Prisma user models
- **OAuth Providers** - Social login support (Google, GitHub, etc.)

## Current Exports

The following are available but not fully implemented:

```typescript
import { createAuth, guard, User } from '@veloxts/auth';

// User interface for type definitions
interface User {
  id: string;
  email: string;
  [key: string]: unknown;
}

// Placeholder - returns stub implementation
const auth = createAuth({ secret: 'your-secret' });

// Placeholder decorator
@guard(['admin'])
class AdminProcedures { }
```

## Roadmap

| Version | Features |
|---------|----------|
| v0.1.0 | Placeholder with type definitions |
| v1.1.0 | JWT authentication, session management |
| v1.2.0 | Guards, policies, RBAC |
| v1.3.0 | OAuth providers |

## Related Packages

- [@veloxts/core](../core) - Application framework
- [@veloxts/router](../router) - Procedure definitions and routing
- [@veloxts/orm](../orm) - Database integration

## License

[MIT](../../LICENSE)
