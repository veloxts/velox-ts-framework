/**
 * Storage Utilities
 *
 * Helper functions for file storage operations.
 */

import { lookup } from 'mime-types';

/**
 * Normalize a file path by removing leading/trailing slashes and collapsing multiple slashes.
 */
export function normalizePath(path: string): string {
  return path
    .replace(/^\/+/, '') // Remove leading slashes
    .replace(/\/+$/, '') // Remove trailing slashes
    .replace(/\/+/g, '/'); // Collapse multiple slashes
}

/**
 * Join path segments together.
 */
export function joinPath(...segments: string[]): string {
  return normalizePath(segments.filter(Boolean).join('/'));
}

/**
 * Get the directory name from a path.
 */
export function dirname(path: string): string {
  const normalized = normalizePath(path);
  const lastSlash = normalized.lastIndexOf('/');
  return lastSlash === -1 ? '' : normalized.slice(0, lastSlash);
}

/**
 * Get the file name from a path.
 */
export function basename(path: string): string {
  const normalized = normalizePath(path);
  const lastSlash = normalized.lastIndexOf('/');
  return lastSlash === -1 ? normalized : normalized.slice(lastSlash + 1);
}

/**
 * Get the file extension from a path (without the dot).
 */
export function extname(path: string): string {
  const name = basename(path);
  const lastDot = name.lastIndexOf('.');
  return lastDot === -1 || lastDot === 0 ? '' : name.slice(lastDot + 1);
}

/**
 * Detect MIME type from file path.
 */
export function detectMimeType(path: string): string {
  const mimeType = lookup(path);
  return mimeType || 'application/octet-stream';
}

/**
 * Convert content to Buffer.
 */
export function toBuffer(content: Buffer | string): Buffer {
  if (Buffer.isBuffer(content)) {
    return content;
  }
  return Buffer.from(content, 'utf-8');
}

/**
 * Check if content is a readable stream.
 */
export function isReadableStream(content: unknown): content is NodeJS.ReadableStream {
  return (
    content !== null &&
    typeof content === 'object' &&
    'pipe' in content &&
    typeof (content as NodeJS.ReadableStream).pipe === 'function'
  );
}

/**
 * Convert a readable stream to a Buffer.
 */
export async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

/**
 * Format bytes to human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;

  return `${value.toFixed(exponent === 0 ? 0 : 2)} ${units[exponent]}`;
}

/**
 * Validate a file path doesn't contain dangerous patterns.
 */
export function validatePath(path: string): void {
  const normalized = normalizePath(path);

  // Check for path traversal
  if (normalized.includes('..')) {
    throw new Error(`Invalid path: path traversal detected in "${path}"`);
  }

  // Check for null bytes
  if (normalized.includes('\0')) {
    throw new Error(`Invalid path: null byte detected in "${path}"`);
  }

  // Check for empty path
  if (normalized.length === 0) {
    throw new Error('Invalid path: path cannot be empty');
  }
}

/**
 * Generate a unique file name with timestamp.
 */
export function uniqueFileName(originalName: string): string {
  const ext = extname(originalName);
  const name = basename(originalName);
  // Remove extension from name (including the dot)
  const base = ext ? name.slice(0, -(ext.length + 1)) : name;
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);

  return ext ? `${base}-${timestamp}-${random}.${ext}` : `${base}-${timestamp}-${random}`;
}
