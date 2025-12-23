/**
 * Storage Template
 *
 * Generates storage configuration and upload handler files for VeloxTS applications.
 */

import type { ProjectContext, TemplateContext, TemplateFunction } from '../types.js';

// ============================================================================
// Template Options
// ============================================================================

export interface StorageOptions {
  /** Generate local filesystem storage configuration */
  local: boolean;
  /** Generate S3/R2/MinIO storage configuration */
  s3: boolean;
  /** Generate file upload handler with storage */
  upload: boolean;
}

// ============================================================================
// Path Helpers
// ============================================================================

/**
 * Get the path for a storage configuration file
 */
export function getStoragePath(
  entityName: string,
  _project: ProjectContext,
  options: StorageOptions
): string {
  if (options.upload) {
    return `src/handlers/${entityName.toLowerCase()}-upload.ts`;
  }
  return `src/config/storage/${entityName.toLowerCase()}.ts`;
}

// ============================================================================
// Templates
// ============================================================================

/**
 * Generate local filesystem storage configuration
 */
function generateLocalStorage(ctx: TemplateContext<StorageOptions>): string {
  const { entity } = ctx;

  return `/**
 * ${entity.pascal} Storage Configuration (Local Filesystem)
 *
 * Local file storage configuration for ${entity.humanReadable}.
 */

import { createLocalStorageDriver } from '@veloxts/storage';
import { join } from 'node:path';

// ============================================================================
// Configuration
// ============================================================================

/**
 * ${entity.pascal} local storage driver
 *
 * Stores files in the local filesystem with organized directory structure.
 *
 * @example
 * \`\`\`typescript
 * import { ${entity.camel}Storage } from '@/config/storage/${entity.kebab}';
 *
 * // Store a file
 * const filePath = await ${entity.camel}Storage.put('avatar.jpg', buffer);
 *
 * // Retrieve a file
 * const fileBuffer = await ${entity.camel}Storage.get('avatar.jpg');
 *
 * // Delete a file
 * await ${entity.camel}Storage.delete('avatar.jpg');
 *
 * // Check if file exists
 * const exists = await ${entity.camel}Storage.exists('avatar.jpg');
 * \`\`\`
 */
export const ${entity.camel}Storage = createLocalStorageDriver({
  // Root directory for stored files
  root: join(process.cwd(), 'storage', '${entity.kebab}'),

  // Base URL for serving files (optional)
  baseUrl: process.env.STORAGE_BASE_URL ?? 'http://localhost:3030/storage/${entity.kebab}',

  // Disk visibility
  visibility: 'private', // 'public' | 'private'

  // File permissions (Unix-style, e.g., 0o644 for rw-r--r--)
  permissions: {
    file: 0o644,
    directory: 0o755,
  },

  // Optional: Organize files in subdirectories by date
  pathGenerator: (filename: string) => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return \`\${year}/\${month}/\${day}/\${filename}\`;
  },
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique filename with timestamp
 */
export function generateUniqueFilename(originalFilename: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = originalFilename.split('.').pop();
  const basename = originalFilename.replace(/\\.[^/.]+$/, '');
  const sanitized = basename.replace(/[^a-z0-9]/gi, '-').toLowerCase();

  return \`\${sanitized}-\${timestamp}-\${random}.\${ext}\`;
}

/**
 * Validate file type and size
 */
export function validate${entity.pascal}File(file: { mimetype: string; size: number }): {
  valid: boolean;
  error?: string;
} {
  // Allowed MIME types
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
  ];

  // Max file size (10MB)
  const maxSize = 10 * 1024 * 1024;

  if (!allowedTypes.includes(file.mimetype)) {
    return {
      valid: false,
      error: \`Invalid file type. Allowed: \${allowedTypes.join(', ')}\`,
    };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: \`File too large. Max size: \${maxSize / (1024 * 1024)}MB\`,
    };
  }

  return { valid: true };
}
`;
}

/**
 * Generate S3-compatible storage configuration
 */
function generateS3Storage(ctx: TemplateContext<StorageOptions>): string {
  const { entity } = ctx;

  return `/**
 * ${entity.pascal} Storage Configuration (S3/R2/MinIO)
 *
 * S3-compatible object storage configuration for ${entity.humanReadable}.
 */

import { createS3StorageDriver } from '@veloxts/storage';

// ============================================================================
// Configuration
// ============================================================================

/**
 * ${entity.pascal} S3 storage driver
 *
 * Stores files in S3-compatible object storage (AWS S3, Cloudflare R2, MinIO).
 *
 * @example
 * \`\`\`typescript
 * import { ${entity.camel}Storage } from '@/config/storage/${entity.kebab}';
 *
 * // Store a file
 * const fileUrl = await ${entity.camel}Storage.put('avatar.jpg', buffer, {
 *   metadata: { userId: '123' },
 *   contentType: 'image/jpeg',
 * });
 *
 * // Retrieve a file
 * const fileBuffer = await ${entity.camel}Storage.get('avatar.jpg');
 *
 * // Get a signed URL (temporary access to private file)
 * const signedUrl = await ${entity.camel}Storage.getSignedUrl('avatar.jpg', { expiresIn: 3600 });
 *
 * // Delete a file
 * await ${entity.camel}Storage.delete('avatar.jpg');
 * \`\`\`
 */
export const ${entity.camel}Storage = createS3StorageDriver({
  // S3 credentials
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },

  // Bucket configuration
  bucket: process.env.S3_BUCKET ?? '${entity.kebab}-files',
  region: process.env.S3_REGION ?? 'us-east-1',

  // Optional: Custom endpoint for R2/MinIO
  endpoint: process.env.S3_ENDPOINT, // e.g., 'https://[account-id].r2.cloudflarestorage.com'

  // Public URL base (for public files)
  baseUrl: process.env.S3_PUBLIC_URL, // e.g., 'https://cdn.example.com'

  // Default ACL for uploaded files
  acl: 'private', // 'public-read' | 'private' | 'authenticated-read'

  // Optional: Path prefix for all files
  pathPrefix: '${entity.kebab}/',

  // Cache control headers
  cacheControl: 'public, max-age=31536000', // 1 year for immutable files
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique S3 key with organized path structure
 */
export function generateS3Key(originalFilename: string, options?: { userId?: string }): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = originalFilename.split('.').pop();
  const basename = originalFilename.replace(/\\.[^/.]+$/, '');
  const sanitized = basename.replace(/[^a-z0-9]/gi, '-').toLowerCase();

  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  const userPath = options?.userId ? \`users/\${options.userId}/\` : '';
  return \`\${userPath}\${year}/\${month}/\${sanitized}-\${timestamp}-\${random}.\${ext}\`;
}

/**
 * Validate file for S3 upload
 */
export function validate${entity.pascal}File(file: { mimetype: string; size: number }): {
  valid: boolean;
  error?: string;
} {
  // Allowed MIME types
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'application/pdf',
    'video/mp4',
    'video/webm',
  ];

  // Max file size (50MB for S3)
  const maxSize = 50 * 1024 * 1024;

  if (!allowedTypes.includes(file.mimetype)) {
    return {
      valid: false,
      error: \`Invalid file type. Allowed: \${allowedTypes.join(', ')}\`,
    };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: \`File too large. Max size: \${maxSize / (1024 * 1024)}MB\`,
    };
  }

  return { valid: true };
}

/**
 * Get content type from file extension
 */
export function getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    mp4: 'video/mp4',
    webm: 'video/webm',
  };

  return mimeTypes[ext ?? ''] ?? 'application/octet-stream';
}
`;
}

/**
 * Generate file upload handler with storage integration
 */
function generateUploadHandler(ctx: TemplateContext<StorageOptions>): string {
  const { entity } = ctx;

  return `/**
 * ${entity.pascal} Upload Handler
 *
 * File upload endpoint with storage integration for ${entity.humanReadable}.
 */

import type { BaseContext } from '@veloxts/core';
import { procedure } from '@veloxts/router';
import { ${entity.camel}Storage, generateUniqueFilename, validate${entity.pascal}File } from '@/config/storage/${entity.kebab}';
import { z } from 'zod';

// ============================================================================
// Schema
// ============================================================================

const Upload${entity.pascal}Schema = z.object({
  // File metadata will be provided via multipart form data
  // Fastify @fastify/multipart plugin handles file parsing
});

const Upload${entity.pascal}ResponseSchema = z.object({
  success: z.boolean(),
  fileUrl: z.string().url(),
  filename: z.string(),
  size: z.number(),
  mimetype: z.string(),
});

export type Upload${entity.pascal}Response = z.infer<typeof Upload${entity.pascal}ResponseSchema>;

// ============================================================================
// Upload Handler
// ============================================================================

/**
 * Upload ${entity.humanReadable} file
 *
 * Handles multipart file uploads with validation and storage.
 *
 * @example
 * \`\`\`typescript
 * // Client-side (with fetch)
 * const formData = new FormData();
 * formData.append('file', fileInput.files[0]);
 *
 * const response = await fetch('/api/${entity.kebab}/upload', {
 *   method: 'POST',
 *   body: formData,
 * });
 *
 * const result = await response.json();
 * console.log('File uploaded:', result.fileUrl);
 * \`\`\`
 */
export const upload${entity.pascal} = procedure
  .input(Upload${entity.pascal}Schema)
  .output(Upload${entity.pascal}ResponseSchema)
  .mutation(async ({ ctx }: { ctx: BaseContext }) => {
    // Get multipart data from request
    const data = await ctx.request.file();

    if (!data) {
      throw new Error('No file uploaded');
    }

    // Validate file
    const validation = validate${entity.pascal}File({
      mimetype: data.mimetype,
      size: data.file.bytesRead,
    });

    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Generate unique filename
    const filename = generateUniqueFilename(data.filename);

    // Convert stream to buffer
    const buffer = await data.toBuffer();

    // Store file
    const filePath = await ${entity.camel}Storage.put(filename, buffer);

    // Get public URL (if storage is configured for public access)
    const fileUrl = await ${entity.camel}Storage.url(filePath);

    // TODO: Save file metadata to database
    // Example:
    // await ctx.db.${entity.camel}File.create({
    //   data: {
    //     filename,
    //     path: filePath,
    //     url: fileUrl,
    //     mimetype: data.mimetype,
    //     size: buffer.length,
    //     userId: ctx.user?.id,
    //   },
    // });

    return {
      success: true,
      fileUrl,
      filename,
      size: buffer.length,
      mimetype: data.mimetype,
    };
  });

// ============================================================================
// Delete Handler
// ============================================================================

const Delete${entity.pascal}Schema = z.object({
  filename: z.string(),
});

/**
 * Delete ${entity.humanReadable} file
 */
export const delete${entity.pascal} = procedure
  .input(Delete${entity.pascal}Schema)
  .output(z.object({ success: z.boolean() }))
  .mutation(async ({ input }) => {
    // TODO: Verify user owns this file or has permission to delete
    // const file = await ctx.db.${entity.camel}File.findUnique({
    //   where: { filename: input.filename },
    // });
    //
    // if (!file || file.userId !== ctx.user?.id) {
    //   throw new Error('File not found or unauthorized');
    // }

    await ${entity.camel}Storage.delete(input.filename);

    // TODO: Delete from database
    // await ctx.db.${entity.camel}File.delete({
    //   where: { filename: input.filename },
    // });

    return { success: true };
  });

// ============================================================================
// Download Handler
// ============================================================================

const Download${entity.pascal}Schema = z.object({
  filename: z.string(),
});

/**
 * Download ${entity.humanReadable} file
 *
 * Returns a temporary signed URL for secure file access.
 */
export const download${entity.pascal} = procedure
  .input(Download${entity.pascal}Schema)
  .output(z.object({ downloadUrl: z.string().url() }))
  .query(async ({ input }) => {
    // TODO: Verify user has access to this file
    // const file = await ctx.db.${entity.camel}File.findUnique({
    //   where: { filename: input.filename },
    // });
    //
    // if (!file) {
    //   throw new Error('File not found');
    // }

    // Check if file exists
    const exists = await ${entity.camel}Storage.exists(input.filename);
    if (!exists) {
      throw new Error('File not found in storage');
    }

    // Generate signed URL (expires in 1 hour)
    const downloadUrl = await ${entity.camel}Storage.getSignedUrl(input.filename, {
      expiresIn: 3600,
    });

    return { downloadUrl };
  });
`;
}

// ============================================================================
// Main Template
// ============================================================================

/**
 * Storage template function
 */
export const storageTemplate: TemplateFunction<StorageOptions> = (ctx) => {
  if (ctx.options.upload) {
    return generateUploadHandler(ctx);
  }
  if (ctx.options.s3) {
    return generateS3Storage(ctx);
  }
  // Default to local storage
  return generateLocalStorage(ctx);
};

// ============================================================================
// Post-generation Instructions
// ============================================================================

export function getStorageInstructions(entityName: string, options: StorageOptions): string {
  const lines = [];

  if (options.upload) {
    lines.push(`Your ${entityName} upload handler has been created.`, '', 'Next steps:');
    lines.push('  1. Register @fastify/multipart plugin in your app:');
    lines.push('');
    lines.push("     import multipart from '@fastify/multipart';");
    lines.push('     await app.register(multipart);');
    lines.push('');
    lines.push('  2. Create the storage configuration file:');
    lines.push(`     velox make storage ${entityName} --local  # or --s3`);
    lines.push('');
    lines.push('  3. Register upload procedures in your router');
    lines.push('  4. Optional: Create a Prisma model for file metadata');
  } else if (options.s3) {
    lines.push(`Your ${entityName} S3 storage configuration has been created.`, '', 'Next steps:');
    lines.push('  1. Add environment variables to .env:');
    lines.push('');
    lines.push('     S3_ACCESS_KEY_ID=your-access-key');
    lines.push('     S3_SECRET_ACCESS_KEY=your-secret-key');
    lines.push(`     S3_BUCKET=${entityName}-files`);
    lines.push('     S3_REGION=us-east-1');
    lines.push('     # Optional for R2/MinIO:');
    lines.push('     # S3_ENDPOINT=https://[account-id].r2.cloudflarestorage.com');
    lines.push('     # S3_PUBLIC_URL=https://cdn.example.com');
    lines.push('');
    lines.push('  2. Install AWS SDK dependencies:');
    lines.push('');
    lines.push('     pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner');
    lines.push('');
    lines.push('  3. Import and use the storage driver in your procedures');
  } else {
    lines.push(
      `Your ${entityName} local storage configuration has been created.`,
      '',
      'Next steps:'
    );
    lines.push('  1. Ensure the storage directory exists:');
    lines.push('');
    lines.push(`     mkdir -p storage/${entityName.toLowerCase()}`);
    lines.push('');
    lines.push('  2. Add storage directory to .gitignore:');
    lines.push('');
    lines.push('     echo "storage/" >> .gitignore');
    lines.push('');
    lines.push('  3. Configure file serving in your app (for public access):');
    lines.push('');
    lines.push("     import fastifyStatic from '@fastify/static';");
    lines.push("     import { join } from 'node:path';");
    lines.push('');
    lines.push('     await app.register(fastifyStatic, {');
    lines.push("       root: join(process.cwd(), 'storage'),");
    lines.push("       prefix: '/storage/',");
    lines.push('     });');
    lines.push('');
    lines.push('  4. Import and use the storage driver in your procedures');
  }

  return lines.join('\n');
}
