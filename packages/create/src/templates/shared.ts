/**
 * Shared Template Constants
 *
 * Common constants used across all templates.
 */

import { createRequire } from 'node:module';

// Read version from package.json dynamically
const require = createRequire(import.meta.url);
const packageJson = require('../../package.json') as { version: string };

// ============================================================================
// Version Constant
// ============================================================================

/**
 * VeloxTS framework version for generated projects.
 * This is automatically updated during releases via changesets.
 */
export const VELOXTS_VERSION: string = packageJson.version ?? '0.0.0-unknown';
