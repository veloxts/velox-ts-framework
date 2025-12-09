/**
 * Default Template (Full-Stack)
 *
 * Full-stack workspace template with:
 * - apps/api: REST API with user CRUD operations
 * - apps/web: React frontend with TanStack Router
 *
 * No authentication - suitable for internal APIs or as a starting point.
 */

import { generateRootFiles, generateWebBaseFiles, generateWebStyleFiles } from './shared/index.js';
import { VELOXTS_VERSION } from './shared.js';
import type { TemplateConfig, TemplateFile } from './types.js';

// ============================================================================
// API Package.json
// ============================================================================

function generateApiPackageJson(): string {
  return JSON.stringify(
    {
      name: 'api',
      version: '0.0.1',
      private: true,
      type: 'module',
      main: 'dist/index.js',
      scripts: {
        build: 'tsup',
        start: 'node dist/index.js',
        dev: 'tsx watch src/index.ts',
        'dev:hmr': 'velox dev --hmr',
        'type-check': 'tsc --noEmit',
        clean:
          "node -e \"require('fs').rmSync('dist',{recursive:true,force:true});require('fs').rmSync('tsconfig.tsbuildinfo',{force:true})\"",
        'db:generate': 'prisma generate',
        'db:push': 'prisma db push',
        'db:studio': 'prisma studio',
        postinstall: 'prisma generate',
      },
      dependencies: {
        '@prisma/adapter-better-sqlite3': '7.1.0',
        '@prisma/client': '7.1.0',
        '@veloxts/velox': `${VELOXTS_VERSION}`,
        'better-sqlite3': '12.5.0',
        dotenv: '17.2.3',
        zod: '3.24.4',
      },
      devDependencies: {
        '@veloxts/cli': `${VELOXTS_VERSION}`,
        'hot-hook': '0.4.0',
        prisma: '7.1.0',
        tsup: '8.5.1',
        tsx: '4.21.0',
        typescript: '5.8.3',
      },
      hotHook: {
        boundaries: ['./src/procedures/**/*.ts', './src/schemas/**/*.ts', './src/handlers/**/*.ts'],
      },
    },
    null,
    2
  );
}

// ============================================================================
// API tsconfig.json
// ============================================================================

function generateApiTsConfig(): string {
  return JSON.stringify(
    {
      $schema: 'https://json.schemastore.org/tsconfig',
      extends: '../../tsconfig.json',
      compilerOptions: {
        rootDir: './src',
        outDir: './dist',
        declaration: false,
        declarationMap: false,
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist', '**/*.test.ts', '**/*.spec.ts'],
    },
    null,
    2
  );
}

// ============================================================================
// API tsup.config.ts
// ============================================================================

function generateApiTsupConfig(): string {
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
// Prisma Config
// ============================================================================

function generatePrismaConfig(): string {
  return `/**
 * Prisma Configuration (Prisma 7.x)
 *
 * Database URL is configured here instead of schema.prisma.
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

function generateIndexTs(): string {
  return `/**
 * Application Entry Point
 */

import 'dotenv/config';

import {
  veloxApp,
  VELOX_VERSION,
  databasePlugin,
  rest,
  getRouteSummary,
} from '@veloxts/velox';

import { config } from './config/index.js';
import { prisma } from './database/index.js';
import { healthProcedures } from './procedures/health.js';
import { userProcedures } from './procedures/users.js';

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

  // Register all procedures
  const collections = [healthProcedures, userProcedures];
  app.routes(rest(collections, { prefix: config.apiPrefix }));

  return { app, collections };
}

function printBanner(collections: Parameters<typeof getRouteSummary>[0]) {
  const divider = '═'.repeat(50);

  console.log(\`\\n\${divider}\`);
  console.log(\`  VeloxTS API v\${VELOX_VERSION}\`);
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
  console.log(\`  API: http://localhost:\${config.port}\${config.apiPrefix}\`);
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

function generateConfigIndex(): string {
  return `/**
 * Configuration Exports
 */

export * from './app.js';
`;
}

function generateConfigApp(): string {
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

function generateHealthProcedures(): string {
  return `/**
 * Health Check Procedures
 */

import { VELOX_VERSION, defineProcedures, procedure, z } from '@veloxts/velox';

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
// Default Template Generator
// ============================================================================

export function generateDefaultTemplate(config: TemplateConfig): TemplateFile[] {
  const files: TemplateFile[] = [
    // API package files
    { path: 'apps/api/package.json', content: generateApiPackageJson() },
    { path: 'apps/api/tsconfig.json', content: generateApiTsConfig() },
    { path: 'apps/api/tsup.config.ts', content: generateApiTsupConfig() },
    { path: 'apps/api/prisma.config.ts', content: generatePrismaConfig() },
    { path: 'apps/api/.env.example', content: generateEnvExample() },
    { path: 'apps/api/.env', content: generateEnvExample() },

    // Prisma
    { path: 'apps/api/prisma/schema.prisma', content: generatePrismaSchema() },

    // API Source files
    { path: 'apps/api/src/index.ts', content: generateIndexTs() },
    { path: 'apps/api/src/config/index.ts', content: generateConfigIndex() },
    { path: 'apps/api/src/config/app.ts', content: generateConfigApp() },
    { path: 'apps/api/src/database/index.ts', content: generateDatabaseIndex() },
    { path: 'apps/api/src/procedures/index.ts', content: generateProceduresIndex() },
    { path: 'apps/api/src/procedures/health.ts', content: generateHealthProcedures() },
    { path: 'apps/api/src/procedures/users.ts', content: generateUserProcedures() },
    { path: 'apps/api/src/schemas/index.ts', content: generateSchemasIndex() },
    { path: 'apps/api/src/schemas/user.ts', content: generateUserSchema() },
  ];

  // Add root workspace files
  const rootFiles = generateRootFiles(config, false);

  // Add web package files
  const webBaseFiles = generateWebBaseFiles(config, false);
  const webStyleFiles = generateWebStyleFiles();

  return [...files, ...rootFiles, ...webBaseFiles, ...webStyleFiles];
}
