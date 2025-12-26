/**
 * Testcontainers Utilities for VeloxTS Integration Tests
 *
 * Provides pre-configured container factories for common services
 * used across ecosystem packages (cache, queue, mail, storage, events).
 *
 * @module @veloxts/testing/containers
 */

import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';

// ============================================================================
// Container Result Types
// ============================================================================

/**
 * Result from starting a Redis container
 */
export interface RedisContainerResult {
  /** Redis connection URL (redis://host:port) */
  url: string;
  /** Container host */
  host: string;
  /** Mapped port */
  port: number;
  /** Stop the container */
  stop: () => Promise<void>;
  /** The underlying container (for advanced use) */
  container: StartedTestContainer;
}

/**
 * Result from starting a MinIO container
 */
export interface MinioContainerResult {
  /** S3-compatible endpoint URL */
  endpoint: string;
  /** Container host */
  host: string;
  /** Mapped port */
  port: number;
  /** Access key for authentication */
  accessKey: string;
  /** Secret key for authentication */
  secretKey: string;
  /** Stop the container */
  stop: () => Promise<void>;
  /** The underlying container (for advanced use) */
  container: StartedTestContainer;
}

/**
 * Result from starting a MailHog container
 */
export interface MailhogContainerResult {
  /** SMTP server URL (host:port) */
  smtpUrl: string;
  /** SMTP host */
  smtpHost: string;
  /** SMTP port */
  smtpPort: number;
  /** HTTP API URL for retrieving messages */
  apiUrl: string;
  /** HTTP API port */
  apiPort: number;
  /** Stop the container */
  stop: () => Promise<void>;
  /** The underlying container (for advanced use) */
  container: StartedTestContainer;
}

// ============================================================================
// Container Factories
// ============================================================================

/**
 * Starts a Redis container for integration tests.
 *
 * Uses Redis 7 Alpine image for minimal size and fast startup.
 *
 * @example
 * ```typescript
 * import { startRedisContainer } from '@veloxts/testing';
 *
 * describe('Redis integration', () => {
 *   let redis: RedisContainerResult;
 *
 *   beforeAll(async () => {
 *     redis = await startRedisContainer();
 *   });
 *
 *   afterAll(async () => {
 *     await redis.stop();
 *   });
 *
 *   it('should connect to Redis', async () => {
 *     const client = createClient({ url: redis.url });
 *     await client.connect();
 *     // ... tests
 *   });
 * });
 * ```
 */
export async function startRedisContainer(): Promise<RedisContainerResult> {
  const container = await new GenericContainer('redis:7-alpine')
    .withExposedPorts(6379)
    .withWaitStrategy(Wait.forLogMessage('Ready to accept connections'))
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(6379);

  return {
    url: `redis://${host}:${port}`,
    host,
    port,
    stop: async () => {
      await container.stop();
    },
    container,
  };
}

/**
 * Starts a MinIO container for S3-compatible storage tests.
 *
 * MinIO provides S3-compatible API for testing storage drivers
 * without connecting to real AWS S3 or Cloudflare R2.
 *
 * @param options.rootUser - Root user name (default: 'minioadmin')
 * @param options.rootPassword - Root password (default: 'minioadmin')
 *
 * @example
 * ```typescript
 * import { startMinioContainer } from '@veloxts/testing';
 *
 * describe('S3 storage integration', () => {
 *   let minio: MinioContainerResult;
 *
 *   beforeAll(async () => {
 *     minio = await startMinioContainer();
 *   });
 *
 *   afterAll(async () => {
 *     await minio.stop();
 *   });
 *
 *   it('should upload to S3-compatible storage', async () => {
 *     const client = new S3Client({
 *       endpoint: minio.endpoint,
 *       credentials: {
 *         accessKeyId: minio.accessKey,
 *         secretAccessKey: minio.secretKey,
 *       },
 *       forcePathStyle: true, // Required for MinIO
 *     });
 *     // ... tests
 *   });
 * });
 * ```
 */
export async function startMinioContainer(options?: {
  rootUser?: string;
  rootPassword?: string;
}): Promise<MinioContainerResult> {
  const rootUser = options?.rootUser ?? 'minioadmin';
  const rootPassword = options?.rootPassword ?? 'minioadmin';

  const container = await new GenericContainer('minio/minio:latest')
    .withExposedPorts(9000, 9001)
    .withEnvironment({
      MINIO_ROOT_USER: rootUser,
      MINIO_ROOT_PASSWORD: rootPassword,
    })
    .withCommand(['server', '/data', '--console-address', ':9001'])
    .withWaitStrategy(Wait.forHttp('/minio/health/ready', 9000))
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(9000);

  return {
    endpoint: `http://${host}:${port}`,
    host,
    port,
    accessKey: rootUser,
    secretKey: rootPassword,
    stop: async () => {
      await container.stop();
    },
    container,
  };
}

/**
 * Starts a MailHog container for email testing.
 *
 * MailHog captures SMTP emails and provides an HTTP API to retrieve them,
 * perfect for testing email sending without actually sending emails.
 *
 * @example
 * ```typescript
 * import { startMailhogContainer } from '@veloxts/testing';
 *
 * describe('Email integration', () => {
 *   let mailhog: MailhogContainerResult;
 *
 *   beforeAll(async () => {
 *     mailhog = await startMailhogContainer();
 *   });
 *
 *   afterAll(async () => {
 *     await mailhog.stop();
 *   });
 *
 *   it('should send and receive email', async () => {
 *     // Send email via SMTP
 *     const transport = nodemailer.createTransport({
 *       host: mailhog.smtpHost,
 *       port: mailhog.smtpPort,
 *     });
 *     await transport.sendMail({ to: 'test@example.com', subject: 'Test' });
 *
 *     // Verify via MailHog API
 *     const response = await fetch(`${mailhog.apiUrl}/api/v2/messages`);
 *     const messages = await response.json();
 *     expect(messages.items).toHaveLength(1);
 *   });
 * });
 * ```
 */
export async function startMailhogContainer(): Promise<MailhogContainerResult> {
  const container = await new GenericContainer('mailhog/mailhog:latest')
    .withExposedPorts(1025, 8025)
    .withWaitStrategy(Wait.forListeningPorts())
    .start();

  const host = container.getHost();
  const smtpPort = container.getMappedPort(1025);
  const apiPort = container.getMappedPort(8025);

  return {
    smtpUrl: `${host}:${smtpPort}`,
    smtpHost: host,
    smtpPort,
    apiUrl: `http://${host}:${apiPort}`,
    apiPort,
    stop: async () => {
      await container.stop();
    },
    container,
  };
}

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Checks if Docker is available for running containers.
 * Use this to skip tests when Docker is not available (e.g., in CI without Docker).
 *
 * @example
 * ```typescript
 * import { isDockerAvailable } from '@veloxts/testing';
 *
 * const skipIfNoDocker = !await isDockerAvailable() ? describe.skip : describe;
 *
 * skipIfNoDocker('Redis integration', () => {
 *   // Tests that require Docker
 * });
 * ```
 */
export async function isDockerAvailable(): Promise<boolean> {
  try {
    // Try to ping Docker by starting a minimal container
    const container = await new GenericContainer('alpine:latest')
      .withCommand(['echo', 'docker-check'])
      .withStartupTimeout(5000)
      .start();
    await container.stop();
    return true;
  } catch {
    return false;
  }
}

/**
 * Describe suite function type (Vitest/Jest compatible)
 */
export type DescribeFn = (name: string, fn: () => void) => void;

/**
 * Skip integration tests if Docker is not available.
 * Returns `describe.skip` if Docker unavailable, `describe` otherwise.
 *
 * @param describeFn - The describe function from your test framework
 * @param skipFn - The describe.skip function from your test framework
 *
 * @example
 * ```typescript
 * import { describe } from 'vitest';
 * import { describeWithDocker } from '@veloxts/testing';
 *
 * const describeIntegration = await describeWithDocker(describe, describe.skip);
 *
 * describeIntegration('Redis cache driver', () => {
 *   // These tests will be skipped if Docker is not available
 * });
 * ```
 */
export async function describeWithDocker(
  describeFn: DescribeFn,
  skipFn: DescribeFn
): Promise<DescribeFn> {
  const available = await isDockerAvailable();
  return available ? describeFn : skipFn;
}
