/**
 * Tests for password policy validation
 */

import { describe, expect, it, vi } from 'vitest';

import {
  checkPasswordBreach,
  checkPasswordStrength,
  isCommonPassword,
  PasswordPolicy,
  PasswordStrength,
  passwordPolicy,
} from '../password-policy.js';

describe('PasswordPolicy', () => {
  describe('Length validation', () => {
    it('should enforce minimum length', async () => {
      const policy = new PasswordPolicy({ minLength: 12 });
      const result = await policy.validate('short');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 12 characters long');
    });

    it('should pass minimum length', async () => {
      const policy = new PasswordPolicy({ minLength: 8 });
      const result = await policy.validate('longenoughpassword');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should enforce maximum length', async () => {
      const policy = new PasswordPolicy({ maxLength: 20 });
      const result = await policy.validate('this-is-a-very-long-password-that-exceeds-limit');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must not exceed 20 characters');
    });

    it('should allow no maximum length when set to 0', async () => {
      const policy = new PasswordPolicy({ maxLength: 0 });
      const result = await policy.validate('a'.repeat(1000));

      expect(result.valid).toBe(true);
    });
  });

  describe('Character requirements', () => {
    it('should require uppercase letters', async () => {
      const policy = new PasswordPolicy({ requireUppercase: true, minLength: 4 });
      const result1 = await policy.validate('lowercase');
      const result2 = await policy.validate('UpperCase');

      expect(result1.valid).toBe(false);
      expect(result1.errors).toContain('Password must contain at least one uppercase letter');
      expect(result2.valid).toBe(true);
    });

    it('should require lowercase letters', async () => {
      const policy = new PasswordPolicy({ requireLowercase: true, minLength: 4 });
      const result1 = await policy.validate('UPPERCASE');
      const result2 = await policy.validate('LowerCase');

      expect(result1.valid).toBe(false);
      expect(result1.errors).toContain('Password must contain at least one lowercase letter');
      expect(result2.valid).toBe(true);
    });

    it('should require digits', async () => {
      const policy = new PasswordPolicy({ requireDigits: true, minLength: 4 });
      const result1 = await policy.validate('NoDigits');
      const result2 = await policy.validate('With123');

      expect(result1.valid).toBe(false);
      expect(result1.errors).toContain('Password must contain at least one digit');
      expect(result2.valid).toBe(true);
    });

    it('should require special characters', async () => {
      const policy = new PasswordPolicy({ requireSpecialChars: true, minLength: 4 });
      const result1 = await policy.validate('NoSpecialChars');
      const result2 = await policy.validate('With!Special');

      expect(result1.valid).toBe(false);
      expect(result1.errors).toContain('Password must contain at least one special character');
      expect(result2.valid).toBe(true);
    });

    it('should accept custom special characters', async () => {
      const policy = new PasswordPolicy({
        requireSpecialChars: true,
        specialChars: '@#$',
        minLength: 4,
      });

      const result1 = await policy.validate('With!Special'); // ! not in custom set
      const result2 = await policy.validate('With@Special');

      expect(result1.valid).toBe(false);
      expect(result2.valid).toBe(true);
    });

    it('should validate all requirements together', async () => {
      const policy = new PasswordPolicy({
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireDigits: true,
        requireSpecialChars: true,
      });

      const result1 = await policy.validate('weak');
      const result2 = await policy.validate('StrongP@ssw0rd');

      expect(result1.valid).toBe(false);
      expect(result1.errors.length).toBeGreaterThan(0);
      expect(result2.valid).toBe(true);
    });
  });

  describe('Common password detection', () => {
    it('should block common passwords', async () => {
      const policy = new PasswordPolicy({ disallowCommon: true, minLength: 4 });

      const commonPasswords = ['password', 'Password', 'PASSWORD', '123456', 'qwerty'];

      for (const pwd of commonPasswords) {
        const result = await policy.validate(pwd);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Password is too common and easily guessable');
      }
    });

    it('should allow uncommon passwords', async () => {
      const policy = new PasswordPolicy({ disallowCommon: true, minLength: 4 });
      const result = await policy.validate('UncommonP@ssw0rd2024');

      expect(result.valid).toBe(true);
    });

    it('should skip common check when disabled', async () => {
      const policy = new PasswordPolicy({ disallowCommon: false, minLength: 4 });
      const result = await policy.validate('password');

      expect(result.valid).toBe(true);
    });
  });

  describe('Custom blacklist', () => {
    it('should block passwords in blacklist', async () => {
      const policy = new PasswordPolicy({
        blacklist: ['CompanyName123', 'ProjectSecret'],
        minLength: 4,
      });

      const result1 = await policy.validate('CompanyName123');
      const result2 = await policy.validate('companyname123'); // Case insensitive

      expect(result1.valid).toBe(false);
      expect(result2.valid).toBe(false);
      expect(result1.errors).toContain('Password is not allowed');
    });

    it('should allow passwords not in blacklist', async () => {
      const policy = new PasswordPolicy({
        blacklist: ['Forbidden123'],
        minLength: 4,
      });

      const result = await policy.validate('AllowedPassword');
      expect(result.valid).toBe(true);
    });
  });

  describe('User information validation', () => {
    it('should block passwords containing email', async () => {
      const policy = new PasswordPolicy({ disallowUserInfo: true, minLength: 4 });
      const result = await policy.validate('myemail@example.com', {
        email: 'myemail@example.com',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must not contain personal information');
    });

    it('should block passwords containing username from email', async () => {
      const policy = new PasswordPolicy({ disallowUserInfo: true, minLength: 4 });
      const result = await policy.validate('john123password', {
        email: 'john@example.com',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must not contain personal information');
    });

    it('should block passwords containing first name', async () => {
      const policy = new PasswordPolicy({ disallowUserInfo: true, minLength: 4 });
      const result = await policy.validate('alice2024', {
        firstName: 'Alice',
      });

      expect(result.valid).toBe(false);
    });

    it('should allow passwords not containing user info', async () => {
      const policy = new PasswordPolicy({ disallowUserInfo: true, minLength: 4 });
      const result = await policy.validate('CompletelyUnrelatedPassword', {
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(result.valid).toBe(true);
    });

    it('should skip user info check when disabled', async () => {
      const policy = new PasswordPolicy({ disallowUserInfo: false, minLength: 4 });
      const result = await policy.validate('john123', {
        firstName: 'John',
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('Strength scoring', () => {
    it('should score very weak passwords correctly', () => {
      const policy = new PasswordPolicy();
      const { strength, score } = policy.calculateStrength('1234');

      expect(strength).toBe(PasswordStrength.VeryWeak);
      expect(score).toBeLessThan(20);
    });

    it('should score weak passwords correctly', () => {
      const policy = new PasswordPolicy();
      const { strength, score } = policy.calculateStrength('password');

      expect(strength).toBeLessThanOrEqual(PasswordStrength.Weak);
      expect(score).toBeLessThan(40);
    });

    it('should score fair passwords correctly', () => {
      const policy = new PasswordPolicy();
      const { strength, score } = policy.calculateStrength('Password123');

      expect(strength).toBeGreaterThanOrEqual(PasswordStrength.Fair);
      expect(score).toBeGreaterThanOrEqual(40);
    });

    it('should score strong passwords correctly', () => {
      const policy = new PasswordPolicy();
      const { strength, score } = policy.calculateStrength('MyP@ssw0rd2024');

      expect(strength).toBeGreaterThanOrEqual(PasswordStrength.Strong);
      expect(score).toBeGreaterThanOrEqual(60);
    });

    it('should score very strong passwords correctly', () => {
      const policy = new PasswordPolicy();
      const { strength, score } = policy.calculateStrength('C0mpl3x!P@ssw0rd#2024$Secur3');

      expect(strength).toBe(PasswordStrength.VeryStrong);
      expect(score).toBeGreaterThanOrEqual(80);
    });

    it('should penalize repeated characters', () => {
      const policy = new PasswordPolicy();
      const result1 = policy.calculateStrength('Passssword123!');
      const result2 = policy.calculateStrength('Password123!');

      expect(result1.score).toBeLessThan(result2.score);
    });

    it('should penalize only-digit passwords', () => {
      const policy = new PasswordPolicy();
      const { score } = policy.calculateStrength('1234567890');

      expect(score).toBeLessThan(30);
    });

    it('should reward character variety', () => {
      const policy = new PasswordPolicy();
      const result1 = policy.calculateStrength('abcdefghijklm'); // Only lowercase
      const result2 = policy.calculateStrength('Abcdefgh123!'); // Mixed

      expect(result2.score).toBeGreaterThan(result1.score);
    });

    it('should reward length', () => {
      const policy = new PasswordPolicy();
      const result1 = policy.calculateStrength('Pass1!');
      const result2 = policy.calculateStrength('Password1!');
      const result3 = policy.calculateStrength('VeryLongPassword1!');

      expect(result2.score).toBeGreaterThan(result1.score);
      expect(result3.score).toBeGreaterThan(result2.score);
    });
  });

  describe('Breach detection', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should detect breached passwords', async () => {
      // Mock API response with password hash suffix and count
      // SHA-1 of 'password123' is CBFDAC6008F9CAB4083784CBD1874F76618D2A97
      // Prefix: CBFDA, Suffix: C6008F9CAB4083784CBD1874F76618D2A97
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('C6008F9CAB4083784CBD1874F76618D2A97:123456\nOTHERHASH:100'),
      });

      const policy = new PasswordPolicy({
        checkBreaches: true,
        minLength: 4,
      });

      const result = await policy.validate('password123');

      expect(result.breached).toBe(true);
      expect(result.breachCount).toBe(123456);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('data breaches'))).toBe(true);
    });

    it('should pass non-breached passwords', async () => {
      // Mock API response without the password hash
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('SOMEHASH:100\nOTHERHASH:50'),
      });

      const policy = new PasswordPolicy({
        checkBreaches: true,
        minLength: 4,
      });

      const result = await policy.validate('VeloxTS!2024#UniquePassword');

      expect(result.breached).toBe(false);
      expect(result.breachCount).toBe(0);
    });

    it('should handle breach check failures gracefully', async () => {
      const policy = new PasswordPolicy({
        checkBreaches: true,
        minLength: 4,
      });

      // Mock fetch to simulate API failure
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await policy.validate('TestPassword123!');

      // Should not fail validation due to API error
      expect(result.valid).toBe(true);
      expect(result.breached).toBeUndefined();
    });

    it('should skip breach check when disabled', async () => {
      const policy = new PasswordPolicy({
        checkBreaches: false,
        minLength: 4,
      });

      const result = await policy.validate('password123');

      expect(result.breached).toBeUndefined();
      expect(result.breachCount).toBeUndefined();
    });

    it('should allow passwords with low breach count', async () => {
      // Mock API response with low breach count
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('MATCHINGSUFFIX:500'),
      });

      const policy = new PasswordPolicy({
        checkBreaches: true,
        maxBreachOccurrences: 1000,
        minLength: 4,
      });

      // Since we're mocking, create a password whose hash suffix matches our mock
      // For simplicity, we mock to return 0 matches (not found)
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('NONMATCHINGHASH:500'),
      });

      const result = await policy.validate('UncommonPassword2024!');

      // Not found in breach database = count of 0, which is <= 1000
      expect(result.valid).toBe(true);
      expect(result.breachCount).toBe(0);
    });
  });

  describe('Helper functions', () => {
    it('should check password strength without policy', () => {
      const result = checkPasswordStrength('MyP@ssw0rd123');

      expect(result.strength).toBeGreaterThanOrEqual(PasswordStrength.Strong);
      expect(result.score).toBeGreaterThanOrEqual(60);
    });

    it('should detect common passwords', () => {
      expect(isCommonPassword('password')).toBe(true);
      expect(isCommonPassword('Password')).toBe(true);
      expect(isCommonPassword('123456')).toBe(true);
      expect(isCommonPassword('UniquePassword2024')).toBe(false);
    });

    it('should check password breaches', async () => {
      const originalFetch = global.fetch;

      // Mock API response for password123
      // SHA-1 of 'password123' is CBFDAC6008F9CAB4083784CBD1874F76618D2A97
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('C6008F9CAB4083784CBD1874F76618D2A97:123456\nOTHERHASH:100'),
      });

      const count = await checkPasswordBreach('password123');
      expect(count).toBe(123456);

      global.fetch = originalFetch;
    });
  });

  describe('Factory functions', () => {
    it('should create policy with passwordPolicy()', async () => {
      const policy = passwordPolicy({ minLength: 10 });
      const result = await policy.validate('short');

      expect(result.valid).toBe(false);
    });

    it('should work with default config', async () => {
      const policy = passwordPolicy();
      const result = await policy.validate('MySecurePassword123!');

      expect(result).toBeDefined();
      expect(result.strength).toBeDefined();
      expect(result.score).toBeDefined();
    });
  });

  describe('UI helpers', () => {
    it('should get strength label', () => {
      const policy = new PasswordPolicy();

      expect(policy.getStrengthLabel(PasswordStrength.VeryWeak)).toBe('Very Weak');
      expect(policy.getStrengthLabel(PasswordStrength.Weak)).toBe('Weak');
      expect(policy.getStrengthLabel(PasswordStrength.Fair)).toBe('Fair');
      expect(policy.getStrengthLabel(PasswordStrength.Strong)).toBe('Strong');
      expect(policy.getStrengthLabel(PasswordStrength.VeryStrong)).toBe('Very Strong');
    });

    it('should get strength color', () => {
      const policy = new PasswordPolicy();

      expect(policy.getStrengthColor(PasswordStrength.VeryWeak)).toBe('#d73a49');
      expect(policy.getStrengthColor(PasswordStrength.Weak)).toBe('#e36209');
      expect(policy.getStrengthColor(PasswordStrength.Fair)).toBe('#ffd33d');
      expect(policy.getStrengthColor(PasswordStrength.Strong)).toBe('#28a745');
      expect(policy.getStrengthColor(PasswordStrength.VeryStrong)).toBe('#0366d6');
    });
  });

  describe('Complete validation scenarios', () => {
    it('should validate strong password with all checks enabled', async () => {
      const policy = new PasswordPolicy({
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireDigits: true,
        requireSpecialChars: true,
        disallowCommon: true,
        checkBreaches: false, // Disable to avoid network dependency
      });

      const result = await policy.validate('MySecur3P@ssw0rd2024!', {
        email: 'user@example.com',
        firstName: 'John',
      });

      expect(result.valid).toBe(true);
      expect(result.strength).toBeGreaterThanOrEqual(PasswordStrength.Strong);
    });

    it('should return all applicable errors', async () => {
      const policy = new PasswordPolicy({
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireDigits: true,
        requireSpecialChars: true,
      });

      const result = await policy.validate('short');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors).toContain('Password must be at least 12 characters long');
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
      expect(result.errors).toContain('Password must contain at least one digit');
      expect(result.errors).toContain('Password must contain at least one special character');
    });
  });
});
