/**
 * Browser Error Handler
 *
 * This file is loaded when @veloxts/web/server is imported in a browser context.
 * It provides a clear error message to help developers fix their import.
 *
 * @module @veloxts/web/server (browser condition)
 */

throw new Error(
  '@veloxts/web/server cannot be imported in client components.\n\n' +
    'This module contains server-only code that cannot run in the browser.\n\n' +
    'Solutions:\n' +
    '1. Use @veloxts/web/client for browser-safe exports (hooks, types)\n' +
    '2. Move server imports to files with "use server" directive\n' +
    '3. Import from @veloxts/web/types for type-only imports\n\n' +
    'See: https://veloxts.dev/docs/web/server-client-separation'
);
