/**
 * Cookie Plugin Support Utilities
 *
 * Shared type guards and utilities for @fastify/cookie plugin detection.
 * Used by both session and CSRF modules.
 *
 * @module auth/utils/cookie-support
 */

import type { FastifyReply, FastifyRequest } from 'fastify';

// ============================================================================
// Cookie Plugin Types (from @fastify/cookie)
// ============================================================================

/**
 * Cookie serialization options (mirrors @fastify/cookie types)
 */
export interface CookieSerializeOptions {
  domain?: string;
  path?: string;
  sameSite?: 'strict' | 'lax' | 'none' | boolean;
  secure?: boolean;
  httpOnly?: boolean;
  maxAge?: number;
  expires?: Date;
}

/**
 * Fastify reply with cookie methods from @fastify/cookie plugin
 */
export interface FastifyReplyWithCookies extends FastifyReply {
  cookie(name: string, value: string, options?: CookieSerializeOptions): FastifyReply;
  clearCookie(name: string, options?: CookieSerializeOptions): FastifyReply;
}

/**
 * Fastify request with cookies from @fastify/cookie plugin
 */
export interface FastifyRequestWithCookies extends FastifyRequest {
  cookies: Record<string, string | undefined>;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if request has cookie support from @fastify/cookie plugin
 */
export function hasCookieSupport(request: FastifyRequest): request is FastifyRequestWithCookies {
  return 'cookies' in request && request.cookies !== null && typeof request.cookies === 'object';
}

/**
 * Check if reply has cookie methods from @fastify/cookie plugin
 */
export function hasReplyCookieSupport(reply: FastifyReply): reply is FastifyReplyWithCookies {
  return 'cookie' in reply && typeof reply.cookie === 'function';
}

// ============================================================================
// Validated Cookie Context
// ============================================================================

/**
 * Options for cookie context validation
 */
export interface CookieContextValidationOptions {
  /**
   * Name of the middleware requiring cookies (for error message)
   * @default 'This middleware'
   */
  middlewareName?: string;
}

/**
 * Get request and reply with validated cookie support
 * @throws Error with helpful message if @fastify/cookie plugin is not registered
 */
export function getValidatedCookieContext(
  request: FastifyRequest,
  reply: FastifyReply,
  options: CookieContextValidationOptions = {}
): { request: FastifyRequestWithCookies; reply: FastifyReplyWithCookies } {
  const middlewareName = options.middlewareName ?? 'This middleware';

  if (!hasCookieSupport(request) || !hasReplyCookieSupport(reply)) {
    throw new Error(
      `${middlewareName} requires @fastify/cookie plugin. ` +
        'Please register it before using this middleware:\n\n' +
        "  import cookie from '@fastify/cookie';\n" +
        '  await app.register(cookie);\n'
    );
  }
  return { request, reply };
}
