/**
 * Password hashing utilities for @veloxts/auth
 * @module auth/hash
 */

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

import type { HashConfig } from './types.js';

const scryptAsync = promisify(scrypt);

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_BCRYPT_ROUNDS = 12;
const DEFAULT_ARGON2_MEMORY_COST = 65536; // 64 MB
const DEFAULT_ARGON2_TIME_COST = 3;
const DEFAULT_ARGON2_PARALLELISM = 4;

/**
 * Default password hashing configuration
 *
 * Uses bcrypt with 12 rounds, which provides a good balance between
 * security and performance. Increase rounds for higher security
 * (each increment doubles the computation time).
 *
 * @example
 * ```typescript
 * import { DEFAULT_HASH_CONFIG, passwordHasher } from '@veloxts/auth';
 *
 * // Use defaults explicitly
 * const hasher = passwordHasher(DEFAULT_HASH_CONFIG);
 *
 * // Or customize from defaults
 * const strongerHasher = passwordHasher({
 *   ...DEFAULT_HASH_CONFIG,
 *   bcryptRounds: 14,
 * });
 * ```
 */
export const DEFAULT_HASH_CONFIG = {
  algorithm: 'bcrypt',
  bcryptRounds: DEFAULT_BCRYPT_ROUNDS,
} as const;

// ============================================================================
// Password Hasher Class
// ============================================================================

/**
 * Password hasher with configurable algorithms
 *
 * Supports bcrypt and argon2 algorithms. Falls back to scrypt-based
 * implementation when native modules are not available.
 *
 * @example
 * ```typescript
 * const hasher = new PasswordHasher({ algorithm: 'bcrypt', bcryptRounds: 12 });
 *
 * // Hash a password
 * const hash = await hasher.hash('mypassword123');
 *
 * // Verify a password
 * const isValid = await hasher.verify('mypassword123', hash);
 * ```
 */
export class PasswordHasher {
  private readonly config: Required<HashConfig>;
  private bcrypt: typeof import('bcrypt') | null = null;
  private argon2: typeof import('argon2') | null = null;

  constructor(config: HashConfig = {}) {
    this.config = {
      algorithm: config.algorithm ?? 'bcrypt',
      bcryptRounds: config.bcryptRounds ?? DEFAULT_BCRYPT_ROUNDS,
      argon2MemoryCost: config.argon2MemoryCost ?? DEFAULT_ARGON2_MEMORY_COST,
      argon2TimeCost: config.argon2TimeCost ?? DEFAULT_ARGON2_TIME_COST,
      argon2Parallelism: config.argon2Parallelism ?? DEFAULT_ARGON2_PARALLELISM,
    };
  }

  /**
   * Lazily load bcrypt module
   */
  private async loadBcrypt(): Promise<typeof import('bcrypt')> {
    if (!this.bcrypt) {
      try {
        this.bcrypt = await import('bcrypt');
      } catch {
        throw new Error(
          'bcrypt module not found. Install it with: pnpm add bcrypt && pnpm add -D @types/bcrypt'
        );
      }
    }
    return this.bcrypt;
  }

  /**
   * Lazily load argon2 module
   */
  private async loadArgon2(): Promise<typeof import('argon2')> {
    if (!this.argon2) {
      try {
        this.argon2 = await import('argon2');
      } catch {
        throw new Error('argon2 module not found. Install it with: pnpm add argon2');
      }
    }
    return this.argon2;
  }

  /**
   * Hash a password using the configured algorithm
   */
  async hash(password: string): Promise<string> {
    if (this.config.algorithm === 'argon2') {
      return this.hashWithArgon2(password);
    }
    return this.hashWithBcrypt(password);
  }

  /**
   * Verify a password against a hash
   */
  async verify(password: string, hash: string): Promise<boolean> {
    // Detect hash type from format
    if (hash.startsWith('$argon2')) {
      return this.verifyWithArgon2(password, hash);
    }
    if (hash.startsWith('$2')) {
      return this.verifyWithBcrypt(password, hash);
    }
    if (hash.startsWith('$scrypt$')) {
      return this.verifyWithScrypt(password, hash);
    }

    throw new Error('Unknown hash format');
  }

  /**
   * Hash using bcrypt
   */
  private async hashWithBcrypt(password: string): Promise<string> {
    try {
      const bcrypt = await this.loadBcrypt();
      return bcrypt.hash(password, this.config.bcryptRounds);
    } catch (error) {
      // Fallback to scrypt if bcrypt fails
      if ((error as Error).message.includes('not found')) {
        console.warn('bcrypt not available, falling back to scrypt');
        return this.hashWithScrypt(password);
      }
      throw error;
    }
  }

  /**
   * Verify using bcrypt
   */
  private async verifyWithBcrypt(password: string, hash: string): Promise<boolean> {
    const bcrypt = await this.loadBcrypt();
    return bcrypt.compare(password, hash);
  }

  /**
   * Hash using argon2
   */
  private async hashWithArgon2(password: string): Promise<string> {
    try {
      const argon2 = await this.loadArgon2();
      return argon2.hash(password, {
        memoryCost: this.config.argon2MemoryCost,
        timeCost: this.config.argon2TimeCost,
        parallelism: this.config.argon2Parallelism,
        type: 2, // argon2id
      });
    } catch (error) {
      // Fallback to scrypt if argon2 fails
      if ((error as Error).message.includes('not found')) {
        console.warn('argon2 not available, falling back to scrypt');
        return this.hashWithScrypt(password);
      }
      throw error;
    }
  }

  /**
   * Verify using argon2
   */
  private async verifyWithArgon2(password: string, hash: string): Promise<boolean> {
    const argon2 = await this.loadArgon2();
    return argon2.verify(hash, password);
  }

  /**
   * Hash using Node.js built-in scrypt (fallback)
   */
  private async hashWithScrypt(password: string): Promise<string> {
    const salt = randomBytes(32);
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
    return `$scrypt$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
  }

  /**
   * Verify using scrypt
   */
  private async verifyWithScrypt(password: string, hash: string): Promise<boolean> {
    const parts = hash.split('$');
    if (parts.length !== 4 || parts[1] !== 'scrypt') {
      throw new Error('Invalid scrypt hash format');
    }

    const salt = Buffer.from(parts[2], 'hex');
    const storedKey = Buffer.from(parts[3], 'hex');
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;

    return timingSafeEqual(storedKey, derivedKey);
  }

  /**
   * Check if a hash needs rehashing (algorithm or cost changed)
   */
  needsRehash(hash: string): boolean {
    // If using argon2 but hash is bcrypt/scrypt, rehash
    if (this.config.algorithm === 'argon2' && !hash.startsWith('$argon2')) {
      return true;
    }

    // If using bcrypt but hash is argon2/scrypt, rehash
    if (this.config.algorithm === 'bcrypt' && !hash.startsWith('$2')) {
      return true;
    }

    // Check bcrypt rounds from hash and compare with configured rounds
    // bcrypt hashes include rounds in format: $2b$XX$... where XX is the rounds (cost factor)
    if (this.config.algorithm === 'bcrypt' && hash.startsWith('$2')) {
      const parts = hash.split('$');
      // Format: ['', '2b', 'rounds', 'salt+hash']
      if (parts.length >= 4) {
        const hashRounds = parseInt(parts[2], 10);
        if (!Number.isNaN(hashRounds) && hashRounds !== this.config.bcryptRounds) {
          return true;
        }
      }
    }

    return false;
  }
}

/**
 * Creates a new password hasher instance
 *
 * @example
 * ```typescript
 * const hasher = passwordHasher({ rounds: 12 });
 * const hash = await hasher.hash('password123');
 * ```
 */
export function passwordHasher(config?: HashConfig): PasswordHasher {
  return new PasswordHasher(config);
}

/**
 * Default password hasher instance (bcrypt, 12 rounds)
 */
let defaultHasher: PasswordHasher | null = null;

/**
 * Hash a password using the default hasher
 */
export async function hashPassword(password: string): Promise<string> {
  if (!defaultHasher) {
    defaultHasher = new PasswordHasher();
  }
  return defaultHasher.hash(password);
}

/**
 * Verify a password using the default hasher
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!defaultHasher) {
    defaultHasher = new PasswordHasher();
  }
  return defaultHasher.verify(password, hash);
}
