/**
 * @veloxts/storage Testing Utilities
 *
 * This module exports testing utilities for storage providers.
 * Use these to test custom provider implementations or verify
 * third-party providers conform to the StorageStore interface.
 *
 * @example
 * ```typescript
 * import { runProviderTests } from '@veloxts/storage/testing';
 * import { createLocalStore } from '@veloxts/storage/drivers/local';
 *
 * runProviderTests('Local', () =>
 *   createLocalStore({ driver: 'local', root: '/tmp/test-storage' })
 * );
 * ```
 *
 * @packageDocumentation
 */

export { type ProviderTestOptions, runProviderTests } from './provider-compliance.js';
