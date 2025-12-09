/**
 * Root Workspace Configuration Templates
 *
 * Shared templates for workspace root files (package.json, pnpm-workspace.yaml, tsconfig.json)
 */

import type { TemplateConfig, TemplateFile } from '../types.js';

// ============================================================================
// Root package.json
// ============================================================================

export function generateRootPackageJson(config: TemplateConfig): string {
  const runCmd = config.packageManager === 'npm' ? 'npm run' : config.packageManager;

  return JSON.stringify(
    {
      name: config.projectName,
      version: '0.0.1',
      private: true,
      type: 'module',
      scripts: {
        dev: `${runCmd} --parallel -r dev`,
        build: `${runCmd} -r build`,
        'type-check': `${runCmd} -r type-check`,
        'db:push': `${runCmd} -F api db:push`,
        'db:generate': `${runCmd} -F api db:generate`,
        'db:studio': `${runCmd} -F api db:studio`,
      },
      devDependencies: {
        typescript: '5.8.3',
      },
    },
    null,
    2
  );
}

// ============================================================================
// pnpm-workspace.yaml
// ============================================================================

export function generatePnpmWorkspaceYaml(): string {
  return `packages:
  - 'apps/*'
`;
}

// ============================================================================
// Root tsconfig.json
// ============================================================================

export function generateRootTsConfig(): string {
  return JSON.stringify(
    {
      $schema: 'https://json.schemastore.org/tsconfig',
      compilerOptions: {
        target: 'ES2022',
        module: 'ES2022',
        moduleResolution: 'bundler',
        lib: ['ES2022'],
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        resolveJsonModule: true,
        allowSyntheticDefaultImports: true,
        forceConsistentCasingInFileNames: true,
        isolatedModules: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true,
      },
    },
    null,
    2
  );
}

// ============================================================================
// Root .gitignore
// ============================================================================

export function generateRootGitignore(): string {
  return `# Dependencies
node_modules/

# Build output
dist/
*.tsbuildinfo

# Environment variables
.env
.env.local

# Database
*.db
*.db-journal

# Generated Prisma client
**/generated/

# Logs
logs/
*.log

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Turbo
.turbo/

# Vite
apps/web/.vite/
`;
}

// ============================================================================
// Root README.md
// ============================================================================

export function generateRootReadme(config: TemplateConfig): string {
  const runCmd = config.packageManager === 'npm' ? 'npm run' : config.packageManager;

  return `# ${config.projectName}

A VeloxTS full-stack application - TypeScript from backend to frontend.

## Getting Started

### Install Dependencies

\`\`\`bash
${config.packageManager} install
\`\`\`

### Setup Database

\`\`\`bash
${runCmd} db:push
\`\`\`

### Start Development

\`\`\`bash
${runCmd} dev
\`\`\`

This starts both:
- **API** at http://localhost:3210
- **Web** at http://localhost:8080

## Project Structure

\`\`\`
${config.projectName}/
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
\`\`\`

## Available Scripts

| Command | Description |
|---------|-------------|
| \`${runCmd} dev\` | Start both API and Web in development |
| \`${runCmd} build\` | Build both apps for production |
| \`${runCmd} db:push\` | Push database schema changes |
| \`${runCmd} db:studio\` | Open Prisma Studio |

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
`;
}

// ============================================================================
// Root CLAUDE.md
// ============================================================================

export function generateRootClaudeMd(config: TemplateConfig, isAuthTemplate: boolean): string {
  const runCmd = config.packageManager === 'npm' ? 'npm run' : config.packageManager;
  const authSection = isAuthTemplate
    ? `
## Authentication

This project includes full JWT authentication:

| Endpoint | Method | Description |
|----------|--------|-------------|
| \`/api/auth/register\` | POST | Create new account |
| \`/api/auth/login\` | POST | Login and get tokens |
| \`/api/auth/refresh\` | POST | Refresh access token |
| \`/api/auth/logout\` | POST | Revoke current token |
| \`/api/auth/me\` | GET | Get current user (protected) |

### Environment Variables (Required for Production)

\`\`\`bash
JWT_SECRET=<64+ chars>           # Generate: openssl rand -base64 64
JWT_REFRESH_SECRET=<64+ chars>   # Generate: openssl rand -base64 64
\`\`\`
`
    : '';

  return `# CLAUDE.md

This file provides guidance to Claude Code and other AI assistants.

## Project Overview

**${config.projectName}** is a VeloxTS full-stack application with:
- **Backend**: Fastify + VeloxTS (apps/api)
- **Frontend**: React + Vite + TanStack Router (apps/web)
- **Database**: Prisma with SQLite${isAuthTemplate ? '\n- **Auth**: JWT authentication with guards' : ''}

## Commands

\`\`\`bash
${runCmd} dev          # Start both API (3210) and Web (8080)
${runCmd} build        # Build both apps
${runCmd} db:push      # Push database schema
${runCmd} db:studio    # Open Prisma Studio
\`\`\`

## Architecture

### Workspace Structure

\`\`\`
apps/
├── api/               # Backend (VeloxTS + Fastify)
│   ├── src/
│   │   ├── procedures/  # API procedures
│   │   ├── schemas/     # Zod schemas
│   │   └── config/      # App configuration
│   └── prisma/
│       └── schema.prisma
│
└── web/               # Frontend (React + Vite)
    └── src/
        ├── routes/      # TanStack Router pages
        ├── components/  # React components
        └── styles/      # CSS modules
\`\`\`

### API Development (apps/api)

**Creating a new procedure:**

\`\`\`typescript
// apps/api/src/procedures/posts.ts
import { defineProcedures, procedure, z } from '@veloxts/velox';

export const postProcedures = defineProcedures('posts', {
  // GET /api/posts/:id
  getPost: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(PostSchema)
    .query(async ({ input, ctx }) => {
      return ctx.db.post.findUnique({ where: { id: input.id } });
    }),

  // POST /api/posts
  createPost: procedure()
    .input(CreatePostSchema)
    .output(PostSchema)
    .mutation(async ({ input, ctx }) => {
      return ctx.db.post.create({ data: input });
    }),
});
\`\`\`

Then register in \`src/procedures/index.ts\` and add to collections in \`src/index.ts\`.

### Frontend Development (apps/web)

**Creating a new route:**

\`\`\`typescript
// apps/web/src/routes/posts.tsx
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@veloxts/client';

export const Route = createFileRoute('/posts')({
  component: PostsPage,
});

function PostsPage() {
  const { data: posts, isLoading } = useQuery(['posts'], '/posts');

  if (isLoading) return <p>Loading...</p>;

  return (
    <ul>
      {posts?.data.map(post => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}
\`\`\`

### Type Safety

VeloxTS provides end-to-end type safety without code generation:

1. **Define schemas** in \`apps/api/src/schemas/\`
2. **Use in procedures** with \`.input()\` and \`.output()\`
3. **Import in frontend** via \`@veloxts/client\` hooks
4. Types flow automatically from backend to frontend
${authSection}
## Procedure Naming Conventions

| Procedure Name | HTTP Method | Route |
|----------------|-------------|-------|
| \`getUser\` | GET | \`/users/:id\` |
| \`listUsers\` | GET | \`/users\` |
| \`createUser\` | POST | \`/users\` |
| \`updateUser\` | PUT | \`/users/:id\` |
| \`patchUser\` | PATCH | \`/users/:id\` |
| \`deleteUser\` | DELETE | \`/users/:id\` |

## Database

After schema changes:

\`\`\`bash
${runCmd} db:push      # Apply changes
${runCmd} db:generate  # Regenerate client
\`\`\`

Access via context: \`ctx.db.user.findMany()\`
`;
}

// ============================================================================
// Generate All Root Files
// ============================================================================

export function generateRootFiles(config: TemplateConfig, isAuthTemplate: boolean): TemplateFile[] {
  return [
    { path: 'package.json', content: generateRootPackageJson(config) },
    { path: 'pnpm-workspace.yaml', content: generatePnpmWorkspaceYaml() },
    { path: 'tsconfig.json', content: generateRootTsConfig() },
    { path: '.gitignore', content: generateRootGitignore() },
    { path: 'README.md', content: generateRootReadme(config) },
    { path: 'CLAUDE.md', content: generateRootClaudeMd(config, isAuthTemplate) },
  ];
}
