/**
 * Auth Schemas
 *
 * BROWSER-SAFE: This file imports ONLY from 'zod'.
 * Never import from @veloxts/* packages here.
 */

import { z } from 'zod';

// ============================================================================
// Password Schema (for validation display)
// ============================================================================

export const PasswordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password must not exceed 128 characters');

// ============================================================================
// Email Schema
// ============================================================================

export const EmailSchema = z
  .string()
  .email('Invalid email address')
  .transform((email) => email.toLowerCase().trim());

// ============================================================================
// Input Schemas
// ============================================================================

export const RegisterInput = z.object({
  name: z.string().min(2).max(100).trim(),
  email: EmailSchema,
  password: PasswordSchema,
});

export const LoginInput = z.object({
  email: EmailSchema,
  password: z.string().min(1),
});

export const RefreshInput = z.object({
  refreshToken: z.string(),
});

// ============================================================================
// Response Schemas
// ============================================================================

export const TokenResponse = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
  tokenType: z.literal('Bearer'),
});

export const UserResponse = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  roles: z.array(z.string()),
});

export const LogoutResponse = z.object({
  success: z.boolean(),
  message: z.string(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type RegisterData = z.infer<typeof RegisterInput>;
export type LoginData = z.infer<typeof LoginInput>;
export type RefreshData = z.infer<typeof RefreshInput>;
export type TokenResponseData = z.infer<typeof TokenResponse>;
export type UserResponseData = z.infer<typeof UserResponse>;
export type LogoutResponseData = z.infer<typeof LogoutResponse>;
