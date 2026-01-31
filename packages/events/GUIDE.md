# @veloxts/events Guide

## Drivers

### WebSocket Driver

Real-time broadcasting via WebSocket. Supports Redis pub/sub for horizontal scaling.

```typescript
import { eventsPlugin } from '@veloxts/events';

// Basic setup (single instance)
app.use(eventsPlugin({
  driver: 'ws',
  config: {
    path: '/ws',
    pingInterval: 30000,
  },
}));

// With Redis for horizontal scaling
app.use(eventsPlugin({
  driver: 'ws',
  config: {
    path: '/ws',
    redis: process.env.REDIS_URL,
  },
}));
```

## Broadcasting Events

```typescript
// Broadcast to a channel
await ctx.broadcast({
  channel: 'orders.123',
  event: 'order.shipped',
  data: { trackingNumber: 'TRACK123' },
});

// Broadcast to all except sender
await ctx.broadcast({
  channel: 'chat.room-1',
  event: 'message',
  data: { text: 'Hello!' },
  except: ctx.socketId,  // Exclude sender
});
```

## Channel Types

### Public Channels

Anyone can subscribe.

```typescript
// Server
await ctx.broadcast({
  channel: 'announcements',
  event: 'new-feature',
  data: { title: 'New Feature!' },
});

// Client
socket.subscribe('announcements');
```

### Private Channels

Require authorization. Prefix with `private-`.

```typescript
// Server - requires authorization middleware
await ctx.broadcast({
  channel: 'private-user.123',
  event: 'notification',
  data: { message: 'You have a new message' },
});
```

### Presence Channels

Track who's online. Prefix with `presence-`.

```typescript
// Server
await ctx.broadcast({
  channel: 'presence-chat.room-1',
  event: 'typing',
  data: { userId: '123' },
});

// Client receives member_added/member_removed events automatically
```

## Client Integration

### Browser Client

```typescript
const socket = new WebSocket('ws://localhost:3030/ws');

socket.onopen = () => {
  // Subscribe to channel
  socket.send(JSON.stringify({
    type: 'subscribe',
    channel: 'orders.123',
  }));
};

socket.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'event') {
    console.log(`${message.event}:`, message.data);
  }
};

// Unsubscribe
socket.send(JSON.stringify({
  type: 'unsubscribe',
  channel: 'orders.123',
}));
```

### Presence Channels (Client)

```typescript
// Join with user info
socket.send(JSON.stringify({
  type: 'subscribe',
  channel: 'presence-chat.room-1',
  data: { id: '123', name: 'John' },
}));

// Handle presence events
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.event === 'member_added') {
    console.log('User joined:', message.data);
  }
  if (message.event === 'member_removed') {
    console.log('User left:', message.data);
  }
};
```

## Server API

```typescript
// Get subscribers for a channel
const subscribers = await ctx.events.getSubscribers('orders.123');

// Get presence members
const members = await ctx.events.getPresenceMembers('presence-chat.room-1');

// Get connection count
const count = await ctx.events.getConnectionCount('orders.123');

// Get all active channels
const channels = await ctx.events.getChannels();
```

## HTTP Upgrade (Manual Setup)

If not using the plugin, handle WebSocket upgrade manually:

```typescript
import { createWsDriver } from '@veloxts/events';

const events = await createWsDriver({ path: '/ws' });

// In your HTTP server
server.on('upgrade', (request, socket, head) => {
  if (request.url === '/ws') {
    events.handleUpgrade(request, socket, head);
  }
});
```

## Scaling with Redis

For multi-instance deployments, events are broadcast via Redis pub/sub:

```typescript
app.use(eventsPlugin({
  driver: 'ws',
  config: {
    path: '/ws',
    redis: process.env.REDIS_URL,
  },
}));
```

All instances subscribe to a shared Redis channel. When you broadcast:
1. Event is sent to local WebSocket clients
2. Event is published to Redis
3. Other instances receive from Redis and broadcast to their clients

## Standalone Usage

Use events outside of Fastify request context (background jobs, scripts):

```typescript
import { getEvents, closeEvents } from '@veloxts/events';

// Get standalone events instance
const events = await getEvents({ driver: 'ws' });

await events.broadcast('channel', 'event', { data: 'value' });

// Clean up when done
await closeEvents();
```
