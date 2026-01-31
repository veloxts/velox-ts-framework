/**
 * Full-Stack Integration Test
 *
 * This test demonstrates using all testcontainers together to simulate
 * a realistic VeloxTS application workflow:
 *
 * 1. PostgreSQL - User database
 * 2. Redis - Cache + Queue backend
 * 3. MinIO - File storage (S3-compatible)
 * 4. MailHog - Email capture
 *
 * Scenario: User registration flow
 * - Create user in database
 * - Cache user data in Redis
 * - Upload avatar to S3 storage
 * - Queue welcome email job
 * - Send email via SMTP
 * - Verify email was received
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// MailHog API response types
interface MailHogMessage {
  Content: {
    Headers: {
      Subject: string[];
      From: string[];
      To: string[];
    };
  };
}

interface MailHogResponse {
  total: number;
  items: MailHogMessage[];
}

import {
  describeWithDocker,
  type MailhogContainerResult,
  type MinioContainerResult,
  type PostgresContainerResult,
  type RedisContainerResult,
  startMailhogContainer,
  startMinioContainer,
  startPostgresContainer,
  startRedisContainer,
} from '../index.js';

// Container instances
let postgres: PostgresContainerResult;
let redis: RedisContainerResult;
let minio: MinioContainerResult;
let mailhog: MailhogContainerResult;

// Track if containers started successfully
let containersReady = false;

// Use describeWithDocker to skip tests if Docker is unavailable
const describeIntegration = await describeWithDocker(describe, describe.skip);

describeIntegration('Full-Stack Integration Test', () => {
  beforeAll(async () => {
    // Start all containers in parallel for faster setup
    const results = await Promise.all([
      startPostgresContainer({ database: 'velox_test', username: 'velox', password: 'velox123' }),
      startRedisContainer(),
      startMinioContainer({ rootUser: 'veloxadmin', rootPassword: 'veloxsecret' }),
      startMailhogContainer(),
    ]);

    [postgres, redis, minio, mailhog] = results;
    containersReady = true;
  }, 120000); // 2 minute timeout for container startup

  afterAll(async () => {
    if (!containersReady) return;

    // Stop all containers in parallel
    await Promise.all([postgres?.stop(), redis?.stop(), minio?.stop(), mailhog?.stop()]);
  });

  describe('Container Connectivity', () => {
    it('should have PostgreSQL container running', () => {
      expect(postgres).toBeDefined();
      expect(postgres.url).toMatch(/^postgresql:\/\//);
      expect(postgres.host).toBeTruthy();
      expect(postgres.port).toBeGreaterThan(0);
      expect(postgres.database).toBe('velox_test');
      expect(postgres.username).toBe('velox');
    });

    it('should have Redis container running', () => {
      expect(redis).toBeDefined();
      expect(redis.url).toMatch(/^redis:\/\//);
      expect(redis.host).toBeTruthy();
      expect(redis.port).toBeGreaterThan(0);
    });

    it('should have MinIO container running', () => {
      expect(minio).toBeDefined();
      expect(minio.endpoint).toMatch(/^http:\/\//);
      expect(minio.host).toBeTruthy();
      expect(minio.port).toBeGreaterThan(0);
      expect(minio.accessKey).toBe('veloxadmin');
      expect(minio.secretKey).toBe('veloxsecret');
    });

    it('should have MailHog container running', () => {
      expect(mailhog).toBeDefined();
      expect(mailhog.smtpHost).toBeTruthy();
      expect(mailhog.smtpPort).toBeGreaterThan(0);
      expect(mailhog.apiUrl).toMatch(/^http:\/\//);
    });
  });

  describe('PostgreSQL Database Operations', () => {
    it('should connect and execute queries via pg client', async () => {
      // Dynamic import to avoid requiring pg in all environments
      const { default: pg } = await import('pg');
      const client = new pg.Client({ connectionString: postgres.url });

      await client.connect();

      // Create a test table
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Insert test data
      const insertResult = await client.query(
        'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING *',
        ['test@example.com', 'Test User']
      );

      expect(insertResult.rows).toHaveLength(1);
      expect(insertResult.rows[0].email).toBe('test@example.com');
      expect(insertResult.rows[0].name).toBe('Test User');

      // Query the data back
      const selectResult = await client.query('SELECT * FROM users WHERE email = $1', [
        'test@example.com',
      ]);

      expect(selectResult.rows).toHaveLength(1);
      expect(selectResult.rows[0].id).toBe(insertResult.rows[0].id);

      await client.end();
    });
  });

  describe('Redis Cache Operations', () => {
    it('should connect and perform cache operations', async () => {
      // Dynamic import to avoid requiring redis in all environments
      const { createClient } = await import('redis');
      const client = createClient({ url: redis.url });

      await client.connect();

      // Set a cached value
      await client.set('user:1:profile', JSON.stringify({ id: 1, name: 'Test User' }));
      await client.expire('user:1:profile', 3600);

      // Get the cached value
      const cached = await client.get('user:1:profile');
      if (!cached) {
        throw new Error('Cache key not found');
      }

      const parsed = JSON.parse(cached);
      expect(parsed.id).toBe(1);
      expect(parsed.name).toBe('Test User');

      // Test TTL
      const ttl = await client.ttl('user:1:profile');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(3600);

      await client.quit();
    });

    it('should support pub/sub for events', async () => {
      const { createClient } = await import('redis');

      const publisher = createClient({ url: redis.url });
      const subscriber = createClient({ url: redis.url });

      await publisher.connect();
      await subscriber.connect();

      const messages: string[] = [];

      // Subscribe to channel
      await subscriber.subscribe('events:user', (message) => {
        messages.push(message);
      });

      // Publish message
      await publisher.publish('events:user', JSON.stringify({ event: 'user.created', userId: 1 }));

      // Wait for message to be received
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(messages).toHaveLength(1);
      const parsed = JSON.parse(messages[0]);
      expect(parsed.event).toBe('user.created');
      expect(parsed.userId).toBe(1);

      await subscriber.unsubscribe('events:user');
      await publisher.quit();
      await subscriber.quit();
    });
  });

  describe('MinIO S3 Storage Operations', () => {
    it('should upload and download files', async () => {
      // Dynamic import to avoid requiring @aws-sdk/client-s3 in all environments
      const { CreateBucketCommand, GetObjectCommand, PutObjectCommand, S3Client } = await import(
        '@aws-sdk/client-s3'
      );

      const s3 = new S3Client({
        endpoint: minio.endpoint,
        region: 'us-east-1',
        credentials: {
          accessKeyId: minio.accessKey,
          secretAccessKey: minio.secretKey,
        },
        forcePathStyle: true, // Required for MinIO
      });

      const bucketName = 'test-avatars';

      // Create bucket
      await s3.send(new CreateBucketCommand({ Bucket: bucketName }));

      // Upload a file
      const fileContent = Buffer.from('fake-image-content-for-avatar');
      await s3.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: 'users/1/avatar.png',
          Body: fileContent,
          ContentType: 'image/png',
        })
      );

      // Download the file
      const response = await s3.send(
        new GetObjectCommand({
          Bucket: bucketName,
          Key: 'users/1/avatar.png',
        })
      );

      const downloadedContent = await response.Body?.transformToByteArray();
      if (!downloadedContent) {
        throw new Error('Downloaded content is empty');
      }
      expect(Buffer.from(downloadedContent).toString()).toBe('fake-image-content-for-avatar');
      expect(response.ContentType).toBe('image/png');

      s3.destroy();
    });
  });

  describe('MailHog Email Operations', () => {
    it('should send and capture emails via SMTP', async () => {
      // Dynamic import to avoid requiring nodemailer in all environments
      const nodemailer = await import('nodemailer');

      const transport = nodemailer.createTransport({
        host: mailhog.smtpHost,
        port: mailhog.smtpPort,
        secure: false,
      });

      // Send test email
      await transport.sendMail({
        from: 'noreply@veloxts.dev',
        to: 'newuser@example.com',
        subject: 'Welcome to VeloxTS!',
        html: '<h1>Welcome!</h1><p>Thanks for signing up.</p>',
        text: 'Welcome! Thanks for signing up.',
      });

      // Wait for email to be processed
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Fetch emails from MailHog API
      const response = await fetch(`${mailhog.apiUrl}/api/v2/messages`);
      const data = (await response.json()) as MailHogResponse;

      expect(data.total).toBeGreaterThanOrEqual(1);

      const email = data.items[0];
      expect(email.Content.Headers.Subject[0]).toBe('Welcome to VeloxTS!');
      expect(email.Content.Headers.From[0]).toBe('noreply@veloxts.dev');
      expect(email.Content.Headers.To[0]).toBe('newuser@example.com');

      transport.close();
    });

    it('should capture multiple emails', async () => {
      // Clear existing messages first
      await fetch(`${mailhog.apiUrl}/api/v1/messages`, { method: 'DELETE' });

      const nodemailer = await import('nodemailer');

      const transport = nodemailer.createTransport({
        host: mailhog.smtpHost,
        port: mailhog.smtpPort,
        secure: false,
      });

      // Send multiple emails
      await Promise.all([
        transport.sendMail({
          from: 'noreply@veloxts.dev',
          to: 'user1@example.com',
          subject: 'Email 1',
          text: 'First email',
        }),
        transport.sendMail({
          from: 'noreply@veloxts.dev',
          to: 'user2@example.com',
          subject: 'Email 2',
          text: 'Second email',
        }),
        transport.sendMail({
          from: 'noreply@veloxts.dev',
          to: 'user3@example.com',
          subject: 'Email 3',
          text: 'Third email',
        }),
      ]);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify all emails were captured
      const response = await fetch(`${mailhog.apiUrl}/api/v2/messages`);
      const data = (await response.json()) as MailHogResponse;

      expect(data.total).toBe(3);

      transport.close();
    });
  });

  describe('Full User Registration Workflow', () => {
    it('should complete end-to-end user registration', async () => {
      // This test simulates what a VeloxTS app would do:
      // 1. Create user in PostgreSQL
      // 2. Cache user in Redis
      // 3. Upload avatar to MinIO
      // 4. Send welcome email

      // Import all clients
      const [{ default: pg }, { createClient }, s3Sdk, nodemailer] = await Promise.all([
        import('pg'),
        import('redis'),
        import('@aws-sdk/client-s3'),
        import('nodemailer'),
      ]);

      // Clear MailHog messages
      await fetch(`${mailhog.apiUrl}/api/v1/messages`, { method: 'DELETE' });

      // Setup clients
      const dbClient = new pg.Client({ connectionString: postgres.url });
      const cacheClient = createClient({ url: redis.url });
      const s3 = new s3Sdk.S3Client({
        endpoint: minio.endpoint,
        region: 'us-east-1',
        credentials: { accessKeyId: minio.accessKey, secretAccessKey: minio.secretKey },
        forcePathStyle: true,
      });
      const mailTransport = nodemailer.createTransport({
        host: mailhog.smtpHost,
        port: mailhog.smtpPort,
        secure: false,
      });

      await dbClient.connect();
      await cacheClient.connect();

      try {
        // 1. Create user in database
        const userResult = await dbClient.query(
          `INSERT INTO users (email, name) VALUES ($1, $2) RETURNING *`,
          ['workflow-test@example.com', 'Workflow Test User']
        );
        const user = userResult.rows[0];
        expect(user.id).toBeDefined();

        // 2. Cache user profile
        const cacheKey = `user:${user.id}:profile`;
        await cacheClient.set(
          cacheKey,
          JSON.stringify({
            id: user.id,
            email: user.email,
            name: user.name,
            cachedAt: new Date().toISOString(),
          })
        );
        await cacheClient.expire(cacheKey, 3600);

        // Verify cache
        const cachedValue = await cacheClient.get(cacheKey);
        if (!cachedValue) {
          throw new Error('User not found in cache');
        }
        const cachedUser = JSON.parse(cachedValue);
        expect(cachedUser.email).toBe('workflow-test@example.com');

        // 3. Upload avatar to S3
        const bucketName = 'user-avatars';
        try {
          await s3.send(new s3Sdk.CreateBucketCommand({ Bucket: bucketName }));
        } catch {
          // Bucket might already exist
        }

        const avatarContent = Buffer.from(`avatar-for-user-${user.id}`);
        await s3.send(
          new s3Sdk.PutObjectCommand({
            Bucket: bucketName,
            Key: `${user.id}/avatar.png`,
            Body: avatarContent,
            ContentType: 'image/png',
          })
        );

        // Verify avatar upload
        const avatarResponse = await s3.send(
          new s3Sdk.GetObjectCommand({
            Bucket: bucketName,
            Key: `${user.id}/avatar.png`,
          })
        );
        expect(avatarResponse.ContentType).toBe('image/png');

        // 4. Send welcome email
        await mailTransport.sendMail({
          from: 'welcome@veloxts.dev',
          to: user.email,
          subject: `Welcome, ${user.name}!`,
          html: `
            <h1>Welcome to VeloxTS!</h1>
            <p>Hi ${user.name},</p>
            <p>Your account has been created successfully.</p>
            <p>User ID: ${user.id}</p>
          `,
        });

        // Wait for email processing
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Verify email was sent
        const emailResponse = await fetch(`${mailhog.apiUrl}/api/v2/messages`);
        const emailData = (await emailResponse.json()) as MailHogResponse;

        expect(emailData.total).toBeGreaterThanOrEqual(1);
        const welcomeEmail = emailData.items.find(
          (e) => e.Content.Headers.To[0] === 'workflow-test@example.com'
        );
        if (!welcomeEmail) {
          throw new Error('Welcome email not found in MailHog');
        }
        expect(welcomeEmail.Content.Headers.Subject[0]).toBe(`Welcome, ${user.name}!`);

        // Verify all systems are in sync
        const dbUser = await dbClient.query('SELECT * FROM users WHERE id = $1', [user.id]);
        expect(dbUser.rows).toHaveLength(1);
        expect(dbUser.rows[0].email).toBe(cachedUser.email);
      } finally {
        // Cleanup
        await dbClient.end();
        await cacheClient.quit();
        s3.destroy();
        mailTransport.close();
      }
    });
  });
});
