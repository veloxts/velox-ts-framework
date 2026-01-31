# @veloxts/queue Guide

Background job processing for VeloxTS applications with support for sync execution (development) and BullMQ/Redis (production).

## Installation

```bash
pnpm add @veloxts/queue

# For BullMQ (production)
pnpm add bullmq ioredis
```

## Quick Start

### Development (Sync)

Jobs execute immediately in-process:

```typescript
import { velox } from '@veloxts/core';
import { queuePlugin } from '@veloxts/queue';

const app = velox();

app.register(queuePlugin({
  driver: 'sync',
}));

await app.start();
```

### Production (BullMQ)

Jobs are queued in Redis and processed by workers:

```typescript
import { velox } from '@veloxts/core';
import { queuePlugin } from '@veloxts/queue';

const app = velox();

app.register(queuePlugin({
  driver: 'bullmq',
  config: {
    url: process.env.REDIS_URL,
    prefix: 'myapp:queue:',
    defaultConcurrency: 5,
  },
}));

await app.start();
```

**Environment Variables:**

```bash
# .env
REDIS_URL=redis://user:password@your-redis-host:6379
```

## Defining Jobs

```typescript
import { defineJob } from '@veloxts/queue';
import { z } from 'zod';

export const sendWelcomeEmail = defineJob({
  name: 'email.welcome',
  schema: z.object({
    userId: z.string().uuid(),
    email: z.string().email(),
  }),
  handler: async ({ data, ctx, progress }) => {
    await progress(10);
    const user = await ctx.db.user.findUnique({ where: { id: data.userId } });
    await progress(50);
    await ctx.mail.send(WelcomeEmail, { to: data.email, data: { user } });
    await progress(100);
  },
  options: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  },
});
```

## Dispatching Jobs

```typescript
// Dispatch immediately
await ctx.queue.dispatch(sendWelcomeEmail, {
  userId: '123',
  email: 'user@example.com',
});

// Dispatch with delay
await ctx.queue.dispatch(sendWelcomeEmail, data, { delay: '10m' });

// Dispatch with priority (lower = higher priority)
await ctx.queue.dispatch(sendWelcomeEmail, data, { priority: 1 });

// Dispatch in batch
await ctx.queue.dispatchBatch(sendWelcomeEmail, [
  { userId: '1', email: 'a@example.com' },
  { userId: '2', email: 'b@example.com' },
]);
```

## Job Options

```typescript
defineJob({
  name: 'my.job',
  schema: MySchema,
  handler: async ({ data }) => { ... },
  options: {
    attempts: 3,                    // Retry count
    backoff: {
      type: 'exponential',          // or 'fixed'
      delay: 1000,                  // Base delay in ms
    },
    priority: 1,                    // Lower = higher priority
    timeout: 30000,                 // Job timeout in ms
    removeOnComplete: true,         // Clean up completed jobs
    removeOnFail: false,            // Keep failed jobs for inspection
  },
});
```

## Failed Jobs

```typescript
// Get failed jobs
const failed = await ctx.queue.getFailedJobs('default');

// Retry a specific job
await ctx.queue.retryJob(jobId, 'default');

// Retry all failed jobs
await ctx.queue.retryAllFailed();
```

## Queue Management

```typescript
// Pause a queue
await ctx.queue.pauseQueue('default');

// Resume a queue
await ctx.queue.resumeQueue('default');

// Get queue stats
const stats = await ctx.queue.getStats('default');
// { waiting: 10, active: 2, completed: 100, failed: 5 }
```

## Production Deployment

### Running Workers

In production, run separate worker processes:

```typescript
// worker.ts
import { createWorker } from '@veloxts/queue';
import { sendWelcomeEmail, processOrder } from './jobs';

const worker = await createWorker({
  connection: { url: process.env.REDIS_URL },
  jobs: [sendWelcomeEmail, processOrder],
  concurrency: 5,
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await worker.close();
  process.exit(0);
});
```

### CLI Commands

```bash
velox queue:work              # Start queue worker
velox queue:work --queue=high # Process specific queue
velox queue:failed            # List failed jobs
velox queue:retry <id>        # Retry a failed job
```

### Production Checklist

1. **Redis for job persistence** - Required for BullMQ
2. **Separate worker processes** - Don't process jobs in web server
3. **Graceful shutdown** - Allow in-progress jobs to complete
4. **Failed job monitoring** - Alert on job failures
5. **Concurrency tuning** - Match to your workload

### Recommended Redis providers

- [Upstash](https://upstash.com) - Serverless, pay-per-request
- [Redis Cloud](https://redis.com/cloud) - Managed Redis
- [Railway](https://railway.app) - Simple Redis add-on

## Standalone Usage

Use queue outside of Fastify request context (CLI commands, scripts):

```typescript
import { getQueue, closeQueue } from '@veloxts/queue';

// Get standalone queue instance
const queue = await getQueue({
  driver: 'bullmq',
  config: { url: process.env.REDIS_URL },
});

await queue.dispatch(myJob, { data: 'value' });

// Clean up when done
await closeQueue();
```
