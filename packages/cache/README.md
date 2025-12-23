# @veloxts/cache

> **Early Preview** - APIs may change before v1.0.

Multi-driver caching with tags, locks, and the remember pattern.

## Installation

```bash
npm install @veloxts/cache
```

## Quick Start

```typescript
import { cachePlugin } from '@veloxts/cache';

app.use(cachePlugin({ driver: 'memory' }));

// In your procedures
const user = await ctx.cache.remember('user:123', '1h', async () => {
  return db.user.findUnique({ where: { id: '123' } });
});
```

See [GUIDE.md](./GUIDE.md) for detailed documentation.

## License

MIT
