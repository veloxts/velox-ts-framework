/**
 * Session module barrel export
 *
 * Re-exports all session types, stores, and utilities.
 *
 * @module session
 */

// Store
export type { SessionStore } from './store.js';
export { inMemorySessionStore } from './store.js';
// Types
export type {
  Session,
  SessionAuthContext,
  SessionContext,
  SessionData,
  SessionMiddlewareOptions,
  StoredSession,
} from './types.js';
export {
  DEFAULT_COOKIE_NAME,
  DEFAULT_SESSION_TTL,
  MIN_SECRET_LENGTH,
  SESSION_ID_BYTES,
} from './types.js';
