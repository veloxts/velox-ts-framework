/**
 * Raw Body Plugin
 *
 * Preserves the raw request body as a Buffer on the request object.
 * Required for webhook signature verification (Stripe, GitHub, etc.)
 * where the raw bytes must match the HMAC signature.
 *
 * Uses a `preParsing` hook to capture the raw bytes before Fastify's
 * built-in JSON parser processes them, so normal JSON parsing is preserved
 * for all routes.
 *
 * @module plugins/raw-body
 */

import { Readable } from 'node:stream';

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
 * for all requests. Fastify's built-in JSON parser continues to
 * work normally — this plugin does not replace it.
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
    fastify.decorateRequest('rawBody', undefined);

    fastify.addHook('preParsing', async (request: FastifyRequest, _reply, payload) => {
      const chunks: Buffer[] = [];

      for await (const chunk of payload) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
      }

      const rawBody = Buffer.concat(chunks);
      request.rawBody = rawBody;

      return Readable.from(rawBody);
    });
  },
});
