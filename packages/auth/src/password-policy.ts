/**
 * Password policy validation and strength scoring
 *
 * Provides configurable password requirements, strength scoring,
 * common password checking, and optional breach detection.
 *
 * @module auth/password-policy
 */

import { createHash } from 'node:crypto';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Password policy requirements configuration
 */
export interface PasswordPolicyConfig {
  /**
   * Minimum password length
   * @default 12
   */
  minLength?: number;

  /**
   * Maximum password length (0 for no limit)
   * @default 128
   */
  maxLength?: number;

  /**
   * Require at least one uppercase letter
   * @default false
   */
  requireUppercase?: boolean;

  /**
   * Require at least one lowercase letter
   * @default false
   */
  requireLowercase?: boolean;

  /**
   * Require at least one digit
   * @default false
   */
  requireDigits?: boolean;

  /**
   * Require at least one special character
   * @default false
   */
  requireSpecialChars?: boolean;

  /**
   * Custom special characters set
   * @default "!@#$%^&*()_+-=[]{}|;:,.<>?"
   */
  specialChars?: string;

  /**
   * Disallow common passwords from list
   * @default true
   */
  disallowCommon?: boolean;

  /**
   * Check password against Have I Been Pwned API
   * @default false
   */
  checkBreaches?: boolean;

  /**
   * Maximum allowed occurrences in breaches (0 = any breach fails)
   * @default 0
   */
  maxBreachOccurrences?: number;

  /**
   * Custom password blacklist
   * @default []
   */
  blacklist?: readonly string[];

  /**
   * Disallow passwords containing user information
   * (email, username, etc. - must be provided during validation)
   * @default true
   */
  disallowUserInfo?: boolean;
}

/**
 * Password strength levels
 */
export enum PasswordStrength {
  VeryWeak = 0,
  Weak = 1,
  Fair = 2,
  Strong = 3,
  VeryStrong = 4,
}

/**
 * Password validation result
 */
export interface PasswordValidationResult {
  /** Whether password passes all requirements */
  valid: boolean;

  /** Validation error messages */
  errors: string[];

  /** Password strength score (0-4) */
  strength: PasswordStrength;

  /** Detailed strength score (0-100) */
  score: number;

  /** Whether password was found in breach database */
  breached?: boolean;

  /** Number of times password appeared in breaches */
  breachCount?: number;
}

/**
 * User information for password validation
 */
export interface UserInfo {
  /** User's email address */
  email?: string;

  /** Username */
  username?: string;

  /** First name */
  firstName?: string;

  /** Last name */
  lastName?: string;

  /** Any other identifying information to exclude */
  [key: string]: string | undefined;
}

// ============================================================================
// Common Passwords List (Top 100)
// ============================================================================

/**
 * Most common passwords to block (from NCSC/HaveIBeenPwned research)
 */
const COMMON_PASSWORDS = new Set([
  '123456',
  'password',
  '12345678',
  'qwerty',
  '123456789',
  '12345',
  '1234',
  '111111',
  '1234567',
  'dragon',
  '123123',
  'baseball',
  'iloveyou',
  '2000',
  '2001',
  '2002',
  '2003',
  '2004',
  '2005',
  'trustno1',
  'monkey',
  '1234567890',
  'master',
  'superman',
  'qwertyuiop',
  '654321',
  'letmein',
  'football',
  'shadow',
  'michael',
  'jennifer',
  '1111',
  '2222',
  '3333',
  '4444',
  '5555',
  '6666',
  '7777',
  '8888',
  '9999',
  '0000',
  'abc123',
  'batman',
  'welcome',
  'sunshine',
  'princess',
  'password1',
  'password123',
  'admin',
  'login',
  'passw0rd',
  'qwerty123',
  'solo',
  'starwars',
  'whatever',
  'charlie',
  'donald',
  'freedom',
  'ginger',
  'jordan',
  'killer',
  'liverpool',
  'london',
  'michelle',
  'thomas',
  'trustno',
  'cheese',
  'coffee',
  'cookie',
  'pepper',
  'summer',
  'winter',
  'welcome1',
  'access',
  'lovely',
  'bailey',
  'orange',
  'ashley',
  'daniel',
  'monkey1',
  'purple',
  'rangers',
  'secret',
  'secret1',
  'test',
  'test123',
  'computer',
  'internet',
  'maverick',
  'matrix',
  'phoenix',
  'thunder',
  'zxcvbnm',
  'hello',
  'hello123',
]);

// ============================================================================
// Password Policy Class
// ============================================================================

/**
 * Password policy validator and strength scorer
 *
 * @example
 * ```typescript
 * const policy = new PasswordPolicy({
 *   minLength: 12,
 *   requireUppercase: true,
 *   requireLowercase: true,
 *   requireDigits: true,
 *   checkBreaches: true,
 * });
 *
 * // Validate password
 * const result = await policy.validate('MyP@ssw0rd123', {
 *   email: 'user@example.com',
 * });
 *
 * if (!result.valid) {
 *   console.log('Errors:', result.errors);
 * }
 *
 * console.log('Strength:', PasswordStrength[result.strength]);
 * console.log('Score:', result.score);
 * ```
 */
export class PasswordPolicy {
  private readonly config: Required<PasswordPolicyConfig>;

  constructor(config: PasswordPolicyConfig = {}) {
    this.config = {
      minLength: config.minLength ?? 12,
      maxLength: config.maxLength ?? 128,
      requireUppercase: config.requireUppercase ?? false,
      requireLowercase: config.requireLowercase ?? false,
      requireDigits: config.requireDigits ?? false,
      requireSpecialChars: config.requireSpecialChars ?? false,
      specialChars: config.specialChars ?? '!@#$%^&*()_+-=[]{}|;:,.<>?',
      disallowCommon: config.disallowCommon ?? true,
      checkBreaches: config.checkBreaches ?? false,
      maxBreachOccurrences: config.maxBreachOccurrences ?? 0,
      blacklist: config.blacklist ?? [],
      disallowUserInfo: config.disallowUserInfo ?? true,
    };
  }

  /**
   * Validate a password against the policy
   *
   * @param password - Password to validate
   * @param userInfo - Optional user information to check against
   * @returns Validation result with errors and strength score
   */
  async validate(password: string, userInfo?: UserInfo): Promise<PasswordValidationResult> {
    const errors: string[] = [];

    // Length requirements
    if (password.length < this.config.minLength) {
      errors.push(`Password must be at least ${this.config.minLength} characters long`);
    }

    if (this.config.maxLength > 0 && password.length > this.config.maxLength) {
      errors.push(`Password must not exceed ${this.config.maxLength} characters`);
    }

    // Character requirements
    if (this.config.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (this.config.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (this.config.requireDigits && !/\d/.test(password)) {
      errors.push('Password must contain at least one digit');
    }

    if (this.config.requireSpecialChars) {
      const specialCharsRegex = new RegExp(`[${escapeRegex(this.config.specialChars)}]`);
      if (!specialCharsRegex.test(password)) {
        errors.push('Password must contain at least one special character');
      }
    }

    // Common password check
    if (this.config.disallowCommon) {
      const lowerPassword = password.toLowerCase();
      if (COMMON_PASSWORDS.has(lowerPassword)) {
        errors.push('Password is too common and easily guessable');
      }
    }

    // Custom blacklist check
    if (this.config.blacklist.length > 0) {
      const lowerPassword = password.toLowerCase();
      for (const banned of this.config.blacklist) {
        if (lowerPassword === banned.toLowerCase()) {
          errors.push('Password is not allowed');
          break;
        }
      }
    }

    // User information check
    if (this.config.disallowUserInfo && userInfo) {
      const lowerPassword = password.toLowerCase();
      const infoValues = Object.values(userInfo).filter(
        (v): v is string => typeof v === 'string' && v.length > 0
      );

      for (const value of infoValues) {
        const lowerValue = value.toLowerCase();

        // Check if password contains user info
        if (lowerPassword.includes(lowerValue)) {
          errors.push('Password must not contain personal information');
          break;
        }

        // Check if password is similar to email username
        if (value.includes('@')) {
          const username = value.split('@')[0].toLowerCase();
          if (username.length >= 3 && lowerPassword.includes(username)) {
            errors.push('Password must not contain personal information');
            break;
          }
        }
      }
    }

    // Strength score
    const { score, strength } = this.calculateStrength(password);

    // Breach check (async)
    let breached: boolean | undefined;
    let breachCount: number | undefined;

    if (this.config.checkBreaches) {
      try {
        breachCount = await this.checkBreaches(password);
        breached = breachCount > this.config.maxBreachOccurrences;

        if (breached) {
          errors.push(`Password has been found in ${breachCount} data breaches and is not secure`);
        }
      } catch (error) {
        // Breach check failed - log but don't fail validation
        console.warn('Password breach check failed:', error);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      strength,
      score,
      breached,
      breachCount,
    };
  }

  /**
   * Calculate password strength score (0-100) and level (0-4)
   *
   * Based on:
   * - Length
   * - Character variety (uppercase, lowercase, digits, special)
   * - Entropy
   * - Pattern detection
   */
  calculateStrength(password: string): { score: number; strength: PasswordStrength } {
    let score = 0;

    // Length scoring (up to 30 points)
    if (password.length >= 8) score += 10;
    if (password.length >= 12) score += 10;
    if (password.length >= 16) score += 5;
    if (password.length >= 20) score += 5;

    // Character variety (up to 40 points)
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSpecial = /[^a-zA-Z0-9]/.test(password);

    const varietyCount = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;
    score += varietyCount * 10;

    // Entropy bonus (up to 20 points)
    const entropy = this.calculateEntropy(password);
    if (entropy >= 30) score += 5;
    if (entropy >= 40) score += 5;
    if (entropy >= 50) score += 5;
    if (entropy >= 60) score += 5;

    // Pattern penalties (up to -20 points)
    if (/(.)\1{2,}/.test(password)) score -= 5; // Repeated characters (aaa, 111)
    if (/^[a-z]+$/.test(password)) score -= 5; // Only lowercase
    if (/^[A-Z]+$/.test(password)) score -= 5; // Only uppercase
    if (/^\d+$/.test(password)) score -= 10; // Only digits
    if (/^(012|123|234|345|456|567|678|789|890)/.test(password)) score -= 5; // Sequential

    // Bonus for mixing character positions (up to 10 points)
    const mixedPositions = this.checkMixedPositions(password);
    if (mixedPositions) score += 10;

    // Ensure score is within bounds
    score = Math.max(0, Math.min(100, score));

    // Convert score to strength level
    let strength: PasswordStrength;
    if (score < 20) strength = PasswordStrength.VeryWeak;
    else if (score < 40) strength = PasswordStrength.Weak;
    else if (score < 60) strength = PasswordStrength.Fair;
    else if (score < 80) strength = PasswordStrength.Strong;
    else strength = PasswordStrength.VeryStrong;

    return { score, strength };
  }

  /**
   * Calculate Shannon entropy of password
   */
  private calculateEntropy(password: string): number {
    const charCounts = new Map<string, number>();

    for (const char of password) {
      charCounts.set(char, (charCounts.get(char) ?? 0) + 1);
    }

    let entropy = 0;
    const length = password.length;

    for (const count of charCounts.values()) {
      const probability = count / length;
      entropy -= probability * Math.log2(probability);
    }

    return entropy * length;
  }

  /**
   * Check if character types are well-mixed (not clustered)
   */
  private checkMixedPositions(password: string): boolean {
    if (password.length < 4) return false;

    const quarters = [
      password.slice(0, Math.floor(password.length / 4)),
      password.slice(Math.floor(password.length / 4), Math.floor(password.length / 2)),
      password.slice(Math.floor(password.length / 2), Math.floor((3 * password.length) / 4)),
      password.slice(Math.floor((3 * password.length) / 4)),
    ];

    // Check that each quarter has some variety
    let varietyQuarters = 0;
    for (const quarter of quarters) {
      const hasAlpha = /[a-zA-Z]/.test(quarter);
      const hasDigit = /\d/.test(quarter);
      const hasSpecial = /[^a-zA-Z0-9]/.test(quarter);

      if ([hasAlpha, hasDigit, hasSpecial].filter(Boolean).length >= 2) {
        varietyQuarters++;
      }
    }

    return varietyQuarters >= 3;
  }

  /**
   * Check password against Have I Been Pwned API
   *
   * Uses k-anonymity: only sends first 5 chars of SHA-1 hash
   * to protect password privacy.
   *
   * @returns Number of times password appears in breaches (0 = not found)
   */
  private async checkBreaches(password: string): Promise<number> {
    return queryBreachDatabase(password);
  }

  /**
   * Get password strength as human-readable string
   */
  getStrengthLabel(strength: PasswordStrength): string {
    switch (strength) {
      case PasswordStrength.VeryWeak:
        return 'Very Weak';
      case PasswordStrength.Weak:
        return 'Weak';
      case PasswordStrength.Fair:
        return 'Fair';
      case PasswordStrength.Strong:
        return 'Strong';
      case PasswordStrength.VeryStrong:
        return 'Very Strong';
    }
  }

  /**
   * Get password strength color (for UI display)
   */
  getStrengthColor(strength: PasswordStrength): string {
    switch (strength) {
      case PasswordStrength.VeryWeak:
        return '#d73a49'; // Red
      case PasswordStrength.Weak:
        return '#e36209'; // Orange
      case PasswordStrength.Fair:
        return '#ffd33d'; // Yellow
      case PasswordStrength.Strong:
        return '#28a745'; // Green
      case PasswordStrength.VeryStrong:
        return '#0366d6'; // Blue
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Escape special characters for regex
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Query Have I Been Pwned API for password breach count
 *
 * Uses k-anonymity: only sends first 5 chars of SHA-1 hash
 * to protect password privacy.
 *
 * @param password - The password to check
 * @returns Number of times password appears in breaches (0 = not found)
 * @internal This is the core implementation used by both PasswordPolicy and checkPasswordBreach
 */
async function queryBreachDatabase(password: string): Promise<number> {
  // Hash password with SHA-1
  const hash = createHash('sha1').update(password).digest('hex').toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  // Query API with hash prefix
  const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: {
      'User-Agent': 'VeloxTS-Auth-Password-Policy',
    },
  });

  if (!response.ok) {
    throw new Error(`HaveIBeenPwned API error: ${response.status}`);
  }

  const text = await response.text();
  const lines = text.split('\n');

  // Search for our suffix in results
  for (const line of lines) {
    const [hashSuffix, countStr] = line.split(':');
    if (hashSuffix === suffix) {
      return parseInt(countStr.trim(), 10);
    }
  }

  return 0; // Not found in breaches
}

// ============================================================================
// Convenience Exports
// ============================================================================

/**
 * Create a password policy validator (succinct API)
 *
 * @example
 * ```typescript
 * import { passwordPolicy } from '@veloxts/auth';
 *
 * const policy = passwordPolicy({
 *   minLength: 12,
 *   requireUppercase: true,
 *   requireDigits: true,
 * });
 *
 * const result = await policy.validate('MyPassword123');
 * ```
 */
export function passwordPolicy(config?: PasswordPolicyConfig): PasswordPolicy {
  return new PasswordPolicy(config);
}

/**
 * Quick password strength check (no policy validation)
 *
 * @example
 * ```typescript
 * import { checkPasswordStrength } from '@veloxts/auth';
 *
 * const { strength, score } = checkPasswordStrength('MyP@ssw0rd123');
 * console.log(PasswordStrength[strength]); // "Strong"
 * console.log(score); // 75
 * ```
 */
export function checkPasswordStrength(password: string): {
  score: number;
  strength: PasswordStrength;
} {
  const policy = new PasswordPolicy();
  return policy.calculateStrength(password);
}

/**
 * Quick common password check
 *
 * @example
 * ```typescript
 * import { isCommonPassword } from '@veloxts/auth';
 *
 * if (isCommonPassword('password123')) {
 *   console.log('Please choose a more secure password');
 * }
 * ```
 */
export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password.toLowerCase());
}

/**
 * Check password against Have I Been Pwned
 *
 * Uses k-anonymity: only sends first 5 chars of SHA-1 hash
 * to protect password privacy.
 *
 * @example
 * ```typescript
 * import { checkPasswordBreach } from '@veloxts/auth';
 *
 * const count = await checkPasswordBreach('password123');
 * if (count > 0) {
 *   console.log(`Found in ${count} breaches!`);
 * }
 * ```
 */
export async function checkPasswordBreach(password: string): Promise<number> {
  return queryBreachDatabase(password);
}
