# CLAUDE.md

This is a VeloxTS full-stack application using React Server Components.

## Project Structure

```
__PROJECT_NAME__/
├── app/                    # Application layer (RSC)
│   ├── pages/              # File-based routing (RSC pages)
│   │   ├── index.tsx       # Home page (/)
│   │   └── users.tsx       # Users page (/users)
│   ├── layouts/            # Layout components
│   │   └── root.tsx        # Root layout (wraps all pages)
│   └── actions/            # Server actions
│       └── users.ts        # User-related actions
├── src/                    # Source layer
│   ├── api/                # API layer (Fastify embedded in Vinxi)
│   │   ├── handler.ts      # API handler for /api/* routes
│   │   ├── database.ts     # Prisma client
│   │   ├── procedures/     # API procedure definitions
│   │   └── schemas/        # Zod validation schemas
│   ├── entry.client.tsx    # Client hydration entry
│   └── entry.server.tsx    # Server rendering entry
├── prisma/
│   └── schema.prisma       # Database schema
├── app.config.ts           # Vinxi configuration
└── package.json
```

## Key Concepts

### React Server Components (RSC)
- Pages in `app/pages/` are Server Components by default
- They run on the server and can directly access the database
- Use `'use client'` directive for client-side interactivity

### File-Based Routing
- `app/pages/index.tsx` → `/`
- `app/pages/users.tsx` → `/users`
- `app/pages/users/[id].tsx` → `/users/:id` (dynamic route)
- `app/pages/[...slug].tsx` → catch-all route

### Server Actions
- Defined in `app/actions/` with `'use server'` directive
- Type-safe with Zod validation via `createAction()`
- Can be called directly from client components

### API Routes
- All `/api/*` routes are handled by embedded Fastify
- Procedures defined in `src/api/procedures/`
- Full VeloxTS type safety and REST conventions

## Commands

```bash
# Development
__RUN_CMD__ dev         # Start dev server with HMR

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

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/users` - List all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user
