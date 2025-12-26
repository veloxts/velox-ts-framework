/**
 * Vinxi Application Configuration
 *
 * VeloxTS full-stack application with React Server Components.
 * All options have sensible defaults - only specify what you need to change.
 */

import { defineVeloxApp } from '@veloxts/web';

export default defineVeloxApp({
  port: __API_PORT__,
});
