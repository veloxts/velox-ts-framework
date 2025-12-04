/**
 * Health Check Procedures
 *
 * System health and status endpoints for monitoring.
 */

import { VELOX_VERSION } from '@veloxts/core';
import { defineProcedures, procedure } from '@veloxts/router';
import { z } from 'zod';

// ============================================================================
// Health Procedures
// ============================================================================

export const healthProcedures = defineProcedures('health', {
  /**
   * Basic health check
   *
   * Uses .rest() override because "getHealth" naming convention
   * would generate GET /health/:id instead of GET /health.
   *
   * REST: GET /health
   * tRPC: health.getHealth()
   */
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

  /**
   * Readiness check for load balancers
   *
   * Returns 200 when app is ready to accept traffic.
   * Could check database connectivity, cache availability, etc.
   *
   * REST: GET /ready
   */
  getReady: procedure()
    .rest({ method: 'GET', path: '/ready' })
    .output(
      z.object({
        ready: z.boolean(),
        checks: z.record(z.boolean()),
      })
    )
    .query(async ({ ctx }) => {
      // Check if database is connected
      const dbConnected = ctx.db !== undefined;

      return {
        ready: dbConnected,
        checks: {
          database: dbConnected,
        },
      };
    }),
});

export type HealthProcedures = typeof healthProcedures;
