/**
 * Tests for provider factories (r2, minio)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

describe('R2 Provider', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should validate required config fields', async () => {
    const { r2 } = await import('../providers/r2.js');

    // Missing bucket
    await expect(
      r2({
        bucket: '',
        accountId: 'test-account',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
      })
    ).rejects.toThrow(ZodError);

    // Missing accountId
    await expect(
      r2({
        bucket: 'test-bucket',
        accountId: '',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
      })
    ).rejects.toThrow(ZodError);

    // Missing accessKeyId
    await expect(
      r2({
        bucket: 'test-bucket',
        accountId: 'test-account',
        accessKeyId: '',
        secretAccessKey: 'test-secret',
      })
    ).rejects.toThrow(ZodError);

    // Missing secretAccessKey
    await expect(
      r2({
        bucket: 'test-bucket',
        accountId: 'test-account',
        accessKeyId: 'test-key',
        secretAccessKey: '',
      })
    ).rejects.toThrow(ZodError);
  });

  it('should validate publicUrl is a valid URL', async () => {
    const { r2 } = await import('../providers/r2.js');

    await expect(
      r2({
        bucket: 'test-bucket',
        accountId: 'test-account',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
        publicUrl: 'not-a-url',
      })
    ).rejects.toThrow(ZodError);
  });

  it('should validate jurisdiction is eu or fedramp', async () => {
    const { r2 } = await import('../providers/r2.js');

    await expect(
      r2({
        bucket: 'test-bucket',
        accountId: 'test-account',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
        jurisdiction: 'invalid' as 'eu',
      })
    ).rejects.toThrow(ZodError);
  });

  it(
    'should accept valid eu jurisdiction',
    async () => {
      const { r2 } = await import('../providers/r2.js');

      // This will fail at runtime due to no S3 client, but config validation should pass
      // We mock at the S3 level, not here
      const store = await r2({
        bucket: 'test-bucket',
        accountId: 'test-account',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
        jurisdiction: 'eu',
      });

      expect(store).toBeDefined();
      expect(typeof store.put).toBe('function');
      expect(typeof store.get).toBe('function');
    },
    15000
  );

  it('should export PROVIDER_NAME', async () => {
    const { PROVIDER_NAME } = await import('../providers/r2.js');
    expect(PROVIDER_NAME).toBe('r2');
  });
});

describe('MinIO Provider', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should validate required config fields', async () => {
    const { minio } = await import('../providers/minio.js');

    // Missing bucket
    await expect(
      minio({
        bucket: '',
        endpoint: 'http://localhost:9000',
        accessKeyId: 'minioadmin',
        secretAccessKey: 'minioadmin',
      })
    ).rejects.toThrow(ZodError);

    // Missing endpoint
    await expect(
      minio({
        bucket: 'test-bucket',
        endpoint: '',
        accessKeyId: 'minioadmin',
        secretAccessKey: 'minioadmin',
      })
    ).rejects.toThrow(ZodError);

    // Missing accessKeyId
    await expect(
      minio({
        bucket: 'test-bucket',
        endpoint: 'http://localhost:9000',
        accessKeyId: '',
        secretAccessKey: 'minioadmin',
      })
    ).rejects.toThrow(ZodError);

    // Missing secretAccessKey
    await expect(
      minio({
        bucket: 'test-bucket',
        endpoint: 'http://localhost:9000',
        accessKeyId: 'minioadmin',
        secretAccessKey: '',
      })
    ).rejects.toThrow(ZodError);
  });

  it('should validate endpoint is a valid URL', async () => {
    const { minio } = await import('../providers/minio.js');

    await expect(
      minio({
        bucket: 'test-bucket',
        endpoint: 'not-a-url',
        accessKeyId: 'minioadmin',
        secretAccessKey: 'minioadmin',
      })
    ).rejects.toThrow(ZodError);
  });

  it('should use default region if not provided', async () => {
    const { minio } = await import('../providers/minio.js');

    const store = await minio({
      bucket: 'test-bucket',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'minioadmin',
      secretAccessKey: 'minioadmin',
    });

    expect(store).toBeDefined();
    expect(typeof store.put).toBe('function');
  });

  it('should accept custom region', async () => {
    const { minio } = await import('../providers/minio.js');

    const store = await minio({
      bucket: 'test-bucket',
      endpoint: 'http://localhost:9000',
      accessKeyId: 'minioadmin',
      secretAccessKey: 'minioadmin',
      region: 'eu-west-1',
    });

    expect(store).toBeDefined();
  });

  it('should export PROVIDER_NAME', async () => {
    const { PROVIDER_NAME } = await import('../providers/minio.js');
    expect(PROVIDER_NAME).toBe('minio');
  });
});

describe('Providers index', () => {
  it('should export r2 and minio', async () => {
    const providers = await import('../providers/index.js');

    expect(typeof providers.r2).toBe('function');
    expect(typeof providers.minio).toBe('function');
    expect(providers.R2_PROVIDER).toBe('r2');
    expect(providers.MINIO_PROVIDER).toBe('minio');
  });

  it('should re-export base drivers', async () => {
    const providers = await import('../providers/index.js');

    expect(typeof providers.createLocalStore).toBe('function');
    expect(typeof providers.createS3Store).toBe('function');
    expect(providers.LOCAL_DRIVER).toBe('local');
    expect(providers.S3_DRIVER).toBe('s3');
  });
});
