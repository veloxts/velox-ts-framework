# @veloxts/cache Guide

Multi-driver caching for VeloxTS applications with support for memory (LRU) and Redis, cache tags, and distributed locks.

## Installation

```bash
pnpm add @veloxts/cache

# For Redis (production)
pnpm add ioredis
```

## Quick Start

### Development (Memory)

```typescript
import { createApp } from '@veloxts/core';
import { cachePlugin } from '@veloxts/cache';

const app = createApp();

app.register(cachePlugin({
  driver: 'memory',
  config: { maxSize: 1000 },
}));

await app.start();
```

### Production (Redis)

```typescript
import { createApp } from '@veloxts/core';
import { cachePlugin } from '@veloxts/cache';

const app = createApp();

app.register(cachePlugin({
  driver: 'redis',
  config: {
    url: process.env.REDIS_URL,
  },
}));

await app.start();
```

**Environment Variables:**

```bash
# .env
REDIS_URL=redis://user:password@your-redis-host:6379
```

## Basic Usage

```typescript
// Store a value with TTL
await ctx.cache.put('user:123', { name: 'John' }, '30m');

// Get a value
const user = await ctx.cache.get('user:123');

// Check existence
if (await ctx.cache.has('user:123')) { ... }

// Delete a value
await ctx.cache.forget('user:123');

// Delete multiple values
await ctx.cache.forgetMany(['user:123', 'user:456']);
```

## Remember Pattern

Cache-aside pattern that fetches from cache or computes and stores:

```typescript
const user = await ctx.cache.remember('user:123', '1h', async () => {
  return await ctx.db.user.findUniqueOrThrow({ where: { id: '123' } });
});
```

## TTL Formats

```typescript
await ctx.cache.put('key', value, '30s');  // 30 seconds
await ctx.cache.put('key', value, '5m');   // 5 minutes
await ctx.cache.put('key', value, '1h');   // 1 hour
await ctx.cache.put('key', value, '1d');   // 1 day
await ctx.cache.put('key', value, '1w');   // 1 week
await ctx.cache.put('key', value, 3600);   // 3600 seconds (number)
```

## Cache Tags

Group cache entries for bulk invalidation:

```typescript
// Store with tags
await ctx.cache.tags(['users', 'active']).put('user:123', user);
await ctx.cache.tags(['users', 'active']).put('user:456', user2);

// Invalidate all entries with 'users' tag
await ctx.cache.tags(['users']).flush();
```

## Distributed Locks

Prevent concurrent execution across instances (Redis only):

```typescript
await ctx.cache.lockAndRun('payment:process', '30s', async () => {
  // Only one process can run this at a time
  await processPayment();
});
```

## Atomic Operations

```typescript
await ctx.cache.increment('views:post:123');
await ctx.cache.increment('views:post:123', 5);  // Increment by 5
await ctx.cache.decrement('stock:item:456');
```

## Drivers

| Driver | Backend | Use Case |
|--------|---------|----------|
| `memory` | lru-cache | Development, single instance |
| `redis` | ioredis | Production, multi-instance |

### Memory Driver Options

```typescript
app.register(cachePlugin({
  driver: 'memory',
  config: {
    maxSize: 1000,      // Max entries
    defaultTtl: '1h',   // Default TTL
  },
}));
```

### Redis Driver Options

```typescript
app.register(cachePlugin({
  driver: 'redis',
  config: {
    url: process.env.REDIS_URL,
    keyPrefix: 'myapp:cache:',  // Optional prefix
    defaultTtl: '1h',           // Default TTL
  },
}));
```

## Production Deployment

**Why Redis for production:**
- Shared cache across multiple server instances
- Cache persists across deployments
- Distributed locks work across instances
- Better memory management than in-process cache

**Recommended Redis providers:**
- [Upstash](https://upstash.com) - Serverless, pay-per-request
- [Redis Cloud](https://redis.com/cloud) - Managed Redis
- [Railway](https://railway.app) - Simple Redis add-on

## Standalone Usage

Use cache outside of Fastify request context (CLI commands, background jobs):

```typescript
import { getCache, closeCache } from '@veloxts/cache';

// Get standalone cache instance
const cache = await getCache({
  driver: 'redis',
  config: { url: process.env.REDIS_URL },
});

await cache.put('key', 'value', '1h');
const value = await cache.get('key');

// Clean up when done
await closeCache();
```
