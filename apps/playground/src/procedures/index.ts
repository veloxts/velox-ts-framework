/**
 * Procedure Exports
 *
 * Central export point for all application procedures.
 * Import this in your router configuration.
 */

export { type HealthProcedures, healthProcedures } from './health.js';
export { type UserProcedures, userProcedures } from './users.js';

// ============================================================================
// Aggregated Types for Client
// ============================================================================

import type { HealthProcedures } from './health.js';
import type { UserProcedures } from './users.js';

/**
 * Complete router type for frontend client
 *
 * Use this type with createClient for full type safety:
 *
 * @example
 * ```typescript
 * import { createClient } from '@veloxts/client';
 * import type { AppRouter } from '../server/procedures';
 *
 * const api = createClient<AppRouter>({
 *   baseUrl: 'http://localhost:3210/api',
 * });
 *
 * // Fully typed!
 * const user = await api.users.getUser({ id: '...' });
 * const health = await api.health.getHealth();
 * ```
 */
export interface AppRouter {
  users: UserProcedures;
  health: HealthProcedures;
}
