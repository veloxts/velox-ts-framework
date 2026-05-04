/**
 * Empty-body-tolerant JSON parser
 *
 * Fastify's default `application/json` parser rejects empty bodies with a 400.
 * The Velox client sends `Content-Type: application/json` with an empty body
 * for input-less mutations, which would otherwise fail before reaching the
 * procedure pipeline. This parser returns `{}` for empty bodies and delegates
 * to `JSON.parse` for everything else.
 *
 * Registered automatically by the VeloxApp constructor. Users who need a
 * different parser can call `server.removeContentTypeParser('application/json')`
 * before registering their own.
 *
 * @module plugins/empty-body-parser
 */
import type { FastifyInstance } from 'fastify';

export function setupEmptyBodyParser(server: FastifyInstance): void {
  server.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, done) => {
    const raw = typeof body === 'string' ? body.trim() : '';
    if (raw === '') {
      done(null, {});
      return;
    }
    try {
      done(null, JSON.parse(raw));
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      err.statusCode = 400;
      done(err);
    }
  });
}
