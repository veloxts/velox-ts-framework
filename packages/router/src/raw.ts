/**
 * Raw response primitive for procedures
 *
 * Lets procedure handlers return non-JSON HTTP responses (redirects, cookies,
 * custom headers, raw bodies, streams) without bypassing the procedure system.
 *
 * Returning a `RawResponse` from a procedure handler tells the REST adapter
 * to apply the response settings to Fastify's `reply` and skip the default
 * JSON serialization path.
 *
 * Procedures using `raw()` typically omit `.output()` since the response
 * body isn't a JSON-serialized DTO. Their OpenAPI documentation is generated
 * without a response schema (valid OpenAPI for raw responses).
 *
 * @example OAuth callback (replaces a raw `fastify.get(...)` route)
 * ```typescript
 * import { procedure, raw } from '@veloxts/router';
 *
 * export const oauthProcedures = procedures('oauth', {
 *   authorize: procedure()
 *     .rest({ method: 'GET', path: '/auth/atlassian' })
 *     .query(async ({ ctx }) => {
 *       const { url, state, codeVerifier } = provider.buildAuthorizeUrl();
 *       return raw({
 *         cookies: [
 *           { name: 'oauth_state', value: pack(state, codeVerifier), options: { httpOnly: true } },
 *         ],
 *         redirect: { url, status: 302 },
 *       });
 *     }),
 * });
 * ```
 *
 * @example File download
 * ```typescript
 * import { createReadStream } from 'node:fs';
 *
 * download: procedure()
 *   .input(z.object({ id: z.string() }))
 *   .query(async ({ input }) => raw({
 *     status: 200,
 *     headers: {
 *       'Content-Type': 'application/octet-stream',
 *       'Content-Disposition': `attachment; filename="${input.id}.bin"`,
 *     },
 *     body: createReadStream(`/storage/${input.id}.bin`),
 *   }));
 * ```
 *
 * @module raw
 */
import type { Readable } from 'node:stream';

/** Brand identifying a `RawResponse` returned from `raw()`. */
const RAW_RESPONSE_BRAND = '__velox_raw_response__';

/**
 * Cookie options accepted by `RawResponse.cookies`.
 *
 * Mirrors `@fastify/cookie`'s `CookieSerializeOptions` shape but kept as a
 * plain interface so this module has no hard dependency on `@fastify/cookie`.
 * Procedures using `cookies` require that plugin to be registered (see
 * `@veloxts/auth` template for the standard wiring).
 */
export interface RawResponseCookieOptions {
  domain?: string;
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  priority?: 'low' | 'medium' | 'high';
  sameSite?: 'lax' | 'none' | 'strict' | boolean;
  secure?: boolean | 'auto';
  signed?: boolean;
}

/** Cookie to set on the response. */
export interface RawResponseCookie {
  /** Cookie name. */
  readonly name: string;
  /** Cookie value (string only — caller is responsible for encoding). */
  readonly value: string;
  /** Optional cookie attributes (max-age, httpOnly, secure, etc.). */
  readonly options?: RawResponseCookieOptions;
}

/** Redirect descriptor. */
export interface RawResponseRedirect {
  /** Absolute or relative URL to redirect to. */
  readonly url: string;
  /**
   * HTTP redirect status. Defaults to `302` (Found).
   * Use `303` for POST → GET redirects, `307`/`308` to preserve method+body.
   */
  readonly status?: 301 | 302 | 303 | 307 | 308;
}

/**
 * Options accepted by `raw()`. All fields optional — a bare `raw({})`
 * sends an empty 200 response.
 */
export interface RawResponseOptions {
  /**
   * HTTP status code. Defaults to `200`. Ignored when `redirect` is set
   * (the redirect's `status` wins).
   */
  status?: number;
  /** Headers to set on the response. */
  headers?: Record<string, string>;
  /**
   * Cookies to set via `reply.setCookie`. Requires `@fastify/cookie` to be
   * registered on the Fastify instance.
   */
  cookies?: ReadonlyArray<RawResponseCookie>;
  /** Redirect to a URL. When set, `body` is ignored. */
  redirect?: RawResponseRedirect;
  /**
   * Response body. Strings, Buffers, and Node streams are sent as-is via
   * `reply.send()` so the caller controls Content-Type via `headers`.
   * Plain objects are NOT serialized — use a regular `.output()` schema for
   * JSON responses.
   */
  body?: string | Buffer | Readable;
}

/**
 * Branded raw-response object returned by `raw()`. The REST adapter detects
 * this brand and applies the contained settings to Fastify's `reply`.
 */
export interface RawResponse extends RawResponseOptions {
  readonly [RAW_RESPONSE_BRAND]: true;
}

/**
 * Create a raw HTTP response from a procedure handler.
 *
 * The returned object is a branded marker — its presence tells the REST
 * adapter to bypass JSON serialization and apply headers/cookies/redirect/body
 * directly to the Fastify reply.
 *
 * @param options - Response settings. All fields optional.
 * @returns A `RawResponse` to return from a `.query()` or `.mutation()` handler.
 *
 * @example
 * ```typescript
 * .query(async ({ ctx }) => raw({
 *   cookies: [{ name: 'session', value: token, options: { httpOnly: true } }],
 *   redirect: { url: '/dashboard', status: 302 },
 * }))
 * ```
 */
export function raw(options: RawResponseOptions = {}): RawResponse {
  return { ...options, [RAW_RESPONSE_BRAND]: true } as RawResponse;
}

/**
 * Type guard: returns true when `value` is a `RawResponse` produced by `raw()`.
 *
 * Used by the REST adapter to short-circuit JSON serialization. Exported for
 * advanced cases (custom adapters, testing) — most users don't need it.
 */
export function isRawResponse(value: unknown): value is RawResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<string, unknown>)[RAW_RESPONSE_BRAND] === true
  );
}
