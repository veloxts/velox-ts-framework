# @veloxts/events Guide

Real-time event broadcasting for VeloxTS applications using WebSocket or Server-Sent Events (SSE).

## Installation

```bash
pnpm add @veloxts/events
```

## Quick Start

### Single Instance (Development)

```typescript
import { veloxApp } from '@veloxts/core';
import { eventsPlugin } from '@veloxts/events';

const app = veloxApp();

app.register(eventsPlugin({
  driver: 'ws',
  path: '/ws',
}));

await app.start();
```

### Multiple Instances (Production with Redis)

For horizontal scaling across multiple server instances, enable Redis pub/sub:

```typescript
import { veloxApp } from '@veloxts/core';
import { eventsPlugin } from '@veloxts/events';

const app = veloxApp();

app.register(eventsPlugin({
  driver: 'ws',
  path: '/ws',
  redis: process.env.REDIS_URL,
  authSecret: process.env.EVENTS_SECRET,
  authorizer: async (channel, request) => {
    if (channel.type === 'public') {
      return { authorized: true };
    }

    const user = request.user;
    if (!user) {
      return { authorized: false, error: 'Authentication required' };
    }

    if (channel.type === 'presence') {
      return {
        authorized: true,
        member: { id: user.id, info: { name: user.name } },
      };
    }

    return { authorized: true };
  },
}));

await app.start();
```

**Environment Variables:**

```bash
# .env
REDIS_URL=redis://localhost:6379
EVENTS_SECRET=your-32-char-secret-for-signing-tokens
```

## Drivers

### WebSocket Driver (Recommended)

Real-time bidirectional communication. Supports Redis pub/sub for horizontal scaling.

```typescript
app.register(eventsPlugin({
  driver: 'ws',
  path: '/ws',
  redis: process.env.REDIS_URL,     // Optional: for horizontal scaling
  authSecret: process.env.EVENTS_SECRET,  // Required for private/presence channels
  pingInterval: 30000,               // Keep-alive interval (default: 30s)
  maxPayloadSize: 1048576,           // Max message size (default: 1MB)
}));
```

### SSE Driver (Fallback)

Unidirectional server-to-client streaming. Use when WebSocket isn't available.

```typescript
app.register(eventsPlugin({
  driver: 'sse',
  path: '/events',
  heartbeatInterval: 15000,  // Keep-alive interval (default: 15s)
  retryInterval: 3000,       // Client reconnect delay (default: 3s)
}));
```

## Broadcasting Events

### In Procedures

```typescript
import { procedure, procedures } from '@veloxts/router';
import { z } from 'zod';

export const orderProcedures = procedures('orders', {
  createOrder: procedure()
    .input(z.object({ productId: z.string(), quantity: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const order = await ctx.db.order.create({ data: input });

      // Broadcast to public channel
      await ctx.events.broadcast('orders', 'order.created', {
        orderId: order.id,
        total: order.total,
      });

      // Broadcast to user's private channel
      await ctx.events.broadcast(
        `private-user.${ctx.user.id}`,
        'order.confirmed',
        order
      );

      return order;
    }),
});
```

### Broadcasting Methods

```typescript
// Basic broadcast
await ctx.events.broadcast('channel', 'event-name', { data: 'value' });

// Broadcast to multiple channels
await ctx.events.broadcastToMany(
  ['user.1', 'user.2', 'user.3'],
  'notification',
  { message: 'System maintenance scheduled' }
);

// Broadcast to all except sender (e.g., chat messages)
await ctx.events.broadcastExcept(
  'chat.room-1',
  'message.sent',
  { text: 'Hello!' },
  senderSocketId
);
```

## Channel Types

### Public Channels

Anyone can subscribe. No prefix required.

```typescript
// Server
await ctx.events.broadcast('announcements', 'new-feature', {
  title: 'Dark Mode Released!',
});

// Client
socket.send(JSON.stringify({
  type: 'subscribe',
  channel: 'announcements',
}));
```

### Private Channels

Require authentication. Prefix with `private-`.

```typescript
// Server - only authorized users receive
await ctx.events.broadcast('private-user.123', 'notification', {
  message: 'You have a new message',
});

// Client - subscription requires auth token
socket.send(JSON.stringify({
  type: 'subscribe',
  channel: 'private-user.123',
  auth: authToken,  // Obtained from /ws/auth endpoint
}));
```

### Presence Channels

Track who's online. Prefix with `presence-`.

```typescript
// Server
await ctx.events.broadcast('presence-chat.room-1', 'typing', {
  userId: '123',
  userName: 'Alice',
});

// Get who's online
const members = await ctx.events.presenceMembers('presence-chat.room-1');
// [{ id: '123', info: { name: 'Alice' } }, { id: '456', info: { name: 'Bob' } }]

// Client - receives member_added/member_removed automatically
socket.send(JSON.stringify({
  type: 'subscribe',
  channel: 'presence-chat.room-1',
  data: { id: 'user-123', name: 'Alice' },
  auth: authToken,
}));
```

## Channel Authorization

Configure the `authorizer` callback to control channel access:

```typescript
app.register(eventsPlugin({
  driver: 'ws',
  path: '/ws',
  authSecret: process.env.EVENTS_SECRET,
  authorizer: async (channel, request) => {
    // Public channels - allow all
    if (channel.type === 'public') {
      return { authorized: true };
    }

    // Get user from request (set by @veloxts/auth)
    const user = request.user;
    if (!user) {
      return { authorized: false, error: 'Not authenticated' };
    }

    // Private user channels - only owner can subscribe
    if (channel.name.startsWith('private-user.')) {
      const channelUserId = channel.name.replace('private-user.', '');
      if (channelUserId !== user.id) {
        return { authorized: false, error: 'Access denied' };
      }
    }

    // Presence channels - include member info
    if (channel.type === 'presence') {
      return {
        authorized: true,
        member: {
          id: user.id,
          info: { name: user.name, avatar: user.avatar },
        },
      };
    }

    return { authorized: true };
  },
}));
```

## Client Integration

### WebSocket Client (Browser)

```typescript
const socket = new WebSocket('ws://localhost:3030/ws');

// Connection established
socket.onopen = () => {
  console.log('Connected');

  // Subscribe to public channel
  socket.send(JSON.stringify({
    type: 'subscribe',
    channel: 'orders',
  }));
};

// Receive messages
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);

  switch (message.type) {
    case 'event':
      console.log(`${message.event}:`, message.data);
      break;
    case 'subscription_succeeded':
      console.log(`Subscribed to ${message.channel}`);
      break;
    case 'subscription_error':
      console.error(`Failed to subscribe: ${message.error}`);
      break;
  }
};

// Unsubscribe
socket.send(JSON.stringify({
  type: 'unsubscribe',
  channel: 'orders',
}));

// Handle reconnection
socket.onclose = () => {
  console.log('Disconnected, reconnecting...');
  setTimeout(() => reconnect(), 3000);
};
```

### Private Channel Authentication (Browser)

```typescript
async function subscribeToPrivateChannel(socket, channel) {
  // Get auth token from server
  const response = await fetch('/ws/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',  // Send session cookie
    body: JSON.stringify({
      socketId: socket.socketId,
      channel,
    }),
  });

  const { auth, channel_data } = await response.json();

  // Subscribe with auth
  socket.send(JSON.stringify({
    type: 'subscribe',
    channel,
    auth,
    channel_data,
  }));
}
```

### Presence Channel Events

```typescript
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.event === 'member_added') {
    console.log('User joined:', message.data);
    // { id: '123', info: { name: 'Alice' } }
  }

  if (message.event === 'member_removed') {
    console.log('User left:', message.data);
    // { id: '123' }
  }
};
```

## Server API

```typescript
// Get subscriber count
const count = await ctx.events.subscriberCount('orders');

// Check if channel has subscribers
const hasSubscribers = await ctx.events.hasSubscribers('orders');

// Get all active channels
const channels = await ctx.events.channels();

// Get presence members
const members = await ctx.events.presenceMembers('presence-chat.room-1');
```

## Scaling with Redis

For multi-instance deployments behind a load balancer:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Instance 1    │     │   Instance 2    │     │   Instance 3    │
│   WebSocket     │     │   WebSocket     │     │   WebSocket     │
│   Driver        │     │   Driver        │     │   Driver        │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │         Redis           │
                    │       (pub/sub)         │
                    └─────────────────────────┘
```

When you call `ctx.events.broadcast()`:
1. Event is sent to local WebSocket clients
2. Event is published to Redis
3. Other instances receive from Redis
4. Each instance delivers to its local clients

**Configuration:**

```typescript
app.register(eventsPlugin({
  driver: 'ws',
  path: '/ws',
  redis: process.env.REDIS_URL,  // e.g., "redis://localhost:6379"
}));
```

## Standalone Usage

Use events outside of Fastify request context (background jobs, CLI, scripts):

```typescript
import { getEvents, closeEvents } from '@veloxts/events';

// Get standalone instance
const events = await getEvents({
  driver: 'ws',
  redis: process.env.REDIS_URL,
});

// Broadcast from background job
await events.broadcast('jobs', 'job.completed', { jobId: '123' });

// Clean up on shutdown
await closeEvents();
```

## Testing

For integration tests with Redis pub/sub, use testcontainers:

```typescript
import { startRedisContainer } from '@veloxts/testing';
import { createWsDriver } from '@veloxts/events';

const redis = await startRedisContainer();

const driver = await createWsDriver({
  driver: 'ws',
  path: '/ws',
  redis: redis.url,
});

// Run tests...

await driver.close();
await redis.stop();
```
