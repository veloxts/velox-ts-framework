/**
 * Health Check Procedures
 *
 * API endpoints for application health monitoring.
 */

import { procedure, procedures } from '@veloxts/router';

import { db } from '../database.js';

export const healthProcedures = procedures('health', {
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
    .query(async () => {
      try {
        // Test database connection
        await db.$queryRaw`SELECT 1`;

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
