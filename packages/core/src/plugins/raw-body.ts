/**
 * Raw Body Plugin
 *
 * Preserves the raw request body as a Buffer on the request object.
 * Required for webhook signature verification (Stripe, GitHub, etc.)
 * where the raw bytes must match the HMAC signature.
 *
 * @module plugins/raw-body
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';

import { definePlugin } from '../plugin.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Raw request body as Buffer (available when rawBodyPlugin is registered) */
    rawBody?: Buffer;
  }
}

/**
 * Fastify plugin that preserves the raw request body.
 *
 * After registration, `request.rawBody` contains the raw Buffer
 * for `application/json` requests.
 *
 * @example
 * ```typescript
 * import { rawBodyPlugin } from '@veloxts/core';
 *
 * await app.register(rawBodyPlugin);
 *
 * // In a webhook handler:
 * const isValid = verifySignature(request.rawBody, request.headers['stripe-signature']);
 * ```
 */
export const rawBodyPlugin = definePlugin({
  name: '@veloxts/raw-body',
  version: '1.0.0',
  async register(fastify: FastifyInstance): Promise<void> {
    fastify.addContentTypeParser(
      'application/json',
      { parseAs: 'buffer' },
      (
        request: FastifyRequest,
        body: Buffer,
        done: (err: Error | null, result?: unknown) => void
      ) => {
        request.rawBody = body;

        try {
          const json: unknown = body.length > 0 ? JSON.parse(body.toString()) : undefined;
          done(null, json);
        } catch (error) {
          done(error instanceof Error ? error : new Error(String(error)));
        }
      }
    );
  },
});
