/**
 * Auth Bridge for Server Actions
 *
 * Specialized helpers for authentication procedures that need to
 * set httpOnly cookies for token storage. These helpers wrap
 * `action.fromProcedure()` with auth-specific callbacks.
 *
 * @module @veloxts/web/actions/auth-bridge
 *
 * @example
 * ```typescript
 * 'use server';
 *
 * import { authAction } from '@veloxts/web';
 * import { authProcedures } from '@/api/procedures/auth';
 * import { db } from '@/api/database';
 *
 * // Login sets tokens in httpOnly cookies
 * export const login = authAction.fromTokenProcedure(
 *   authProcedures.procedures.createSession,
 *   { parseFormData: true, contextExtensions: { db } }
 * );
 *
 * // Logout clears auth cookies
 * export const logout = authAction.fromLogoutProcedure(
 *   authProcedures.procedures.deleteSession,
 *   { contextExtensions: { db } }
 * );
 * ```
 */

import type { BaseContext } from '@veloxts/core';
import type { CompiledProcedure } from '@veloxts/router';

import type { H3ActionContext, H3CookieOptions } from '../adapters/h3-adapter.js';
import { action } from './action.js';
import type { ExecuteProcedureOptions } from './procedure-bridge.js';
import type { ActionResult } from './types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for auth cookies.
 */
export interface AuthCookieConfig {
  /**
   * Name of the access token cookie.
   * @default 'accessToken'
   */
  accessTokenName?: string;

  /**
   * Name of the refresh token cookie.
   * @default 'refreshToken'
   */
  refreshTokenName?: string;

  /**
   * Cookie options applied to auth cookies.
   * Merged with secure defaults.
   */
  cookieOptions?: H3CookieOptions;
}

/**
 * Options for creating an auth action from a procedure.
 */
export interface AuthActionOptions extends ExecuteProcedureOptions {
  /**
   * Whether to parse FormData input.
   * @default false
   */
  parseFormData?: boolean;

  /**
   * Cookie configuration.
   */
  cookies?: AuthCookieConfig;
}

/**
 * Standard token response from auth procedures.
 */
export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

/**
 * Sanitized login response returned to client.
 * Raw tokens are stripped for security (stored in httpOnly cookies).
 */
export interface LoginResponse {
  success: boolean;
  expiresIn: number;
}

// ============================================================================
// Default Cookie Configuration
// ============================================================================

const DEFAULT_COOKIE_OPTIONS: H3CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
};

const ACCESS_TOKEN_MAX_AGE = 15 * 60; // 15 minutes
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

// ============================================================================
// Auth Action Helper
// ============================================================================

/**
 * Auth-specific action helpers for token-based authentication.
 *
 * These helpers wrap `action.fromProcedure()` with authentication-specific
 * callbacks that handle token storage in httpOnly cookies.
 *
 * @example
 * ```typescript
 * // In your server actions file
 * 'use server';
 *
 * import { authAction } from '@veloxts/web';
 * import { authProcedures } from '@/api/procedures/auth';
 *
 * export const login = authAction.fromTokenProcedure(
 *   authProcedures.procedures.createSession,
 *   { parseFormData: true, contextExtensions: { db } }
 * );
 *
 * export const register = authAction.fromTokenProcedure(
 *   authProcedures.procedures.createAccount,
 *   { parseFormData: true, contextExtensions: { db } }
 * );
 *
 * export const logout = authAction.fromLogoutProcedure(
 *   authProcedures.procedures.deleteSession,
 *   { contextExtensions: { db } }
 * );
 * ```
 */
export const authAction = {
  /**
   * Creates a server action from an auth procedure that returns tokens.
   *
   * This helper:
   * 1. Executes the procedure via the procedure bridge
   * 2. On success, stores tokens in httpOnly cookies
   * 3. Returns a sanitized response (tokens stripped for security)
   *
   * @param procedure - The auth procedure that returns TokenResponse
   * @param options - Configuration options
   * @returns Server action that returns LoginResponse
   *
   * @example
   * ```typescript
   * export const login = authAction.fromTokenProcedure(
   *   authProcedures.procedures.createSession,
   *   {
   *     parseFormData: true,
   *     contextExtensions: { db: prisma },
   *     cookies: {
   *       accessTokenName: 'session',
   *       cookieOptions: { sameSite: 'strict' },
   *     },
   *   }
   * );
   * ```
   */
  fromTokenProcedure<TInput, TContext extends BaseContext = BaseContext>(
    procedure: CompiledProcedure<TInput, TokenResponse, TContext>,
    options?: AuthActionOptions
  ): (input: TInput) => Promise<ActionResult<LoginResponse>> {
    const accessName = options?.cookies?.accessTokenName ?? 'accessToken';
    const refreshName = options?.cookies?.refreshTokenName ?? 'refreshToken';
    const cookieOpts = { ...DEFAULT_COOKIE_OPTIONS, ...options?.cookies?.cookieOptions };

    // Extract procedure-bridge options
    const { parseFormData = false, cookies: _, ...executionOptions } = options ?? {};

    return action.fromProcedure(procedure, {
      parseFormData,
      ...executionOptions,

      onSuccess: async (result: unknown, ctx: H3ActionContext) => {
        const tokens = result as TokenResponse;

        // Set access token cookie (short-lived)
        ctx.setCookie(accessName, tokens.accessToken, {
          ...cookieOpts,
          maxAge: ACCESS_TOKEN_MAX_AGE,
        });

        // Set refresh token cookie (longer-lived)
        ctx.setCookie(refreshName, tokens.refreshToken, {
          ...cookieOpts,
          maxAge: REFRESH_TOKEN_MAX_AGE,
        });
      },

      transformResult: (result: unknown): LoginResponse => {
        const tokens = result as TokenResponse;
        // Strip raw tokens from client response (security)
        return {
          success: true,
          expiresIn: tokens.expiresIn,
        };
      },
    }) as (input: TInput) => Promise<ActionResult<LoginResponse>>;
  },

  /**
   * Creates a server action from a logout procedure.
   *
   * This helper:
   * 1. Executes the procedure via the procedure bridge
   * 2. On success, clears auth cookies
   *
   * @param procedure - The logout procedure
   * @param options - Configuration options
   * @returns Server action that returns the procedure output
   *
   * @example
   * ```typescript
   * export const logout = authAction.fromLogoutProcedure(
   *   authProcedures.procedures.deleteSession,
   *   { contextExtensions: { db: prisma } }
   * );
   * ```
   */
  fromLogoutProcedure<TInput, TOutput, TContext extends BaseContext = BaseContext>(
    procedure: CompiledProcedure<TInput, TOutput, TContext>,
    options?: Omit<AuthActionOptions, 'parseFormData'>
  ): (input: TInput) => Promise<ActionResult<TOutput>> {
    const accessName = options?.cookies?.accessTokenName ?? 'accessToken';
    const refreshName = options?.cookies?.refreshTokenName ?? 'refreshToken';

    // Extract procedure-bridge options
    const { cookies: _, ...executionOptions } = options ?? {};

    return action.fromProcedure(procedure, {
      ...executionOptions,

      onSuccess: async (_result: unknown, ctx: H3ActionContext) => {
        // Clear both auth cookies
        ctx.deleteCookie(accessName);
        ctx.deleteCookie(refreshName);
      },
    });
  },

  /**
   * Creates a server action from a token refresh procedure.
   *
   * This helper:
   * 1. Reads the refresh token from cookies
   * 2. Executes the refresh procedure
   * 3. On success, updates the access token cookie
   *
   * @param procedure - The refresh procedure that returns new tokens
   * @param options - Configuration options
   * @returns Server action that returns LoginResponse
   *
   * @example
   * ```typescript
   * export const refreshToken = authAction.fromRefreshProcedure(
   *   authProcedures.procedures.refreshSession,
   *   { contextExtensions: { db: prisma } }
   * );
   * ```
   */
  fromRefreshProcedure<TInput, TContext extends BaseContext = BaseContext>(
    procedure: CompiledProcedure<TInput, TokenResponse, TContext>,
    options?: AuthActionOptions
  ): (input: TInput) => Promise<ActionResult<LoginResponse>> {
    const accessName = options?.cookies?.accessTokenName ?? 'accessToken';
    const refreshName = options?.cookies?.refreshTokenName ?? 'refreshToken';
    const cookieOpts = { ...DEFAULT_COOKIE_OPTIONS, ...options?.cookies?.cookieOptions };

    // Extract procedure-bridge options
    const { parseFormData = false, cookies: _, ...executionOptions } = options ?? {};

    return action.fromProcedure(procedure, {
      parseFormData,
      ...executionOptions,

      beforeExecute: async (ctx: H3ActionContext) => {
        // Make refresh token available on context if the procedure needs it
        const refreshToken = ctx.getCookie(refreshName);
        if (refreshToken) {
          // Store for the handler to access if needed
          (ctx as unknown as Record<string, unknown>).refreshToken = refreshToken;
        }
      },

      onSuccess: async (result: unknown, ctx: H3ActionContext) => {
        const tokens = result as TokenResponse;

        // Update access token cookie
        ctx.setCookie(accessName, tokens.accessToken, {
          ...cookieOpts,
          maxAge: ACCESS_TOKEN_MAX_AGE,
        });

        // Update refresh token cookie (if new one provided)
        if (tokens.refreshToken) {
          ctx.setCookie(refreshName, tokens.refreshToken, {
            ...cookieOpts,
            maxAge: REFRESH_TOKEN_MAX_AGE,
          });
        }
      },

      transformResult: (result: unknown): LoginResponse => {
        const tokens = result as TokenResponse;
        return {
          success: true,
          expiresIn: tokens.expiresIn,
        };
      },
    }) as (input: TInput) => Promise<ActionResult<LoginResponse>>;
  },
};
