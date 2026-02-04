/**
 * Tests for signedUploadUrl() method
 */

import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createLocalStore } from '../drivers/local.js';
import type { StorageStore } from '../types.js';

const TEST_ROOT = join(process.cwd(), '.test-storage-signed-upload');

describe('signedUploadUrl() method', () => {
  let store: StorageStore;

  beforeAll(async () => {
    await mkdir(TEST_ROOT, { recursive: true });
  });

  afterAll(async () => {
    await rm(TEST_ROOT, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await rm(TEST_ROOT, { recursive: true, force: true });
    await mkdir(TEST_ROOT, { recursive: true });

    store = createLocalStore({
      driver: 'local',
      root: TEST_ROOT,
      baseUrl: 'http://localhost:3030/files',
      defaultVisibility: 'private',
    });
  });

  it('should return a URL string', async () => {
    const url = await store.signedUploadUrl({
      key: 'uploads/new-file.txt',
      contentType: 'text/plain',
    });

    expect(typeof url).toBe('string');
    expect(url.length).toBeGreaterThan(0);
  });

  it('should include the key in the URL path', async () => {
    const url = await store.signedUploadUrl({
      key: 'uploads/image.jpg',
      contentType: 'image/jpeg',
    });

    expect(url).toContain('uploads/image.jpg');
  });

  it('should accept expiresIn option', async () => {
    const url = await store.signedUploadUrl({
      key: 'uploads/file.txt',
      contentType: 'text/plain',
      expiresIn: 300, // 5 minutes
    });

    expect(typeof url).toBe('string');
    // Local storage doesn't actually use expiresIn, but it should accept it
  });

  it('should accept maxContentLength option', async () => {
    const url = await store.signedUploadUrl({
      key: 'uploads/file.txt',
      contentType: 'text/plain',
      maxContentLength: 10 * 1024 * 1024, // 10MB
    });

    expect(typeof url).toBe('string');
    // Local storage doesn't enforce maxContentLength, but it should accept it
  });

  it('should handle nested paths', async () => {
    const url = await store.signedUploadUrl({
      key: 'a/b/c/deep-file.txt',
      contentType: 'text/plain',
    });

    expect(url).toContain('a/b/c/deep-file.txt');
  });

  it('should work without contentType (optional)', async () => {
    const url = await store.signedUploadUrl({
      key: 'uploads/unknown-type-file',
    });

    expect(typeof url).toBe('string');
  });
});

describe('signedUploadUrl() method - Local behavior', () => {
  let store: StorageStore;

  beforeAll(async () => {
    await mkdir(TEST_ROOT, { recursive: true });
  });

  afterAll(async () => {
    await rm(TEST_ROOT, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await rm(TEST_ROOT, { recursive: true, force: true });
    await mkdir(TEST_ROOT, { recursive: true });

    store = createLocalStore({
      driver: 'local',
      root: TEST_ROOT,
      baseUrl: 'http://localhost:3030/files',
    });
  });

  it('should return the same URL as url() for local storage', async () => {
    const key = 'uploads/file.txt';

    const uploadUrl = await store.signedUploadUrl({ key, contentType: 'text/plain' });
    const publicUrl = await store.url(key);

    expect(uploadUrl).toBe(publicUrl);
  });
});
