# @veloxts/scheduler Guide

## Creating a Scheduler

```typescript
import { createScheduler, task } from '@veloxts/scheduler';

const scheduler = createScheduler([
  task('cleanup-tokens', async () => {
    await db.token.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  })
    .daily()
    .at('02:00')
    .build(),

  task('send-digest', async () => {
    await sendDailyDigest();
  })
    .weekdays()
    .at('09:00')
    .timezone('America/New_York')
    .build(),
], {
  timezone: 'UTC',
  debug: true,
});

scheduler.start();
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
task('name', handler)
  .daily()
  .at('09:00')
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

## Running the Scheduler

### In Your App

```typescript
// Start with your app
const scheduler = createScheduler(tasks);
scheduler.start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await scheduler.stop();
  process.exit(0);
});
```

### From System Cron

Add to your crontab to run every minute:

```bash
* * * * * cd /path/to/app && node scheduler.js >> /dev/null 2>&1
```

## Scheduler API

```typescript
// Start/stop
scheduler.start();
await scheduler.stop();

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

## Callbacks

```typescript
const scheduler = createScheduler(tasks, {
  timezone: 'UTC',
  debug: false,
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
});
```
