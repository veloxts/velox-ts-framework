/**
 * Default preset configurations for each environment.
 */

import type { Environment, EcosystemPreset } from './types.js';

/**
 * Development preset - optimized for fast local iteration.
 *
 * All drivers use in-memory or local implementations:
 * - No external services required (Redis, S3, SMTP)
 * - Fast startup and restarts
 * - Emails logged to console
 */
export const developmentPreset: EcosystemPreset = {
  cache: {
    driver: 'memory',
    config: { maxSize: 1000 },
  },
  queue: {
    driver: 'sync',
  },
  mail: {
    driver: 'log',
  },
  storage: {
    driver: 'local',
    root: './uploads',
    baseUrl: '/files',
  },
  events: {
    driver: 'ws',
    path: '/ws',
  },
  scheduler: {
    tasks: [],
  },
};

/**
 * Test preset - optimized for fast, isolated tests.
 *
 * Similar to development but with smaller limits:
 * - No persistence between tests
 * - Synchronous job execution for predictable tests
 * - Temp directory for storage
 */
export const testPreset: EcosystemPreset = {
  cache: {
    driver: 'memory',
    config: { maxSize: 100 },
  },
  queue: {
    driver: 'sync',
  },
  mail: {
    driver: 'log',
  },
  storage: {
    driver: 'local',
    root: './tmp/test-uploads',
    baseUrl: '/files',
  },
  events: {
    driver: 'ws',
    path: '/ws',
  },
  scheduler: {
    tasks: [],
  },
};

/**
 * Production preset - optimized for scale and reliability.
 *
 * Uses distributed services:
 * - Redis for cache, queue, and event pub/sub
 * - S3-compatible storage (AWS S3, Cloudflare R2, MinIO)
 * - Resend for transactional email
 *
 * Required environment variables:
 * - REDIS_URL: Redis connection URL
 * - RESEND_API_KEY: Resend API key
 * - S3_BUCKET: S3 bucket name
 * - AWS_REGION: AWS region (default: us-east-1)
 */
export const productionPreset: EcosystemPreset = {
  cache: {
    driver: 'redis',
    config: {
      url: process.env.REDIS_URL,
    },
  },
  queue: {
    driver: 'bullmq',
    config: {
      url: process.env.REDIS_URL,
    },
  },
  mail: {
    driver: 'resend',
    config: {
      apiKey: process.env.RESEND_API_KEY ?? '',
    },
  },
  storage: {
    driver: 's3',
    bucket: process.env.S3_BUCKET ?? '',
    region: process.env.AWS_REGION ?? 'us-east-1',
  },
  events: {
    driver: 'ws',
    path: '/ws',
    redis: process.env.REDIS_URL,
  },
  scheduler: {
    tasks: [],
  },
};

/**
 * Get preset configuration for an environment.
 */
export function getPreset(env: Environment): EcosystemPreset {
  switch (env) {
    case 'development':
      return developmentPreset;
    case 'test':
      return testPreset;
    case 'production':
      return productionPreset;
  }
}

/**
 * All presets by environment.
 */
export const presets = {
  development: developmentPreset,
  test: testPreset,
  production: productionPreset,
} as const;
