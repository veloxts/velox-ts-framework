# Getting Started with VeloxTS Framework

> **Alpha Release** - VeloxTS is in early development (v0.1.0-alpha). APIs may change. This guide reflects the current MVP functionality.

Welcome to VeloxTS, a TypeScript full-stack web framework focused on developer experience and type safety. This guide will walk you through creating your first VeloxTS application.

## What is VeloxTS?

VeloxTS is a modern TypeScript framework that combines type safety with convention-based development. It helps you build type-safe APIs with minimal boilerplate.

**Core Features (v0.1.0):**

- **Type safety without code generation** - Types flow naturally from backend to frontend using TypeScript's `typeof` and `as const`
- **Procedure-based API design** - Define your business logic once, get both tRPC and REST endpoints automatically
- **Convention over configuration** - Naming conventions automatically generate REST routes (e.g., `getUser` becomes `GET /users/:id`)
- **Fluent builder API** - Clean, chainable syntax for defining procedures
- **Modern stack** - Built on Fastify, tRPC, Prisma, and Zod

**Current Limitations (v0.1.0):**

- Only GET and POST HTTP methods (PUT/PATCH/DELETE in v1.1)
- No built-in authentication (planned for v1.1)
- Basic CLI - no code generators yet

**Why Choose VeloxTS?**

If you're building a full-stack TypeScript application and want:
- Type safety across your entire stack without code generation
- Convention-driven development that reduces boilerplate
- The flexibility to expose both internal (tRPC) and external (REST) APIs from the same code

Then VeloxTS may be a good fit. Note that it's still in alpha - evaluate carefully for your use case.

## Prerequisites

Before you begin, ensure you have:

- **Node.js 20+** installed ([download here](https://nodejs.org/))
- **Basic TypeScript knowledge** - Familiarity with types, interfaces, and async/await
- **Command-line experience** - Comfortable running terminal commands
- **A package manager** - npm, pnpm, or yarn

Experience with Express, Fastify, or Next.js API routes is helpful but not required.

## Quick Start

Create a new VeloxTS project with a single command:

```bash
# Using npx (recommended)
npx create-velox-app my-app

# Or with pnpm
pnpm create velox-app my-app

# Or with yarn
yarn create velox-app my-app
```

The scaffolder will:
1. Create the project directory
2. Generate a complete application structure
3. Install all dependencies
4. Initialize Git with a `.gitignore`
5. Set up a SQLite database with example schema

Navigate to your project:

```bash
cd my-app
```

Set up the database:

```bash
npm run db:migrate
```

Start the development server:

```bash
npm run dev
```

Your VeloxTS application is now running at `http://localhost:3210`

Visit the URL in your browser to see the welcome page, or test the API:

```bash
curl http://localhost:3210/health
```

You should see:

```json
{
  "status": "ok",
  "timestamp": "2025-12-04T12:00:00.000Z"
}
```

Congratulations! You've just created your first VeloxTS application.

## Project Structure

Let's explore what `create-velox-app` generated:

```
my-app/
├── src/
│   ├── config/
│   │   ├── app.ts           # Application configuration (port, host, etc.)
│   │   └── index.ts         # Config exports
│   ├── database/
│   │   ├── index.ts         # Database plugin setup
│   │   └── prisma.ts        # Prisma client initialization
│   ├── procedures/
│   │   ├── health.ts        # Health check endpoint
│   │   ├── users.ts         # Example user CRUD procedures
│   │   └── index.ts         # Procedure exports
│   ├── schemas/
│   │   ├── user.ts          # User validation schemas
│   │   └── index.ts         # Schema exports
│   └── index.ts             # Application entry point
├── prisma/
│   └── schema.prisma        # Database schema (Prisma)
├── public/
│   └── index.html           # Welcome page
├── .env                     # Environment variables (created from .env.example)
├── .env.example             # Environment variables template
├── package.json             # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
├── tsup.config.ts           # Build configuration
└── README.md                # Project documentation
```

**Key Directories:**

- **`src/config/`** - Application configuration (port, environment, API prefix)
- **`src/database/`** - Database client setup and Prisma integration
- **`src/procedures/`** - Your API endpoints defined as procedures
- **`src/schemas/`** - Zod schemas for input/output validation
- **`prisma/`** - Database schema and migration files

## Your First API

Let's examine the generated user API to understand how VeloxTS works.

### Step 1: Understanding Schemas

Open `src/schemas/user.ts`:

```typescript
import { z } from 'zod';

// Output schema - What the API returns
export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Input schema - What the API accepts when creating a user
export const CreateUserInput = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
});

// TypeScript type inferred from schema
export type User = z.infer<typeof UserSchema>;
```

Schemas define:
1. **Validation rules** - Zod validates all inputs and outputs
2. **TypeScript types** - Use `z.infer<>` to extract types
3. **API contract** - What clients can expect

### Step 2: Understanding Procedures

Open `src/procedures/users.ts`:

```typescript
import { defineProcedures, procedure } from '@veloxts/router';
import { z } from 'zod';
import { UserSchema, CreateUserInput } from '../schemas/user';

export const userProcedures = defineProcedures('users', {
  // GET /users/:id
  getUser: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(UserSchema.nullable())
    .query(async ({ input, ctx }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: input.id }
      });
      return user;
    }),

  // GET /users
  listUsers: procedure()
    .input(z.object({
      page: z.number().optional(),
      limit: z.number().optional(),
    }).optional())
    .output(z.object({
      data: z.array(UserSchema),
      meta: z.object({
        page: z.number(),
        limit: z.number(),
        total: z.number(),
      }),
    }))
    .query(async ({ input, ctx }) => {
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 10;
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        ctx.db.user.findMany({ skip, take: limit }),
        ctx.db.user.count(),
      ]);

      return { data, meta: { page, limit, total } };
    }),

  // POST /users
  createUser: procedure()
    .input(CreateUserInput)
    .output(UserSchema)
    .mutation(async ({ input, ctx }) => {
      return ctx.db.user.create({ data: input });
    }),
});
```

**Key Concepts:**

1. **`defineProcedures('users', { ... })`** - Groups related procedures under a namespace
2. **`procedure()`** - Fluent builder for defining endpoints
3. **`.input(schema)`** - Validates incoming data
4. **`.output(schema)`** - Validates outgoing data
5. **`.query(handler)`** - For read operations (GET)
6. **`.mutation(handler)`** - For write operations (POST, PUT, DELETE)
7. **`ctx`** - Context object with request-scoped state (like `ctx.db` for database access)

**Naming Conventions:**

VeloxTS uses procedure names to infer HTTP methods and paths:

| Procedure Name | HTTP Method | REST Path | Description |
|---------------|-------------|-----------|-------------|
| `getUser` | GET | `/users/:id` | Get single resource |
| `listUsers` | GET | `/users` | List collection |
| `createUser` | POST | `/users` | Create resource |

Note: MVP (v0.1.0) supports GET and POST. PUT, PATCH, and DELETE will be added in v1.1.

### Step 3: Testing Your API

With the dev server running (`npm run dev`), test the endpoints:

**Health Check:**

```bash
curl http://localhost:3210/health
```

**Create a User:**

```bash
curl -X POST http://localhost:3210/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice Johnson", "email": "alice@example.com"}'
```

Response:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "name": "Alice Johnson",
  "email": "alice@example.com",
  "createdAt": "2025-12-04T12:00:00.000Z",
  "updatedAt": "2025-12-04T12:00:00.000Z"
}
```

**List Users:**

```bash
curl http://localhost:3210/users
```

**Get User by ID:**

```bash
curl http://localhost:3210/users/550e8400-e29b-41d4-a716-446655440001
```

**Search Users:**

```bash
curl "http://localhost:3210/users/search?q=alice"
```

## Database Setup

VeloxTS uses Prisma for database management, providing type-safe database access.

> **Note:** VeloxTS uses Prisma 7, which introduces driver adapters for database connections. For detailed setup instructions, troubleshooting, and migration guides, see the [Prisma 7 Setup Guide](./PRISMA-7-SETUP.md).

### Understanding the Schema

Open `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(uuid())
  name      String
  email     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

This defines:
- **Database provider** - SQLite by default (change to PostgreSQL or MySQL for production)
- **User model** - Fields, types, and constraints
- **Client generation** - Prisma generates a type-safe client

### Making Schema Changes

Let's add a `bio` field to users:

1. **Update the Prisma schema** (`prisma/schema.prisma`):

```prisma
model User {
  id        String   @id @default(uuid())
  name      String
  email     String   @unique
  bio       String?  // Optional bio field
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

2. **Create and run migration:**

```bash
npm run db:migrate
```

Prisma will prompt for a migration name (e.g., "add_user_bio").

3. **Update the schema** (`src/schemas/user.ts`):

```typescript
export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  bio: z.string().nullable(),  // Add bio field
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateUserInput = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  bio: z.string().max(500).optional(),  // Add bio field
});
```

4. **Test the change:**

```bash
curl -X POST http://localhost:3210/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Bob Smith", "email": "bob@example.com", "bio": "TypeScript enthusiast"}'
```

### Switching to PostgreSQL

For production, you'll want a more robust database:

1. **Update `prisma/schema.prisma`:**

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

2. **Update `.env`:**

```env
DATABASE_URL="postgresql://user:password@localhost:5432/mydb?schema=public"
```

3. **Regenerate and migrate:**

```bash
npm run db:generate
npm run db:migrate
```

## Type Safety in Action

One of VeloxTS's most powerful features is automatic type inference from backend to frontend.

### Backend Types

In your procedures, types flow automatically:

```typescript
export const userProcedures = defineProcedures('users', {
  getUser: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(UserSchema.nullable())
    .query(async ({ input, ctx }) => {
      // input is typed as { id: string }
      //        ^? { id: string }

      // ctx.db is typed as PrismaClient
      //        ^? PrismaClient

      // Return type must match UserSchema or null
      return ctx.db.user.findUnique({ where: { id: input.id } });
      //     ^? User | null
    }),
});
```

No explicit type annotations needed - TypeScript infers everything from the schemas.

### Frontend Integration

To use your API from a frontend with full type safety:

1. **Export your router type** (already done in `src/index.ts`):

```typescript
export type { AppRouter } from './procedures';
```

2. **In your frontend app, create a client:**

```typescript
import { createClient } from '@veloxts/client';
import type { AppRouter } from '../server/src';

const api = createClient<AppRouter>({
  baseUrl: 'http://localhost:3210',
});

// Fully typed API calls
async function fetchUser(id: string) {
  const user = await api.users.getUser({ id });
  //    ^? User | null (inferred from backend schema)

  if (user) {
    console.log(user.name);  // TypeScript knows all fields
    //          ^? string
  }
}

// Create user with validation
async function createUser() {
  const newUser = await api.users.createUser({
    name: 'Charlie',
    email: 'charlie@example.com',
  });
  //    ^? User (inferred from backend schema)
}
```

**No code generation required** - types flow directly from your backend procedures to frontend code through TypeScript's type system.

### Type Safety Benefits

- **Autocomplete** - Your IDE suggests available procedures and their parameters
- **Compile-time errors** - Typos and invalid data caught before runtime
- **Refactoring confidence** - Change a schema, TypeScript finds all affected code
- **Documentation** - Types serve as inline documentation

## Development Workflow

VeloxTS provides a streamlined development experience.

### Available Scripts

Your project includes these npm scripts:

```bash
# Development
npm run dev              # Start dev server with hot reload (port 3210)

# Build
npm run build            # Compile TypeScript to production code
npm run start            # Run production build

# Database
npm run db:migrate       # Run database migrations
npm run db:generate      # Regenerate Prisma client after schema changes

# Type checking
npm run type-check       # Validate TypeScript types without building
```

### Hot Reload

The dev server watches for changes and automatically restarts:

1. Edit `src/procedures/users.ts`
2. Save the file
3. Server restarts automatically
4. Test the change immediately

No manual restarts needed during development.

### Environment Variables

Configure your application via `.env`:

```env
# Application
NODE_ENV=development
PORT=3210
HOST=localhost

# Database
DATABASE_URL="file:./dev.db"

# Optional: API prefix
API_PREFIX=/api
```

Access in code:

```typescript
const config = {
  port: Number(process.env.PORT) || 3210,
  host: process.env.HOST || 'localhost',
};
```

### Debugging

Use your IDE's debugger or add console logs:

```typescript
getUser: procedure()
  .input(z.object({ id: z.string().uuid() }))
  .output(UserSchema.nullable())
  .query(async ({ input, ctx }) => {
    console.log('Fetching user:', input.id);  // Simple logging

    const user = await ctx.db.user.findUnique({
      where: { id: input.id }
    });

    console.log('Found user:', user);
    return user;
  }),
```

Logs appear in your terminal where `npm run dev` is running.

## Testing Endpoints

You have several options for testing your API during development.

### Using curl

Quick command-line testing:

```bash
# GET request
curl http://localhost:3210/users

# POST request with JSON
curl -X POST http://localhost:3210/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com"}'

# GET with query parameters
curl "http://localhost:3210/users/search?q=alice"
```

### Using HTTPie

More user-friendly than curl ([install HTTPie](https://httpie.io/)):

```bash
# GET request
http :3210/users

# POST request
http POST :3210/users name="Test User" email="test@example.com"
```

### Using Postman or Insomnia

GUI tools for API testing:

1. Import endpoints manually
2. Save requests for reuse
3. Inspect responses with syntax highlighting

### Using the Type-Safe Client

Create a test script (`scripts/test-api.ts`):

```typescript
import { createClient } from '@veloxts/client';
import type { AppRouter } from '../src';

const api = createClient<AppRouter>({
  baseUrl: 'http://localhost:3210',
});

async function testApi() {
  // Create user
  const user = await api.users.createUser({
    name: 'Test User',
    email: 'test@example.com',
  });
  console.log('Created user:', user);

  // List users
  const users = await api.users.listUsers({ page: 1, limit: 10 });
  console.log('Users:', users.data.length);

  // Get specific user
  const fetchedUser = await api.users.getUser({ id: user.id });
  console.log('Fetched user:', fetchedUser);
}

testApi();
```

Run with:

```bash
npx tsx scripts/test-api.ts
```

## Building Your Own API

Now that you understand the basics, let's create a new endpoint from scratch.

### Example: Posts API

1. **Define the database schema** (`prisma/schema.prisma`):

```prisma
model Post {
  id        String   @id @default(uuid())
  title     String
  content   String
  published Boolean  @default(false)
  authorId  String
  author    User     @relation(fields: [authorId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// Update User model to include relation
model User {
  id        String   @id @default(uuid())
  name      String
  email     String   @unique
  posts     Post[]   // Add this line
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

2. **Run migration:**

```bash
npm run db:migrate
```

3. **Create schemas** (`src/schemas/post.ts`):

```typescript
import { z } from 'zod';

export const PostSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  published: z.boolean(),
  authorId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreatePostInput = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  authorId: z.string().uuid(),
  published: z.boolean().optional(),
});

export type Post = z.infer<typeof PostSchema>;
```

4. **Create procedures** (`src/procedures/posts.ts`):

```typescript
import { defineProcedures, procedure } from '@veloxts/router';
import { z } from 'zod';
import { PostSchema, CreatePostInput } from '../schemas/post';

export const postProcedures = defineProcedures('posts', {
  // GET /posts/:id
  getPost: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(PostSchema.nullable())
    .query(async ({ input, ctx }) => {
      return ctx.db.post.findUnique({ where: { id: input.id } });
    }),

  // GET /posts
  listPosts: procedure()
    .input(z.object({
      published: z.boolean().optional(),
    }).optional())
    .output(z.array(PostSchema))
    .query(async ({ input, ctx }) => {
      return ctx.db.post.findMany({
        where: input?.published !== undefined
          ? { published: input.published }
          : undefined,
      });
    }),

  // POST /posts
  createPost: procedure()
    .input(CreatePostInput)
    .output(PostSchema)
    .mutation(async ({ input, ctx }) => {
      return ctx.db.post.create({
        data: {
          ...input,
          published: input.published ?? false,
        },
      });
    }),
});
```

5. **Export procedures** (`src/procedures/index.ts`):

```typescript
export { userProcedures } from './users';
export { postProcedures } from './posts';  // Add this line
export { healthProcedures } from './health';
```

6. **Register routes** (`src/index.ts`):

```typescript
import { postProcedures } from './procedures';  // Add import

// In createApp function, update the collections array:
const collections = [
  userProcedures,
  postProcedures,  // Add this line
  healthProcedures
];
```

7. **Test your new API:**

```bash
# Create a post
curl -X POST http://localhost:3210/posts \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My First Post",
    "content": "This is the content of my first post",
    "authorId": "550e8400-e29b-41d4-a716-446655440001",
    "published": true
  }'

# List posts
curl http://localhost:3210/posts

# List only published posts
curl "http://localhost:3210/posts?published=true"
```

## Next Steps

Congratulations! You've learned the fundamentals of VeloxTS Framework. Here's what to explore next:

### Dive Deeper

1. **[@veloxts/router](../packages/router/README.md)** - Learn about middleware, custom REST paths, and advanced routing
2. **[@veloxts/validation](../packages/validation/README.md)** - Master Zod schemas for complex validation
3. **[@veloxts/orm](../packages/orm/README.md)** - Advanced Prisma patterns and database optimization
4. **[@veloxts/client](../packages/client/README.md)** - Frontend integration with React, Vue, or vanilla TypeScript

### Advanced Topics

- **Custom middleware** - Add authentication, logging, rate limiting
- **Error handling** - Structured error responses and error transformation
- **Context extensions** - Add your own context properties
- **Custom REST paths** - Override naming conventions when needed
- **tRPC integration** - Use internal type-safe APIs alongside REST

### Production Deployment

- **Environment configuration** - Production-ready config patterns
- **Database migrations** - Deployment strategies for schema changes
- **Docker containerization** - Package your app for deployment
- **Monitoring and logging** - Add observability to your application

### Community and Support

- **GitHub Repository** - [github.com/veloxts/velox-ts-framework](https://github.com/veloxts/velox-ts-framework)
- **Documentation** - [github.com/veloxts/velox-ts-framework/docs](https://github.com/veloxts/velox-ts-framework/tree/main/docs)
- **Discord Community** - Get help and share your projects
- **Report Issues** - Found a bug? Let us know!

## Common Patterns

### Custom REST Path Override

When naming conventions don't fit your needs:

```typescript
searchUsers: procedure()
  .rest({ method: 'GET', path: '/users/search' })  // Custom path
  .input(z.object({ q: z.string() }))
  .output(z.array(UserSchema))
  .query(async ({ input, ctx }) => {
    // Search implementation
  }),
```

### Middleware for Authentication

Add cross-cutting concerns (Note: Full auth system comes in v1.1):

```typescript
const requireAuth = async ({ ctx, next }) => {
  const token = ctx.request.headers.authorization;

  if (!token) {
    throw new UnauthorizedError('Authentication required');
  }

  // Verify token and attach user to context
  const user = await verifyToken(token);
  ctx.user = user;

  return next();
};

const protectedProcedure = procedure()
  .use(requireAuth)  // Apply middleware
  .query(async ({ ctx }) => {
    // ctx.user is available here
  });
```

### Pagination Helper

Reusable pagination pattern:

```typescript
import { paginationInputSchema } from '@veloxts/validation';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

function getPaginationParams(input?: { page?: number; limit?: number }) {
  const page = input?.page ?? DEFAULT_PAGE;
  const limit = Math.min(input?.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

// Use in procedures
listUsers: procedure()
  .input(paginationInputSchema.optional())
  .query(async ({ input, ctx }) => {
    const { page, limit, skip } = getPaginationParams(input);
    // ...
  }),
```

## MVP Limitations (v0.1.0)

The current release includes:

**Included:**
- GET and POST HTTP methods
- Query and mutation procedures
- Input/output validation with Zod
- Naming convention-based REST mapping
- Custom REST path overrides
- tRPC adapter for internal APIs
- Middleware support
- Prisma integration
- Type-safe frontend client

**Coming in v1.1:**
- PUT, PATCH, DELETE HTTP methods (full REST)
- Built-in authentication system
- Nested resource routing
- OpenAPI/Swagger documentation generation
- React hooks for API calls
- Database seeding system

## Troubleshooting

### Port Already in Use

```
Error: Port 3210 is already in use
```

**Solution:** Change the port in `.env`:

```env
PORT=3211
```

### Database Connection Error

```
Error: Can't reach database server
```

**Solution:** Check your `DATABASE_URL` in `.env`. For SQLite, ensure the file path is correct. For PostgreSQL/MySQL, verify the server is running.

### Type Errors After Schema Changes

**Solution:** Regenerate the Prisma client:

```bash
npm run db:generate
```

### Import Errors

```
Cannot find module '@veloxts/router'
```

**Solution:** Ensure dependencies are installed:

```bash
npm install
```

## FAQ

**Q: Do I need to generate code like with GraphQL or other frameworks?**

A: No! VeloxTS achieves type safety through direct TypeScript type inference. Types flow from backend to frontend using `typeof` without any build-time code generation.

**Q: Can I use VeloxTS for REST-only APIs (no tRPC)?**

A: Yes! Simply don't register the tRPC plugin. Your procedures will still generate REST endpoints.

**Q: Can I mix VeloxTS procedures with regular Fastify routes?**

A: Yes! You have full access to the underlying Fastify instance (`app.server`) to add custom routes, plugins, or middleware.

**Q: Is VeloxTS production-ready?**

A: The MVP (v0.1.0) is suitable for production use for GET/POST APIs. However, it's a young framework. Full REST support and additional features are coming in v1.1.

**Q: How does VeloxTS compare to tRPC directly?**

A: VeloxTS builds on tRPC but adds REST endpoint generation, Laravel-inspired conventions, and a batteries-included framework experience. Use tRPC directly if you only need internal type-safe APIs.

**Q: Can I use a different ORM instead of Prisma?**

A: Currently, VeloxTS is designed around Prisma. Future versions may support other ORMs through plugins.

---

**Ready to build something awesome?** Start exploring the [package documentation](../packages/) or join our [community](https://discord.gg/veloxts) to share what you're building.

Happy coding with VeloxTS!
