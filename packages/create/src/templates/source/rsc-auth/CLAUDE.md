# CLAUDE.md

This is a VeloxTS full-stack application using React Server Components with JWT Authentication.

## Project Structure

```
__PROJECT_NAME__/
├── app/                    # Application layer (RSC)
│   ├── pages/              # File-based routing (RSC pages)
│   │   ├── index.tsx       # Home page (/)
│   │   ├── users.tsx       # Users page (/users)
│   │   ├── auth/           # Auth pages
│   │   │   ├── login.tsx   # Login page
│   │   │   └── register.tsx # Registration page
│   │   └── dashboard/      # Protected pages
│   │       └── index.tsx   # Dashboard (requires auth)
│   ├── layouts/            # Layout components
│   │   └── root.tsx        # Root layout
│   └── actions/            # Server actions
│       ├── users.ts        # User actions with validated()
│       └── auth.ts         # Auth actions
├── src/                    # Source layer
│   ├── api/                # API layer (Fastify embedded in Vinxi)
│   │   ├── handler.ts      # API handler with auth plugin
│   │   ├── database.ts     # Prisma client
│   │   ├── procedures/     # API procedure definitions
│   │   │   ├── auth.ts     # Authentication procedures
│   │   │   ├── health.ts   # Health check
│   │   │   └── users.ts    # User CRUD
│   │   ├── schemas/        # Zod validation schemas
│   │   └── utils/          # Utilities
│   │       └── auth.ts     # JWT helpers, token store
│   ├── entry.client.tsx    # Client hydration
│   └── entry.server.tsx    # Server rendering
├── prisma/
│   └── schema.prisma       # Database schema (with password field)
├── app.config.ts           # Vinxi configuration
└── package.json
```

## Authentication

### JWT-Based Authentication
- Access tokens (15 min expiry)
- Refresh tokens (7 day expiry)
- Secure password hashing (bcrypt)
- Rate limiting on auth endpoints
- Token revocation support

### Auth Endpoints
```
POST /api/auth/register  - Create new account
POST /api/auth/login     - Authenticate, get tokens
POST /api/auth/refresh   - Refresh access token
POST /api/auth/logout    - Revoke current token
GET  /api/auth/me        - Get current user (protected)
```

### Password Requirements
- Minimum 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- Not a common password

## Server Actions with validated()

Use the `validated()` helper for secure server actions:

```typescript
// app/actions/users.ts
'use server';
import { validated, validatedMutation, validatedQuery } from '@veloxts/web';
import { z } from 'zod';

// Public query (no auth required)
export const searchUsers = validatedQuery(
  z.object({ query: z.string().optional() }),
  async (input) => {
    return db.user.findMany({ where: { name: { contains: input.query } } });
  }
);

// Authenticated mutation (ctx.user available)
export const updateProfile = validatedMutation(
  z.object({ name: z.string() }),
  async (input, ctx) => {
    return db.user.update({ where: { id: ctx.user.id }, data: input });
  }
);

// Custom security options with rate limiting
export const createUser = validated(
  CreateUserSchema,
  async (input) => { /* ... */ },
  {
    rateLimit: { maxRequests: 10, windowMs: 60_000 },
    maxInputSize: 10 * 1024,
  }
);

// Role-based authorization
export const adminDeleteUser = validated(
  DeleteUserSchema,
  async (input) => { /* ... */ },
  {
    requireAuth: true,
    requireRoles: ['admin'],
  }
);
```

### Security Features
- **Input validation** - Zod schema validation
- **Input sanitization** - Prototype pollution prevention
- **Input size limits** - DoS protection (default 1MB)
- **Rate limiting** - Sliding window per IP
- **Authentication** - Optional via `requireAuth: true`
- **Authorization** - Role-based via `requireRoles`

## Commands

```bash
# Development
__RUN_CMD__ dev         # Start dev server

# Database
__RUN_CMD__ db:generate # Generate Prisma client
__RUN_CMD__ db:push     # Push schema to database
__RUN_CMD__ db:migrate  # Run migrations
__RUN_CMD__ db:studio   # Open Prisma Studio

# Production
__RUN_CMD__ build       # Build for production
__RUN_CMD__ start       # Start production server
```

## Development

1. Run `__RUN_CMD__ db:push` to set up the database
2. Run `__RUN_CMD__ dev` to start the development server
3. Open http://localhost:__API_PORT__ in your browser
4. Register an account at /auth/register
5. Access protected pages at /dashboard

## Environment Variables

Required for production:
```bash
# Generate with: openssl rand -base64 64
JWT_SECRET="..."
JWT_REFRESH_SECRET="..."
```

## API Endpoints

### Public
- `GET /api/health` - Health check
- `GET /api/users` - List users

### Authentication
- `POST /api/auth/register` - Create account (rate limited)
- `POST /api/auth/login` - Get tokens (rate limited)
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/logout` - Logout (protected)
- `GET /api/auth/me` - Current user (protected)

### Protected (require Bearer token)
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user
