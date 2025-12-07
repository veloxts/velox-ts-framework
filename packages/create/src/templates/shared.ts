/**
 * Shared Template Files
 *
 * Common files used by all templates (config, gitignore, etc.)
 */

import type { TemplateConfig, TemplateFile } from './types.js';

// ============================================================================
// Version Constant
// ============================================================================

/**
 * VeloxTS framework version for generated projects.
 * This is automatically updated during releases via changesets.
 */
export const VELOXTS_VERSION = '0.3.1';

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
// Config Files
// ============================================================================

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

// ============================================================================
// Health Procedures
// ============================================================================

export function generateHealthProcedures(): string {
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

// ============================================================================
// Static Files
// ============================================================================

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

// ============================================================================
// README
// ============================================================================

export function generateReadme(config: TemplateConfig): string {
  return `# ${config.projectName}

A VeloxTS application - TypeScript full-stack framework.

## Getting Started

### Install Dependencies

\`\`\`bash
${config.packageManager} install
\`\`\`

### Setup Database

\`\`\`bash
${config.packageManager} db:push
\`\`\`

### Start Development Server

\`\`\`bash
${config.packageManager} dev
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

- \`${config.packageManager} dev\` - Start development server with hot reload
- \`${config.packageManager} build\` - Build for production
- \`${config.packageManager} start\` - Start production server
- \`${config.packageManager} db:push\` - Sync database schema
- \`${config.packageManager} db:studio\` - Open Prisma Studio

## Learn More

- [VeloxTS Documentation](https://veloxts.dev)
- [TypeScript](https://www.typescriptlang.org/)
- [Fastify](https://fastify.dev/)
- [Prisma](https://www.prisma.io/)

## License

MIT
`;
}

// ============================================================================
// Shared Files Generator
// ============================================================================

export function generateSharedFiles(config: TemplateConfig): TemplateFile[] {
  return [
    { path: 'tsconfig.json', content: generateTsConfig() },
    { path: 'tsup.config.ts', content: generateTsupConfig() },
    { path: '.gitignore', content: generateGitignore() },
    { path: 'prisma.config.ts', content: generatePrismaConfig() },
    { path: 'README.md', content: generateReadme(config) },
    { path: 'src/config/index.ts', content: generateConfigIndex() },
    { path: 'src/config/app.ts', content: generateConfigApp() },
    { path: 'src/procedures/health.ts', content: generateHealthProcedures() },
    { path: 'public/index.html', content: generateIndexHtml() },
  ];
}
