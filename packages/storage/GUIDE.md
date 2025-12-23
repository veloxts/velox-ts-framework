# @veloxts/storage Guide

## Drivers

### Local Driver (default)

Store files on the local filesystem.

```typescript
import { storagePlugin } from '@veloxts/storage';

app.use(storagePlugin({
  driver: 'local',
  config: {
    root: './storage',
    baseUrl: 'http://localhost:3030/files',
  },
}));
```

### S3 Driver

S3-compatible storage (AWS S3, Cloudflare R2, MinIO, DigitalOcean Spaces).

```bash
npm install @aws-sdk/client-s3 @aws-sdk/lib-storage @aws-sdk/s3-request-presigner
```

```typescript
// AWS S3
app.use(storagePlugin({
  driver: 's3',
  config: {
    bucket: process.env.S3_BUCKET,
    region: 'us-east-1',
  },
}));

// Cloudflare R2
app.use(storagePlugin({
  driver: 's3',
  config: {
    bucket: process.env.R2_BUCKET,
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
}));

// MinIO (local S3)
app.use(storagePlugin({
  driver: 's3',
  config: {
    bucket: 'my-bucket',
    region: 'us-east-1',
    endpoint: 'http://localhost:9000',
    forcePathStyle: true,
    accessKeyId: 'minioadmin',
    secretAccessKey: 'minioadmin',
  },
}));
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

// Stream a file (memory-efficient for large files)
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
  expiresIn: 3600, // 1 hour
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
