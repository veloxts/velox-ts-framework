# @veloxts/storage Guide

File storage abstraction for VeloxTS applications with support for local filesystem and S3-compatible storage (AWS S3, Cloudflare R2, MinIO).

## Installation

```bash
pnpm add @veloxts/storage

# For S3/R2 (production)
pnpm add @aws-sdk/client-s3 @aws-sdk/lib-storage @aws-sdk/s3-request-presigner
```

## Quick Start

### Development (Local)

```typescript
import { velox } from '@veloxts/core';
import { storagePlugin } from '@veloxts/storage';

const app = velox();

app.register(storagePlugin({
  driver: 'local',
  config: {
    root: './storage',
    baseUrl: 'http://localhost:3030/files',
  },
}));

await app.start();
```

### Production (AWS S3)

```typescript
import { velox } from '@veloxts/core';
import { storagePlugin } from '@veloxts/storage';

const app = velox();

app.register(storagePlugin({
  driver: 's3',
  config: {
    bucket: process.env.S3_BUCKET,
    region: process.env.S3_REGION,
    // Uses AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY from env
  },
}));

await app.start();
```

### Production (Cloudflare R2)

```typescript
app.register(storagePlugin({
  driver: 's3',
  config: {
    bucket: process.env.R2_BUCKET,
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
}));
```

**Environment Variables:**

```bash
# .env (AWS S3)
S3_BUCKET=my-bucket
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# .env (Cloudflare R2)
R2_BUCKET=my-bucket
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
```

## Basic Operations

```typescript
// Upload a file
await ctx.storage.put('avatars/user-123.jpg', buffer, {
  contentType: 'image/jpeg',
  visibility: 'public',
});

// Upload from stream (for large files)
await ctx.storage.put('videos/large.mp4', readableStream);

// Download a file
const content = await ctx.storage.get('documents/report.pdf');

// Stream a file (memory-efficient)
const stream = await ctx.storage.stream('videos/large.mp4');

// Check if file exists
if (await ctx.storage.exists('avatars/user-123.jpg')) { ... }

// Delete a file
await ctx.storage.delete('temp/upload.tmp');

// Delete multiple files
await ctx.storage.deleteMany(['temp/a.txt', 'temp/b.txt']);
```

## File URLs

```typescript
// Public URL (for public files)
const url = await ctx.storage.url('avatars/user-123.jpg');

// Signed URL (temporary access to private files)
const signedUrl = await ctx.storage.signedUrl('documents/private.pdf', {
  expiresIn: 3600, // 1 hour in seconds
});
```

## Copy and Move

```typescript
// Copy a file
await ctx.storage.copy('old/path.jpg', 'new/path.jpg');

// Move a file
await ctx.storage.move('temp/upload.jpg', 'permanent/file.jpg');
```

## File Metadata

```typescript
const meta = await ctx.storage.metadata('avatars/user-123.jpg');
// { path, size, lastModified, contentType }
```

## List Files

```typescript
// List files in a directory
const { files, cursor, hasMore } = await ctx.storage.list('uploads/', {
  recursive: false,
  limit: 100,
});

// Paginate through all files
let cursor;
do {
  const result = await ctx.storage.list('uploads/', { cursor });
  files.push(...result.files);
  cursor = result.cursor;
} while (result.hasMore);
```

## Visibility

```typescript
// Set visibility
await ctx.storage.setVisibility('file.jpg', 'public');  // or 'private'
```

## Production Deployment

### Choosing a Provider

| Provider | Best For |
|----------|----------|
| [Cloudflare R2](https://developers.cloudflare.com/r2/) | Zero egress fees, global edge |
| [AWS S3](https://aws.amazon.com/s3/) | Mature ecosystem, extensive features |
| [DigitalOcean Spaces](https://www.digitalocean.com/products/spaces) | Simple pricing, S3-compatible |
| [MinIO](https://min.io/) | Self-hosted, S3-compatible |

### Production Checklist

1. **Use S3-compatible storage** - Local filesystem doesn't scale
2. **Configure bucket policies** - Least privilege access
3. **Set proper CORS** - For direct browser uploads
4. **Use signed URLs for private files** - Time-limited access
5. **Enable versioning** - For critical files (optional)

### Complete S3 Configuration

```typescript
app.register(storagePlugin({
  driver: 's3',
  config: {
    bucket: process.env.S3_BUCKET,
    region: process.env.S3_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,

    // Optional settings
    endpoint: process.env.S3_ENDPOINT,      // For R2, MinIO, etc.
    forcePathStyle: false,                   // true for MinIO
    defaultVisibility: 'private',
  },
}));
```

### Serving Files in Production

For public files, use a CDN in front of your storage:

```typescript
app.register(storagePlugin({
  driver: 's3',
  config: {
    bucket: process.env.S3_BUCKET,
    region: process.env.S3_REGION,
    publicUrl: 'https://cdn.example.com',  // CDN URL
  },
}));
```

## Standalone Usage

Use storage outside of Fastify request context (CLI commands, background jobs):

```typescript
import { getStorage, closeStorage } from '@veloxts/storage';

// Get standalone storage instance
const storage = await getStorage({
  driver: 's3',
  config: {
    bucket: process.env.S3_BUCKET,
    region: process.env.S3_REGION,
  },
});

await storage.put('file.txt', Buffer.from('Hello'));
const content = await storage.get('file.txt');

// Clean up when done
await closeStorage();
```
