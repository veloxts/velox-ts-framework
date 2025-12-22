/**
 * Health Check Procedures
 */

import { procedure, procedures, VELOX_VERSION } from '@veloxts/velox';

import { HealthResponse } from '../schemas/health.js';

export const healthProcedures = procedures('health', {
  getHealth: procedure()
    .rest({ method: 'GET', path: '/health' })
    .output(HealthResponse)
    .query(async () => ({
      status: 'ok' as const,
      version: VELOX_VERSION,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    })),
});
