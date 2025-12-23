# @veloxts/queue

> **Early Preview** - APIs may change before v1.0.

Background job processing with type-safe job definitions and multiple drivers.

## Installation

```bash
npm install @veloxts/queue
```

## Quick Start

```typescript
import { queuePlugin, defineJob } from '@veloxts/queue';

app.use(queuePlugin({ driver: 'sync' }));

const sendEmail = defineJob({
  name: 'email.send',
  handler: async ({ data }) => {
    await mailer.send(data.to, data.subject, data.body);
  },
});

// Dispatch a job
await ctx.queue.dispatch(sendEmail, { to: 'user@example.com', subject: 'Hello' });
```

See [GUIDE.md](./GUIDE.md) for detailed documentation.

## License

MIT
