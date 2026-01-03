/**
 * Vinxi Application Configuration
 *
 * VeloxTS full-stack application with React Server Components.
 * All options have sensible defaults - only specify what you need to change.
 */

import { createVeloxApp } from '@veloxts/web';

export default createVeloxApp({
  port: __API_PORT__,
});
