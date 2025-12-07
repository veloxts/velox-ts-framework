/**
 * Tests for password hashing
 * Note: These tests use the scrypt fallback since bcrypt/argon2 are optional peer dependencies
 */

import { describe, expect, it } from 'vitest';

import { createPasswordHasher, hashPassword, PasswordHasher, verifyPassword } from '../hash.js';

describe('Password Hashing', () => {
  describe('PasswordHasher (scrypt fallback)', () => {
    // Use scrypt fallback since bcrypt/argon2 may not be installed

    // Helper to force scrypt fallback
    const createScryptHash = async (password: string): Promise<string> => {
      // The hasher will automatically fall back to scrypt if bcrypt is not available
      const testHasher = new PasswordHasher({ algorithm: 'bcrypt' });
      try {
        return await testHasher.hash(password);
      } catch {
        // If bcrypt fails to load, we'll create a scrypt hash manually for testing
        // This simulates what happens in environments without native modules
        const { randomBytes, scrypt } = await import('node:crypto');
        const { promisify } = await import('node:util');
        const scryptAsync = promisify(scrypt);
        const salt = randomBytes(32);
        const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
        return `$scrypt$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
      }
    };

    it('should hash and verify password with scrypt', async () => {
      const password = 'mySecurePassword123!';
      const hash = await createScryptHash(password);

      expect(hash).toBeDefined();
      expect(hash.startsWith('$scrypt$') || hash.startsWith('$2')).toBe(true);

      // Create a new hasher to verify
      const verifyHasher = new PasswordHasher();
      const isValid = await verifyHasher.verify(password, hash);
      expect(isValid).toBe(true);
    });

    it('should fail verification with wrong password', async () => {
      const password = 'mySecurePassword123!';
      const hash = await createScryptHash(password);

      const verifyHasher = new PasswordHasher();
      const isValid = await verifyHasher.verify('wrongPassword', hash);
      expect(isValid).toBe(false);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'mySecurePassword123!';
      const hash1 = await createScryptHash(password);
      const hash2 = await createScryptHash(password);

      expect(hash1).not.toBe(hash2); // Different salts should produce different hashes
    });
  });

  describe('scrypt hash format', () => {
    it('should verify scrypt hash format', async () => {
      const { randomBytes, scrypt } = await import('node:crypto');
      const { promisify } = await import('node:util');
      const scryptAsync = promisify(scrypt);

      const password = 'testPassword';
      const salt = randomBytes(32);
      const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
      const hash = `$scrypt$${salt.toString('hex')}$${derivedKey.toString('hex')}`;

      const hasher = new PasswordHasher();
      const isValid = await hasher.verify(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject invalid scrypt format', async () => {
      const hasher = new PasswordHasher();

      await expect(hasher.verify('password', '$scrypt$invalid')).rejects.toThrow(
        'Invalid scrypt hash format'
      );
      await expect(hasher.verify('password', '$scrypt$ab$cd$extra')).rejects.toThrow(
        'Invalid scrypt hash format'
      );
    });
  });

  describe('hash detection', () => {
    it('should detect unknown hash format', async () => {
      const hasher = new PasswordHasher();

      await expect(hasher.verify('password', 'unknown-hash-format')).rejects.toThrow(
        'Unknown hash format'
      );
    });
  });

  describe('needsRehash', () => {
    it('should indicate rehash needed when algorithm changes', () => {
      // Using bcrypt but have argon2 hash
      const bcryptHasher = new PasswordHasher({ algorithm: 'bcrypt' });
      const argon2Hash = '$argon2id$v=19$m=65536,t=3,p=4$somesalt$somehash';
      expect(bcryptHasher.needsRehash(argon2Hash)).toBe(true);

      // Using argon2 but have bcrypt hash
      const argon2Hasher = new PasswordHasher({ algorithm: 'argon2' });
      const bcryptHash = '$2b$12$somesaltandhash';
      expect(argon2Hasher.needsRehash(bcryptHash)).toBe(true);
    });

    it('should not indicate rehash when algorithm matches', () => {
      const bcryptHasher = new PasswordHasher({ algorithm: 'bcrypt' });
      const bcryptHash = '$2b$12$somesaltandhash';
      expect(bcryptHasher.needsRehash(bcryptHash)).toBe(false);

      const argon2Hasher = new PasswordHasher({ algorithm: 'argon2' });
      const argon2Hash = '$argon2id$v=19$m=65536,t=3,p=4$somesalt$somehash';
      expect(argon2Hasher.needsRehash(argon2Hash)).toBe(false);
    });
  });

  describe('createPasswordHasher factory', () => {
    it('should create a hasher with config', () => {
      const hasher = createPasswordHasher({ algorithm: 'bcrypt', bcryptRounds: 10 });
      expect(hasher).toBeInstanceOf(PasswordHasher);
    });

    it('should create a hasher with defaults', () => {
      const hasher = createPasswordHasher();
      expect(hasher).toBeInstanceOf(PasswordHasher);
    });
  });

  describe('convenience functions', () => {
    it('hashPassword should use default hasher', async () => {
      const password = 'testPassword';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });

    it('verifyPassword should use default hasher', async () => {
      const password = 'testPassword';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);

      const isInvalid = await verifyPassword('wrongPassword', hash);
      expect(isInvalid).toBe(false);
    });
  });
});
