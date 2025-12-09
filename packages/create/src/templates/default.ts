/**
 * Default Template (API Only)
 *
 * Basic REST API template with user CRUD operations.
 * No authentication - suitable for internal APIs or as a starting point.
 */

import { generateSharedFiles, VELOXTS_VERSION } from './shared.js';
import type { TemplateConfig, TemplateFile } from './types.js';

// ============================================================================
// Package.json
// ============================================================================

function generatePackageJson(config: TemplateConfig): string {
  return JSON.stringify(
    {
      name: config.projectName,
      version: '0.0.1',
      description: 'A VeloxTS application',
      type: 'module',
      main: 'dist/index.js',
      scripts: {
        build: 'tsup',
        start: 'node dist/index.js',
        dev: 'tsx watch src/index.ts',
        'type-check': 'tsc --noEmit',
        clean:
          "node -e \"require('fs').rmSync('dist',{recursive:true,force:true});require('fs').rmSync('tsconfig.tsbuildinfo',{force:true})\"",
        'db:generate': 'prisma generate',
        'db:push': 'prisma db push',
        'db:studio': 'prisma studio',
        postinstall: 'prisma generate',
      },
      dependencies: {
        '@fastify/static': '^8.3.0',
        '@prisma/adapter-better-sqlite3': '^7.1.0',
        '@prisma/client': '^7.1.0',
        '@veloxts/velox': `^${VELOXTS_VERSION}`,
        'better-sqlite3': '^12.5.0',
        dotenv: '^17.2.3',
        zod: '^3.24.4',
      },
      devDependencies: {
        prisma: '^7.1.0',
        tsup: '^8.5.1',
        tsx: '^4.21.0',
        typescript: '^5.9.3',
      },
    },
    null,
    2
  );
}

// ============================================================================
// Environment Files
// ============================================================================

function generateEnvExample(): string {
  return `# Database URL
# SQLite (local development):
DATABASE_URL="file:./dev.db"
# PostgreSQL (production):
# DATABASE_URL="postgresql://user:password@localhost:5432/myapp"

# Server Configuration
PORT=3210
HOST=0.0.0.0
NODE_ENV=development

# API Configuration
API_PREFIX=/api
`;
}

// ============================================================================
// Prisma Schema
// ============================================================================

function generatePrismaSchema(): string {
  return `// Prisma Schema
//
// This schema defines the database structure.
// Using SQLite for simplicity - easily swap to PostgreSQL for production.

generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "sqlite"
}

// ============================================================================
// User Model
// ============================================================================

/// User model for basic CRUD demonstration
model User {
  id        String   @id @default(uuid())
  name      String
  email     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}
`;
}

// ============================================================================
// Source Files
// ============================================================================

function generateIndexTs(): string {
  return `/**
 * Application Entry Point
 */

import 'dotenv/config';

import fastifyStatic from '@fastify/static';
import {
  veloxApp,
  VELOX_VERSION,
  databasePlugin,
  discoverProcedures,
  rest,
  getRouteSummary,
} from '@veloxts/velox';
import path from 'node:path';

import { config } from './config/index.js';
import { prisma } from './database/index.js';

// ============================================================================
// Application Bootstrap
// ============================================================================

async function createApp() {
  const app = await veloxApp({
    port: config.port,
    host: config.host,
    logger: config.logger,
  });

  // Register database plugin
  await app.register(databasePlugin({ client: prisma }));

  // Register static file serving for frontend
  await app.server.register(fastifyStatic, {
    root: path.join(process.cwd(), 'public'),
    prefix: '/',
  });

  // Auto-discover and register all procedures from src/procedures/
  const collections = await discoverProcedures('./src/procedures');
  app.routes(rest(collections, { prefix: config.apiPrefix }));

  return { app, collections };
}

function printBanner(collections: Parameters<typeof getRouteSummary>[0]) {
  const divider = '═'.repeat(50);

  console.log(\`\\n\${divider}\`);
  console.log(\`  VeloxTS Application v\${VELOX_VERSION}\`);
  console.log(\`  Environment: \${config.env}\`);
  console.log(divider);

  // Print registered routes
  const routes = getRouteSummary(collections);
  console.log('\\n📍 Registered Routes:\\n');

  for (const route of routes) {
    const method = route.method.padEnd(6);
    const path = route.path.padEnd(25);
    console.log(\`   \${method} \${path} → \${route.namespace}.\${route.procedure}\`);
  }

  console.log(\`\\n\${divider}\`);
  console.log(\`  Frontend: http://localhost:\${config.port}\`);
  console.log(\`  REST API: http://localhost:\${config.port}\${config.apiPrefix}\`);
  console.log(\`\${divider}\\n\`);
}

async function main() {
  try {
    const { app, collections } = await createApp();
    await app.start();
    printBanner(collections);
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

main();
`;
}

function generateDatabaseIndex(): string {
  return `/**
 * Database Client (Prisma 7.x)
 *
 * Prisma 7 requires:
 * - Generated client from custom output path
 * - Driver adapter for database connections
 */

import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

import { PrismaClient } from '../generated/prisma/client.js';

// Validate DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Create SQLite adapter with database URL from environment
const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL });

// Export configured Prisma client
export const prisma = new PrismaClient({ adapter });
`;
}

function generateProceduresIndex(): string {
  return `/**
 * Procedure Exports
 */

export * from './health.js';
export * from './users.js';
`;
}

function generateUserProcedures(): string {
  return `/**
 * User Procedures
 */

import { defineProcedures, procedure, paginationInputSchema, z } from '@veloxts/velox';

import { CreateUserInput, UpdateUserInput, UserSchema } from '../schemas/user.js';

// Database types
interface DbUser {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

interface DbClient {
  user: {
    findUnique: (args: { where: { id: string } }) => Promise<DbUser | null>;
    findMany: (args?: { skip?: number; take?: number }) => Promise<DbUser[]>;
    create: (args: { data: { name: string; email: string } }) => Promise<DbUser>;
    update: (args: { where: { id: string }; data: { name?: string; email?: string } }) => Promise<DbUser>;
    delete: (args: { where: { id: string } }) => Promise<DbUser>;
    count: () => Promise<number>;
  };
}

function getDb(ctx: { db: unknown }): DbClient {
  return ctx.db as DbClient;
}

function toUserResponse(dbUser: DbUser) {
  return {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    createdAt: dbUser.createdAt.toISOString(),
    updatedAt: dbUser.updatedAt.toISOString(),
  };
}

export const userProcedures = defineProcedures('users', {
  getUser: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(UserSchema.nullable())
    .query(async ({ input, ctx }) => {
      const db = getDb(ctx);
      const user = await db.user.findUnique({ where: { id: input.id } });
      return user ? toUserResponse(user) : null;
    }),

  listUsers: procedure()
    .input(paginationInputSchema.optional())
    .output(
      z.object({
        data: z.array(UserSchema),
        meta: z.object({
          page: z.number(),
          limit: z.number(),
          total: z.number(),
        }),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = getDb(ctx);
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 10;
      const skip = (page - 1) * limit;

      const [dbUsers, total] = await Promise.all([
        db.user.findMany({ skip, take: limit }),
        db.user.count(),
      ]);

      return {
        data: dbUsers.map(toUserResponse),
        meta: { page, limit, total },
      };
    }),

  createUser: procedure()
    .input(CreateUserInput)
    .output(UserSchema)
    .mutation(async ({ input, ctx }) => {
      const db = getDb(ctx);
      const user = await db.user.create({ data: input });
      return toUserResponse(user);
    }),

  updateUser: procedure()
    .input(z.object({ id: z.string().uuid() }).merge(UpdateUserInput))
    .output(UserSchema)
    .mutation(async ({ input, ctx }) => {
      const db = getDb(ctx);
      const { id, ...data } = input;
      const user = await db.user.update({ where: { id }, data });
      return toUserResponse(user);
    }),

  patchUser: procedure()
    .input(z.object({ id: z.string().uuid() }).merge(UpdateUserInput))
    .output(UserSchema)
    .mutation(async ({ input, ctx }) => {
      const db = getDb(ctx);
      const { id, ...data } = input;
      const user = await db.user.update({ where: { id }, data });
      return toUserResponse(user);
    }),

  deleteUser: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb(ctx);
      await db.user.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
`;
}

function generateSchemasIndex(): string {
  return `/**
 * Schema Exports
 */

export * from './user.js';
`;
}

function generateUserSchema(): string {
  return `/**
 * User Schemas
 */

import { createIdSchema, emailSchema, z } from '@veloxts/velox';

export const UserSchema = z.object({
  id: createIdSchema('uuid'),
  name: z.string().min(1).max(100),
  email: emailSchema,
  createdAt: z.coerce.date().transform((d) => d.toISOString()),
  updatedAt: z.coerce.date().transform((d) => d.toISOString()),
});

export type User = z.infer<typeof UserSchema>;

export const CreateUserInput = z.object({
  name: z.string().min(1).max(100),
  email: emailSchema,
});

export type CreateUserData = z.infer<typeof CreateUserInput>;

export const UpdateUserInput = z.object({
  name: z.string().min(1).max(100).optional(),
  email: emailSchema.optional(),
});

export type UpdateUserData = z.infer<typeof UpdateUserInput>;
`;
}

// ============================================================================
// CLAUDE.md
// ============================================================================

function generateClaudeMd(config: TemplateConfig): string {
  return `# CLAUDE.md

This file provides guidance to Claude Code and other AI assistants when working with this VeloxTS project.

## Project Overview

**${config.projectName}** is a VeloxTS application - a TypeScript full-stack framework built on Fastify, tRPC, Prisma, and Zod.

**Key Characteristics:**
- Type safety without code generation (direct type imports)
- Hybrid API: tRPC for internal, REST for external
- Convention over configuration
- Laravel-inspired developer experience

## Commands

\`\`\`bash
${config.packageManager} dev          # Start development server with hot reload
${config.packageManager} build        # Build for production
${config.packageManager} start        # Run production server
${config.packageManager} db:push      # Push database schema changes
${config.packageManager} db:generate  # Regenerate Prisma client
${config.packageManager} db:studio    # Open Prisma Studio GUI
${config.packageManager} type-check   # Run TypeScript type checking
\`\`\`

## Project Structure

\`\`\`
src/
├── config/          # Application configuration
├── database/        # Prisma client setup
├── procedures/      # API procedures (business logic)
├── schemas/         # Zod validation schemas
├── generated/       # Generated Prisma client (git-ignored)
└── index.ts         # Application entry point

prisma/
└── schema.prisma    # Database schema

public/              # Static files served at /
\`\`\`

## Procedure Naming Conventions

Procedure names automatically map to HTTP methods and routes:

| Procedure Name | HTTP Method | Route | Status Code |
|----------------|-------------|-------|-------------|
| \`getUser\` | GET | \`/users/:id\` | 200 |
| \`listUsers\` | GET | \`/users\` | 200 |
| \`findUsers\` | GET | \`/users\` | 200 |
| \`createUser\` | POST | \`/users\` | 201 |
| \`addUser\` | POST | \`/users\` | 201 |
| \`updateUser\` | PUT | \`/users/:id\` | 200 |
| \`editUser\` | PUT | \`/users/:id\` | 200 |
| \`patchUser\` | PATCH | \`/users/:id\` | 200 |
| \`deleteUser\` | DELETE | \`/users/:id\` | 200/204 |
| \`removeUser\` | DELETE | \`/users/:id\` | 200/204 |

## Creating a New Procedure

\`\`\`typescript
// src/procedures/posts.ts
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

## Type Safety

VeloxTS provides end-to-end type safety without code generation:

- **Zod schemas** define validation and infer TypeScript types
- **Procedures** chain \`.input()\` and \`.output()\` for full type inference
- **Context** provides typed access to database (\`ctx.db\`)
- Import types directly: \`import type { User } from './schemas/user.js'\`

## Database (Prisma)

- Schema: \`prisma/schema.prisma\`
- Config: \`prisma.config.ts\` (Prisma 7.x style)
- Client: Generated to \`src/generated/prisma/\`
- Access via context: \`ctx.db.user.findMany()\`

After schema changes:
\`\`\`bash
${config.packageManager} db:push      # Apply changes to database
${config.packageManager} db:generate  # Regenerate client types
\`\`\`

## Environment Variables

Configured in \`.env\`:
- \`DATABASE_URL\` - Database connection string
- \`PORT\` - Server port (default: 3210)
- \`HOST\` - Server host (default: 0.0.0.0)
- \`NODE_ENV\` - Environment (development/production)
- \`API_PREFIX\` - API route prefix (default: /api)

## Code Style

- Use Zod for all input/output validation
- Keep procedures focused - one operation per procedure
- Use descriptive names following conventions
- Colocate schemas with their procedures when simple
- Extract to \`src/schemas/\` when shared across procedures
`;
}

// ============================================================================
// Default Template Generator
// ============================================================================

export function generateDefaultTemplate(config: TemplateConfig): TemplateFile[] {
  const files: TemplateFile[] = [
    // Root files
    { path: 'package.json', content: generatePackageJson(config) },
    { path: '.env.example', content: generateEnvExample() },
    { path: '.env', content: generateEnvExample() },
    { path: 'CLAUDE.md', content: generateClaudeMd(config) },

    // Prisma
    { path: 'prisma/schema.prisma', content: generatePrismaSchema() },

    // Source files
    { path: 'src/index.ts', content: generateIndexTs() },
    { path: 'src/database/index.ts', content: generateDatabaseIndex() },
    { path: 'src/procedures/index.ts', content: generateProceduresIndex() },
    { path: 'src/procedures/users.ts', content: generateUserProcedures() },
    { path: 'src/schemas/index.ts', content: generateSchemasIndex() },
    { path: 'src/schemas/user.ts', content: generateUserSchema() },
  ];

  // Add shared files
  return [...files, ...generateSharedFiles(config)];
}
