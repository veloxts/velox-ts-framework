# @veloxts/scheduler Guide

Cron task scheduling for VeloxTS applications with a fluent API for defining scheduled tasks.

## Installation

```bash
pnpm add @veloxts/scheduler
```

## Quick Start

```typescript
import { createApp } from '@veloxts/core';
import { schedulerPlugin, task } from '@veloxts/scheduler';

const app = createApp();

app.register(schedulerPlugin({
  timezone: 'UTC',
  tasks: [
    task('cleanup-tokens', async (ctx) => {
      await ctx.db.token.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
    })
      .daily()
      .at('02:00')
      .build(),

    task('send-digest', async (ctx) => {
      await sendDailyDigest();
    })
      .weekdays()
      .at('09:00')
      .timezone('America/New_York')
      .build(),
  ],
}));

await app.start();
```

## Schedule Frequencies

```typescript
task('name', handler)
  // Time-based
  .everyMinute()
  .everyFiveMinutes()
  .everyTenMinutes()
  .everyFifteenMinutes()
  .everyThirtyMinutes()
  .hourly()
  .hourlyAt(15)              // At :15 past the hour
  .daily()
  .dailyAt('09:00')
  .weekly()
  .weeklyOn('monday', '09:00')
  .monthly()
  .monthlyOn(1, '00:00')     // 1st of month at midnight
  .quarterly()
  .yearly()

  // Day constraints
  .weekdays()                // Monday-Friday
  .weekends()                // Saturday-Sunday
  .mondays()
  .tuesdays()
  // ... etc

  // Custom cron
  .cron('*/5 * * * *')       // Every 5 minutes

  .build()
```

## Task Options

```typescript
task('sync-data', syncData)
  .hourly()
  .timezone('America/New_York')     // Task-specific timezone
  .withoutOverlapping()             // Skip if still running
  .withoutOverlapping(30)           // Max lock time in minutes
  .when(() => isMainServer())       // Conditional execution
  .skip(() => isMaintenanceMode())  // Skip condition
  .onSuccess((ctx, duration) => {
    console.log(`Completed in ${duration}ms`);
  })
  .onFailure((ctx, error, duration) => {
    notifySlack(`Task failed: ${error.message}`);
  })
  .build()
```

## Scheduler API

```typescript
// Access scheduler from context
const scheduler = ctx.scheduler;

// Check status
scheduler.isRunning();

// Get tasks
const tasks = scheduler.getTasks();
const task = scheduler.getTask('cleanup-tokens');

// Manual execution
await scheduler.runTask('cleanup-tokens');

// Next run time
const nextRun = scheduler.getNextRun('cleanup-tokens');

// Execution history
const history = scheduler.getHistory('cleanup-tokens');
```

## Global Callbacks

```typescript
app.register(schedulerPlugin({
  timezone: 'UTC',
  tasks: [...],
  onTaskStart: (task, ctx) => {
    console.log(`Starting: ${task.name}`);
  },
  onTaskComplete: (task, ctx, duration) => {
    metrics.recordTaskDuration(task.name, duration);
  },
  onTaskError: (task, ctx, error, duration) => {
    errorTracker.capture(error, { task: task.name });
  },
  onTaskSkip: (task, ctx, reason) => {
    console.log(`Skipped ${task.name}: ${reason}`);
  },
}));
```

## Production Deployment

### Key Considerations

Unlike other ecosystem packages, the scheduler doesn't require external services like Redis. However, production deployments need special attention:

### 1. Run on Single Instance Only

Scheduled tasks should only run on ONE server instance to prevent duplicate execution:

```typescript
task('send-reports', sendReports)
  .daily()
  .at('09:00')
  .when(() => process.env.SCHEDULER_ENABLED === 'true')
  .build()
```

Set `SCHEDULER_ENABLED=true` only on one instance.

### 2. Use `withoutOverlapping()` for Long Tasks

Prevent task overlap if execution might exceed the schedule interval:

```typescript
task('sync-inventory', syncInventory)
  .everyFiveMinutes()
  .withoutOverlapping(10)  // Lock for max 10 minutes
  .build()
```

### 3. Graceful Shutdown

Allow running tasks to complete before shutdown:

```typescript
const app = createApp();

app.register(schedulerPlugin({ tasks: [...] }));

// Graceful shutdown
process.on('SIGTERM', async () => {
  await app.close();  // Waits for scheduler to stop
  process.exit(0);
});
```

### 4. Monitor Task Execution

```typescript
app.register(schedulerPlugin({
  tasks: [...],
  onTaskError: (task, ctx, error) => {
    // Send to error tracking (Sentry, etc.)
    Sentry.captureException(error, {
      tags: { task: task.name },
    });
  },
  onTaskComplete: (task, ctx, duration) => {
    // Send to metrics (Datadog, etc.)
    metrics.timing(`scheduler.${task.name}`, duration);
  },
}));
```

### Production Checklist

1. **Single instance** - Only enable scheduler on one server
2. **Graceful shutdown** - Handle SIGTERM properly
3. **Error monitoring** - Track task failures
4. **Overlap prevention** - Use `withoutOverlapping()` for long tasks
5. **Timezone** - Set explicit timezone for predictable execution

### Environment Variables

```bash
# .env
SCHEDULER_ENABLED=true        # Only set on scheduler instance
SCHEDULER_TIMEZONE=UTC        # Default timezone
```

### Running as Separate Process

For better isolation, run scheduler as a separate process:

```typescript
// scheduler.ts
import { createScheduler, task } from '@veloxts/scheduler';

const scheduler = createScheduler({
  timezone: process.env.SCHEDULER_TIMEZONE || 'UTC',
  tasks: [
    task('cleanup', cleanup).daily().at('02:00').build(),
    task('reports', sendReports).weekdays().at('09:00').build(),
  ],
});

scheduler.start();

process.on('SIGTERM', async () => {
  await scheduler.stop();
  process.exit(0);
});
```

```bash
# Run as separate process
node scheduler.js
```

## Standalone Usage

Use scheduler outside of Fastify context:

```typescript
import { createScheduler, task } from '@veloxts/scheduler';

const scheduler = createScheduler({
  timezone: 'UTC',
  tasks: [
    task('my-task', () => console.log('Running!'))
      .everyMinute()
      .build(),
  ],
});

scheduler.start();

// Later...
await scheduler.stop();
```
