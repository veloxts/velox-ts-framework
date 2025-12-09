/**
 * Procedure Discovery Module
 *
 * Auto-scan and register procedures from the filesystem.
 *
 * @module discovery
 *
 * @example Basic usage
 * ```typescript
 * import { discoverProcedures, rest } from '@veloxts/router';
 *
 * const collections = await discoverProcedures('./src/procedures');
 * await app.register(rest(collections), { prefix: '/api' });
 * ```
 *
 * @example With options
 * ```typescript
 * const collections = await discoverProcedures('./src/procedures', {
 *   recursive: true,
 *   onInvalidExport: 'warn',
 * });
 * ```
 *
 * @example Verbose mode for tooling
 * ```typescript
 * const result = await discoverProceduresVerbose('./src/procedures');
 * console.log(`Found ${result.collections.length} collections`);
 * console.log(`Scanned ${result.scannedFiles.length} files`);
 * ```
 */

export {
  DiscoveryError,
  directoryNotFound,
  fileLoadError,
  invalidExport,
  invalidFileType,
  isDiscoveryError,
  noProceduresFound,
  permissionDenied,
} from './errors.js';
export { discoverProcedures, discoverProceduresVerbose } from './loader.js';
export type { DiscoveryOptions, DiscoveryResult, DiscoveryWarning } from './types.js';
export { DiscoveryErrorCode } from './types.js';
