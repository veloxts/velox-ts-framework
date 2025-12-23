# @veloxts/cache Guide

Multi-driver caching layer for VeloxTS framework with support for memory (LRU), Redis, cache tags, and distributed locks.

## Installation

```bash
pnpm add @veloxts/cache

# For Redis support (optional)
pnpm add ioredis
```

## Plugin Registration

```typescript
import { createApp } from '@veloxts/core';
import { cachePlugin } from '@veloxts/cache';

const app = createApp();

// Memory cache (development)
app.use(cachePlugin({
  driver: 'memory',
  config: { maxSize: 1000 },
}));

// Redis cache (production)
app.use(cachePlugin({
  driver: 'redis',
  config: { url: process.env.REDIS_URL },
}));
```

## Basic Usage

```typescript
// Store a value
await ctx.cache.put('user:123', { name: 'John' }, '30m');

// Get a value
const user = await ctx.cache.get('user:123');

// Check existence
if (await ctx.cache.has('user:123')) { ... }

// Delete a value
await ctx.cache.forget('user:123');
```

## Remember Pattern

Cache-aside pattern that fetches from cache or computes and stores:

```typescript
const user = await ctx.cache.remember('user:123', '1h', async () => {
  return await ctx.db.user.findUnique({ where: { id: '123' } });
});
```

## TTL Formats

```typescript
await ctx.cache.put('key', value, '30s');  // 30 seconds
await ctx.cache.put('key', value, '5m');   // 5 minutes
await ctx.cache.put('key', value, '1h');   // 1 hour
await ctx.cache.put('key', value, '1d');   // 1 day
await ctx.cache.put('key', value, '1w');   // 1 week
await ctx.cache.put('key', value, 3600);   // 3600 seconds
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

Prevent concurrent execution across instances:

```typescript
await ctx.cache.lockAndRun('payment:process', '30s', async () => {
  // Only one process can run this at a time
  await processPayment();
});
```

## Atomic Operations

```typescript
await ctx.cache.increment('views:post:123');
await ctx.cache.decrement('stock:item:456');
```

## Drivers

| Driver | Backend | Use Case |
|--------|---------|----------|
| `memory` | lru-cache | Development, single instance |
| `redis` | ioredis | Production, multi-instance |
