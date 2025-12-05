/**
 * Template Generation Functions
 *
 * Generates all files needed for a new VeloxTS project.
 * Templates are based on the playground app structure.
 */

// ============================================================================
// Version Constant
// ============================================================================

/**
 * VeloxTS framework version for generated projects.
 * This is automatically updated during releases via changesets.
 */
export const VELOXTS_VERSION = '0.1.0';

// ============================================================================
// Template Interface
// ============================================================================

export interface ProjectTemplate {
  projectName: string;
  packageManager: 'npm' | 'pnpm' | 'yarn';
}

// ============================================================================
// Package.json Template
// ============================================================================

export function generatePackageJson(template: ProjectTemplate): string {
  return JSON.stringify(
    {
      name: template.projectName,
      version: '0.1.0',
      description: 'A VeloxTS application',
      type: 'module',
      main: 'dist/index.js',
      scripts: {
        build: 'tsup',
        start: 'node dist/index.js',
        dev: 'tsx watch src/index.ts',
        'type-check': 'tsc --noEmit',
        clean: 'rm -rf dist tsconfig.tsbuildinfo',
        'db:generate': 'prisma generate',
        'db:push': 'prisma db push',
        'db:studio': 'prisma studio',
        postinstall: 'prisma generate',
      },
      dependencies: {
        '@fastify/static': '^8.3.0',
        '@prisma/adapter-better-sqlite3': '^7.1.0',
        '@prisma/client': '^7.1.0',
        '@veloxts/core': `^${VELOXTS_VERSION}`,
        '@veloxts/orm': `^${VELOXTS_VERSION}`,
        '@veloxts/router': `^${VELOXTS_VERSION}`,
        '@veloxts/validation': `^${VELOXTS_VERSION}`,
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
// TypeScript Config
// ============================================================================

export function generateTsConfig(): string {
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
        declaration: false,
        declarationMap: false,
        rootDir: './src',
        outDir: './dist',
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist', '**/*.test.ts', '**/*.spec.ts'],
    },
    null,
    2
  );
}

// ============================================================================
// tsup Config
// ============================================================================

export function generateTsupConfig(): string {
  return `import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  clean: true,
  dts: false,
  sourcemap: true,
});
`;
}

// ============================================================================
// Environment Files
// ============================================================================

export function generateEnvExample(): string {
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

export function generateGitignore(): string {
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
src/generated/

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
`;
}

// ============================================================================
// Prisma Schema
// ============================================================================

export function generatePrismaSchema(): string {
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
// Prisma Config (Prisma 7.x)
// ============================================================================

export function generatePrismaConfig(): string {
  return `/**
 * Prisma Configuration (Prisma 7.x)
 *
 * Database URL is now configured here instead of schema.prisma.
 * See: https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7
 */

import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  earlyAccess: true,
  schema: './prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
`;
}

// ============================================================================
// Source Files
// ============================================================================

export function generateIndexTs(): string {
  return `/**
 * Application Entry Point
 */

import 'dotenv/config';

import fastifyStatic from '@fastify/static';
import { createVeloxApp, VELOX_VERSION } from '@veloxts/core';
import { createDatabasePlugin } from '@veloxts/orm';
import { createRoutesRegistrar, getRouteSummary } from '@veloxts/router';
import path from 'node:path';

import { config } from './config/index.js';
import { prisma } from './database/index.js';
import { healthProcedures, userProcedures } from './procedures/index.js';

// ============================================================================
// Application Bootstrap
// ============================================================================

async function createApp() {
  const app = await createVeloxApp({
    port: config.port,
    host: config.host,
    logger: config.logger,
  });

  // Register database plugin
  await app.use(createDatabasePlugin({ client: prisma }));

  // Register static file serving for frontend
  await app.server.register(fastifyStatic, {
    root: path.join(process.cwd(), 'public'),
    prefix: '/',
  });

  // Register REST API routes
  const collections = [userProcedures, healthProcedures];
  app.routes(createRoutesRegistrar(collections, { prefix: config.apiPrefix }));

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

export function generateConfigIndex(): string {
  return `/**
 * Configuration Exports
 */

export * from './app.js';
`;
}

export function generateConfigApp(): string {
  return `/**
 * Application Configuration
 */

export interface AppConfig {
  port: number;
  host: string;
  logger: boolean;
  apiPrefix: string;
  env: 'development' | 'production' | 'test';
}

export function createConfig(): AppConfig {
  return {
    port: Number(process.env.PORT) || 3210,
    host: process.env.HOST || '0.0.0.0',
    logger: process.env.LOG_LEVEL !== 'silent',
    apiPrefix: process.env.API_PREFIX || '/api',
    env: (process.env.NODE_ENV as AppConfig['env']) || 'development',
  };
}

export const config = createConfig();
`;
}

export function generateDatabaseIndex(): string {
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

export function generateProceduresIndex(): string {
  return `/**
 * Procedure Exports
 */

export * from './health.js';
export * from './users.js';
`;
}

export function generateHealthProcedures(): string {
  return `/**
 * Health Check Procedures
 */

import { VELOX_VERSION } from '@veloxts/core';
import { defineProcedures, procedure } from '@veloxts/router';
import { z } from 'zod';

export const healthProcedures = defineProcedures('health', {
  getHealth: procedure()
    .rest({ method: 'GET', path: '/health' })
    .output(
      z.object({
        status: z.literal('ok'),
        version: z.string(),
        timestamp: z.string().datetime(),
        uptime: z.number(),
      })
    )
    .query(async () => ({
      status: 'ok' as const,
      version: VELOX_VERSION,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    })),
});
`;
}

export function generateUserProcedures(): string {
  return `/**
 * User Procedures
 */

import { defineProcedures, procedure } from '@veloxts/router';
import { paginationInputSchema } from '@veloxts/validation';
import { z } from 'zod';

import { CreateUserInput, UserSchema } from '../schemas/user.js';

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
});
`;
}

export function generateSchemasIndex(): string {
  return `/**
 * Schema Exports
 */

export * from './user.js';
`;
}

export function generateUserSchema(): string {
  return `/**
 * User Schemas
 */

import { createIdSchema, emailSchema } from '@veloxts/validation';
import { z } from 'zod';

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
`;
}

export function generateIndexHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VeloxTS App</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { margin-bottom: 20px; color: #333; }
    .card { background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .card h2 { margin-bottom: 15px; color: #555; font-size: 1.1rem; }
    button { background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; }
    button:hover { background: #0056b3; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Welcome to VeloxTS</h1>
    <div class="card">
      <h2>Your app is running!</h2>
      <p>Visit <code>/api/health</code> to check the API status.</p>
      <p>Visit <code>/api/users</code> to see the users endpoint.</p>
    </div>
  </div>
</body>
</html>
`;
}

export function generateReadme(projectName: string): string {
  return `# ${projectName}

A VeloxTS application - TypeScript full-stack framework.

## Getting Started

### Install Dependencies

\`\`\`bash
pnpm install
\`\`\`

### Setup Database

\`\`\`bash
pnpm db:push
\`\`\`

### Start Development Server

\`\`\`bash
pnpm dev
\`\`\`

The app will start at http://localhost:3210

## Project Structure

\`\`\`
src/
├── config/          # Application configuration
├── database/        # Database client
├── procedures/      # API procedures (business logic)
├── schemas/         # Zod validation schemas
└── index.ts         # Application entry point
\`\`\`

## Available Scripts

- \`pnpm dev\` - Start development server with hot reload
- \`pnpm build\` - Build for production
- \`pnpm start\` - Start production server
- \`pnpm db:push\` - Sync database schema
- \`pnpm db:studio\` - Open Prisma Studio

## Learn More

- [VeloxTS Documentation](https://veloxts.dev)
- [TypeScript](https://www.typescriptlang.org/)
- [Fastify](https://fastify.dev/)
- [Prisma](https://www.prisma.io/)

## License

MIT
`;
}
