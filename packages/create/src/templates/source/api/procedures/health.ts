/**
 * Health Check Procedures
 */

import { defineProcedures, procedure, VELOX_VERSION, z } from '@veloxts/velox';

export const healthProcedures = defineProcedures('health', {
  getHealth: procedure()
    .rest({ method: 'GET', path: '/health' })
    .output(
      z.object({
        status: z.literal('ok'),
        version: z.string(),
        timestamp: z.string().datetime(),
        uptime: z.number(),
      })
    )
    .query(async () => ({
      status: 'ok' as const,
      version: VELOX_VERSION,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    })),
});
