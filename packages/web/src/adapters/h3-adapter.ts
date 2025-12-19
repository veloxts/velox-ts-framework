/**
 * H3/Vinxi Auth Adapter
 *
 * Provides request context integration for server actions when running
 * inside Vinxi's H3 event handlers. This enables real authentication
 * and cookie management in RSC server actions.
 *
 * @module @veloxts/web/adapters/h3-adapter
 */

import type { ActionContext } from '../actions/types.js';

/**
 * H3 cookie options (mirrors h3 CookieSerializeOptions)
 */
export interface H3CookieOptions {
  domain?: string;
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: 'strict' | 'lax' | 'none' | boolean;
  secure?: boolean;
  priority?: 'low' | 'medium' | 'high';
  partitioned?: boolean;
}

/**
 * Configuration for the H3 adapter
 */
export interface H3AdapterConfig {
  /**
   * Function to load user from session/token
   * Called when getAuthenticatedContext is used
   */
  userLoader?: (ctx: H3ActionContext) => Promise<{ id: string; [key: string]: unknown } | null>;

  /**
   * Name of the session cookie
   * @default 'session'
   */
  sessionCookieName?: string;

  /**
   * Name of the auth token header
   * @default 'authorization'
   */
  authHeaderName?: string;
}

/**
 * Extended action context with H3-specific utilities
 */
export interface H3ActionContext extends ActionContext {
  /**
   * Get a cookie value by name
   */
  getCookie(name: string): string | undefined;

  /**
   * Set a cookie
   */
  setCookie(name: string, value: string, options?: H3CookieOptions): void;

  /**
   * Delete a cookie
   */
  deleteCookie(name: string, options?: H3CookieOptions): void;

  /**
   * Get the raw H3 event (for advanced usage)
   */
  readonly h3Event: unknown;
}

/**
 * Authenticated H3 action context
 */
export interface AuthenticatedH3ActionContext extends H3ActionContext {
  /**
   * The authenticated user
   */
  user: {
    id: string;
    [key: string]: unknown;
  };
}

/**
 * Type for Vinxi's H3 event
 * We use unknown to avoid direct dependency on h3 package
 */
type H3Event = unknown;

/**
 * H3 utilities type (imported from vinxi/http at runtime)
 * We use generic function types that accept unknown to avoid direct h3 type dependency
 */
interface H3Utilities {
  getWebRequest: (event?: unknown) => Request;
  getCookie: (event: unknown, name: string) => string | undefined;
  setCookie: (
    event: unknown,
    name: string,
    value: string,
    options?: Record<string, unknown>
  ) => void;
  deleteCookie: (event: unknown, name: string, options?: Record<string, unknown>) => void;
  parseCookies: (event?: unknown) => Record<string, string>;
  getRequestHeaders: (event: unknown) => Record<string, string | string[] | undefined>;
}

/**
 * Cached H3 utilities - loaded lazily from vinxi/http
 */
let h3Utils: H3Utilities | null = null;

/**
 * Loads H3 utilities from vinxi/http
 * Throws helpful error if vinxi is not installed
 */
async function getH3Utilities(): Promise<H3Utilities> {
  if (h3Utils) {
    return h3Utils;
  }

  try {
    // Dynamic import to avoid bundling issues and allow tree-shaking
    const vinxiHttp = (await import('vinxi/http')) as unknown as H3Utilities;
    h3Utils = {
      getWebRequest: vinxiHttp.getWebRequest,
      getCookie: vinxiHttp.getCookie,
      setCookie: vinxiHttp.setCookie,
      deleteCookie: vinxiHttp.deleteCookie,
      parseCookies: vinxiHttp.parseCookies,
      getRequestHeaders: vinxiHttp.getRequestHeaders,
    };
    return h3Utils;
  } catch {
    throw new Error(
      '[VeloxTS] H3 adapter requires vinxi to be installed. ' + 'Install it with: pnpm add vinxi'
    );
  }
}

/**
 * Creates an H3 action context from the current Vinxi event.
 *
 * This function must be called within a Vinxi server function or
 * H3 event handler. It provides access to the real request context
 * including cookies, headers, and response utilities.
 *
 * @example
 * ```typescript
 * import { createH3Context } from '@veloxts/web/adapters/h3-adapter';
 *
 * export async function myServerAction() {
 *   'use server';
 *
 *   const ctx = await createH3Context();
 *   const sessionToken = ctx.getCookie('session');
 *   // ... use real request context
 * }
 * ```
 */
export async function createH3Context(event?: H3Event): Promise<H3ActionContext> {
  const utils = await getH3Utilities();

  // Get the web request - event is optional when called from server function
  const request = utils.getWebRequest(event);

  // Parse all cookies into a Map
  const cookiesRecord = utils.parseCookies(event);
  const cookies = new Map<string, string>(Object.entries(cookiesRecord));

  return {
    request,
    headers: request.headers,
    cookies,
    h3Event: event,

    getCookie(name: string): string | undefined {
      return cookies.get(name);
    },

    setCookie(name: string, value: string, options?: H3CookieOptions): void {
      if (!event) {
        throw new Error(
          '[VeloxTS] setCookie requires H3 event context. ' +
            'Ensure you are calling this from a Vinxi server function.'
        );
      }
      utils.setCookie(event, name, value, options as Record<string, unknown>);
      // Update local cache
      cookies.set(name, value);
    },

    deleteCookie(name: string, options?: H3CookieOptions): void {
      if (!event) {
        throw new Error(
          '[VeloxTS] deleteCookie requires H3 event context. ' +
            'Ensure you are calling this from a Vinxi server function.'
        );
      }
      utils.deleteCookie(event, name, options as Record<string, unknown>);
      // Update local cache
      cookies.delete(name);
    },
  };
}

/**
 * Creates an authenticated H3 context by loading the user.
 *
 * Uses the configured userLoader to get the current user from
 * session or token. Returns null if no authenticated user.
 *
 * @example
 * ```typescript
 * import { createH3AuthAdapter } from '@veloxts/web/adapters/h3-adapter';
 *
 * const adapter = createH3AuthAdapter({
 *   userLoader: async (ctx) => {
 *     const token = ctx.getCookie('session');
 *     if (!token) return null;
 *     return await validateSession(token);
 *   },
 * });
 *
 * export async function protectedAction() {
 *   'use server';
 *
 *   const ctx = await adapter.getAuthenticatedContext();
 *   if (!ctx) {
 *     return { error: 'UNAUTHORIZED' };
 *   }
 *   // ctx.user is available
 * }
 * ```
 */
export interface H3AuthAdapter {
  /**
   * Get the current request context (authenticated or not)
   */
  getContext(event?: H3Event): Promise<H3ActionContext>;

  /**
   * Get an authenticated context, or null if not authenticated
   */
  getAuthenticatedContext(event?: H3Event): Promise<AuthenticatedH3ActionContext | null>;

  /**
   * Require authentication - throws if not authenticated
   */
  requireAuth(event?: H3Event): Promise<AuthenticatedH3ActionContext>;

  /**
   * Check if the current request is authenticated
   */
  isAuthenticated(event?: H3Event): Promise<boolean>;

  /**
   * Get the auth token from header or cookie
   */
  getAuthToken(ctx: H3ActionContext): string | undefined;
}

/**
 * Creates an H3 auth adapter with user loading capability.
 *
 * @example
 * ```typescript
 * import { createH3AuthAdapter } from '@veloxts/web/adapters/h3-adapter';
 * import { db } from './db';
 *
 * export const authAdapter = createH3AuthAdapter({
 *   userLoader: async (ctx) => {
 *     const token = ctx.getCookie('session');
 *     if (!token) return null;
 *
 *     const session = await db.session.findUnique({
 *       where: { token },
 *       include: { user: true },
 *     });
 *
 *     if (!session || session.expiresAt < new Date()) {
 *       return null;
 *     }
 *
 *     return session.user;
 *   },
 *   sessionCookieName: 'session',
 *   authHeaderName: 'authorization',
 * });
 * ```
 */
export function createH3AuthAdapter(config: H3AdapterConfig = {}): H3AuthAdapter {
  const { userLoader, sessionCookieName = 'session', authHeaderName = 'authorization' } = config;

  /**
   * Extract auth token from header or cookie
   */
  function getAuthToken(ctx: H3ActionContext): string | undefined {
    // Check Authorization header first (for Bearer tokens)
    const authHeader = ctx.headers.get(authHeaderName);
    if (authHeader) {
      // Extract token from "Bearer <token>" format
      if (authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7);
      }
      return authHeader;
    }

    // Fall back to session cookie
    return ctx.getCookie(sessionCookieName);
  }

  return {
    async getContext(event?: H3Event): Promise<H3ActionContext> {
      return createH3Context(event);
    },

    async getAuthenticatedContext(event?: H3Event): Promise<AuthenticatedH3ActionContext | null> {
      const ctx = await createH3Context(event);

      if (!userLoader) {
        // No user loader configured - can't authenticate
        return null;
      }

      const user = await userLoader(ctx);
      if (!user) {
        return null;
      }

      return {
        ...ctx,
        user,
      };
    },

    async requireAuth(event?: H3Event): Promise<AuthenticatedH3ActionContext> {
      const ctx = await this.getAuthenticatedContext(event);

      if (!ctx) {
        throw new H3AuthError('UNAUTHORIZED', 'Authentication required');
      }

      return ctx;
    },

    async isAuthenticated(event?: H3Event): Promise<boolean> {
      const ctx = await this.getAuthenticatedContext(event);
      return ctx !== null;
    },

    getAuthToken,
  };
}

/**
 * Error thrown when authentication fails in H3 adapter
 */
export class H3AuthError extends Error {
  constructor(
    public code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'SESSION_EXPIRED',
    message: string
  ) {
    super(message);
    this.name = 'H3AuthError';
  }
}

/**
 * Type guard to check if context is H3 context
 */
export function isH3Context(ctx: ActionContext): ctx is H3ActionContext {
  return 'getCookie' in ctx && typeof (ctx as H3ActionContext).getCookie === 'function';
}

/**
 * Type guard to check if context is authenticated H3 context
 */
export function isAuthenticatedH3Context(ctx: ActionContext): ctx is AuthenticatedH3ActionContext {
  return isH3Context(ctx) && 'user' in ctx && ctx.user !== undefined && ctx.user !== null;
}

/**
 * Creates a server action with real H3 context.
 *
 * Unlike createAction from handler.ts, this version gets real request
 * context from Vinxi's H3 layer, enabling proper authentication.
 *
 * @example
 * ```typescript
 * import { createH3Action } from '@veloxts/web/adapters/h3-adapter';
 * import { z } from 'zod';
 *
 * const adapter = createH3AuthAdapter({ ... });
 *
 * export const getProfile = createH3Action(adapter, {
 *   requireAuth: true,
 * }, async (input, ctx) => {
 *   // ctx.user is guaranteed to be available
 *   return { id: ctx.user.id };
 * });
 * ```
 */
export function createH3Action<TInput, TOutput>(
  adapter: H3AuthAdapter,
  options: {
    requireAuth?: boolean;
    validate?: (input: unknown) => TInput;
  },
  handler: (input: TInput, ctx: H3ActionContext | AuthenticatedH3ActionContext) => Promise<TOutput>
): (
  input: TInput
) => Promise<
  { success: true; data: TOutput } | { success: false; error: { code: string; message: string } }
> {
  const { requireAuth = false, validate } = options;

  return async (input: TInput) => {
    try {
      // Validate input if validator provided
      const validatedInput = validate ? validate(input) : input;

      // Get context based on auth requirement
      let ctx: H3ActionContext | AuthenticatedH3ActionContext;

      if (requireAuth) {
        ctx = await adapter.requireAuth();
      } else {
        ctx = await adapter.getContext();
      }

      // Execute handler
      const result = await handler(validatedInput, ctx);

      return { success: true as const, data: result };
    } catch (err) {
      if (err instanceof H3AuthError) {
        return {
          success: false as const,
          error: { code: err.code, message: err.message },
        };
      }

      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      return {
        success: false as const,
        error: { code: 'INTERNAL_ERROR', message },
      };
    }
  };
}

/**
 * Helper to create a mock H3 context for testing
 */
export function createMockH3Context(overrides: Partial<H3ActionContext> = {}): H3ActionContext {
  const cookies = new Map<string, string>();
  const setCookies: Array<{ name: string; value: string; options?: H3CookieOptions }> = [];
  const deletedCookies: Array<{ name: string; options?: H3CookieOptions }> = [];

  const defaultContext: H3ActionContext = {
    request: new Request('http://localhost/'),
    headers: new Headers(),
    cookies,
    h3Event: null,

    getCookie(name: string): string | undefined {
      return cookies.get(name);
    },

    setCookie(name: string, value: string, options?: H3CookieOptions): void {
      cookies.set(name, value);
      setCookies.push({ name, value, options });
    },

    deleteCookie(name: string, options?: H3CookieOptions): void {
      cookies.delete(name);
      deletedCookies.push({ name, options });
    },
  };

  return { ...defaultContext, ...overrides };
}

/**
 * Helper to create an authenticated mock H3 context for testing
 */
export function createMockAuthenticatedH3Context(
  user: { id: string; [key: string]: unknown },
  overrides: Partial<H3ActionContext> = {}
): AuthenticatedH3ActionContext {
  const baseContext = createMockH3Context(overrides);
  return { ...baseContext, user };
}
