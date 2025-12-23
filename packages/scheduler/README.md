# @veloxts/scheduler

> **Early Preview** - APIs may change before v1.0.

Cron-based task scheduling with a fluent API and overlap prevention.

## Installation

```bash
npm install @veloxts/scheduler
```

## Quick Start

```typescript
import { createScheduler, task } from '@veloxts/scheduler';

const scheduler = createScheduler([
  task('cleanup', () => db.token.deleteExpired())
    .daily()
    .at('02:00')
    .build(),

  task('digest', () => sendDailyDigest())
    .weekdays()
    .at('09:00')
    .build(),
]);

scheduler.start();
```

See [GUIDE.md](./GUIDE.md) for detailed documentation.

## License

MIT
