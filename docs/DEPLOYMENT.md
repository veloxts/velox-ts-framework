# VeloxTS Deployment Guide

A comprehensive guide to deploying VeloxTS applications to production environments including Docker, Railway, and Render.

## Overview

VeloxTS applications are standard Node.js applications built with TypeScript, making them deployable to any platform that supports Node.js 20+. This guide covers the most common deployment scenarios and production best practices.

**Supported Deployment Targets:**
- Docker containers (local, AWS, GCP, Azure)
- Railway (managed platform with PostgreSQL)
- Render (managed platform with PostgreSQL)
- Fly.io, DigitalOcean App Platform, Heroku
- Traditional VPS (Ubuntu, Debian, CentOS)

**Prerequisites:**
- Node.js 20+ in production environment
- PostgreSQL or MySQL database (SQLite not recommended for production)
- Environment variable management
- Basic understanding of your deployment platform

## Quick Reference

### Default Ports
- Development: `3030`
- Production: Use `PORT` environment variable (most platforms set this automatically)

### Required Environment Variables
```bash
# Application
NODE_ENV=production
PORT=3030                          # Auto-set by most platforms
HOST=0.0.0.0                       # Listen on all interfaces

# Database (Prisma 7 requires DATABASE_URL)
DATABASE_URL="postgresql://user:password@host:5432/dbname"

# Authentication (if using @veloxts/auth)
JWT_SECRET="your-secret-key-min-32-chars"
JWT_REFRESH_SECRET="your-refresh-secret-key-min-32-chars"
SESSION_SECRET="your-session-secret-min-16-chars"

# Optional
API_PREFIX=/api                    # Default: /api
LOG_LEVEL=info                     # Default: info
```

### Build Commands
```bash
# Install dependencies
pnpm install --frozen-lockfile

# Generate Prisma client
pnpm prisma generate

# Build TypeScript to JavaScript
pnpm build

# Run database migrations (production)
pnpm prisma migrate deploy

# Start production server
pnpm start
```

## Docker Deployment

Docker provides a consistent, portable deployment environment for VeloxTS applications.

### Production Dockerfile

Create a `Dockerfile` in your project root:

```dockerfile
# syntax=docker/dockerfile:1

# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Copy application code
COPY . .

# Generate Prisma client
RUN pnpm prisma generate

# Build TypeScript to JavaScript
RUN pnpm build

# Production stage
FROM node:20-alpine AS runner

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership to nodejs user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose application port
EXPOSE 3030

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3030/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "dist/index.js"]
```

### Docker Compose with PostgreSQL

For local development or self-hosted deployments, use Docker Compose:

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3030:3030"
    environment:
      NODE_ENV: production
      PORT: 3030
      HOST: 0.0.0.0
      DATABASE_URL: postgresql://velox:veloxpass@db:5432/veloxdb
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      SESSION_SECRET: ${SESSION_SECRET}
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - velox-network
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3030/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 40s

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: velox
      POSTGRES_PASSWORD: veloxpass
      POSTGRES_DB: veloxdb
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped
    networks:
      - velox-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U velox"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres-data:
    driver: local

networks:
  velox-network:
    driver: bridge
```

### Docker Build and Run

Build the Docker image:

```bash
docker build -t velox-app:latest .
```

Run with Docker Compose:

```bash
# Create .env file with secrets
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 32)" >> .env
echo "SESSION_SECRET=$(openssl rand -base64 16)" >> .env

# Start services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

Run database migrations:

```bash
# Run migrations inside the container
docker-compose exec app pnpm prisma migrate deploy
```

### Docker Best Practices

1. **Multi-stage builds** - Separate build and runtime stages to reduce image size
2. **Non-root user** - Run application as non-privileged user for security
3. **Layer caching** - Copy package files before source code for better caching
4. **Health checks** - Enable Docker to monitor application health
5. **Production dependencies** - Install only production dependencies in final stage
6. **Secret management** - Use Docker secrets or environment variables, never hardcode

### Dockerfile Optimization

For smaller images, add a `.dockerignore` file:

```
# .dockerignore
node_modules
dist
.git
.env
.env.*
*.log
coverage
.DS_Store
README.md
```

## Railway Deployment

Railway is a modern platform-as-a-service with excellent PostgreSQL support and GitHub integration.

### Step-by-Step Railway Deployment

#### 1. Prepare Your Repository

Ensure your project has these files:

```
my-velox-app/
├── package.json         # With build and start scripts
├── prisma/
│   └── schema.prisma    # Database schema
├── src/
│   └── index.ts         # Application entry point
└── .gitignore           # Exclude node_modules, .env, dist
```

Verify `package.json` scripts:

```json
{
  "scripts": {
    "build": "pnpm prisma generate && pnpm tsup",
    "start": "node dist/index.js",
    "db:migrate": "prisma migrate deploy"
  }
}
```

#### 2. Create Railway Project

1. Sign up at [railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Authorize Railway to access your repository
5. Select your VeloxTS project repository

#### 3. Add PostgreSQL Database

1. In your Railway project, click "New"
2. Select "Database" → "PostgreSQL"
3. Railway automatically creates the database and sets `DATABASE_URL`

#### 4. Configure Environment Variables

In the Railway dashboard, add these variables to your app service:

```bash
NODE_ENV=production
JWT_SECRET=<generate-secure-key>
JWT_REFRESH_SECRET=<generate-secure-key>
SESSION_SECRET=<generate-secure-key>
```

Generate secure keys:

```bash
# JWT_SECRET (32+ characters)
openssl rand -base64 32

# JWT_REFRESH_SECRET (32+ characters)
openssl rand -base64 32

# SESSION_SECRET (16+ characters)
openssl rand -base64 16
```

#### 5. Configure Build Settings

Railway auto-detects Node.js projects. Verify in Settings:

- **Build Command**: `pnpm install --frozen-lockfile && pnpm build`
- **Start Command**: `pnpm start`
- **Node Version**: 20 (set in package.json `engines` field)

Update `package.json` to specify Node version:

```json
{
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=8.0.0"
  }
}
```

#### 6. Run Database Migrations

After first deployment, run migrations:

1. Open Railway project dashboard
2. Click on your app service
3. Go to "Settings" → "Deploy"
4. Add deployment command:

```bash
pnpm prisma migrate deploy && node dist/index.js
```

Or run manually via Railway CLI:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Link to your project
railway link

# Run migrations
railway run pnpm prisma migrate deploy
```

#### 7. Deploy

Railway auto-deploys on every push to your main branch:

```bash
git add .
git commit -m "Deploy to Railway"
git push origin main
```

Monitor deployment in the Railway dashboard.

#### 8. Access Your Application

Railway provides a public URL:

1. Go to your app service settings
2. Click "Networking" → "Generate Domain"
3. Access your app at `https://your-app.railway.app`

Test the deployment:

```bash
curl https://your-app.railway.app/api/health
```

### Railway Configuration File

Create `railway.toml` for advanced configuration:

```toml
[build]
builder = "NIXPACKS"
buildCommand = "pnpm install --frozen-lockfile && pnpm build"

[deploy]
startCommand = "pnpm prisma migrate deploy && pnpm start"
healthcheckPath = "/api/health"
healthcheckTimeout = 100
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

### Custom Domain on Railway

1. Purchase domain from registrar (Cloudflare, Namecheap, etc.)
2. In Railway dashboard, go to app service → "Networking"
3. Click "Custom Domain" → Add your domain
4. Update DNS records at your registrar:

```
Type: CNAME
Name: @ (or subdomain)
Value: <railway-provided-cname>
```

Wait for DNS propagation (5-30 minutes).

### Railway Best Practices

1. **Database backups** - Enable automated backups in PostgreSQL service settings
2. **Environment variables** - Use Railway's shared variables for common configs
3. **Monitoring** - Enable Railway's built-in monitoring and logs
4. **Preview deployments** - Use Railway's PR preview feature for testing
5. **Scaling** - Adjust resources in service settings if needed

## Render Deployment

Render offers free PostgreSQL databases and seamless GitHub deployments.

### Step-by-Step Render Deployment

#### 1. Prepare Your Repository

Same requirements as Railway - ensure `package.json` has correct scripts:

```json
{
  "scripts": {
    "build": "pnpm prisma generate && pnpm tsup",
    "start": "node dist/index.js"
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=8.0.0"
  }
}
```

#### 2. Create PostgreSQL Database

1. Sign up at [render.com](https://render.com)
2. Click "New +" → "PostgreSQL"
3. Configure:
   - **Name**: `velox-db`
   - **Database**: `veloxdb`
   - **User**: `velox`
   - **Region**: Choose closest to your users
   - **Plan**: Free or Starter
4. Click "Create Database"
5. Copy the "Internal Database URL" (used by your app)

#### 3. Create Web Service

1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Name**: `velox-app`
   - **Environment**: `Node`
   - **Region**: Same as database
   - **Branch**: `main`
   - **Build Command**: `pnpm install --frozen-lockfile && pnpm build`
   - **Start Command**: `pnpm prisma migrate deploy && pnpm start`
   - **Plan**: Free or Starter

#### 4. Configure Environment Variables

In web service settings, add environment variables:

```bash
NODE_ENV=production
DATABASE_URL=<internal-database-url-from-step-2>
JWT_SECRET=<generate-secure-key>
JWT_REFRESH_SECRET=<generate-secure-key>
SESSION_SECRET=<generate-secure-key>
```

Use the "Internal Database URL" from your PostgreSQL service, not the external URL.

#### 5. Deploy

Render automatically deploys. Monitor progress in the dashboard.

First deployment takes 5-10 minutes (installs dependencies, runs migrations, builds app).

#### 6. Access Your Application

Render provides a URL like `https://velox-app.onrender.com`

Test the deployment:

```bash
curl https://velox-app.onrender.com/api/health
```

### Render Blueprint (render.yaml)

For infrastructure-as-code, create `render.yaml` in your repository:

```yaml
services:
  - type: web
    name: velox-app
    env: node
    region: oregon
    plan: starter
    buildCommand: pnpm install --frozen-lockfile && pnpm build
    startCommand: pnpm prisma migrate deploy && pnpm start
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: velox-db
          property: connectionString
      - key: JWT_SECRET
        generateValue: true
      - key: JWT_REFRESH_SECRET
        generateValue: true
      - key: SESSION_SECRET
        generateValue: true

databases:
  - name: velox-db
    databaseName: veloxdb
    user: velox
    plan: starter
    region: oregon
```

Deploy from blueprint:

1. Push `render.yaml` to your repository
2. In Render dashboard, click "New +" → "Blueprint"
3. Connect repository
4. Render creates all services automatically

### Custom Domain on Render

1. In web service settings, go to "Custom Domain"
2. Click "Add Custom Domain"
3. Enter your domain (e.g., `api.example.com`)
4. Update DNS at your registrar:

```
Type: CNAME
Name: api (or @)
Value: <render-provided-cname>
```

Render automatically provisions SSL certificates via Let's Encrypt.

### Render Best Practices

1. **Use Internal URLs** - Connect web service to database using internal URL (faster, free bandwidth)
2. **Health checks** - Configure `/api/health` endpoint for automatic restarts
3. **Persistent storage** - Use Render Disks if you need file storage (not common with VeloxTS)
4. **Background jobs** - Use Render Cron Jobs for scheduled tasks
5. **Free tier limits** - Free services sleep after 15 minutes of inactivity (first request takes 30s to wake)

## General Production Considerations

### Environment Variables Checklist

Verify all required environment variables are set:

```bash
# Required
NODE_ENV=production
DATABASE_URL=postgresql://...
PORT=3030
HOST=0.0.0.0

# Authentication (if using @veloxts/auth)
JWT_SECRET=<32+ characters>
JWT_REFRESH_SECRET=<32+ characters>
SESSION_SECRET=<16+ unique characters>

# Optional but recommended
API_PREFIX=/api
LOG_LEVEL=info
```

Generate secure secrets:

```bash
# Generate strong random secrets
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Never commit secrets to Git.** Use platform-provided secret management or environment variable services.

### Database Configuration for Production

VeloxTS uses Prisma 7 with driver adapters. For production, switch from SQLite to PostgreSQL.

#### Update Prisma Schema

Edit `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"  // Changed from "sqlite"
}

model User {
  id        String   @id @default(dbgenerated("gen_random_uuid()"))  // PostgreSQL UUID
  name      String
  email     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}
```

#### Update Database Client

Edit `src/config/database.ts`:

```typescript
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../../generated/prisma/client.js';

// Validate required environment variable
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                       // Maximum connections
  idleTimeoutMillis: 30000,      // Close idle connections after 30s
  connectionTimeoutMillis: 2000, // Timeout for acquiring connection
});

// Create Prisma adapter
const adapter = new PrismaPg(pool);

// Export configured Prisma client
export const prisma = new PrismaClient({ adapter });

// Graceful shutdown - close connection pool
process.on('beforeExit', async () => {
  await pool.end();
});
```

#### Install PostgreSQL Adapter

```bash
pnpm add @prisma/adapter-pg@7.1.0 pg@8.13.1
pnpm add -D @types/pg@8.11.10
```

For detailed Prisma 7 setup, see [PRISMA-7-SETUP.md](./PRISMA-7-SETUP.md).

### Running Migrations in Production

**Important:** Never use `prisma db push` in production. Always use migrations.

#### Generate Migration Locally

```bash
# Create migration from schema changes
pnpm prisma migrate dev --name add_user_bio

# Commit migration files
git add prisma/migrations
git commit -m "Add user bio field"
git push
```

#### Apply Migration in Production

Most platforms auto-run migrations if you update the start command:

```bash
# Railway/Render start command
pnpm prisma migrate deploy && pnpm start
```

Or run manually via platform CLI:

```bash
# Railway
railway run pnpm prisma migrate deploy

# Render (via SSH or shell)
pnpm prisma migrate deploy
```

**Migration Best Practices:**

1. **Test migrations locally first** - Always test on development database
2. **Backup before migrating** - Create database backup before applying migrations
3. **Rollback plan** - Know how to revert changes if migration fails
4. **Zero-downtime migrations** - For critical apps, use blue-green deployments
5. **Monitor after migration** - Check logs and metrics after deployment

### Graceful Shutdown Handling

VeloxTS templates include graceful shutdown handlers by default:

```typescript
// src/index.ts
import { prisma } from './config/database.js';

// ... application setup ...

await app.start();

// Send ready signal to CLI for accurate HMR timing
if (process.send) {
  process.send({ type: 'velox:ready' });
}

// Graceful shutdown - disconnect Prisma to prevent connection pool leaks
let isShuttingDown = false;

const shutdown = async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  try {
    await prisma.$disconnect();
  } catch {
    // Ignore disconnect errors during shutdown
  }
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

**Why This Matters:**

- **Connection pool leaks** - Prevents database connection exhaustion
- **Graceful termination** - Allows in-flight requests to complete
- **Platform compatibility** - Required for zero-downtime deployments
- **Resource cleanup** - Closes file handles, network connections

### Logging Configuration

Configure structured logging for production:

```typescript
// src/config/app.ts
export const config = {
  port: Number(process.env.PORT) || 3030,
  host: process.env.HOST || '0.0.0.0',
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport:
      process.env.NODE_ENV === 'production'
        ? undefined  // Use default (JSON to stdout)
        : {
            target: 'pino-pretty',  // Pretty print in development
            options: {
              colorize: true,
            },
          },
  },
  apiPrefix: process.env.API_PREFIX || '/api',
};
```

**Log Levels:**

- `fatal` - System is unusable
- `error` - Error events that might still allow the app to continue
- `warn` - Warning events (potential issues)
- `info` - Informational messages (default)
- `debug` - Detailed debug information
- `trace` - Very detailed trace information

Set via environment variable:

```bash
LOG_LEVEL=warn  # Production: warn or info
LOG_LEVEL=debug # Development: debug or trace
```

### Health Check Endpoints

VeloxTS templates include a `/api/health` endpoint by default:

```typescript
// src/procedures/health.ts
import { defineProcedures, procedure } from '@veloxts/router';
import { z } from 'zod';

export const healthProcedures = defineProcedures('health', {
  check: procedure()
    .output(
      z.object({
        status: z.literal('ok'),
        timestamp: z.string().datetime(),
        uptime: z.number(),
      })
    )
    .query(() => ({
      status: 'ok' as const,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    })),
});
```

Access via REST:

```bash
curl https://your-app.com/api/health
```

Response:

```json
{
  "status": "ok",
  "timestamp": "2025-12-18T12:00:00.000Z",
  "uptime": 1234.56
}
```

**Health Check Best Practices:**

1. **Fast response** - Should return in <100ms
2. **No authentication** - Public endpoint for monitoring
3. **Database check** - Optionally ping database to verify connectivity
4. **Dependency checks** - Check critical external services if needed

Enhanced health check with database:

```typescript
check: procedure()
  .output(
    z.object({
      status: z.enum(['ok', 'degraded']),
      timestamp: z.string().datetime(),
      uptime: z.number(),
      database: z.enum(['connected', 'disconnected']),
    })
  )
  .query(async ({ ctx }) => {
    let dbStatus: 'connected' | 'disconnected' = 'disconnected';

    try {
      await ctx.db.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch {
      // Database connection failed
    }

    return {
      status: dbStatus === 'connected' ? ('ok' as const) : ('degraded' as const),
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbStatus,
    };
  }),
```

## Platform-Specific Tips

### Fly.io

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
flyctl auth login

# Initialize app
flyctl launch

# Deploy
flyctl deploy
```

Create `fly.toml`:

```toml
app = "velox-app"
primary_region = "sjc"

[build]
  builder = "heroku/buildpacks:20"

[env]
  NODE_ENV = "production"
  PORT = "8080"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0

[[services]]
  internal_port = 8080
  protocol = "tcp"

  [[services.ports]]
    handlers = ["http"]
    port = 80

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443

  [[services.http_checks]]
    interval = 10000
    grace_period = "5s"
    method = "get"
    path = "/api/health"
    protocol = "http"
    timeout = 2000
```

### DigitalOcean App Platform

1. Create App from GitHub repository
2. Set build command: `pnpm install --frozen-lockfile && pnpm build`
3. Set run command: `pnpm start`
4. Add managed PostgreSQL database
5. Configure environment variables
6. Deploy

### Heroku

```bash
# Install Heroku CLI
curl https://cli-assets.heroku.com/install.sh | sh

# Login
heroku login

# Create app
heroku create velox-app

# Add PostgreSQL
heroku addons:create heroku-postgresql:mini

# Deploy
git push heroku main

# Run migrations
heroku run pnpm prisma migrate deploy
```

Create `Procfile`:

```
web: pnpm start
release: pnpm prisma migrate deploy
```

## Troubleshooting

### Port Binding Issues

**Symptom:** Application fails to start with "Port already in use" error.

**Solution:** Ensure `HOST=0.0.0.0` to listen on all interfaces:

```typescript
// src/config/app.ts
export const config = {
  host: process.env.HOST || '0.0.0.0',  // Not 'localhost' or '127.0.0.1'
  port: Number(process.env.PORT) || 3030,
};
```

### Database Connection Timeouts

**Symptom:** Application crashes with "connect ETIMEDOUT" or "Connection pool exhausted".

**Solution:** Optimize connection pool settings:

```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                       // Increase if needed
  idleTimeoutMillis: 30000,      // Close idle connections
  connectionTimeoutMillis: 5000, // Increase timeout
});
```

Verify `DATABASE_URL` uses internal/private network URL on platforms like Railway and Render.

### Migration Failures

**Symptom:** Deployment fails during `prisma migrate deploy`.

**Solutions:**

1. **Check migration files** - Ensure all migrations are committed to Git
2. **Manual rollback** - Use `prisma migrate resolve --rolled-back <migration>`
3. **Schema drift** - Run `prisma db push` locally, then create new migration
4. **Destructive changes** - Use `prisma migrate dev --create-only` to edit migration SQL

### Build Failures

**Symptom:** Build fails with TypeScript errors or missing dependencies.

**Solutions:**

1. **Clear cache** - Delete `node_modules` and `dist`, reinstall dependencies
2. **Type check locally** - Run `pnpm type-check` before pushing
3. **Missing types** - Ensure `@types/*` packages are in `devDependencies`
4. **Prisma not generated** - Add `pnpm prisma generate` to build command

### Memory Issues

**Symptom:** Application crashes with "JavaScript heap out of memory".

**Solutions:**

1. **Increase Node.js memory** - Add to start command:

```json
{
  "scripts": {
    "start": "node --max-old-space-size=512 dist/index.js"
  }
}
```

2. **Optimize queries** - Use Prisma's `select` to fetch only needed fields
3. **Connection pooling** - Reduce `max` pool size if running on limited RAM
4. **Platform resources** - Upgrade to larger instance/plan

### SSL/TLS Certificate Issues

**Symptom:** Database connection fails with "unable to verify the first certificate".

**Solution:** Add SSL mode to `DATABASE_URL`:

```bash
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
```

Or disable SSL verification (not recommended for production):

```bash
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=disable"
```

### Slow First Request (Cold Start)

**Symptom:** First request takes 5-30 seconds on free tiers (Render, Railway).

**Explanation:** Free tier services sleep after inactivity. First request wakes the service.

**Solutions:**

1. **Upgrade to paid tier** - Removes auto-sleep behavior
2. **Keep-alive pings** - Use external monitoring to ping app every 10 minutes
3. **Serverless alternative** - Use platform-specific serverless options (requires code changes)

## Performance Optimization

### Connection Pooling

Tune PostgreSQL connection pool for your workload:

```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                       // Max connections (tune based on instance size)
  min: 5,                        // Keep 5 connections warm
  idleTimeoutMillis: 30000,      // Close idle connections after 30s
  connectionTimeoutMillis: 2000,
  allowExitOnIdle: false,
});
```

**Guidelines:**

- Small instance (512MB RAM): `max: 10`
- Medium instance (1GB RAM): `max: 20`
- Large instance (2GB+ RAM): `max: 50`

### Database Indexes

Add indexes for frequently queried fields:

```prisma
model User {
  id    String @id @default(dbgenerated("gen_random_uuid()"))
  email String @unique

  @@index([email])  // Index for faster lookups
}

model Post {
  id        String   @id
  authorId  String
  published Boolean

  @@index([authorId])          // Index for user's posts
  @@index([published, authorId])  // Composite index for filtered queries
}
```

Regenerate client and migrate:

```bash
pnpm prisma migrate dev --name add_indexes
pnpm prisma migrate deploy  # In production
```

### Caching

Add caching layer with Redis (future enhancement):

```typescript
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export const cachedProcedure = procedure()
  .query(async ({ ctx, input }) => {
    const cacheKey = `users:${input.id}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const user = await ctx.db.user.findUnique({ where: { id: input.id } });

    await redis.set(cacheKey, JSON.stringify(user), 'EX', 300); // 5 min TTL

    return user;
  });
```

## Security Checklist

Before deploying to production:

- [ ] All secrets use environment variables (never hardcoded)
- [ ] `.env` file is in `.gitignore`
- [ ] `NODE_ENV=production` is set
- [ ] Database uses strong password
- [ ] JWT secrets are 32+ random characters
- [ ] Session secrets are 16+ unique characters
- [ ] CORS is configured for your frontend domain
- [ ] Rate limiting is enabled (if using @veloxts/auth)
- [ ] Helmet or equivalent security headers are enabled
- [ ] Database connection uses SSL/TLS
- [ ] Application runs as non-root user (Docker)
- [ ] Dependencies are up-to-date (run `pnpm outdated`)
- [ ] Health check endpoint is accessible
- [ ] Logs do not contain sensitive data

## Monitoring and Observability

### Application Metrics

Use platform-provided monitoring or integrate third-party services:

**Railway:** Built-in metrics (CPU, memory, network)
**Render:** Built-in metrics and log streaming
**Custom:** Integrate with Datadog, New Relic, or Sentry

Example Sentry integration:

```bash
pnpm add @sentry/node
```

```typescript
import * as Sentry from '@sentry/node';

if (process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 1.0,
  });
}
```

### Log Aggregation

Stream logs to external service for long-term retention:

- **Railway:** Built-in log streaming to Logtail, Datadog
- **Render:** Log drains to Papertrail, Logtail
- **Self-hosted:** Use Loki, Elasticsearch, or CloudWatch

## Continuous Deployment

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Railway

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Type check
        run: pnpm type-check

      - name: Build
        run: pnpm build

      - name: Deploy to Railway
        uses: bervProject/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: velox-app
```

## Conclusion

VeloxTS applications deploy seamlessly to modern platforms with minimal configuration. Choose the platform that best fits your needs:

- **Docker** - Maximum control, portable, works anywhere
- **Railway** - Fastest setup, great DX, auto-scaling
- **Render** - Free tier, simple, good for MVPs
- **Fly.io** - Global edge deployment, advanced features
- **Traditional VPS** - Full control, budget-friendly at scale

For detailed database setup, see [PRISMA-7-SETUP.md](./PRISMA-7-SETUP.md).

For getting started with VeloxTS, see [GETTING_STARTED.md](./GETTING_STARTED.md).

Need help? Open an issue on [GitHub](https://github.com/veloxts/velox-ts-framework/issues).
