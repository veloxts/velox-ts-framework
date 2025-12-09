# __PROJECT_NAME__

A VeloxTS full-stack application - TypeScript from backend to frontend.

## Getting Started

### Install Dependencies

```bash
__PACKAGE_MANAGER__ install
```

### Setup Database

```bash
__RUN_CMD__ db:push
```

### Start Development

```bash
__RUN_CMD__ dev
```

This starts both:
- **API** at http://localhost:__API_PORT__
- **Web** at http://localhost:__WEB_PORT__

## Project Structure

```
__PROJECT_NAME__/
├── apps/
│   ├── api/                 # Backend API (Fastify + VeloxTS)
│   │   ├── src/
│   │   │   ├── procedures/  # API endpoints
│   │   │   ├── schemas/     # Zod validation
│   │   │   └── index.ts     # Entry point
│   │   └── prisma/          # Database schema
│   │
│   └── web/                 # React Frontend (Vite + TanStack)
│       └── src/
│           ├── routes/      # File-based routing
│           └── main.tsx     # Entry point
│
├── package.json             # Workspace root
└── pnpm-workspace.yaml      # Workspace config
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `__RUN_CMD__ dev` | Start both API and Web in development |
| `__RUN_CMD__ build` | Build both apps for production |
| `__RUN_CMD__ db:push` | Push database schema changes |
| `__RUN_CMD__ db:studio` | Open Prisma Studio |

## Type Safety

VeloxTS provides end-to-end type safety:

1. **Backend**: Define procedures with Zod schemas
2. **Frontend**: Import types directly, use type-safe hooks
3. **No code generation** - types flow automatically

## Learn More

- [VeloxTS Documentation](https://veloxts.dev)
- [React](https://react.dev/)
- [TanStack Router](https://tanstack.com/router)
- [Prisma](https://www.prisma.io/)
