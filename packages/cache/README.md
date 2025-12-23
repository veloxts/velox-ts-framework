# @veloxts/cache

Multi-driver caching layer for VeloxTS framework.

## Installation

```bash
pnpm add @veloxts/cache
```

## Quick Start

```typescript
import { cachePlugin } from '@veloxts/cache';

app.use(cachePlugin({
  driver: 'memory', // or 'redis'
}));
```

See [GUIDE.md](./GUIDE.md) for detailed documentation.
