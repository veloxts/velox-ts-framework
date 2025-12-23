# @veloxts/storage

> **Early Preview** - APIs may change before v1.0.

File storage abstraction with local filesystem and S3-compatible drivers.

## Installation

```bash
npm install @veloxts/storage
```

## Quick Start

```typescript
import { storagePlugin } from '@veloxts/storage';

app.use(storagePlugin({ driver: 'local', root: './storage' }));

// Upload a file
await ctx.storage.put('avatars/user-123.jpg', buffer, { visibility: 'public' });

// Get public URL
const url = await ctx.storage.url('avatars/user-123.jpg');
```

See [GUIDE.md](./GUIDE.md) for detailed documentation.

## License

MIT
