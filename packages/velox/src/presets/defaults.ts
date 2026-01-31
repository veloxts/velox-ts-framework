/**
 * Default preset configurations for each environment.
 */

import type { EcosystemPreset, Environment } from './types.js';

/**
 * Required environment variables for production preset.
 */
export const PRODUCTION_ENV_VARS = {
  REDIS_URL: 'Redis connection URL (for cache, queue, events)',
  RESEND_API_KEY: 'Resend API key (for transactional email)',
  S3_BUCKET: 'S3 bucket name (for file storage)',
  AWS_REGION: 'AWS region (optional, defaults to us-east-1)',
} as const;

interface ProductionEnvVars {
  REDIS_URL: string;
  RESEND_API_KEY: string;
  S3_BUCKET: string;
  AWS_REGION: string;
}

/**
 * Validate required environment variables for production.
 * @returns The validated environment variables
 * @throws Error with list of missing variables
 */
export function validateProductionEnv(): ProductionEnvVars {
  const required = ['REDIS_URL', 'RESEND_API_KEY', 'S3_BUCKET'] as const;

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    const details = missing.map((key) => `  - ${key}: ${PRODUCTION_ENV_VARS[key]}`).join('\n');

    throw new Error(
      `Missing required environment variables for production preset:\n${details}\n\n` +
        `Set these in your .env file or environment, or use a different preset.`
    );
  }

  return {
    REDIS_URL: process.env.REDIS_URL as string,
    RESEND_API_KEY: process.env.RESEND_API_KEY as string,
    S3_BUCKET: process.env.S3_BUCKET as string,
    AWS_REGION: process.env.AWS_REGION ?? 'us-east-1',
  };
}

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
 * Create production preset with validated environment variables.
 */
function createProductionPreset(env: ProductionEnvVars): EcosystemPreset {
  return {
    cache: {
      driver: 'redis',
      config: {
        url: env.REDIS_URL,
      },
    },
    queue: {
      driver: 'bullmq',
      config: {
        url: env.REDIS_URL,
      },
    },
    mail: {
      driver: 'resend',
      config: {
        apiKey: env.RESEND_API_KEY,
      },
    },
    storage: {
      driver: 's3',
      bucket: env.S3_BUCKET,
      region: env.AWS_REGION,
    },
    events: {
      driver: 'ws',
      path: '/ws',
      redis: env.REDIS_URL,
    },
    scheduler: {
      tasks: [],
    },
  };
}

/**
 * Create production preset with current environment variables (unvalidated).
 * Used for the module-level export. Prefer getPreset('production') which validates.
 */
function createProductionPresetFromEnv(): EcosystemPreset {
  return {
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
}

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
 *
 * @see validateProductionEnv() to check if all required vars are set
 */
export const productionPreset: EcosystemPreset = createProductionPresetFromEnv();

/**
 * Get preset configuration for an environment.
 * For production, validates required environment variables first.
 *
 * @throws Error if production env vars are missing
 */
export function getPreset(env: Environment): EcosystemPreset {
  switch (env) {
    case 'development':
      return developmentPreset;
    case 'test':
      return testPreset;
    case 'production': {
      const env = validateProductionEnv();
      // Return fresh preset to pick up env vars set after module load
      return createProductionPreset(env);
    }
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
