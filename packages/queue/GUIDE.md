# @veloxts/queue Guide

## Drivers

### Sync Driver (default)

Executes jobs immediately in-process. Best for development and testing.

```typescript
import { queuePlugin } from '@veloxts/queue';

app.use(queuePlugin({ driver: 'sync' }));
```

### BullMQ Driver

Production-ready Redis-backed queues with retries, delays, and priorities.

```bash
npm install bullmq ioredis
```

```typescript
app.use(queuePlugin({
  driver: 'bullmq',
  config: {
    url: process.env.REDIS_URL,
    prefix: 'myapp:queue:',
    defaultConcurrency: 5,
  },
}));
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
  handler: async ({ data, ctx }) => {
    const user = await ctx.db.user.findUnique({ where: { id: data.userId } });
    await ctx.mail.send(WelcomeEmail, { to: data.email, data: { user } });
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
await ctx.queue.dispatch(sendWelcomeEmail, { userId: '123', email: 'user@example.com' });

// Dispatch with delay
await ctx.queue.dispatch(sendWelcomeEmail, data, { delay: '10m' });

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

## CLI Commands

```bash
velox queue:work              # Start queue worker
velox queue:work --queue=high # Process specific queue
velox queue:failed            # List failed jobs
velox queue:retry <id>        # Retry a failed job
```
