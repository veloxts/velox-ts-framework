/**
 * @veloxts/web/client
 *
 * Browser-safe exports for VeloxTS client components.
 * This module can be safely imported in 'use client' components
 * without pulling in server dependencies.
 *
 * @example
 * ```tsx
 * 'use client';
 *
 * import { useAction, useFormAction } from '@veloxts/web/client';
 * import type { ActionResult } from '@veloxts/web/client';
 * ```
 *
 * @module @veloxts/web/client
 */

'use client';

// Hydration utilities
export {
  extractInitialData,
  getInitialData,
  type HydrateOptions,
  type HydrateResult,
  hydrate,
  hydrateRoot,
  showErrorOverlay,
} from '../rendering/client-hydrator.js';
// Browser-safe types (re-exported from types module)
export type {
  ActionError,
  ActionErrorCode,
  ActionResult,
  ActionSuccess,
} from '../types/actions.js';
// useAction hook
export type {
  UseActionOptions,
  UseActionReturn,
  UseActionState,
} from './use-action.js';
export { useAction } from './use-action.js';
// useFormAction hook
export type {
  InferFormActionOutput,
  UseFormActionOptions,
  UseFormActionReturn,
  UseFormActionState,
} from './use-form-action.js';
export { useFormAction } from './use-form-action.js';
