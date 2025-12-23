# @veloxts/events

> **Early Preview** - APIs may change before v1.0.

Real-time event broadcasting via WebSocket with optional Redis pub/sub for scaling.

## Installation

```bash
npm install @veloxts/events
```

## Quick Start

```typescript
import { eventsPlugin } from '@veloxts/events';

app.use(eventsPlugin({ driver: 'ws', path: '/ws' }));

// Broadcast an event
await ctx.broadcast({
  channel: 'orders.123',
  event: 'order.shipped',
  data: { trackingNumber: 'TRACK123' },
});
```

See [GUIDE.md](./GUIDE.md) for detailed documentation.

## License

MIT
