/**
 * Security validation utilities for production presets.
 *
 * Validates that required environment variables, secrets, and security
 * settings are properly configured before the application starts.
 */

import { detectEnvironment } from './env.js';
import type { Environment } from './types.js';

/**
 * Validation result with errors and warnings.
 */
export interface ValidationResult {
  valid: boolean;
  errors: SecurityValidationIssue[];
  warnings: SecurityValidationIssue[];
}

/**
 * A single security validation issue (error or warning).
 */
export interface SecurityValidationIssue {
  category: 'env' | 'secret' | 'security';
  key: string;
  message: string;
  suggestion?: string;
}

/**
 * Security requirements configuration.
 */
export interface SecurityRequirements {
  /**
   * Required environment variables with descriptions.
   * Key is the env var name, value is a description.
   */
  requiredEnvVars?: Record<string, string>;

  /**
   * Minimum length for JWT secrets.
   * @default 32
   */
  jwtSecretMinLength?: number;

  /**
   * Minimum length for session secrets.
   * @default 32
   */
  sessionSecretMinLength?: number;

  /**
   * Environment variables that are secrets and should be validated for length.
   * @default ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'SESSION_SECRET']
   */
  secretEnvVars?: string[];
}

/**
 * Default security requirements for production.
 */
const DEFAULT_REQUIREMENTS: Required<SecurityRequirements> = {
  requiredEnvVars: {
    DATABASE_URL: 'Database connection string',
  },
  jwtSecretMinLength: 32,
  sessionSecretMinLength: 32,
  secretEnvVars: ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'SESSION_SECRET'],
};

/**
 * Validate security requirements for production deployment.
 *
 * Checks:
 * - Required environment variables are set
 * - Secrets meet minimum length requirements
 * - Secrets have sufficient entropy (not weak patterns)
 *
 * @param requirements - Custom security requirements (merged with defaults)
 * @returns ValidationResult with errors and warnings
 *
 * @example
 * ```typescript
 * const result = validateSecurity();
 *
 * if (!result.valid) {
 *   console.error('Security validation failed:');
 *   result.errors.forEach(e => console.error(`  [${e.category}] ${e.key}: ${e.message}`));
 *   process.exit(1);
 * }
 * ```
 */
export function validateSecurity(requirements?: SecurityRequirements): ValidationResult {
  const config: Required<SecurityRequirements> = {
    ...DEFAULT_REQUIREMENTS,
    ...requirements,
    requiredEnvVars: {
      ...DEFAULT_REQUIREMENTS.requiredEnvVars,
      ...requirements?.requiredEnvVars,
    },
  };

  const errors: SecurityValidationIssue[] = [];
  const warnings: SecurityValidationIssue[] = [];

  // Check required environment variables
  for (const [key, description] of Object.entries(config.requiredEnvVars)) {
    if (!process.env[key]) {
      errors.push({
        category: 'env',
        key,
        message: `Missing required environment variable`,
        suggestion: description,
      });
    }
  }

  // Check secret lengths and patterns
  for (const key of config.secretEnvVars) {
    const value = process.env[key];

    if (!value) {
      // Only warn if secret is not required (required ones are caught above)
      if (!config.requiredEnvVars[key]) {
        warnings.push({
          category: 'secret',
          key,
          message: `Secret not set (optional but recommended)`,
          suggestion: `Generate with: openssl rand -base64 48`,
        });
      }
      continue;
    }

    // Check minimum length
    const minLength = key.includes('SESSION')
      ? config.sessionSecretMinLength
      : config.jwtSecretMinLength;

    if (value.length < minLength) {
      errors.push({
        category: 'secret',
        key,
        message: `Secret too short (${value.length} chars, minimum ${minLength})`,
        suggestion: `Generate with: openssl rand -base64 48`,
      });
      continue;
    }

    // Check for weak patterns
    if (isWeakSecret(value)) {
      warnings.push({
        category: 'secret',
        key,
        message: `Secret appears to have low entropy`,
        suggestion: `Use a cryptographically random value: openssl rand -base64 48`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate security requirements and throw if validation fails.
 *
 * Only validates in production environment. In development/test, returns silently.
 *
 * @param requirements - Custom security requirements
 * @throws Error with formatted list of validation failures
 *
 * @example
 * ```typescript
 * import { validateSecurityOrThrow } from '@veloxts/velox';
 *
 * // At app startup
 * validateSecurityOrThrow();  // Throws in production if validation fails
 *
 * const app = await veloxApp(getServerConfig());
 * ```
 */
export function validateSecurityOrThrow(requirements?: SecurityRequirements): void {
  const env = detectEnvironment();

  // Only validate in production
  if (env !== 'production') {
    return;
  }

  const result = validateSecurity(requirements);

  if (!result.valid) {
    const errorLines = result.errors.map((e) => {
      let line = `  [${e.category}] ${e.key}: ${e.message}`;
      if (e.suggestion) {
        line += `\n    Suggestion: ${e.suggestion}`;
      }
      return line;
    });

    const warningLines = result.warnings.map((w) => {
      let line = `  [${w.category}] ${w.key}: ${w.message}`;
      if (w.suggestion) {
        line += `\n    Suggestion: ${w.suggestion}`;
      }
      return line;
    });

    let message = `Production security validation failed:\n\n${errorLines.join('\n\n')}`;

    if (warningLines.length > 0) {
      message += `\n\nWarnings:\n${warningLines.join('\n\n')}`;
    }

    throw new Error(message);
  }

  // Log warnings even if validation passes
  if (result.warnings.length > 0) {
    console.warn('\nSecurity warnings:');
    for (const warning of result.warnings) {
      console.warn(`  [${warning.category}] ${warning.key}: ${warning.message}`);
      if (warning.suggestion) {
        console.warn(`    Suggestion: ${warning.suggestion}`);
      }
    }
    console.warn('');
  }
}

/**
 * Check if a secret value appears to be weak.
 *
 * Detects common weak patterns:
 * - All same character (aaaa...)
 * - Sequential patterns (123456, abcdef)
 * - Common weak values (secret, password, test)
 *
 * @param value - The secret value to check
 * @returns true if the secret appears weak, false otherwise
 *
 * @example
 * ```typescript
 * import { isWeakSecret } from '@veloxts/velox';
 *
 * isWeakSecret('password123');  // true
 * isWeakSecret('aaaaaaaaaa');   // true
 * isWeakSecret('K8sX#mP2qR!nL4wJ@bY9zC&vD');  // false
 * ```
 */
export function isWeakSecret(value: string): boolean {
  // All same character
  if (/^(.)\1+$/.test(value)) {
    return true;
  }

  // Common weak values
  const weakValues = [
    'secret',
    'password',
    'test',
    'development',
    'changeme',
    'admin',
    '123456',
    'qwerty',
  ];

  const lowerValue = value.toLowerCase();
  if (weakValues.some((weak) => lowerValue.includes(weak))) {
    return true;
  }

  // Very low character diversity (less than 4 unique chars in 32+ char string)
  if (value.length >= 32) {
    const uniqueChars = new Set(value).size;
    if (uniqueChars < 4) {
      return true;
    }
  }

  return false;
}

/**
 * Validate that auth-related secrets are properly configured.
 *
 * This validates both JWT secrets (required for token-based auth) and
 * SESSION_SECRET (required for session-based auth). In production,
 * all three secrets must be set and meet minimum length requirements.
 *
 * Use validateSecurity() for full validation including other env vars.
 *
 * @param env - Target environment (defaults to NODE_ENV detection)
 * @throws Error if secrets are missing or weak in production
 *
 * @example
 * ```typescript
 * import { validateAuthSecrets } from '@veloxts/velox';
 *
 * // At app startup - validates JWT_SECRET, JWT_REFRESH_SECRET, SESSION_SECRET
 * validateAuthSecrets();
 * ```
 */
export function validateAuthSecrets(env?: Environment): void {
  const environment = env ?? detectEnvironment();

  if (environment !== 'production') {
    return;
  }

  // For auth secrets, treat missing as errors
  // All three are required: JWT for stateless auth, SESSION for cookie-based auth
  const requiredSecrets = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'SESSION_SECRET'];
  const missingSecrets = requiredSecrets.filter((key) => !process.env[key]);

  if (missingSecrets.length > 0) {
    const details = missingSecrets.map((key) => `  - ${key}`).join('\n');
    throw new Error(
      `Missing required auth secrets for production:\n${details}\n\n` +
        `Generate secure secrets with: openssl rand -base64 48`
    );
  }

  // Validate secret lengths (32 chars minimum for all auth secrets)
  const secretMinLength = 32;
  const errors: { key: string; message: string }[] = [];

  for (const key of requiredSecrets) {
    const value = process.env[key];
    if (value && value.length < secretMinLength) {
      errors.push({
        key,
        message: `Secret too short (${value.length} chars, minimum ${secretMinLength})`,
      });
    }
  }

  if (errors.length > 0) {
    const errorLines = errors.map((e) => `  - ${e.key}: ${e.message}`).join('\n');
    throw new Error(`Auth secret validation failed:\n${errorLines}`);
  }
}
