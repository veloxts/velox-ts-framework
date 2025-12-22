/**
 * Health Schemas
 *
 * BROWSER-SAFE: This file imports ONLY from 'zod'.
 * Never import from @veloxts/* packages here.
 */

import { z } from 'zod';

// ============================================================================
// Health Check Schema
// ============================================================================

export const HealthResponse = z.object({
  status: z.literal('ok'),
  version: z.string(),
  timestamp: z.string().datetime(),
  uptime: z.number(),
});

export type HealthResponseData = z.infer<typeof HealthResponse>;
