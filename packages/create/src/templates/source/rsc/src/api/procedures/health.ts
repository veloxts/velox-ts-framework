/**
 * Health Check Procedures
 *
 * API endpoints for application health monitoring.
 */

import { defineProcedures, procedure } from '@veloxts/router';

export const healthProcedures = defineProcedures('health', {
  /**
   * Basic health check
   * GET /api/health
   */
  getHealth: procedure()
    .rest({ method: 'GET', path: '/health' })
    .query(() => ({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    })),

  /**
   * Readiness check (includes database)
   * GET /api/health/ready
   */
  getReady: procedure()
    .rest({ method: 'GET', path: '/health/ready' })
    .query(async ({ ctx }) => {
      try {
        // Test database connection
        await ctx.db.$queryRaw`SELECT 1`;

        return {
          status: 'ready',
          database: 'connected',
          timestamp: new Date().toISOString(),
        };
      } catch {
        return {
          status: 'not_ready',
          database: 'disconnected',
          timestamp: new Date().toISOString(),
        };
      }
    }),
});
