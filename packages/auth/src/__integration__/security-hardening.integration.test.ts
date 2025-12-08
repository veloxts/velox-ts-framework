/**
 * Integration tests demonstrating security hardening features
 *
 * Shows rate limiting, CSRF protection, and password policy working together
 */

import { describe, expect, it } from 'vitest';

import { csrfMiddleware } from '../csrf.js';
import { PasswordPolicy, PasswordStrength } from '../password-policy.js';
import { authRateLimiter } from '../rate-limit.js';

describe('Security Hardening Integration', () => {
  describe('Rate Limiting', () => {
    it('should provide auth-specific rate limiters', () => {
      // Rate limiters for different auth operations
      expect(authRateLimiter.login).toBeDefined();
      expect(authRateLimiter.register).toBeDefined();
      expect(authRateLimiter.passwordReset).toBeDefined();
      expect(authRateLimiter.refresh).toBeDefined();

      // Helper methods
      expect(authRateLimiter.recordFailure).toBeDefined();
      expect(authRateLimiter.resetLimit).toBeDefined();
      expect(authRateLimiter.isLockedOut).toBeDefined();
      expect(authRateLimiter.getRemainingAttempts).toBeDefined();
    });

    it('should track failed attempts', () => {
      const key = 'test@example.com';

      // Initially should have max attempts available
      const remaining1 = authRateLimiter.getRemainingAttempts(key, 'login');
      expect(remaining1).toBe(5); // Default max attempts

      // Record a failure
      authRateLimiter.recordFailure(key, 'login');

      // Should have one fewer attempt
      const remaining2 = authRateLimiter.getRemainingAttempts(key, 'login');
      expect(remaining2).toBe(4);

      // Reset limit
      authRateLimiter.resetLimit(key, 'login');

      // Should be back to max
      const remaining3 = authRateLimiter.getRemainingAttempts(key, 'login');
      expect(remaining3).toBe(5);
    });

    it('should detect lockout state', () => {
      const key = 'locked@example.com';

      // Initially not locked out
      expect(authRateLimiter.isLockedOut(key, 'login')).toBe(false);

      // Record max failures to trigger lockout
      for (let i = 0; i < 6; i++) {
        authRateLimiter.recordFailure(key, 'login');
      }

      // Should now be locked out
      expect(authRateLimiter.isLockedOut(key, 'login')).toBe(true);
      expect(authRateLimiter.getRemainingAttempts(key, 'login')).toBe(0);

      // Clean up
      authRateLimiter.resetLimit(key, 'login');
    });
  });

  describe('CSRF Protection', () => {
    it('should create CSRF middleware', () => {
      const csrf = csrfMiddleware({
        token: {
          secret: 'test-secret-that-is-at-least-32-characters-long',
        },
      });

      expect(csrf.protect).toBeDefined();
      expect(csrf.provide).toBeDefined();
      expect(csrf.manager).toBeDefined();
    });

    it('should have manager with token operations', () => {
      const csrf = csrfMiddleware({
        token: {
          secret: 'test-secret-that-is-at-least-32-characters-long',
        },
      });

      expect(csrf.manager.generateToken).toBeDefined();
      expect(csrf.manager.validateToken).toBeDefined();
      expect(csrf.manager.verifySignature).toBeDefined();
      expect(csrf.manager.parseToken).toBeDefined();
    });
  });

  describe('Password Policy', () => {
    it('should validate passwords with comprehensive rules', async () => {
      const policy = new PasswordPolicy({
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireDigits: true,
        requireSpecialChars: true,
        disallowCommon: true,
        checkBreaches: false, // Skip network calls in tests
      });

      // Weak password should fail
      const weak = await policy.validate('password', {
        email: 'user@example.com',
      });

      expect(weak.valid).toBe(false);
      expect(weak.errors.length).toBeGreaterThan(0);
      expect(weak.strength).toBeLessThanOrEqual(PasswordStrength.Weak);

      // Strong password should pass
      const strong = await policy.validate('MyS3cur3P@ssw0rd!2024', {
        email: 'user@example.com',
      });

      expect(strong.valid).toBe(true);
      expect(strong.errors).toHaveLength(0);
      expect(strong.strength).toBeGreaterThanOrEqual(PasswordStrength.Strong);
    });

    it('should detect common passwords', async () => {
      const policy = new PasswordPolicy({
        disallowCommon: true,
        minLength: 4,
      });

      const commonPasswords = ['password', '123456', 'qwerty', 'letmein', 'welcome'];

      for (const pwd of commonPasswords) {
        const result = await policy.validate(pwd);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('common'))).toBe(true);
      }
    });

    it('should prevent user info in passwords', async () => {
      const policy = new PasswordPolicy({
        disallowUserInfo: true,
        minLength: 4,
      });

      const userInfo = {
        email: 'alice@example.com',
        firstName: 'Alice',
        lastName: 'Johnson',
      };

      // Password containing first name should fail
      const result1 = await policy.validate('alice123', userInfo);
      expect(result1.valid).toBe(false);

      // Password containing email username should fail
      const result2 = await policy.validate('alice@2024', userInfo);
      expect(result2.valid).toBe(false);

      // Unrelated password should pass
      const result3 = await policy.validate('CompletelyUnrelated123!', userInfo);
      expect(result3.valid).toBe(true);
    });

    it('should calculate strength correctly', () => {
      const policy = new PasswordPolicy();

      const tests = [
        { password: '1234', expectedMax: PasswordStrength.VeryWeak },
        { password: 'password', expectedMax: PasswordStrength.Weak },
        { password: 'Password123', expectedMin: PasswordStrength.Fair },
        { password: 'MyP@ssw0rd123', expectedMin: PasswordStrength.Strong },
        { password: 'C0mpl3x!P@ss#2024$', expectedStrength: PasswordStrength.VeryStrong },
      ];

      for (const test of tests) {
        const result = policy.calculateStrength(test.password);

        if ('expectedStrength' in test) {
          expect(result.strength).toBe(test.expectedStrength);
        } else if ('expectedMin' in test) {
          expect(result.strength).toBeGreaterThanOrEqual(test.expectedMin);
        } else if ('expectedMax' in test) {
          expect(result.strength).toBeLessThanOrEqual(test.expectedMax);
        }
      }
    });
  });

  describe('Complete Authentication Flow', () => {
    it('should demonstrate secure registration flow', async () => {
      // 1. Password policy validation
      const passwordPolicy = new PasswordPolicy({
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireDigits: true,
        requireSpecialChars: true,
        disallowCommon: true,
        disallowUserInfo: true,
      });

      const userInfo = {
        email: 'newuser@example.com',
        firstName: 'John',
      };

      // Validate password meets policy
      const passwordResult = await passwordPolicy.validate('MySecur3P@ssw0rd!', userInfo);
      expect(passwordResult.valid).toBe(true);
      expect(passwordResult.strength).toBeGreaterThanOrEqual(PasswordStrength.Strong);

      // 2. Rate limiting would be applied via middleware
      const registerRateLimiter = authRateLimiter.register;
      expect(registerRateLimiter).toBeDefined();

      // 3. CSRF protection would be applied
      const csrf = csrfMiddleware({
        token: {
          secret: 'secure-secret-at-least-32-chars-long-for-production',
        },
      });
      expect(csrf.protect).toBeDefined();

      // In a real procedure:
      // const registerUser = procedure()
      //   .use(csrf.protect())
      //   .use(authRateLimiter.register())
      //   .input(RegisterSchema)
      //   .mutation(async ({ input, ctx }) => {
      //     // Validate password
      //     const validation = await passwordPolicy.validate(input.password, {
      //       email: input.email,
      //     });
      //
      //     if (!validation.valid) {
      //       throw new Error(validation.errors.join(', '));
      //     }
      //
      //     // Hash password and save user
      //     const hashedPassword = await hashPassword(input.password);
      //     return db.user.create({ data: { ...input, password: hashedPassword } });
      //   });
    });

    it('should demonstrate secure login flow', () => {
      // 1. Rate limiting by email + IP
      const loginRateLimiter = authRateLimiter.login;
      expect(loginRateLimiter).toBeDefined();

      // Track failed attempts
      const email = 'user@example.com';
      expect(authRateLimiter.getRemainingAttempts(email, 'login')).toBe(5);

      // Simulate failed login
      authRateLimiter.recordFailure(email, 'login');
      expect(authRateLimiter.getRemainingAttempts(email, 'login')).toBe(4);

      // After successful login, reset
      authRateLimiter.resetLimit(email, 'login');
      expect(authRateLimiter.getRemainingAttempts(email, 'login')).toBe(5);

      // 2. CSRF protection would be applied to login form
      const csrf = csrfMiddleware({
        token: {
          secret: 'secure-secret-at-least-32-chars-long',
        },
      });
      expect(csrf.protect).toBeDefined();

      // In a real procedure:
      // const login = procedure()
      //   .use(csrf.protect())
      //   .use(authRateLimiter.login((ctx) => ctx.input.email))
      //   .input(LoginSchema)
      //   .mutation(async ({ input, ctx }) => {
      //     const user = await db.user.findUnique({ where: { email: input.email } });
      //
      //     if (!user || !(await verifyPassword(input.password, user.password))) {
      //       // Record failure for rate limiting
      //       authRateLimiter.recordFailure(input.email, 'login');
      //       throw new AuthError('Invalid credentials', 401);
      //     }
      //
      //     // Reset rate limit on success
      //     authRateLimiter.resetLimit(input.email, 'login');
      //
      //     // Generate tokens
      //     return jwt.generateTokenPair(user);
      //   });
    });

    it('should demonstrate password reset flow', () => {
      // Password reset has stricter rate limiting
      const resetRateLimiter = authRateLimiter.passwordReset;
      expect(resetRateLimiter).toBeDefined();

      const email = 'reset@example.com';

      // Fewer attempts allowed (3 by default vs 5 for login)
      expect(authRateLimiter.getRemainingAttempts(email, 'password-reset')).toBe(3);

      // In a real procedure:
      // const requestPasswordReset = procedure()
      //   .use(csrf.protect())
      //   .use(authRateLimiter.passwordReset((ctx) => ctx.input.email))
      //   .input(z.object({ email: z.string().email() }))
      //   .mutation(async ({ input }) => {
      //     // Generate reset token and send email
      //     // ...
      //   });
      //
      // const resetPassword = procedure()
      //   .use(csrf.protect())
      //   .input(z.object({
      //     token: z.string(),
      //     newPassword: z.string(),
      //   }))
      //   .mutation(async ({ input }) => {
      //     // Validate new password against policy
      //     const validation = await passwordPolicy.validate(input.newPassword);
      //     if (!validation.valid) {
      //       throw new Error(validation.errors.join(', '));
      //     }
      //
      //     // Update password
      //     // ...
      //   });
    });
  });

  describe('Security Best Practices', () => {
    it('should demonstrate layered security approach', () => {
      // Layer 1: Rate Limiting (prevent brute force)
      const rateLimiter = authRateLimiter;
      expect(rateLimiter).toBeDefined();

      // Layer 2: CSRF Protection (prevent request forgery)
      const csrf = csrfMiddleware({
        token: { secret: 'test-secret-at-least-32-chars-long' },
      });
      expect(csrf).toBeDefined();

      // Layer 3: Password Policy (ensure password quality)
      const passwordPolicy = new PasswordPolicy({
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireDigits: true,
        requireSpecialChars: true,
      });
      expect(passwordPolicy).toBeDefined();

      // Layer 4: Password Hashing (bcrypt/argon2)
      // Layer 5: JWT with short expiry (15 minutes)
      // Layer 6: Refresh token rotation
      // Layer 7: Session management with secure cookies
    });

    it('should provide comprehensive password validation', async () => {
      const policy = new PasswordPolicy({
        minLength: 12,
        maxLength: 128,
        requireUppercase: true,
        requireLowercase: true,
        requireDigits: true,
        requireSpecialChars: true,
        disallowCommon: true,
        disallowUserInfo: true,
        checkBreaches: false, // Would be enabled in production
      });

      const userInfo = {
        email: 'security@example.com',
        firstName: 'Secure',
      };

      // Test weak password
      const weak = await policy.validate('weak', userInfo);
      expect(weak.valid).toBe(false);
      expect(weak.errors.length).toBeGreaterThan(3);

      // Test strong password
      const strong = await policy.validate('V3ry$ecur3P@ssw0rd!2024', userInfo);
      expect(strong.valid).toBe(true);
      expect(strong.strength).toBe(PasswordStrength.VeryStrong);
      expect(strong.score).toBeGreaterThanOrEqual(80);
    });
  });
});
