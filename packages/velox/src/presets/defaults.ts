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
 * - Relaxed auth settings for easier testing
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
  auth: {
    jwt: {
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d',
    },
    rateLimit: {
      max: 100, // Relaxed for development
      windowMs: 900000, // 15 minutes
    },
    session: {
      ttl: 604800, // 7 days
      sliding: true,
      absoluteTimeout: 604800,
    },
    cookie: {
      secure: false, // Allow HTTP in development
      sameSite: 'lax',
      httpOnly: true,
    },
  },
};

/**
 * Test preset - optimized for fast, isolated tests.
 *
 * Similar to development but with smaller limits:
 * - No persistence between tests
 * - Synchronous job execution for predictable tests
 * - Temp directory for storage
 * - Very relaxed rate limits for test automation
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
  auth: {
    jwt: {
      accessTokenExpiry: '1h', // Longer for test convenience
      refreshTokenExpiry: '7d',
    },
    rateLimit: {
      max: 1000, // Very relaxed for test automation
      windowMs: 900000,
    },
    session: {
      ttl: 3600, // 1 hour - shorter for test isolation
      sliding: true,
      absoluteTimeout: 3600,
    },
    cookie: {
      secure: false,
      sameSite: 'lax',
      httpOnly: true,
    },
  },
};

/**
 * Production auth preset - strict security settings.
 */
const productionAuthPreset = {
  jwt: {
    accessTokenExpiry: '5m', // Short-lived for security
    refreshTokenExpiry: '1d', // 1 day (shorter than dev)
  },
  rateLimit: {
    max: 5, // Strict rate limiting
    windowMs: 900000, // 15 minutes
  },
  session: {
    ttl: 14400, // 4 hours
    sliding: true,
    absoluteTimeout: 86400, // 24 hours max
  },
  cookie: {
    secure: true, // HTTPS required in production
    sameSite: 'strict' as const, // Strict CSRF protection
    httpOnly: true,
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
    auth: productionAuthPreset,
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
    auth: productionAuthPreset,
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
